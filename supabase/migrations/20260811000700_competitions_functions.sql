-- ============================================================================
-- Olimpiadas Scouts · Funciones y reglas de competencias
-- ============================================================================
-- Tres bloques:
--   1. Alianzas entre grupos que ahora pasan por administración antes del pago.
--   2. Generación de la programación y registro de resultados.
--   3. Vistas públicas: lo único que se puede consultar sin iniciar sesión.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Utilidades de arbitraje
-- ─────────────────────────────────────────────────────────────────────────────

-- Identificador del árbitro conectado, o NULL si quien consulta no lo es o
-- está desactivado. Un árbitro dado de baja deja de ver sus competencias sin
-- que haya que borrar nada.
create or replace function public.current_referee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id
    from public.referees r
    join public.profiles p on p.id = r.id
   where r.id = auth.uid() and r.active and p.role = 'referee';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Alianzas entre grupos
-- ─────────────────────────────────────────────────────────────────────────────

-- ¿Todos los integrantes prestados de este equipo tienen visto bueno de
-- administración? Un equipo sin externos lo cumple por vacuidad.
create or replace function public.team_intergroup_approved(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
      from public.team_members tm
      join public.participants p on p.id = tm.participant_id
      join public.teams t        on t.id = tm.team_id
     where tm.team_id = p_team_id
       and p.group_id <> t.owner_group_id
       and not exists (
         select 1
           from public.intergroup_requests r
           join public.intergroup_proposals ip on ip.request_id = r.id
          where r.team_id = p_team_id
            and r.status = 'admin_approved'
            and ip.participant_id = tm.participant_id
            and ip.accepted
       )
  );
$$;

-- Aceptar una propuesta ya no cierra el trámite: lo deja en manos de
-- administración. Antes, dos grupos podían acordar entre ellos un préstamo y
-- pagar sin que la organización llegara a enterarse.
create or replace function public.accept_intergroup_proposal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.intergroup_requests%rowtype;
  v_team    public.teams%rowtype;
  v_pid     uuid;
begin
  select * into v_request from public.intergroup_requests where id = p_request_id for update;

  if not found then
    raise exception 'La solicitud no existe.' using errcode = 'no_data_found';
  end if;

  if v_request.requester_group_id <> public.current_group_id() and not public.is_admin() then
    raise exception 'Solo el grupo que solicitó puede aceptar la propuesta.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_request.status <> 'proposed' then
    raise exception 'La solicitud no tiene participantes propuestos.' using errcode = 'check_violation';
  end if;

  -- El disparador de team_members valida rama, cupo y tope de externos.
  for v_pid in
    select participant_id from public.intergroup_proposals where request_id = p_request_id
  loop
    insert into public.team_members (team_id, participant_id, role)
    values (v_request.team_id, v_pid, 'starter')
    on conflict do nothing;
  end loop;

  update public.intergroup_proposals set accepted = true where request_id = p_request_id;

  update public.intergroup_requests
     set status = 'admin_review', resolved_at = now()
   where id = p_request_id;

  select * into v_team from public.teams where id = v_request.team_id;

  insert into public.notifications (group_id, title, body, link, kind)
  values (v_request.target_group_id, 'Propuesta aceptada',
          'Tus participantes fueron integrados al equipo solicitante. '
          || 'Administración revisará la alianza antes del pago.',
          '/panel/solicitudes', 'success');

  insert into public.notifications (group_id, title, body, link, kind)
  values (null, 'Alianza por revisar',
          'El equipo "' || v_team.name || '" incorporó participantes de otro grupo.',
          '/admin/intergrupales', 'info');

  perform public.log_audit('Aceptó una propuesta intergrupal', 'intergroup_request',
                           p_request_id::text, '{}'::jsonb);
end;
$$;

-- Administración resuelve. Al rechazar, los prestados salen del equipo: de otro
-- modo quedaría cuadrado en pantalla pero bloqueado para siempre en el pago.
create or replace function public.review_intergroup_request(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.intergroup_requests%rowtype;
  v_team    public.teams%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo la organización revisa las alianzas.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_request from public.intergroup_requests where id = p_request_id for update;

  if not found then
    raise exception 'La solicitud no existe.' using errcode = 'no_data_found';
  end if;

  if v_request.status <> 'admin_review' then
    raise exception 'Esta solicitud no está esperando revisión administrativa.'
      using errcode = 'check_violation';
  end if;

  if not p_approve and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Indica el motivo del rechazo.' using errcode = 'check_violation';
  end if;

  select * into v_team from public.teams where id = v_request.team_id;

  if p_approve then
    update public.intergroup_requests
       set status = 'admin_approved',
           admin_note = coalesce(p_note, ''),
           admin_reviewed_at = now(),
           admin_reviewed_by = auth.uid()
     where id = p_request_id;
  else
    -- Se retiran solo los participantes de esta solicitud, no todo el equipo:
    -- puede haber otra alianza aprobada conviviendo en la misma alineación.
    delete from public.team_members tm
     where tm.team_id = v_request.team_id
       and tm.participant_id in (
         select participant_id from public.intergroup_proposals
          where request_id = p_request_id and accepted
       );

    update public.intergroup_requests
       set status = 'admin_rejected',
           admin_note = btrim(p_note),
           admin_reviewed_at = now(),
           admin_reviewed_by = auth.uid()
     where id = p_request_id;
  end if;

  insert into public.notifications (group_id, title, body, link, kind)
  select gid,
         case when p_approve then 'Alianza aprobada' else 'Alianza rechazada' end,
         case when p_approve
              then 'El equipo "' || v_team.name || '" ya puede continuar con el pago.'
              else btrim(p_note) end,
         '/panel/solicitudes',
         case when p_approve then 'success' else 'error' end
    from unnest(array[v_request.requester_group_id, v_request.target_group_id]) as gid;

  perform public.log_audit(
    case when p_approve then 'Aprobó una alianza intergrupal'
         else 'Rechazó una alianza intergrupal' end,
    'intergroup_request', p_request_id::text,
    jsonb_build_object('note', btrim(coalesce(p_note, '')))
  );
end;
$$;

-- Un equipo con prestados sin aprobar no puede pagar. La comprobación va aquí y
-- no solo en la interfaz porque es la que decide si se cobra o no.
create or replace function public.tg_block_unapproved_team_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payable_type = 'team' and not public.team_intergroup_approved(new.payable_id) then
    raise exception
      'Administración debe aprobar a los participantes de otros grupos antes del pago.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger payments_require_intergroup_approval
  before insert on public.payments
  for each row execute function public.tg_block_unapproved_team_payment();

-- ─────────────────────────────────────────────────────────────────────────────
-- Generación de la programación
-- ─────────────────────────────────────────────────────────────────────────────

-- Equipos que pueden entrar al calendario: alineación completa y confirmados.
-- `p_include_pending` permite armar el calendario antes de que todos los pagos
-- estén revisados, que es como se trabaja en la práctica.
create or replace function public.schedulable_teams(
  p_sport_id        uuid,
  p_branch_id       text,
  p_include_pending boolean default false
)
returns setof public.teams
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.*
    from public.teams t
    join public.sports s on s.id = t.sport_id
   where t.sport_id = p_sport_id
     and (t.status = 'confirmed'
          or (p_include_pending and t.status not in ('rejected', 'cancelled')))
     -- La rama del equipo es la de sus integrantes.
     and exists (
       select 1
         from public.team_members tm
         join public.participants p on p.id = tm.participant_id
        where tm.team_id = t.id and p.branch_id = p_branch_id
     )
     and (select count(*) from public.team_members tm
           where tm.team_id = t.id and tm.role = 'starter') = s.team_size
   order by t.name;
$$;

create or replace function public.schedulable_participants(
  p_sport_id        uuid,
  p_branch_id       text,
  p_include_pending boolean default false
)
returns setof public.participants
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.*
    from public.individual_registrations ir
    join public.individual_registration_participants irp on irp.registration_id = ir.id
    join public.participants p on p.id = irp.participant_id
   where ir.sport_id = p_sport_id
     and p.branch_id = p_branch_id
     and p.active
     and (ir.status = 'confirmed'
          or (p_include_pending and ir.status not in ('rejected', 'cancelled')))
   order by p.full_name;
$$;

-- Genera el calendario de un deporte y una rama.
--   · Deportes grupales: todos contra todos.
--   · Deportes individuales: tandas del tamaño de `session_capacity`.
-- Reemplaza lo que ya hubiera para esa combinación, salvo lo que tenga
-- resultado publicado: eso no se toca ni por error.
create or replace function public.generate_schedule(
  p_sport_id        uuid,
  p_branch_id       text,
  p_starts_on       date,
  p_starts_at       time,
  p_interval_min    integer default 45,
  p_venue           text default '',
  p_referee_id      uuid default null,
  p_include_pending boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sport     public.sports%rowtype;
  v_teams     uuid[];
  v_people    uuid[];
  v_count     integer := 0;
  v_slot      integer := 0;
  v_when      timestamp;
  v_schedule  uuid;
  i           integer;
  j           integer;
begin
  if not public.is_admin() then
    raise exception 'Solo la organización programa competencias.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_sport from public.sports where id = p_sport_id;
  if not found then
    raise exception 'El deporte no existe.' using errcode = 'no_data_found';
  end if;

  if p_interval_min < 5 then
    raise exception 'El intervalo entre competencias debe ser de al menos 5 minutos.'
      using errcode = 'check_violation';
  end if;

  -- Se conserva lo ya publicado; el resto de esa categoría se rehace.
  delete from public.schedules
   where sport_id = p_sport_id and branch_id = p_branch_id and not result_published;

  if v_sport.type = 'group' then
    select array_agg(id order by name) into v_teams
      from public.schedulable_teams(p_sport_id, p_branch_id, p_include_pending);

    if coalesce(array_length(v_teams, 1), 0) < 2 then
      raise exception 'Hacen falta al menos dos equipos completos para generar partidos.'
        using errcode = 'check_violation';
    end if;

    for i in 1 .. array_length(v_teams, 1) loop
      for j in i + 1 .. array_length(v_teams, 1) loop
        v_when := (p_starts_on + p_starts_at) + (v_slot * p_interval_min || ' minutes')::interval;

        insert into public.schedules (
          sport_id, branch_id, type, label, starts_on, starts_at, venue, referee_id,
          team_a_id, team_b_id
        ) values (
          p_sport_id, p_branch_id, 'match', 'Partido ' || (v_slot + 1),
          v_when::date, v_when::time, coalesce(p_venue, ''), p_referee_id,
          v_teams[i], v_teams[j]
        );

        v_slot  := v_slot + 1;
        v_count := v_count + 1;
      end loop;
    end loop;
  else
    select array_agg(id order by full_name) into v_people
      from public.schedulable_participants(p_sport_id, p_branch_id, p_include_pending);

    if coalesce(array_length(v_people, 1), 0) = 0 then
      raise exception 'No hay participantes inscritos para generar sesiones.'
        using errcode = 'check_violation';
    end if;

    i := 1;
    while i <= array_length(v_people, 1) loop
      v_when := (p_starts_on + p_starts_at) + (v_slot * p_interval_min || ' minutes')::interval;

      insert into public.schedules (
        sport_id, branch_id, type, label, starts_on, starts_at, venue, referee_id
      ) values (
        p_sport_id, p_branch_id, 'session', 'Sesión ' || (v_slot + 1),
        v_when::date, v_when::time, coalesce(p_venue, ''), p_referee_id
      ) returning id into v_schedule;

      insert into public.schedule_participants (schedule_id, participant_id)
      select v_schedule, unnest(v_people[i : i + v_sport.session_capacity - 1]);

      i       := i + v_sport.session_capacity;
      v_slot  := v_slot + 1;
      v_count := v_count + 1;
    end loop;
  end if;

  perform public.log_audit(
    'Generó ' || v_count || ' competencias de ' || v_sport.name,
    'schedule', p_sport_id::text,
    jsonb_build_object('branch', p_branch_id, 'count', v_count)
  );

  return v_count;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Resultados
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.can_manage_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (
        select 1 from public.schedules s
         where s.id = p_schedule_id
           and s.referee_id is not null
           and s.referee_id = public.current_referee_id()
      );
$$;

create or replace function public.save_match_result(
  p_schedule_id uuid,
  p_score_a     integer,
  p_score_b     integer,
  p_notes       text default '',
  p_publish     boolean default false
)
returns public.schedules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.schedules%rowtype;
begin
  if not public.can_manage_schedule(p_schedule_id) then
    raise exception 'Esta competencia no está asignada a tu usuario.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_schedule from public.schedules where id = p_schedule_id for update;

  if v_schedule.type <> 'match' then
    raise exception 'Esta competencia no es un partido.' using errcode = 'check_violation';
  end if;

  if p_publish and (p_score_a is null or p_score_b is null) then
    raise exception 'Faltan marcadores por registrar.' using errcode = 'check_violation';
  end if;

  update public.schedules
     set score_a           = p_score_a,
         score_b           = p_score_b,
         result_notes      = coalesce(p_notes, ''),
         status            = case when p_publish then 'finished' else 'in_progress' end,
         result_published  = p_publish,
         result_entered_by = auth.uid(),
         result_updated_at = now()
   where id = p_schedule_id
   returning * into v_schedule;

  perform public.log_audit(
    case when p_publish then 'Publicó un resultado' else 'Guardó un resultado en borrador' end,
    'schedule', p_schedule_id::text,
    jsonb_build_object('score_a', p_score_a, 'score_b', p_score_b)
  );

  return v_schedule;
end;
$$;

-- Marcas de una sesión individual. El puesto se calcula aquí y no en el
-- navegador: es lo que después alimenta la clasificación general.
create or replace function public.save_session_result(
  p_schedule_id uuid,
  p_entries     jsonb,
  p_notes       text default '',
  p_publish     boolean default false
)
returns public.schedules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.schedules%rowtype;
  v_order    public.result_order;
begin
  if not public.can_manage_schedule(p_schedule_id) then
    raise exception 'Esta competencia no está asignada a tu usuario.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_schedule from public.schedules where id = p_schedule_id for update;

  if v_schedule.type <> 'session' then
    raise exception 'Esta competencia no es una sesión individual.'
      using errcode = 'check_violation';
  end if;

  select result_order into v_order from public.sports where id = v_schedule.sport_id;

  -- `p_entries`: [{"participant_id": "...", "value": 12.47, "disqualified": false}]
  update public.schedule_participants sp
     set value        = e.value,
         disqualified = e.disqualified
    from (
      select (x ->> 'participant_id')::uuid          as participant_id,
             nullif(x ->> 'value', '')::numeric      as value,
             coalesce((x ->> 'disqualified')::boolean, false) as disqualified
        from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as x
    ) e
   where sp.schedule_id = p_schedule_id
     and sp.participant_id = e.participant_id;

  -- El puesto ignora a los descalificados y a quien no tiene marca.
  with ordered as (
    select participant_id,
           row_number() over (
             order by case when v_order = 'asc'  then value end asc  nulls last,
                      case when v_order = 'desc' then value end desc nulls last
           ) as position
      from public.schedule_participants
     where schedule_id = p_schedule_id
       and not disqualified
       and value is not null
  )
  update public.schedule_participants sp
     set rank = o.position
    from ordered o
   where sp.schedule_id = p_schedule_id and sp.participant_id = o.participant_id;

  update public.schedule_participants
     set rank = null
   where schedule_id = p_schedule_id and (disqualified or value is null);

  update public.schedules
     set result_notes      = coalesce(p_notes, ''),
         status            = case when p_publish then 'finished' else 'in_progress' end,
         result_published  = p_publish,
         result_entered_by = auth.uid(),
         result_updated_at = now()
   where id = p_schedule_id
   returning * into v_schedule;

  perform public.log_audit(
    case when p_publish then 'Publicó los resultados de una sesión'
         else 'Guardó los resultados de una sesión en borrador' end,
    'schedule', p_schedule_id::text, '{}'::jsonb
  );

  return v_schedule;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.referees              enable row level security;
alter table public.referee_sports        enable row level security;
alter table public.schedules             enable row level security;
alter table public.schedule_participants enable row level security;

-- El árbitro se ve a sí mismo; el resto de usuarios autenticados ve la lista
-- para saber quién dirige cada competencia.
create policy referees_read on public.referees
  for select to authenticated using (true);
create policy referees_admin on public.referees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy referee_sports_read on public.referee_sports
  for select to authenticated using (true);
create policy referee_sports_admin on public.referee_sports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- La programación es visible para cualquier usuario autenticado: los grupos
-- necesitan saber cuándo juegan, aunque solo la organización pueda cambiarla.
create policy schedules_read on public.schedules
  for select to authenticated using (true);
create policy schedules_admin on public.schedules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- El árbitro modifica únicamente lo que tiene asignado, y solo el resultado:
-- fecha, lugar y rival los fija la organización.
create policy schedules_referee_result on public.schedules
  for update to authenticated
  using (referee_id is not null and referee_id = public.current_referee_id())
  with check (referee_id is not null and referee_id = public.current_referee_id());

create policy schedule_participants_read on public.schedule_participants
  for select to authenticated using (true);
create policy schedule_participants_admin on public.schedule_participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy schedule_participants_referee on public.schedule_participants
  for update to authenticated
  using (
    exists (select 1 from public.schedules s
             where s.id = schedule_id and s.referee_id = public.current_referee_id())
  )
  with check (
    exists (select 1 from public.schedules s
             where s.id = schedule_id and s.referee_id = public.current_referee_id())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Portal público
-- ─────────────────────────────────────────────────────────────────────────────
-- Estas vistas se ejecutan con los permisos de su dueño, así que atraviesan RLS
-- a propósito. Es la única puerta sin sesión del sistema, y por eso exponen
-- exclusivamente competencias con resultado publicado y nombres ya públicos:
-- ni documentos, ni correos, ni pagos, ni nada de los borradores.

create view public.public_schedule as
select
  s.id,
  s.type,
  s.label,
  s.starts_on,
  s.starts_at,
  s.venue,
  s.status,
  s.result_published,
  s.score_a,
  s.score_b,
  s.result_notes,
  sp.name  as sport_name,
  sp.icon  as sport_icon,
  sp.slug  as sport_slug,
  sp.result_label,
  b.id     as branch_id,
  b.name   as branch_name,
  ta.name  as team_a_name,
  tb.name  as team_b_name,
  r.full_name as referee_name
from public.schedules s
join public.sports   sp on sp.id = s.sport_id
join public.branches b  on b.id  = s.branch_id
left join public.teams ta on ta.id = s.team_a_id
left join public.teams tb on tb.id = s.team_b_id
left join public.profiles r on r.id = s.referee_id;

create view public.public_standings as
with played as (
  select s.sport_id, s.branch_id, s.team_a_id as team_id, s.score_a as gf, s.score_b as gc
    from public.schedules s
   where s.type = 'match' and s.result_published
     and s.score_a is not null and s.score_b is not null
  union all
  select s.sport_id, s.branch_id, s.team_b_id, s.score_b, s.score_a
    from public.schedules s
   where s.type = 'match' and s.result_published
     and s.score_a is not null and s.score_b is not null
)
select
  pl.sport_id,
  sp.name as sport_name,
  sp.slug as sport_slug,
  pl.branch_id,
  b.name  as branch_name,
  pl.team_id,
  t.name  as team_name,
  g.name  as group_name,
  g.country_code,
  count(*)::int                                as played,
  count(*) filter (where pl.gf > pl.gc)::int   as won,
  count(*) filter (where pl.gf = pl.gc)::int   as drawn,
  count(*) filter (where pl.gf < pl.gc)::int   as lost,
  coalesce(sum(pl.gf), 0)::int                 as goals_for,
  coalesce(sum(pl.gc), 0)::int                 as goals_against,
  coalesce(sum(pl.gf) - sum(pl.gc), 0)::int    as goal_difference,
  (count(*) filter (where pl.gf > pl.gc) * 3
   + count(*) filter (where pl.gf = pl.gc))::int as points
from played pl
join public.teams    t  on t.id  = pl.team_id
join public.sports   sp on sp.id = pl.sport_id
join public.branches b  on b.id  = pl.branch_id
join public.groups   g  on g.id  = t.owner_group_id
group by pl.sport_id, sp.name, sp.slug, pl.branch_id, b.name,
         pl.team_id, t.name, g.name, g.country_code;

-- Clasificación general de los deportes individuales: la mejor marca de cada
-- persona, sin importar en qué sesión la hizo.
create view public.public_individual_ranking as
with marks as (
  select s.sport_id, s.branch_id, sr.participant_id, sr.value, sp.result_order
    from public.schedules s
    join public.schedule_participants sr on sr.schedule_id = s.id
    join public.sports sp on sp.id = s.sport_id
   where s.type = 'session' and s.result_published
     and not sr.disqualified and sr.value is not null
),
best as (
  select sport_id, branch_id, participant_id, result_order,
         case when result_order = 'asc' then min(value) else max(value) end as best_value
    from marks
   group by sport_id, branch_id, participant_id, result_order
)
select
  bs.sport_id,
  sp.name as sport_name,
  sp.slug as sport_slug,
  sp.result_label,
  bs.branch_id,
  b.name  as branch_name,
  bs.participant_id,
  p.full_name as participant_name,
  g.name  as group_name,
  g.country_code,
  bs.best_value,
  rank() over (
    partition by bs.sport_id, bs.branch_id
    order by case when bs.result_order = 'asc'  then bs.best_value end asc  nulls last,
             case when bs.result_order = 'desc' then bs.best_value end desc nulls last
  )::int as position
from best bs
join public.participants p on p.id = bs.participant_id
join public.sports   sp on sp.id = bs.sport_id
join public.branches b  on b.id  = bs.branch_id
join public.groups   g  on g.id  = p.group_id;

-- `anon` es el rol de Supabase para quien no ha iniciado sesión. En la
-- validación local con PGlite no existe, así que se comprueba antes.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.public_schedule            to anon;
    grant select on public.public_standings           to anon;
    grant select on public.public_individual_ranking  to anon;
  end if;
end;
$$;

grant select on public.public_schedule           to authenticated;
grant select on public.public_standings          to authenticated;
grant select on public.public_individual_ranking to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tiempo real
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['schedules', 'schedule_participants', 'referees'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception
  when undefined_object then
    raise notice 'La publicación supabase_realtime no existe; se omite.';
end;
$$;
