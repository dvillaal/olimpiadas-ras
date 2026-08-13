-- ============================================================================
-- Corrige "infinite recursion detected in policy for relation teams"
-- ============================================================================
-- teams_read (en public.teams) consultaba directamente public.team_members,
-- y team_members_read/team_members_write (en public.team_members) consultaban
-- directamente public.teams. Como ambas tablas tienen RLS activo, evaluar la
-- política de una obligaba a evaluar la política de la otra, y viceversa: un
-- ciclo que Postgres corta con "infinite recursion detected in policy".
--
-- La solución es el patrón ya usado en el resto del esquema (is_admin(),
-- current_group_id(), team_intergroup_approved()): mover la comprobación a
-- una función `security definer`, que corre con privilegios elevados y por
-- lo tanto no vuelve a disparar las políticas de la tabla que consulta.
-- ============================================================================

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team_id and t.owner_group_id = public.current_group_id()
  );
$$;

create or replace function public.team_has_my_participant(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.participants p on p.id = tm.participant_id
    where tm.team_id = p_team_id and p.group_id = public.current_group_id()
  );
$$;

-- ─── teams: ya no consulta team_members directamente ────────────────────────

drop policy if exists teams_read on public.teams;

create policy teams_read on public.teams
  for select to authenticated
  using (
    public.is_admin()
    or owner_group_id = public.current_group_id()
    or public.team_has_my_participant(id)
    or exists (
      select 1 from public.intergroup_requests r
      where r.team_id = teams.id and r.target_group_id = public.current_group_id()
    )
  );

-- ─── team_members: ya no consulta teams directamente ────────────────────────

drop policy if exists team_members_read on public.team_members;

create policy team_members_read on public.team_members
  for select to authenticated
  using (
    public.is_admin()
    or public.is_team_owner(team_id)
    or exists (
      select 1 from public.participants p
      where p.id = team_members.participant_id and p.group_id = public.current_group_id()
    )
  );

drop policy if exists team_members_write on public.team_members;

create policy team_members_write on public.team_members
  for all to authenticated
  using (public.is_team_owner(team_id))
  with check (public.is_team_owner(team_id));
