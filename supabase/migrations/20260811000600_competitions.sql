-- ============================================================================
-- Olimpiadas Scouts · Competencias, arbitraje y resultados
-- ============================================================================
-- El prototipo V4 agrega un bloque entero que la primera versión del sistema no
-- contemplaba: un tercer rol (árbitro), la programación de partidos y sesiones,
-- el registro de resultados y un portal público donde cualquiera los consulta
-- sin iniciar sesión.
--
-- Además corrige dos cosas del modelo anterior:
--   · Las ramas pasan de cuatro genéricas a las siete reales del movimiento,
--     cada una con su rango de edad, que ahora se valida.
--   · Una alianza entre grupos debe pasar por administración ANTES de que el
--     equipo pueda pagar. Antes bastaba con que el grupo aliado aceptara.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ─────────────────────────────────────────────────────────────────────────────

-- `alter type ... add value` no permite usar el valor nuevo dentro de la misma
-- transacción, y estas migraciones corren en una sola. Recrear el tipo es más
-- verboso pero determinista.

alter type public.user_role rename to user_role_v1;
create type public.user_role as enum ('admin', 'group', 'referee');

-- La función declara el tipo por OID: al renombrarlo seguiría devolviendo el
-- viejo, así que hay que rehacerla.
drop function if exists public.current_user_role();

-- La restricción compara `role` con literales del tipo viejo. Si sigue viva
-- mientras se cambia el tipo de la columna, Postgres intenta evaluarla como
-- `user_role = user_role_v1` y falla. Se rehace más abajo, ya con el rol nuevo.
alter table public.profiles drop constraint if exists profiles_group_consistency;

alter table public.profiles alter column role drop default;
alter table public.profiles
  alter column role type public.user_role using role::text::public.user_role;
alter table public.profiles alter column role set default 'group';
drop type public.user_role_v1;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_referee()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'referee' from public.profiles where id = auth.uid()), false);
$$;

-- Un árbitro no pertenece a ningún grupo, igual que el administrador.
alter table public.profiles add constraint profiles_group_consistency check (
  (role in ('admin', 'referee') and group_id is null)
  or (role = 'group' and group_id is not null)
);

-- Estados nuevos del circuito intergrupal: aceptar ya no basta, administración
-- revisa a los participantes externos antes de habilitar el pago.
alter type public.intergroup_status rename to intergroup_status_v1;
create type public.intergroup_status as enum (
  'pending',         -- esperando respuesta del grupo aliado
  'proposed',        -- el aliado propuso participantes
  'accepted',        -- el solicitante aceptó la propuesta
  'admin_review',    -- esperando el visto bueno de administración
  'admin_approved',  -- externos verificados: el equipo ya puede pagar
  'admin_rejected',  -- administración los rechazó y salieron del equipo
  'rejected',        -- rechazada por alguno de los dos grupos
  'cancelled'        -- retirada por quien la creó
);
-- `participants_read` filtra por el estado de la solicitud para dejar que los
-- dos grupos se vean mientras dura la alianza. Postgres no permite cambiar el
-- tipo de una columna usada en una política, así que se rehace enseguida.
drop policy if exists participants_read on public.participants;

alter table public.intergroup_requests alter column status drop default;
alter table public.intergroup_requests
  alter column status type public.intergroup_status using status::text::public.intergroup_status;
alter table public.intergroup_requests alter column status set default 'pending';
drop type public.intergroup_status_v1;

-- Misma regla que antes, más los estados de revisión administrativa: si el
-- grupo aliado dejara de ver a sus prestados en cuanto se acepta la propuesta,
-- no podría seguir el trámite hasta la aprobación.
create policy participants_read on public.participants
  for select to authenticated
  using (
    public.is_admin()
    or group_id = public.current_group_id()
    or exists (
      select 1 from public.intergroup_requests r
      where r.status in ('pending', 'proposed', 'accepted', 'admin_review', 'admin_approved')
        and (
          (r.target_group_id = participants.group_id and r.requester_group_id = public.current_group_id())
          or (r.requester_group_id = participants.group_id and r.target_group_id = public.current_group_id())
        )
    )
  );

create type public.schedule_type as enum ('match', 'session');

create type public.schedule_status as enum ('scheduled', 'in_progress', 'finished', 'cancelled');

-- En unos deportes gana la marca más alta (goles, puntos) y en otros la más
-- baja (tiempos). Sin esto, el podio de atletismo saldría al revés.
create type public.result_order as enum ('asc', 'desc');

-- ─────────────────────────────────────────────────────────────────────────────
-- Ramas reales del movimiento, con rango de edad
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.branches add column if not exists min_age     integer;
alter table public.branches add column if not exists max_age     integer;
alter table public.branches add column if not exists description text not null default '';

insert into public.branches (id, name, sort_order, min_age, max_age, description) values
  ('cachorros', 'Cachorros',              1,  5,  6, 'Niños y niñas entre los 5 y los 6 años.'),
  ('lobatos',   'Lobatos',                2,  7, 10, 'Niños y niñas entre los 7 y los 10 años.'),
  ('webelos',   'Webelos',                3, 10, 11, 'Niños y niñas entre los 10 y los 11 años.'),
  ('scouts',    'Scouts',                 4, 11, 14, 'Jóvenes entre los 11 y los 14 años.'),
  ('nomadas',   'Nómadas Scout',          5, 15, 17, 'Jóvenes entre los 15 y los 17 años.'),
  ('rovers',    'Rovers',                 6, 18, 20, 'Jóvenes adultos entre los 18 y los 20 años.'),
  ('adultos',   'Consejeros y Dirigentes',7, 21, 99, 'Consejeros y dirigentes de 21 años en adelante.')
on conflict (id) do update
  set name        = excluded.name,
      sort_order  = excluded.sort_order,
      min_age     = excluded.min_age,
      max_age     = excluded.max_age,
      description = excluded.description;

-- Equivalencias con las cuatro ramas genéricas de la versión anterior. El mapeo
-- es inyectivo, así que ninguna actualización choca con la clave única de
-- `sport_branches`.
do $$
declare
  v_map constant jsonb := jsonb_build_object(
    'manada',     'lobatos',
    'tropa',      'scouts',
    'caminantes', 'nomadas'
  );
  v_old text;
  v_new text;
begin
  for v_old, v_new in select key, value #>> '{}' from jsonb_each(v_map) loop
    if exists (select 1 from public.branches where id = v_old) then
      update public.participants   set branch_id = v_new where branch_id = v_old;

      -- Un deporte podría tener ya la rama destino: en ese caso basta con
      -- borrar la vieja en lugar de reasignarla.
      delete from public.sport_branches sb
       where sb.branch_id = v_old
         and exists (select 1 from public.sport_branches x
                      where x.sport_id = sb.sport_id and x.branch_id = v_new);
      update public.sport_branches set branch_id = v_new where branch_id = v_old;

      delete from public.branches where id = v_old;
    end if;
  end loop;
end;
$$;

alter table public.branches alter column min_age set not null;
alter table public.branches alter column max_age set not null;
alter table public.branches add constraint branches_age_range check (
  min_age between 0 and 120 and max_age between min_age and 120
);

-- La edad debe corresponder a la rama. Vivía solo en el navegador del mock.
create or replace function public.tg_participant_branch_age()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_branch public.branches%rowtype;
  v_age    integer;
begin
  select * into v_branch from public.branches where id = new.branch_id;

  if not found then
    raise exception 'La rama indicada no existe.' using errcode = 'foreign_key_violation';
  end if;

  -- Edad cumplida al día de hoy, igual que `ageOf()` en el prototipo.
  v_age := extract(year from age(current_date, new.birthdate));

  if v_age < v_branch.min_age or v_age > v_branch.max_age then
    raise exception
      'La rama % admite de % a % años, y % tiene % .',
      v_branch.name, v_branch.min_age, v_branch.max_age, new.first_names, v_age
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists participants_branch_age on public.participants;
create trigger participants_branch_age
  before insert or update of birthdate, branch_id on public.participants
  for each row execute function public.tg_participant_branch_age();

-- ─────────────────────────────────────────────────────────────────────────────
-- Parámetros de competencia por deporte
-- ─────────────────────────────────────────────────────────────────────────────

-- Cuántas personas entran en una sesión de un deporte individual: define en
-- cuántas tandas se reparte la inscripción al generar la programación.
alter table public.sports add column if not exists session_capacity integer not null default 8
  check (session_capacity >= 1);

-- Cómo se llama el resultado en este deporte: «Goles», «Tiempo», «Puntos».
alter table public.sports add column if not exists result_label text not null default 'Resultado';

alter table public.sports add column if not exists result_order public.result_order not null default 'desc';

-- ─────────────────────────────────────────────────────────────────────────────
-- Árbitros
-- ─────────────────────────────────────────────────────────────────────────────

-- El árbitro es un perfil más: la cuenta la crea el administrador y el sistema
-- le envía la contraseña, igual que con los grupos. Esta tabla solo guarda lo
-- que es propio del arbitraje.
create table public.referees (
  id         uuid        primary key references public.profiles (id) on delete cascade,
  phone      text        not null default '',
  notes      text        not null default '',
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deportes que puede dirigir. Restringe a quién ofrece el selector al programar.
create table public.referee_sports (
  referee_id uuid not null references public.referees (id) on delete cascade,
  sport_id   uuid not null references public.sports (id)   on delete cascade,
  primary key (referee_id, sport_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Programación de competencias
-- ─────────────────────────────────────────────────────────────────────────────

create table public.schedules (
  id          uuid        primary key default gen_random_uuid(),
  sport_id    uuid        not null references public.sports (id)   on delete cascade,
  branch_id   text        not null references public.branches (id),
  type        public.schedule_type not null,
  label       text        not null default '',
  starts_on   date        not null,
  starts_at   time        not null,
  venue       text        not null default '',
  -- Si el árbitro se da de baja, la competencia queda sin asignar en lugar de
  -- desaparecer del calendario.
  referee_id  uuid        references public.referees (id) on delete set null,
  team_a_id   uuid        references public.teams (id) on delete cascade,
  team_b_id   uuid        references public.teams (id) on delete cascade,
  status      public.schedule_status not null default 'scheduled',

  -- Resultado de un partido. Se guarda aquí y no en otra tabla porque es un
  -- par de números que solo existe una vez por competencia.
  score_a     integer     check (score_a is null or score_a >= 0),
  score_b     integer     check (score_b is null or score_b >= 0),
  result_notes text       not null default '',

  -- Un resultado se guarda como borrador y solo al publicarlo se hace visible
  -- en el portal público.
  result_published    boolean not null default false,
  result_entered_by   uuid    references public.profiles (id) on delete set null,
  result_updated_at   timestamptz,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Un partido enfrenta a dos equipos distintos; una sesión no tiene equipos.
  constraint schedules_shape check (
    (type = 'match'   and team_a_id is not null and team_b_id is not null and team_a_id <> team_b_id)
    or
    (type = 'session' and team_a_id is null and team_b_id is null)
  ),
  -- Solo se publica lo que tiene resultado: en un partido, ambos marcadores.
  constraint schedules_published_has_result check (
    not result_published
    or type = 'session'
    or (score_a is not null and score_b is not null)
  )
);

create index schedules_sport_branch_idx on public.schedules (sport_id, branch_id);
create index schedules_referee_idx      on public.schedules (referee_id);
create index schedules_calendar_idx     on public.schedules (starts_on, starts_at);
create index schedules_published_idx    on public.schedules (result_published) where result_published;

-- Participantes citados a una sesión individual, con su marca.
create table public.schedule_participants (
  schedule_id    uuid    not null references public.schedules (id)    on delete cascade,
  participant_id uuid    not null references public.participants (id) on delete cascade,
  -- NULL mientras el árbitro no registre nada. `numeric` para admitir tiempos
  -- con decimales (12.47 segundos) y puntajes enteros con el mismo campo.
  value          numeric(12, 3),
  disqualified   boolean not null default false,
  -- Puesto dentro de la sesión, calculado al publicar según `result_order`.
  rank           integer check (rank is null or rank >= 1),
  primary key (schedule_id, participant_id)
);

create index schedule_participants_participant_idx
  on public.schedule_participants (participant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Revisión administrativa de las alianzas
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.intergroup_requests
  add column if not exists admin_note        text not null default '',
  add column if not exists admin_reviewed_at timestamptz,
  add column if not exists admin_reviewed_by uuid references public.profiles (id) on delete set null;

-- Mismo disparador de `updated_at` que ya usan las demás tablas.
create trigger referees_set_updated_at
  before update on public.referees
  for each row execute function public.tg_set_updated_at();

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function public.tg_set_updated_at();
