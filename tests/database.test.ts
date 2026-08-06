import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Pruebas de las reglas que viven en Postgres.
 *
 * Se ejecutan contra PGlite, un Postgres real compilado a WebAssembly, así que
 * los disparadores y las restricciones se comprueban de verdad, sin necesidad
 * de una base de datos remota. Lo único emulado son los esquemas `auth` y
 * `storage` que Supabase provee de fábrica.
 */

const ROOT = join(import.meta.dirname, '..');

const STUBS = `
create schema if not exists auth;
create schema if not exists storage;
create domain citext as text;

create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);

create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
`;

let db: PGlite;

/** Los identificadores del seed cambian en cada corrida: se leen al vuelo. */
async function idOf(table: string, column: string, value: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `select id from public.${table} where ${column} = $1`,
    [value],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`No se encontró ${table}.${column} = ${value}`);
  return id;
}

async function newGroup(name: string, email: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.groups (name, city, leader_name, leader_email, status)
     values ($1, 'Medellín', 'Responsable Prueba', $2, 'approved') returning id`,
    [name, email],
  );
  return result.rows[0]!.id;
}

async function newParticipant(
  groupId: string,
  document: string,
  branch = 'tropa',
  active = true,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.participants
       (group_id, doc_type, document, first_names, last_names, birthdate, branch_id, active)
     values ($1, 'TI', $2, 'Nombre', 'Apellido', '2010-05-20', $3, $4) returning id`,
    [groupId, document, branch, active],
  );
  return result.rows[0]!.id;
}

beforeAll(async () => {
  db = await new PGlite();
  await db.exec(STUBS);

  const dir = join(ROOT, 'supabase', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = (await readFile(join(dir, file), 'utf8')).replace(
      /^\s*create\s+extension[^;]*;/gim,
      '',
    );
    await db.exec(sql);
  }

  const seed = (await readFile(join(ROOT, 'supabase', 'seed.sql'), 'utf8')).replace(
    /^\s*create\s+extension[^;]*;/gim,
    '',
  );
  await db.exec(seed);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('esquema y seed', () => {
  it('carga el catálogo completo de países', async () => {
    const result = await db.query<{ n: number }>('select count(*)::int as n from public.countries');
    expect(result.rows[0]?.n).toBeGreaterThanOrEqual(190);
  });

  it('mantiene una sola fila de configuración', async () => {
    await expect(
      db.exec('insert into public.settings (id) values (true)'),
    ).rejects.toThrow();
  });
});

describe('grupos', () => {
  it('asigna el código GS-00X al aprobar', async () => {
    const id = await newGroup('Grupo Código', 'codigo@ejemplo.com');
    const result = await db.query<{ code: string }>(
      'select code from public.groups where id = $1',
      [id],
    );
    expect(result.rows[0]?.code).toMatch(/^GS-\d{3}$/);
  });

  it('exige un motivo al rechazar', async () => {
    await expect(
      db.exec(`insert into public.groups (name, leader_name, leader_email, status)
               values ('Sin Motivo', 'Alguien', 'sinmotivo@ejemplo.com', 'rejected')`),
    ).rejects.toThrow();
  });

  it('no permite que dos grupos escojan el mismo país', async () => {
    const a = await newGroup('País A', 'paisa@ejemplo.com');
    const b = await newGroup('País B', 'paisb@ejemplo.com');

    await db.query(`update public.groups set country_code = 'AR' where id = $1`, [a]);
    await expect(
      db.query(`update public.groups set country_code = 'AR' where id = $1`, [b]),
    ).rejects.toThrow();
  });

  it('no acepta dos grupos con el mismo correo de responsable', async () => {
    await newGroup('Correo Uno', 'repetido@ejemplo.com');
    await expect(newGroup('Correo Dos', 'repetido@ejemplo.com')).rejects.toThrow();
  });
});

describe('participantes', () => {
  it('el documento es único por tipo, no de forma global', async () => {
    const group = await newGroup('Documentos', 'documentos@ejemplo.com');
    await newParticipant(group, '5551234');

    // Mismo número con otro tipo: son personas distintas y debe permitirse.
    await expect(
      db.query(
        `insert into public.participants
           (group_id, doc_type, document, first_names, last_names, birthdate, branch_id)
         values ($1, 'CC', '5551234', 'Otra', 'Persona', '1990-01-01', 'tropa')`,
        [group],
      ),
    ).resolves.toBeDefined();

    // Mismo número y mismo tipo: es un duplicado real.
    await expect(newParticipant(group, '5551234')).rejects.toThrow();
  });

  it('calcula el nombre completo automáticamente', async () => {
    const group = await newGroup('Nombre Completo', 'nombre@ejemplo.com');
    const id = await newParticipant(group, '7770001');
    const result = await db.query<{ full_name: string }>(
      'select full_name from public.participants where id = $1',
      [id],
    );
    expect(result.rows[0]?.full_name).toBe('Nombre Apellido');
  });

  it('rechaza una fecha de nacimiento futura', async () => {
    const group = await newGroup('Fecha Futura', 'futura@ejemplo.com');
    await expect(
      db.query(
        `insert into public.participants
           (group_id, doc_type, document, first_names, last_names, birthdate, branch_id)
         values ($1, 'TI', '8880001', 'Futuro', 'Bebé', '2099-01-01', 'tropa')`,
        [group],
      ),
    ).rejects.toThrow();
  });
});

describe('equipos', () => {
  it('no admite más titulares que el tamaño del deporte', async () => {
    const sport = await idOf('sports', 'slug', 'futbol'); // 5 titulares
    const group = await newGroup('Exceso Titulares', 'exceso@ejemplo.com');

    const team = await db.query<{ id: string }>(
      `insert into public.teams (owner_group_id, sport_id, name)
       values ($1, $2, 'Equipo Exceso') returning id`,
      [group, sport],
    );
    const teamId = team.rows[0]!.id;

    for (let index = 0; index < 5; index += 1) {
      const participant = await newParticipant(group, `600000${index}`);
      await db.query(
        `insert into public.team_members (team_id, participant_id, role)
         values ($1, $2, 'starter')`,
        [teamId, participant],
      );
    }

    const extra = await newParticipant(group, '6000099');
    await expect(
      db.query(
        `insert into public.team_members (team_id, participant_id, role)
         values ($1, $2, 'starter')`,
        [teamId, extra],
      ),
    ).rejects.toThrow(/titular/i);
  });

  it('rechaza a un participante de una rama no habilitada', async () => {
    // Voleibol solo admite caminantes y rovers.
    const sport = await idOf('sports', 'slug', 'voleibol');
    const group = await newGroup('Rama Incorrecta', 'rama@ejemplo.com');

    const team = await db.query<{ id: string }>(
      `insert into public.teams (owner_group_id, sport_id, name)
       values ($1, $2, 'Equipo Rama') returning id`,
      [group, sport],
    );

    const participant = await newParticipant(group, '6100001', 'manada');
    await expect(
      db.query(
        `insert into public.team_members (team_id, participant_id, role) values ($1, $2, 'starter')`,
        [team.rows[0]!.id, participant],
      ),
    ).rejects.toThrow(/rama/i);
  });

  it('rechaza a un participante inactivo', async () => {
    const sport = await idOf('sports', 'slug', 'futbol');
    const group = await newGroup('Inactivo', 'inactivo@ejemplo.com');

    const team = await db.query<{ id: string }>(
      `insert into public.teams (owner_group_id, sport_id, name)
       values ($1, $2, 'Equipo Inactivo') returning id`,
      [group, sport],
    );

    const participant = await newParticipant(group, '6200001', 'tropa', false);
    await expect(
      db.query(
        `insert into public.team_members (team_id, participant_id, role) values ($1, $2, 'starter')`,
        [team.rows[0]!.id, participant],
      ),
    ).rejects.toThrow(/inactivo/i);
  });

  it('respeta el máximo de equipos por grupo', async () => {
    // Voleibol permite un solo equipo por grupo.
    const sport = await idOf('sports', 'slug', 'voleibol');
    const group = await newGroup('Máx Equipos', 'maxequipos@ejemplo.com');

    await db.query(
      `insert into public.teams (owner_group_id, sport_id, name) values ($1, $2, 'Voley Uno')`,
      [group, sport],
    );
    await expect(
      db.query(
        `insert into public.teams (owner_group_id, sport_id, name) values ($1, $2, 'Voley Dos')`,
        [group, sport],
      ),
    ).rejects.toThrow(/máximo/i);
  });

  it('impide inscribir un deporte individual como equipo', async () => {
    const sport = await idOf('sports', 'slug', 'ajedrez');
    const group = await newGroup('Individual Como Equipo', 'indeq@ejemplo.com');

    await expect(
      db.query(
        `insert into public.teams (owner_group_id, sport_id, name) values ($1, $2, 'No Válido')`,
        [group, sport],
      ),
    ).rejects.toThrow(/individual/i);
  });
});

describe('inscripciones individuales', () => {
  it('recalcula el valor al agregar y quitar participantes', async () => {
    const sport = await idOf('sports', 'slug', 'ajedrez'); // hereda $5.000
    const group = await newGroup('Recalculo', 'recalculo@ejemplo.com');

    const registration = await db.query<{ id: string }>(
      `insert into public.individual_registrations (group_id, sport_id) values ($1, $2) returning id`,
      [group, sport],
    );
    const registrationId = registration.rows[0]!.id;

    const first = await newParticipant(group, '7100001');
    const second = await newParticipant(group, '7100002');

    await db.query(
      `insert into public.individual_registration_participants (registration_id, participant_id)
       values ($1, $2), ($1, $3)`,
      [registrationId, first, second],
    );

    let amount = await db.query<{ amount: string }>(
      'select amount from public.individual_registrations where id = $1',
      [registrationId],
    );
    expect(Number(amount.rows[0]?.amount)).toBe(10000);

    await db.query(
      `delete from public.individual_registration_participants
       where registration_id = $1 and participant_id = $2`,
      [registrationId, second],
    );

    amount = await db.query<{ amount: string }>(
      'select amount from public.individual_registrations where id = $1',
      [registrationId],
    );
    expect(Number(amount.rows[0]?.amount)).toBe(5000);
  });

  it('no deja inscribir a alguien de otro grupo', async () => {
    const sport = await idOf('sports', 'slug', 'ajedrez');
    const mine = await newGroup('Propio', 'propio@ejemplo.com');
    const other = await newGroup('Ajeno', 'ajeno@ejemplo.com');

    const registration = await db.query<{ id: string }>(
      `insert into public.individual_registrations (group_id, sport_id) values ($1, $2) returning id`,
      [mine, sport],
    );
    const foreign = await newParticipant(other, '7200001');

    await expect(
      db.query(
        `insert into public.individual_registration_participants (registration_id, participant_id)
         values ($1, $2)`,
        [registration.rows[0]!.id, foreign],
      ),
    ).rejects.toThrow(/propio grupo/i);
  });

  it('permite una sola inscripción por grupo y deporte', async () => {
    const sport = await idOf('sports', 'slug', 'atletismo-100m');
    const group = await newGroup('Duplicada', 'duplicada@ejemplo.com');

    await db.query(
      `insert into public.individual_registrations (group_id, sport_id) values ($1, $2)`,
      [group, sport],
    );
    await expect(
      db.query(
        `insert into public.individual_registrations (group_id, sport_id) values ($1, $2)`,
        [group, sport],
      ),
    ).rejects.toThrow();
  });
});

describe('stands', () => {
  it('permite un solo stand por grupo', async () => {
    const group = await newGroup('Stand Único', 'standunico@ejemplo.com');

    await db.query(
      `insert into public.stands (group_id, name, responsible) values ($1, 'Primero', 'Ana')`,
      [group],
    );
    await expect(
      db.query(
        `insert into public.stands (group_id, name, responsible) values ($1, 'Segundo', 'Ana')`,
        [group],
      ),
    ).rejects.toThrow();
  });

  it('toma el valor vigente de la configuración al crearse', async () => {
    const group = await newGroup('Stand Valor', 'standvalor@ejemplo.com');
    const result = await db.query<{ amount: string }>(
      `insert into public.stands (group_id, name, responsible)
       values ($1, 'Con Valor', 'Ana') returning amount`,
      [group],
    );
    expect(Number(result.rows[0]?.amount)).toBe(50000);
  });

  /**
   * En el prototipo el cupo solo se comprobaba contra stands aprobados, así que
   * podían registrarse solicitudes sin límite y sobrevender el espacio.
   */
  it('respeta el cupo contando también los pagos en curso', async () => {
    await db.exec('update public.settings set stand_limit = 1');

    const first = await newGroup('Cupo Uno', 'cupo1@ejemplo.com');
    const second = await newGroup('Cupo Dos', 'cupo2@ejemplo.com');

    await db.query(
      `insert into public.stands (group_id, name, responsible, status)
       values ($1, 'Ocupa Cupo', 'Ana', 'payment_pending')`,
      [first],
    );

    await expect(
      db.query(
        `insert into public.stands (group_id, name, responsible, status)
         values ($1, 'Sin Cupo', 'Luis', 'payment_pending')`,
        [second],
      ),
    ).rejects.toThrow(/cupos/i);

    await db.exec('update public.settings set stand_limit = 30');
  });
});

describe('pagos', () => {
  it('no admite dos pagos con la misma referencia', async () => {
    const group = await newGroup('Referencia', 'referencia@ejemplo.com');
    const stand = await db.query<{ id: string }>(
      `insert into public.stands (group_id, name, responsible)
       values ($1, 'Stand Ref', 'Ana') returning id`,
      [group],
    );

    const insertPayment = (reference: string) =>
      db.query(
        `insert into public.payments
           (group_id, payable_type, payable_id, concept, expected_amount, reported_amount,
            payment_date, payer_name, reference, proof_path)
         values ($1, 'stand', $2, 'Stand', 50000, 50000, current_date, 'Ana Ruiz', $3, 'x/y.pdf')`,
        [group, stand.rows[0]!.id, reference],
      );

    await insertPayment('REF-001');
    await expect(insertPayment('REF-001')).rejects.toThrow();
  });

  it('exige observación al rechazar o pedir corrección', async () => {
    const group = await newGroup('Nota Obligatoria', 'nota@ejemplo.com');
    const stand = await db.query<{ id: string }>(
      `insert into public.stands (group_id, name, responsible)
       values ($1, 'Stand Nota', 'Ana') returning id`,
      [group],
    );

    await expect(
      db.query(
        `insert into public.payments
           (group_id, payable_type, payable_id, concept, expected_amount, reported_amount,
            payment_date, payer_name, reference, proof_path, status, admin_note)
         values ($1, 'stand', $2, 'Stand', 50000, 50000, current_date, 'Ana Ruiz',
                 'REF-SIN-NOTA', 'x/y.pdf', 'rejected', '')`,
        [group, stand.rows[0]!.id],
      ),
    ).rejects.toThrow();
  });

  it('permite un solo pago vivo por concepto', async () => {
    const group = await newGroup('Pago Vivo', 'pagovivo@ejemplo.com');
    const stand = await db.query<{ id: string }>(
      `insert into public.stands (group_id, name, responsible)
       values ($1, 'Stand Vivo', 'Ana') returning id`,
      [group],
    );
    const standId = stand.rows[0]!.id;

    const insertPayment = (reference: string) =>
      db.query(
        `insert into public.payments
           (group_id, payable_type, payable_id, concept, expected_amount, reported_amount,
            payment_date, payer_name, reference, proof_path)
         values ($1, 'stand', $2, 'Stand', 50000, 50000, current_date, 'Ana Ruiz', $3, 'x/y.pdf')`,
        [group, standId, reference],
      );

    await insertPayment('REF-VIVO-1');
    await expect(insertPayment('REF-VIVO-2')).rejects.toThrow();
  });
});

describe('tarifas', () => {
  it('sport_effective_fee hereda la tarifa general cuando el deporte no tiene propia', async () => {
    const sport = await idOf('sports', 'slug', 'ajedrez');
    const result = await db.query<{ fee: string }>(
      'select public.sport_effective_fee($1) as fee',
      [sport],
    );
    expect(Number(result.rows[0]?.fee)).toBe(5000);
  });

  it('respeta una tarifa propia de 0 en lugar de heredar', async () => {
    const sport = await idOf('sports', 'slug', 'ajedrez');
    await db.query('update public.sports set fee = 0 where id = $1', [sport]);

    const result = await db.query<{ fee: string }>(
      'select public.sport_effective_fee($1) as fee',
      [sport],
    );
    expect(Number(result.rows[0]?.fee)).toBe(0);

    await db.query('update public.sports set fee = null where id = $1', [sport]);
  });
});
