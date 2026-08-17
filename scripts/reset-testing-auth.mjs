/**
 * Borra las cuentas de Auth de los jefes de grupo, como paso final del
 * reinicio para pruebas (después de correr supabase/reset_testing.sql).
 *
 * Por qué hace falta un script aparte: `delete from public.groups` borra en
 * cascada el perfil (`public.profiles`) de cada jefe de grupo, pero NO borra
 * su cuenta en `auth.users` — esa tabla la administra Supabase Auth y solo se
 * puede tocar con la Service Role Key a través de `auth.admin.deleteUser`.
 *
 * Se identifica a los "huérfanos" como todo usuario de auth.users que ya NO
 * tiene fila en public.profiles (admin y árbitros sí la conservan, porque el
 * SQL de reset no los toca). Así el script no necesita saber de antemano
 * quién era jefe de grupo: simplemente confía en que el SQL ya se ejecutó.
 *
 * Uso:
 *   node scripts/reset-testing-auth.mjs           → dry-run, solo lista
 *   node scripts/reset-testing-auth.mjs --confirm → borra de verdad
 *
 * Necesita SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL en .env.local.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = await readFile(join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^["']|["']$/g, '');
      }
    } catch {
      // El archivo puede no existir; las variables pueden venir del entorno.
    }
  }
}

await loadEnv();

const confirmed = process.argv.includes('--confirm');

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en tu .env.local.');
  process.exit(1);
}

const url = new URL(rawUrl.trim().replace(/^["']|["']$/g, '')).origin;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Todos los perfiles que SÍ deben sobrevivir (admin + árbitros).
const { data: profiles, error: profilesError } = await supabase
  .from('profiles')
  .select('id, role, email');

if (profilesError) {
  console.error(`No se pudo leer public.profiles: ${profilesError.message}`);
  process.exit(1);
}

const keepIds = new Set((profiles ?? []).map((p) => p.id));
console.log(
  `Perfiles que se conservan: ${profiles?.length ?? 0} ` +
    `(${(profiles ?? []).filter((p) => p.role === 'admin').length} admin, ` +
    `${(profiles ?? []).filter((p) => p.role !== 'admin').length} árbitros/otros).`,
);

// 2. Todas las cuentas de auth.users, paginando por si hay más de 1000.
const allUsers = [];
let page = 1;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.error(`No se pudo listar auth.users: ${error.message}`);
    process.exit(1);
  }
  allUsers.push(...data.users);
  if (data.users.length < 1000) break;
  page += 1;
}

const orphans = allUsers.filter((u) => !keepIds.has(u.id));

if (orphans.length === 0) {
  console.log('No hay cuentas huérfanas que borrar. Nada que hacer.');
  process.exit(0);
}

console.log(`\nCuentas de auth.users SIN perfil (candidatas a borrar): ${orphans.length}`);
for (const u of orphans) {
  console.log(`  · ${u.email ?? '(sin correo)'}  [${u.id}]`);
}

if (!confirmed) {
  console.log(
    '\nEsto fue un dry-run. Revisa la lista de arriba y, si es correcta, ' +
      'vuelve a correr con --confirm para borrarlas de verdad:\n' +
      '  node scripts/reset-testing-auth.mjs --confirm',
  );
  process.exit(0);
}

console.log('\nBorrando...');
let ok = 0;
let failed = 0;
for (const u of orphans) {
  const { error } = await supabase.auth.admin.deleteUser(u.id);
  if (error) {
    failed += 1;
    console.error(`  ✗ ${u.email ?? u.id}: ${error.message}`);
  } else {
    ok += 1;
  }
}

console.log(`\n✔ ${ok} cuenta(s) borrada(s). ${failed > 0 ? `✗ ${failed} fallaron.` : ''}`);
