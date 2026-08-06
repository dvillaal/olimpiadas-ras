-- ============================================================================
-- Olimpiadas Scouts · Funciones, disparadores e invariantes de negocio
-- ============================================================================
-- Todo lo que en el prototipo era un `if` en el navegador (y por tanto
-- eludible) vive aquí, del lado del servidor. La capa TypeScript repite estas
-- validaciones solo para dar mensajes tempranos y agradables al usuario.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Utilidades de sesión
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_group_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select group_id from public.profiles where id = auth.uid();
$$;

create or replace function public.actor_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select nullif(btrim(full_name), '') from public.profiles where id = auth.uid()),
    (select email::text from public.profiles where id = auth.uid()),
    'Sistema'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'settings', 'groups', 'profiles', 'participants', 'sports', 'teams',
    'individual_registrations', 'stands', 'payments'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bitácora
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.log_audit(
  p_action      text,
  p_entity_type text default '',
  p_entity_id   text default '',
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
  values (auth.uid(), public.actor_name(), p_action, p_entity_type, p_entity_id, p_metadata);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tarifas
-- ─────────────────────────────────────────────────────────────────────────────

-- Tarifa efectiva de un deporte: la propia si está definida, si no la general
-- que corresponda a su tipo.
create or replace function public.sport_effective_fee(p_sport_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    s.fee,
    case when s.type = 'individual' then st.individual_fee else st.group_team_fee end,
    0
  )
  from public.sports s
  cross join public.settings st
  where s.id = p_sport_id;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conteo de deportes por participante
-- ─────────────────────────────────────────────────────────────────────────────

-- Cuántos deportes DISTINTOS tiene una persona en inscripciones vigentes.
-- Los estados 'rejected' y 'cancelled' no ocupan cupo.
create or replace function public.participant_sport_count(
  p_participant_id uuid,
  p_exclude_team   uuid default null,
  p_exclude_reg    uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(distinct sport_id)::integer
  from (
    select t.sport_id
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.participant_id = p_participant_id
      and t.status not in ('rejected', 'cancelled')
      and (p_exclude_team is null or t.id <> p_exclude_team)
    union all
    select r.sport_id
    from public.individual_registration_participants irp
    join public.individual_registrations r on r.id = irp.registration_id
    where irp.participant_id = p_participant_id
      and r.status not in ('rejected', 'cancelled')
      and (p_exclude_reg is null or r.id <> p_exclude_reg)
  ) as inscripciones;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Invariantes de equipos
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_validate_team()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sport   public.sports%rowtype;
  v_teams   integer;
begin
  select * into v_sport from public.sports where id = new.sport_id;

  if v_sport.type <> 'group' then
    raise exception 'El deporte "%" es individual y no admite equipos.', v_sport.name
      using errcode = 'check_violation';
  end if;

  if not v_sport.active then
    raise exception 'El deporte "%" está inactivo.', v_sport.name
      using errcode = 'check_violation';
  end if;

  if v_sport.deadline is not null and current_date > v_sport.deadline and tg_op = 'INSERT' then
    raise exception 'La fecha límite de inscripción para "%" venció el %.', v_sport.name, v_sport.deadline
      using errcode = 'check_violation';
  end if;

  -- Cupo de equipos por grupo y deporte.
  select count(*) into v_teams
  from public.teams
  where owner_group_id = new.owner_group_id
    and sport_id = new.sport_id
    and status not in ('rejected', 'cancelled')
    and id <> new.id;

  if v_teams >= v_sport.max_teams_per_group then
    raise exception 'Tu grupo ya alcanzó el máximo de % equipo(s) en "%".',
      v_sport.max_teams_per_group, v_sport.name
      using errcode = 'check_violation';
  end if;

  -- El capitán debe ser titular del equipo.
  if new.captain_id is not null and tg_op = 'UPDATE' then
    if not exists (
      select 1 from public.team_members
      where team_id = new.id and participant_id = new.captain_id and role = 'starter'
    ) then
      raise exception 'El capitán debe estar inscrito como titular del equipo.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger teams_validate
  before insert or update on public.teams
  for each row execute function public.tg_validate_team();

create or replace function public.tg_validate_team_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team        public.teams%rowtype;
  v_sport       public.sports%rowtype;
  v_participant public.participants%rowtype;
  v_starters    integer;
  v_subs        integer;
  v_external    integer;
begin
  select * into v_team from public.teams where id = new.team_id;
  select * into v_sport from public.sports where id = v_team.sport_id;
  select * into v_participant from public.participants where id = new.participant_id;

  if v_team.status in ('confirmed', 'payment_pending') then
    raise exception 'El equipo "%" ya no admite cambios porque está en estado %.',
      v_team.name, v_team.status
      using errcode = 'check_violation';
  end if;

  if not v_participant.active then
    raise exception '% está inactivo y no puede inscribirse.', v_participant.full_name
      using errcode = 'check_violation';
  end if;

  -- La rama del participante debe estar habilitada para el deporte.
  if not exists (
    select 1 from public.sport_branches
    where sport_id = v_sport.id and branch_id = v_participant.branch_id
  ) then
    raise exception 'La rama de % no está habilitada para "%".',
      v_participant.full_name, v_sport.name
      using errcode = 'check_violation';
  end if;

  -- Límite de deportes simultáneos por persona.
  if public.participant_sport_count(new.participant_id, new.team_id, null)
       >= v_sport.max_sports_per_participant
     and not exists (
       select 1 from public.team_members tm
       join public.teams t on t.id = tm.team_id
       where tm.participant_id = new.participant_id and t.sport_id = v_sport.id
     )
  then
    raise exception '% ya alcanzó el máximo de % deporte(s).',
      v_participant.full_name, v_sport.max_sports_per_participant
      using errcode = 'check_violation';
  end if;

  select
    count(*) filter (where tm.role = 'starter'),
    count(*) filter (where tm.role = 'substitute'),
    count(*) filter (where p.group_id <> v_team.owner_group_id)
  into v_starters, v_subs, v_external
  from public.team_members tm
  join public.participants p on p.id = tm.participant_id
  where tm.team_id = new.team_id
    and tm.participant_id <> new.participant_id;

  if new.role = 'starter' and v_starters + 1 > v_sport.team_size then
    raise exception '"%" admite % titular(es).', v_sport.name, v_sport.team_size
      using errcode = 'check_violation';
  end if;

  if new.role = 'substitute' and v_subs + 1 > v_sport.substitutes then
    raise exception '"%" admite % suplente(s).', v_sport.name, v_sport.substitutes
      using errcode = 'check_violation';
  end if;

  if v_participant.group_id <> v_team.owner_group_id then
    if not v_sport.allow_intergroup then
      raise exception '"%" no permite integrantes de otros grupos.', v_sport.name
        using errcode = 'check_violation';
    end if;
    if v_external + 1 > v_sport.max_external then
      raise exception '"%" admite máximo % integrante(s) de otros grupos.',
        v_sport.name, v_sport.max_external
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger team_members_validate
  before insert or update on public.team_members
  for each row execute function public.tg_validate_team_member();

-- ─────────────────────────────────────────────────────────────────────────────
-- Invariantes de inscripciones individuales
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_validate_individual_participant()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reg         public.individual_registrations%rowtype;
  v_sport       public.sports%rowtype;
  v_participant public.participants%rowtype;
begin
  select * into v_reg from public.individual_registrations where id = new.registration_id;
  select * into v_sport from public.sports where id = v_reg.sport_id;
  select * into v_participant from public.participants where id = new.participant_id;

  if v_reg.status in ('confirmed', 'payment_pending') then
    raise exception 'La inscripción ya no admite cambios porque está en estado %.', v_reg.status
      using errcode = 'check_violation';
  end if;

  if v_participant.group_id <> v_reg.group_id then
    raise exception 'Solo puedes inscribir participantes de tu propio grupo.'
      using errcode = 'check_violation';
  end if;

  if not v_participant.active then
    raise exception '% está inactivo y no puede inscribirse.', v_participant.full_name
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.sport_branches
    where sport_id = v_sport.id and branch_id = v_participant.branch_id
  ) then
    raise exception 'La rama de % no está habilitada para "%".',
      v_participant.full_name, v_sport.name
      using errcode = 'check_violation';
  end if;

  if public.participant_sport_count(new.participant_id, null, new.registration_id)
       >= v_sport.max_sports_per_participant then
    raise exception '% ya alcanzó el máximo de % deporte(s).',
      v_participant.full_name, v_sport.max_sports_per_participant
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger individual_participants_validate
  before insert or update on public.individual_registration_participants
  for each row execute function public.tg_validate_individual_participant();

-- El valor de una inscripción individual siempre es tarifa × participantes.
create or replace function public.tg_recalc_individual_amount()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reg_id uuid := coalesce(new.registration_id, old.registration_id);
begin
  update public.individual_registrations r
     set amount = public.sport_effective_fee(r.sport_id) * (
           select count(*) from public.individual_registration_participants
           where registration_id = r.id
         )
   where r.id = v_reg_id;
  return null;
end;
$$;

create trigger individual_participants_recalc
  after insert or delete on public.individual_registration_participants
  for each row execute function public.tg_recalc_individual_amount();

-- ─────────────────────────────────────────────────────────────────────────────
-- Invariantes de stands
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_validate_stand()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer;
  v_taken integer;
begin
  select stand_limit into v_limit from public.settings;

  -- El cupo se consume desde que hay un pago en curso, no solo al aprobar.
  -- Corrige el error del prototipo, donde se podían crear stands sin límite.
  if new.status in ('payment_pending', 'confirmed') then
    select count(*) into v_taken
    from public.stands
    where status in ('payment_pending', 'confirmed')
      and id <> new.id;

    if v_taken >= v_limit then
      raise exception 'No quedan cupos disponibles para stands (límite: %).', v_limit
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.amount := (select stand_fee from public.settings);
  end if;

  return new;
end;
$$;

create trigger stands_validate
  before insert or update on public.stands
  for each row execute function public.tg_validate_stand();

-- ─────────────────────────────────────────────────────────────────────────────
-- Selección de país (atómica)
-- ─────────────────────────────────────────────────────────────────────────────

-- Toma un país para el grupo de quien llama. El bloqueo de fila impide que dos
-- grupos que pulsan al mismo tiempo se queden con el mismo país.
create or replace function public.claim_country(p_code char(2))
returns public.groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid := public.current_group_id();
  v_country  public.countries%rowtype;
  v_group    public.groups%rowtype;
begin
  if v_group_id is null then
    raise exception 'Solo un grupo scout puede escoger país.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_country from public.countries where code = upper(p_code) for update;
  if not found then
    raise exception 'El país % no existe.', p_code using errcode = 'no_data_found';
  end if;

  if v_country.is_reserved then
    raise exception 'El país % está reservado por la organización.', v_country.name
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.groups where country_code = v_country.code and id <> v_group_id) then
    raise exception 'Otro grupo acaba de escoger %. Elige uno diferente.', v_country.name
      using errcode = 'unique_violation';
  end if;

  select * into v_group from public.groups where id = v_group_id for update;

  if v_group.status <> 'approved' then
    raise exception 'Tu grupo aún no está aprobado.' using errcode = 'insufficient_privilege';
  end if;

  if v_group.country_code is not null and v_group.country_code <> v_country.code then
    raise exception 'Tu grupo ya representa a %. Pide al administrador liberarlo primero.',
      (select name from public.countries where code = v_group.country_code)
      using errcode = 'check_violation';
  end if;

  update public.groups set country_code = v_country.code where id = v_group_id
  returning * into v_group;

  perform public.log_audit('Escogió el país ' || v_country.name, 'group', v_group_id::text,
                           jsonb_build_object('country', v_country.code));

  return v_group;
end;
$$;

-- El administrador libera el país de un grupo.
create or replace function public.release_country(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code char(2);
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede liberar países.' using errcode = 'insufficient_privilege';
  end if;

  update public.groups set country_code = null where id = p_group_id returning country_code into v_code;
  perform public.log_audit('Liberó un país', 'group', p_group_id::text,
                           jsonb_build_object('country', v_code));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Revisión de pagos (atómica y con efecto en cascada)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.review_payment(
  p_payment_id uuid,
  p_status     public.payment_status,
  p_note       text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_target  public.registration_status;
  v_title   text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar pagos.' using errcode = 'insufficient_privilege';
  end if;

  if p_status <> 'approved' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Debes indicar el motivo al rechazar o pedir corrección.'
      using errcode = 'check_violation';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'El pago no existe.' using errcode = 'no_data_found';
  end if;

  if v_payment.status = 'approved' then
    raise exception 'Este pago ya fue aprobado y no puede modificarse.' using errcode = 'check_violation';
  end if;

  update public.payments
     set status      = p_status,
         admin_note  = coalesce(p_note, ''),
         reviewed_at = now(),
         reviewed_by = auth.uid()
   where id = p_payment_id
  returning * into v_payment;

  v_target := case p_status
                when 'approved'   then 'confirmed'::public.registration_status
                when 'rejected'   then 'rejected'::public.registration_status
                when 'correction' then 'correction'::public.registration_status
                else 'payment_pending'::public.registration_status
              end;

  if v_payment.payable_type = 'team' then
    update public.teams set status = v_target, admin_note = coalesce(p_note, '')
     where id = v_payment.payable_id;
  elsif v_payment.payable_type = 'individual' then
    update public.individual_registrations set status = v_target, admin_note = coalesce(p_note, '')
     where id = v_payment.payable_id;
  elsif v_payment.payable_type = 'stand' then
    update public.stands set status = v_target, admin_note = coalesce(p_note, '')
     where id = v_payment.payable_id;
  end if;

  v_title := case p_status
               when 'approved'   then 'Pago aprobado'
               when 'rejected'   then 'Pago rechazado'
               when 'correction' then 'Tu pago requiere corrección'
               else 'Pago actualizado'
             end;

  insert into public.notifications (group_id, title, body, link, kind)
  values (
    v_payment.group_id,
    v_title,
    v_payment.concept || ' · referencia ' || v_payment.reference ||
      case when length(btrim(coalesce(p_note, ''))) > 0 then '. ' || p_note else '' end,
    '/panel/pagos',
    case p_status when 'approved' then 'success' when 'rejected' then 'error' else 'warning' end
  );

  perform public.log_audit(
    case p_status
      when 'approved'   then 'Aprobó el pago ' || v_payment.reference
      when 'rejected'   then 'Rechazó el pago ' || v_payment.reference
      when 'correction' then 'Solicitó corrección del pago ' || v_payment.reference
      else 'Actualizó el pago ' || v_payment.reference
    end,
    'payment', p_payment_id::text, jsonb_build_object('status', p_status)
  );

  return v_payment;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Envío de una inscripción a pago
-- ─────────────────────────────────────────────────────────────────────────────

-- Registra el pago de un concepto y mueve la inscripción a 'payment_pending'
-- en una sola transacción, evitando los estados inconsistentes del prototipo.
create or replace function public.submit_payment(
  p_payable_type    public.payable_type,
  p_payable_id      uuid,
  p_concept         text,
  p_expected_amount numeric,
  p_reported_amount numeric,
  p_payment_date    date,
  p_payer_name      text,
  p_payer_document  text,
  p_origin_bank     text,
  p_reference       text,
  p_proof_path      text,
  p_proof_name      text,
  p_proof_size      integer,
  p_notes           text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid := public.current_group_id();
  v_payment  public.payments%rowtype;
  v_owner    uuid;
begin
  if v_group_id is null then
    raise exception 'Solo un grupo scout puede registrar pagos.' using errcode = 'insufficient_privilege';
  end if;

  -- El concepto debe pertenecer al grupo que paga.
  if p_payable_type = 'team' then
    select owner_group_id into v_owner from public.teams where id = p_payable_id;
  elsif p_payable_type = 'individual' then
    select group_id into v_owner from public.individual_registrations where id = p_payable_id;
  else
    select group_id into v_owner from public.stands where id = p_payable_id;
  end if;

  if v_owner is null or v_owner <> v_group_id then
    raise exception 'No puedes pagar un concepto que no pertenece a tu grupo.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Reemplaza un pago devuelto para el mismo concepto, si existe.
  delete from public.payments
   where payable_type = p_payable_type
     and payable_id = p_payable_id
     and status in ('sent', 'correction', 'rejected');

  insert into public.payments (
    group_id, payable_type, payable_id, concept, expected_amount, reported_amount,
    payment_date, payer_name, payer_document, origin_bank, reference,
    proof_path, proof_name, proof_size, notes, status
  ) values (
    v_group_id, p_payable_type, p_payable_id, p_concept, p_expected_amount, p_reported_amount,
    p_payment_date, p_payer_name, coalesce(p_payer_document, ''), coalesce(p_origin_bank, ''),
    btrim(p_reference), p_proof_path, coalesce(p_proof_name, ''), coalesce(p_proof_size, 0),
    coalesce(p_notes, ''), 'sent'
  )
  returning * into v_payment;

  if p_payable_type = 'team' then
    update public.teams set status = 'payment_pending' where id = p_payable_id;
  elsif p_payable_type = 'individual' then
    update public.individual_registrations set status = 'payment_pending' where id = p_payable_id;
  else
    update public.stands set status = 'payment_pending' where id = p_payable_id;
  end if;

  insert into public.notifications (group_id, title, body, link, kind)
  values (null, 'Nuevo pago por revisar',
          p_concept || ' · referencia ' || p_reference,
          '/admin/pagos', 'info');

  perform public.log_audit('Envió el pago ' || p_reference, 'payment', v_payment.id::text,
                           jsonb_build_object('concept', p_concept));

  return v_payment;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Solicitudes intergrupales
-- ─────────────────────────────────────────────────────────────────────────────

-- El grupo destino acepta la propuesta: los participantes se suman al equipo
-- respetando el tope de externos. Todo en una transacción.
create or replace function public.accept_intergroup_proposal(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.intergroup_requests%rowtype;
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
     set status = 'accepted', resolved_at = now()
   where id = p_request_id;

  insert into public.notifications (group_id, title, body, link, kind)
  values (v_request.target_group_id, 'Propuesta aceptada',
          'Tus participantes fueron integrados al equipo solicitante.',
          '/panel/solicitudes', 'success');

  perform public.log_audit('Aceptó una propuesta intergrupal', 'intergroup_request',
                           p_request_id::text, '{}'::jsonb);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Código de grupo al aprobar
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_assign_group_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and new.code is null then
    new.code := 'GS-' || lpad(nextval('public.group_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger groups_assign_code
  before insert or update on public.groups
  for each row execute function public.tg_assign_group_code();

-- ─────────────────────────────────────────────────────────────────────────────
-- Bloqueo de edición sobre inscripciones ya confirmadas
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.tg_protect_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'confirmed' and not public.is_admin() then
    raise exception 'Una inscripción confirmada solo puede modificarla el administrador.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger teams_protect_confirmed
  before update or delete on public.teams
  for each row execute function public.tg_protect_confirmed();

create trigger individual_registrations_protect_confirmed
  before update or delete on public.individual_registrations
  for each row execute function public.tg_protect_confirmed();

create trigger stands_protect_confirmed
  before update or delete on public.stands
  for each row execute function public.tg_protect_confirmed();
