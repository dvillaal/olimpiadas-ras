-- ============================================================================
-- Olimpiadas Scouts · Row Level Security
-- ============================================================================
-- Regla general:
--   · El administrador ve y modifica todo.
--   · Un grupo scout solo ve y modifica lo suyo, y solo mientras la inscripción
--     siga siendo editable.
-- En el prototipo la autorización vivía en el navegador y bastaba abrir la
-- consola para saltársela. Aquí la aplica Postgres en cada consulta.
-- ============================================================================

alter table public.settings                             enable row level security;
alter table public.countries                            enable row level security;
alter table public.branches                             enable row level security;
alter table public.groups                               enable row level security;
alter table public.profiles                             enable row level security;
alter table public.participants                         enable row level security;
alter table public.sports                               enable row level security;
alter table public.sport_branches                       enable row level security;
alter table public.teams                                enable row level security;
alter table public.team_members                         enable row level security;
alter table public.individual_registrations             enable row level security;
alter table public.individual_registration_participants enable row level security;
alter table public.intergroup_requests                  enable row level security;
alter table public.intergroup_proposals                 enable row level security;
alter table public.stands                               enable row level security;
alter table public.payments                             enable row level security;
alter table public.notifications                        enable row level security;
alter table public.audit_log                            enable row level security;
alter table public.email_log                            enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuración y catálogos: lectura para todo usuario autenticado
-- ─────────────────────────────────────────────────────────────────────────────

create policy settings_read on public.settings
  for select to authenticated using (true);
create policy settings_admin on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy countries_read on public.countries
  for select to authenticated using (true);
create policy countries_admin on public.countries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy branches_read on public.branches
  for select to authenticated using (true);
create policy branches_admin on public.branches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sports_read on public.sports
  for select to authenticated using (true);
create policy sports_admin on public.sports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sport_branches_read on public.sport_branches
  for select to authenticated using (true);
create policy sport_branches_admin on public.sport_branches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Grupos y perfiles
-- ─────────────────────────────────────────────────────────────────────────────

-- Un grupo ve su propia ficha; además ve el nombre de los demás grupos
-- aprobados, necesario para las solicitudes intergrupales y el tablero de países.
create policy groups_read on public.groups
  for select to authenticated
  using (public.is_admin() or id = public.current_group_id() or status = 'approved');

create policy groups_update_own on public.groups
  for update to authenticated
  using (id = public.current_group_id())
  with check (id = public.current_group_id());

create policy groups_admin on public.groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_read_own on public.profiles
  for select to authenticated using (public.is_admin() or id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin on public.profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Participantes
-- ─────────────────────────────────────────────────────────────────────────────

-- Un grupo ve a los suyos. Además ve a los participantes de otro grupo cuando
-- existe una solicitud intergrupal viva entre ambos: sin eso, no podría
-- proponer ni revisar integrantes prestados.
create policy participants_read on public.participants
  for select to authenticated
  using (
    public.is_admin()
    or group_id = public.current_group_id()
    or exists (
      select 1 from public.intergroup_requests r
      where r.status in ('pending', 'proposed', 'accepted')
        and (
          (r.target_group_id = participants.group_id and r.requester_group_id = public.current_group_id())
          or (r.requester_group_id = participants.group_id and r.target_group_id = public.current_group_id())
        )
    )
  );

create policy participants_write_own on public.participants
  for all to authenticated
  using (group_id = public.current_group_id())
  with check (group_id = public.current_group_id());

create policy participants_admin on public.participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Equipos
-- ─────────────────────────────────────────────────────────────────────────────

-- Un grupo ve sus equipos y aquellos en los que presta participantes.
create policy teams_read on public.teams
  for select to authenticated
  using (
    public.is_admin()
    or owner_group_id = public.current_group_id()
    or exists (
      select 1
      from public.team_members tm
      join public.participants p on p.id = tm.participant_id
      where tm.team_id = teams.id and p.group_id = public.current_group_id()
    )
    or exists (
      select 1 from public.intergroup_requests r
      where r.team_id = teams.id and r.target_group_id = public.current_group_id()
    )
  );

create policy teams_write_own on public.teams
  for all to authenticated
  using (owner_group_id = public.current_group_id())
  with check (owner_group_id = public.current_group_id());

create policy teams_admin on public.teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy team_members_read on public.team_members
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_group_id = public.current_group_id()
    )
    or exists (
      select 1 from public.participants p
      where p.id = team_members.participant_id and p.group_id = public.current_group_id()
    )
  );

-- Solo el grupo dueño del equipo arma la alineación.
create policy team_members_write on public.team_members
  for all to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_group_id = public.current_group_id()
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_group_id = public.current_group_id()
    )
  );

create policy team_members_admin on public.team_members
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Inscripciones individuales
-- ─────────────────────────────────────────────────────────────────────────────

create policy individual_registrations_own on public.individual_registrations
  for all to authenticated
  using (group_id = public.current_group_id())
  with check (group_id = public.current_group_id());

create policy individual_registrations_admin on public.individual_registrations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy individual_participants_own on public.individual_registration_participants
  for all to authenticated
  using (
    exists (
      select 1 from public.individual_registrations r
      where r.id = registration_id and r.group_id = public.current_group_id()
    )
  )
  with check (
    exists (
      select 1 from public.individual_registrations r
      where r.id = registration_id and r.group_id = public.current_group_id()
    )
  );

create policy individual_participants_admin on public.individual_registration_participants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Solicitudes intergrupales
-- ─────────────────────────────────────────────────────────────────────────────

create policy intergroup_read on public.intergroup_requests
  for select to authenticated
  using (
    public.is_admin()
    or requester_group_id = public.current_group_id()
    or target_group_id = public.current_group_id()
  );

-- Solo el solicitante crea la solicitud.
create policy intergroup_insert on public.intergroup_requests
  for insert to authenticated
  with check (requester_group_id = public.current_group_id());

-- Ambos lados pueden actualizarla: el destino propone, el solicitante resuelve.
create policy intergroup_update on public.intergroup_requests
  for update to authenticated
  using (requester_group_id = public.current_group_id() or target_group_id = public.current_group_id())
  with check (requester_group_id = public.current_group_id() or target_group_id = public.current_group_id());

create policy intergroup_delete on public.intergroup_requests
  for delete to authenticated
  using (requester_group_id = public.current_group_id());

create policy intergroup_admin on public.intergroup_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy intergroup_proposals_read on public.intergroup_proposals
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.intergroup_requests r
      where r.id = request_id
        and (r.requester_group_id = public.current_group_id()
             or r.target_group_id = public.current_group_id())
    )
  );

-- Solo el grupo destino propone a su propia gente.
create policy intergroup_proposals_write on public.intergroup_proposals
  for all to authenticated
  using (
    exists (
      select 1 from public.intergroup_requests r
      where r.id = request_id and r.target_group_id = public.current_group_id()
    )
  )
  with check (
    exists (
      select 1 from public.intergroup_requests r
      where r.id = request_id and r.target_group_id = public.current_group_id()
    )
    and exists (
      select 1 from public.participants p
      where p.id = participant_id and p.group_id = public.current_group_id()
    )
  );

create policy intergroup_proposals_admin on public.intergroup_proposals
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Stands
-- ─────────────────────────────────────────────────────────────────────────────

create policy stands_own on public.stands
  for all to authenticated
  using (group_id = public.current_group_id())
  with check (group_id = public.current_group_id());

create policy stands_admin on public.stands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Pagos
-- ─────────────────────────────────────────────────────────────────────────────

create policy payments_read_own on public.payments
  for select to authenticated
  using (public.is_admin() or group_id = public.current_group_id());

-- Los pagos se crean mediante submit_payment(); esta política cubre el caso
-- de una corrección hecha por el propio grupo.
create policy payments_insert_own on public.payments
  for insert to authenticated
  with check (group_id = public.current_group_id());

-- Un pago aprobado es inmutable para el grupo.
create policy payments_update_own on public.payments
  for update to authenticated
  using (group_id = public.current_group_id() and status in ('correction', 'rejected'))
  with check (group_id = public.current_group_id());

create policy payments_admin on public.payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Notificaciones, bitácora y correos
-- ─────────────────────────────────────────────────────────────────────────────

-- group_id NULL identifica las notificaciones dirigidas al administrador.
create policy notifications_read on public.notifications
  for select to authenticated
  using (
    (public.is_admin() and group_id is null)
    or group_id = public.current_group_id()
    or public.is_admin()
  );

create policy notifications_update on public.notifications
  for update to authenticated
  using (public.is_admin() or group_id = public.current_group_id())
  with check (public.is_admin() or group_id = public.current_group_id());

create policy notifications_admin on public.notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy audit_log_admin on public.audit_log
  for select to authenticated using (public.is_admin());

create policy email_log_admin on public.email_log
  for select to authenticated using (public.is_admin());
