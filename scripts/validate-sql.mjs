/**
 * Valida las migraciones y el seed contra un Postgres real (PGlite, en WASM).
 *
 * No sustituye a `supabase db reset` sobre el proyecto real, pero detecta
 * errores de sintaxis, restricciones mal escritas y funciones que no compilan,
 * sin necesidad de una base de datos remota.
 *
 * Uso: node scripts/validate-sql.mjs
 */
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// PGlite no trae los esquemas que Supabase provee de fábrica. Los emulamos con
// lo mínimo que las migraciones necesitan para compilar.
const SUPABASE_STUBS = `
create schema if not exists auth;
create schema if not exists storage;

-- PGlite no incluye contribs. gen_random_uuid() es núcleo desde PG13, así que
-- pgcrypto solo hace falta en el servidor real. citext se emula con un dominio:
-- basta para validar estructura, tipos y restricciones.
create domain citext as text;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text
);

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

do $$ begin
  create role authenticated;
exception when duplicate_object then null; end $$;
`;

// Las extensiones las provee el servidor real de Supabase; aquí estorban.
function stripExtensions(sql) {
  return sql.replace(/^\s*create\s+extension[^;]*;/gim, '');
}

function fail(label, error, sql) {
  const position = Number(error.position ?? 0);
  let context = '';
  if (position > 0 && sql) {
    const start = Math.max(0, position - 220);
    context = `\n  ...${sql.slice(start, position + 120).replace(/\n/g, '\n  ')}`;
  }
  console.error(`\n✖ ${label}\n  ${error.message}${context}\n`);
  process.exitCode = 1;
}

process.on('uncaughtException', (e) => {
  console.error(`\n✖ Error no controlado: ${e.message}\n`);
  process.exit(1);
});

const db = await new PGlite();
await db.exec(SUPABASE_STUBS);

const migrationsDir = join(root, 'supabase', 'migrations');
const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

let ok = 0;
for (const file of files) {
  const sql = stripExtensions(await readFile(join(migrationsDir, file), 'utf8'));
  try {
    await db.exec(sql);
    console.log(`✔ ${file}`);
    ok += 1;
  } catch (error) {
    fail(file, error, sql);
  }
}

const seed = stripExtensions(await readFile(join(root, 'supabase', 'seed.sql'), 'utf8'));
try {
  await db.exec(seed);
  console.log('✔ seed.sql');
  ok += 1;
} catch (error) {
  fail('seed.sql', error, seed);
}

// Comprobaciones de contenido: que el seed haya dejado lo que promete.
const checks = [
  ['países', 'select count(*)::int as n from public.countries', (n) => n >= 190],
  ['ramas', 'select count(*)::int as n from public.branches', (n) => n === 7],
  ['deportes', 'select count(*)::int as n from public.sports', (n) => n === 5],
  ['ramas por deporte', 'select count(*)::int as n from public.sport_branches', (n) => n === 22],
  ['configuración', 'select count(*)::int as n from public.settings', (n) => n === 1],
  // Toda rama debe traer su rango de edad: sin él, la validación de edad al
  // inscribir participantes no tendría contra qué comparar.
  [
    'ramas con edad',
    'select count(*)::int as n from public.branches where min_age is null or max_age is null',
    (n) => n === 0,
  ],
];

for (const [label, sql, assert] of checks) {
  const result = await db.query(sql);
  const n = result.rows[0]?.n ?? 0;
  if (assert(n)) {
    console.log(`✔ ${label}: ${n}`);
  } else {
    console.error(`✖ ${label}: valor inesperado (${n})`);
    process.exitCode = 1;
  }
}

// El seed debe poder ejecutarse dos veces sin romper nada.
try {
  await db.exec(seed);
  console.log('✔ seed.sql es idempotente');
} catch (error) {
  fail('seed.sql (segunda ejecución)', error, seed);
}

await db.close();

if (process.exitCode) {
  console.error(`\n${files.length + 1 - ok} archivo(s) con errores.`);
} else {
  console.log(`\n${ok} archivo(s) SQL validados correctamente.`);
}
