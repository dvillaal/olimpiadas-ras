-- ============================================================================
-- Olimpiadas Scouts · Esquema base
-- ============================================================================
-- Reemplaza el almacenamiento en localStorage del prototipo por un modelo
-- relacional normalizado en Postgres. Cada regla de negocio que en el mock
-- vivía en JavaScript queda aquí como restricción, índice o disparador.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─────────────────────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ─────────────────────────────────────────────────────────────────────────────

create type public.user_role as enum ('admin', 'group');

create type public.group_status as enum ('pending', 'approved', 'rejected', 'suspended');

create type public.sport_type as enum ('individual', 'group');

-- Ciclo de vida de una inscripción (equipo, inscripción individual o stand).
create type public.registration_status as enum (
  'draft',            -- borrador editable por el grupo
  'payment_pending',  -- pago registrado, esperando revisión
  'correction',       -- el administrador pidió corregir algo
  'rejected',         -- rechazada
  'confirmed',        -- aprobada y en firme
  'cancelled'         -- anulada por el grupo o el administrador
);

create type public.payment_status as enum ('sent', 'correction', 'rejected', 'approved');

create type public.payable_type as enum ('team', 'individual', 'stand');

create type public.team_member_role as enum ('starter', 'substitute');

create type public.intergroup_status as enum ('pending', 'proposed', 'accepted', 'rejected', 'cancelled');

create type public.document_type as enum ('RC', 'TI', 'CC', 'CE', 'PA', 'PEP');

create type public.gender as enum ('F', 'M', 'O');

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuración global (fila única)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.settings (
  id                   boolean primary key default true,
  event_name           text        not null default 'Olimpiadas Scouts 2026',
  individual_fee       numeric(12, 2) not null default 5000    check (individual_fee >= 0),
  group_team_fee       numeric(12, 2) not null default 0       check (group_team_fee >= 0),
  stand_fee            numeric(12, 2) not null default 50000   check (stand_fee >= 0),
  stand_limit          integer     not null default 30         check (stand_limit >= 0),
  max_proof_mb         integer     not null default 8          check (max_proof_mb between 1 and 50),
  registration_open    boolean     not null default true,
  bank_label           text        not null default 'Cuenta Bancaria RAS',
  bank_name            text        not null default 'Bancolombia',
  bank_account_type    text        not null default 'Cuenta de ahorros',
  bank_account_number  text        not null default '10322142743',
  bank_nit             text        not null default '890904933-6',
  bank_holder          text        not null default 'Corporación Región Antioquia Scout',
  updated_at           timestamptz not null default now(),
  constraint settings_singleton check (id)
);

comment on table public.settings is 'Parámetros del evento. Siempre contiene exactamente una fila (id = true).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Catálogos
-- ─────────────────────────────────────────────────────────────────────────────

create table public.countries (
  code        char(2)     primary key,
  name        text        not null,
  -- Un país reservado no puede ser elegido por los grupos, pero tampoco está
  -- asignado: el administrador lo aparta para uso posterior.
  is_reserved boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index countries_name_idx on public.countries (lower(name));

create table public.branches (
  id         text        primary key check (id ~ '^[a-z0-9_-]+$'),
  name       text        not null,
  sort_order integer     not null default 0,
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

comment on table public.branches is 'Ramas scouts (manada, tropa, caminantes, rovers...).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Grupos scouts
-- ─────────────────────────────────────────────────────────────────────────────

create sequence public.group_code_seq start 1;

create table public.groups (
  id               uuid          primary key default gen_random_uuid(),
  -- Se asigna al aprobar el registro: GS-001, GS-002, ...
  code             text          unique,
  name             text          not null check (length(btrim(name)) between 3 and 120),
  city             text          not null default '',
  department       text          not null default '',
  leader_name      text          not null check (length(btrim(leader_name)) >= 3),
  leader_document  text          not null default '',
  leader_email     citext        not null unique,
  leader_phone     text          not null default '',
  -- Un país pertenece como máximo a un grupo: lo garantiza la clave única.
  country_code     char(2)       references public.countries (code) on delete set null,
  status           public.group_status not null default 'pending',
  rejection_reason text,
  notes            text          not null default '',
  active           boolean       not null default true,
  requested_at     timestamptz   not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  constraint groups_country_unique unique (country_code),
  constraint groups_rejection_reason_required
    check (status <> 'rejected' or length(btrim(coalesce(rejection_reason, ''))) > 0),
  -- Solo un grupo aprobado puede tener código y país.
  constraint groups_code_only_when_approved
    check (code is null or status in ('approved', 'suspended')),
  constraint groups_country_only_when_approved
    check (country_code is null or status in ('approved', 'suspended'))
);

create index groups_status_idx on public.groups (status);
create index groups_active_idx on public.groups (active) where active;

comment on column public.groups.country_code is
  'País que representa el grupo. La restricción UNIQUE impide que dos grupos escojan el mismo.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles (extienden auth.users)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  id                   uuid        primary key references auth.users (id) on delete cascade,
  role                 public.user_role not null default 'group',
  group_id             uuid        references public.groups (id) on delete cascade,
  full_name            text        not null default '',
  email                citext      not null,
  -- Cuando el administrador aprueba un grupo, el sistema genera una contraseña
  -- y la envía por correo. El primer ingreso obliga a cambiarla.
  must_change_password boolean     not null default false,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Un administrador no pertenece a ningún grupo; un grupo siempre tiene uno.
  constraint profiles_group_consistency check (
    (role = 'admin' and group_id is null) or (role = 'group' and group_id is not null)
  )
);

create index profiles_group_idx on public.profiles (group_id);
create unique index profiles_one_user_per_group on public.profiles (group_id) where group_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Participantes
-- ─────────────────────────────────────────────────────────────────────────────

create table public.participants (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups (id) on delete cascade,
  doc_type    public.document_type not null default 'TI',
  document    text        not null check (document ~ '^[A-Za-z0-9.-]{3,20}$'),
  first_names text        not null check (length(btrim(first_names)) >= 2),
  last_names  text        not null check (length(btrim(last_names)) >= 2),
  full_name   text        generated always as (btrim(first_names) || ' ' || btrim(last_names)) stored,
  birthdate   date        not null check (birthdate > '1950-01-01' and birthdate < current_date),
  branch_id   text        not null references public.branches (id),
  gender      public.gender,
  phone       text        not null default '',
  email       citext,
  active      boolean     not null default true,
  notes       text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Corrige el error del prototipo: el documento es único por tipo, no global.
  constraint participants_document_unique unique (doc_type, document)
);

create index participants_group_idx on public.participants (group_id);
create index participants_branch_idx on public.participants (branch_id);
create index participants_name_idx on public.participants using gin (to_tsvector('spanish', full_name));

-- ─────────────────────────────────────────────────────────────────────────────
-- Deportes
-- ─────────────────────────────────────────────────────────────────────────────

create table public.sports (
  id                          uuid        primary key default gen_random_uuid(),
  slug                        text        not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                        text        not null,
  icon                        text        not null default '🏅',
  type                        public.sport_type not null,
  description                 text        not null default '',
  category                    text        not null default 'Mixta',
  team_size                   integer     not null default 1  check (team_size >= 1),
  substitutes                 integer     not null default 0  check (substitutes >= 0),
  max_teams_per_group         integer     not null default 1  check (max_teams_per_group >= 1),
  max_sports_per_participant  integer     not null default 3  check (max_sports_per_participant >= 1),
  deadline                    date,
  -- NULL = usa la tarifa general de settings según el tipo de deporte.
  fee                         numeric(12, 2) check (fee is null or fee >= 0),
  allow_intergroup            boolean     not null default true,
  max_external                integer     not null default 0 check (max_external >= 0),
  active                      boolean     not null default true,
  sort_order                  integer     not null default 0,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  -- Un deporte individual no forma equipos ni admite externos.
  constraint sports_individual_shape check (
    type = 'group' or (team_size = 1 and substitutes = 0 and allow_intergroup = false and max_external = 0)
  ),
  constraint sports_external_within_team check (max_external <= team_size)
);

create table public.sport_branches (
  sport_id  uuid not null references public.sports (id) on delete cascade,
  branch_id text not null references public.branches (id) on delete cascade,
  primary key (sport_id, branch_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Equipos (deportes grupales)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.teams (
  id             uuid        primary key default gen_random_uuid(),
  owner_group_id uuid        not null references public.groups (id) on delete cascade,
  sport_id       uuid        not null references public.sports (id) on delete cascade,
  name           text        not null check (length(btrim(name)) >= 3),
  captain_id     uuid        references public.participants (id) on delete set null,
  status         public.registration_status not null default 'draft',
  admin_note     text        not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint teams_name_unique_per_sport unique (sport_id, name)
);

create index teams_owner_idx on public.teams (owner_group_id);
create index teams_sport_idx on public.teams (sport_id);

create table public.team_members (
  team_id        uuid not null references public.teams (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  role           public.team_member_role not null default 'starter',
  added_at       timestamptz not null default now(),
  -- Impide que la misma persona sea titular y suplente del mismo equipo.
  primary key (team_id, participant_id)
);

create index team_members_participant_idx on public.team_members (participant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Inscripciones individuales
-- ─────────────────────────────────────────────────────────────────────────────

create table public.individual_registrations (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  sport_id   uuid        not null references public.sports (id) on delete cascade,
  status     public.registration_status not null default 'draft',
  amount     numeric(12, 2) not null default 0 check (amount >= 0),
  admin_note text        not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un grupo mantiene una sola inscripción por deporte individual.
  constraint individual_registrations_unique unique (group_id, sport_id)
);

create table public.individual_registration_participants (
  registration_id uuid not null references public.individual_registrations (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  primary key (registration_id, participant_id)
);

create index individual_reg_participants_idx
  on public.individual_registration_participants (participant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Solicitudes intergrupales
-- ─────────────────────────────────────────────────────────────────────────────

create table public.intergroup_requests (
  id                 uuid        primary key default gen_random_uuid(),
  team_id            uuid        not null references public.teams (id) on delete cascade,
  requester_group_id uuid        not null references public.groups (id) on delete cascade,
  target_group_id    uuid        not null references public.groups (id) on delete cascade,
  slots_requested    integer     not null check (slots_requested between 1 and 20),
  message            text        not null default '',
  response_note      text        not null default '',
  status             public.intergroup_status not null default 'pending',
  created_at         timestamptz not null default now(),
  responded_at       timestamptz,
  resolved_at        timestamptz,
  constraint intergroup_distinct_groups check (requester_group_id <> target_group_id),
  -- Una sola solicitud viva por equipo y grupo destino.
  constraint intergroup_unique_open unique (team_id, target_group_id)
);

create index intergroup_target_idx on public.intergroup_requests (target_group_id, status);
create index intergroup_requester_idx on public.intergroup_requests (requester_group_id, status);

create table public.intergroup_proposals (
  request_id     uuid not null references public.intergroup_requests (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  accepted       boolean not null default false,
  primary key (request_id, participant_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stands de ventas
-- ─────────────────────────────────────────────────────────────────────────────

create table public.stands (
  id              uuid        primary key default gen_random_uuid(),
  -- Corrige el error del prototipo: un grupo, un stand.
  group_id        uuid        not null unique references public.groups (id) on delete cascade,
  name            text        not null check (length(btrim(name)) >= 3),
  responsible     text        not null check (length(btrim(responsible)) >= 3),
  document        text        not null default '',
  phone           text        not null default '',
  email           citext,
  products        text        not null default '',
  description     text        not null default '',
  needs_power     boolean     not null default false,
  needs_furniture boolean     not null default false,
  notes           text        not null default '',
  amount          numeric(12, 2) not null default 0 check (amount >= 0),
  status          public.registration_status not null default 'draft',
  admin_note      text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index stands_status_idx on public.stands (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pagos
-- ─────────────────────────────────────────────────────────────────────────────

create table public.payments (
  id              uuid        primary key default gen_random_uuid(),
  group_id        uuid        not null references public.groups (id) on delete cascade,
  payable_type    public.payable_type not null,
  payable_id      uuid        not null,
  concept         text        not null,
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  reported_amount numeric(12, 2) not null check (reported_amount >= 0),
  payment_date    date        not null check (payment_date <= current_date),
  payer_name      text        not null check (length(btrim(payer_name)) >= 3),
  payer_document  text        not null default '',
  origin_bank     text        not null default '',
  -- La referencia de consignación identifica el pago de forma única.
  reference       text        not null unique check (length(btrim(reference)) >= 4),
  -- Ruta dentro del bucket privado 'comprobantes' de Supabase Storage.
  proof_path      text        not null,
  proof_name      text        not null default '',
  proof_size      integer     not null default 0,
  notes           text        not null default '',
  status          public.payment_status not null default 'sent',
  admin_note      text        not null default '',
  reviewed_at     timestamptz,
  reviewed_by     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payments_review_note_required
    check (status in ('sent', 'approved') or length(btrim(admin_note)) > 0)
);

create index payments_group_idx on public.payments (group_id);
create index payments_status_idx on public.payments (status);
create index payments_payable_idx on public.payments (payable_type, payable_id);

-- Un concepto solo puede tener un pago vivo a la vez (no aprobado ni rechazado).
create unique index payments_one_open_per_payable
  on public.payments (payable_type, payable_id)
  where status in ('sent', 'correction');

-- ─────────────────────────────────────────────────────────────────────────────
-- Notificaciones y bitácora
-- ─────────────────────────────────────────────────────────────────────────────

create table public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  -- NULL en group_id => notificación dirigida al administrador.
  group_id    uuid        references public.groups (id) on delete cascade,
  title       text        not null,
  body        text        not null default '',
  link        text,
  kind        text        not null default 'info',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_inbox_idx on public.notifications (group_id, read_at, created_at desc);

create table public.audit_log (
  id          bigint      generated always as identity primary key,
  actor_id    uuid,
  actor_name  text        not null default 'Sistema',
  action      text        not null,
  entity_type text        not null default '',
  entity_id   text        not null default '',
  metadata    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create table public.email_log (
  id         bigint      generated always as identity primary key,
  to_email   citext      not null,
  template   text        not null,
  subject    text        not null,
  status     text        not null default 'sent',
  error      text,
  created_at timestamptz not null default now()
);

create index email_log_created_idx on public.email_log (created_at desc);
