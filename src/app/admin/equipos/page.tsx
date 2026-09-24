import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { EmptyState, PageHeader, Panel, StatCard } from '@/components/ui';
import { TeamsFilterList, type TeamRow } from './teams-filter-list';
import { IndividualRegistrationsTable, type IndividualRow } from './individual-registrations-table';

export const metadata: Metadata = { title: 'Equipos' };

export default async function AdminTeamsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: teams },
    { data: members },
    { data: participants },
    { data: sports },
    { data: groups },
    { data: individuals },
    { data: individualParticipants },
    { data: branches },
    { data: sportBranches },
  ] = await Promise.all([
    supabase.from('teams').select('*').order('created_at', { ascending: false }),
    supabase.from('team_members').select('*'),
    supabase.from('participants').select('id, full_name, group_id, branch_id, active'),
    supabase.from('sports').select('*'),
    supabase.from('groups').select('id, name, code'),
    supabase.from('individual_registrations').select('*'),
    supabase.from('individual_registration_participants').select('*'),
    supabase.from('branches').select('id, name'),
    supabase.from('sport_branches').select('sport_id, branch_id'),
  ]);

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const membersByTeam = new Map<string, typeof members>();
  for (const member of members ?? []) {
    membersByTeam.set(member.team_id, [...(membersByTeam.get(member.team_id) ?? []), member]);
  }

  const participantsByRegistration = new Map<string, number>();
  const participantIdsByRegistration = new Map<string, string[]>();
  for (const link of individualParticipants ?? []) {
    participantsByRegistration.set(
      link.registration_id,
      (participantsByRegistration.get(link.registration_id) ?? 0) + 1,
    );
    participantIdsByRegistration.set(link.registration_id, [
      ...(participantIdsByRegistration.get(link.registration_id) ?? []),
      link.participant_id,
    ]);
  }

  const branchIdsBySport = new Map<string, Set<string>>();
  for (const link of sportBranches ?? []) {
    branchIdsBySport.set(
      link.sport_id,
      new Set([...(branchIdsBySport.get(link.sport_id) ?? []), link.branch_id]),
    );
  }

  const teamRows = teams ?? [];
  const confirmed = teamRows.filter((t) => t.status === 'confirmed').length;
  const individualRows = individuals ?? [];

  // Filas ya aplanadas para el listado con filtros (deporte, grupo, estado,
  // búsqueda): se calcula todo aquí para que el componente cliente solo
  // filtre y renderice, sin tener que volver a tocar la base.
  const teamRowsForFilter: TeamRow[] = teamRows.map((team) => {
    const sport = sportById.get(team.sport_id);
    const roster = membersByTeam.get(team.id) ?? [];
    const starters = roster.filter((m) => m.role === 'starter');
    const substitutes = roster.filter((m) => m.role === 'substitute');
    const owner = groupById.get(team.owner_group_id);
    const external = roster.filter(
      (m) => participantById.get(m.participant_id)?.group_id !== team.owner_group_id,
    );

    // Elegibles para editar: participantes activos del grupo dueño, más los
    // externos ya presentes en la alineación (aportados por una alianza
    // aceptada).
    const ownParticipants = (participants ?? []).filter(
      (p) => p.group_id === team.owner_group_id && p.active,
    );
    const externalInRoster = roster
      .map((m) => participantById.get(m.participant_id))
      .filter(
        (p): p is NonNullable<typeof p> => Boolean(p) && p!.group_id !== team.owner_group_id,
      );
    const editParticipants = [
      ...ownParticipants,
      ...externalInRoster.filter((p) => !ownParticipants.some((o) => o.id === p.id)),
    ].map((p) => ({
      id: p.id,
      fullName: p.full_name,
      branch: branchName.get(p.branch_id) ?? p.branch_id,
      groupId: p.group_id,
    }));

    return {
      id: team.id,
      name: team.name,
      status: team.status,
      sportId: team.sport_id,
      sportName: sport?.name ?? '',
      sportIcon: sport?.icon ?? '',
      groupId: team.owner_group_id,
      groupName: owner?.name ?? '—',
      startersCount: starters.length,
      teamSize: sport?.team_size ?? null,
      substitutesCount: substitutes.length,
      externalCount: external.length,
      rosterBadges: roster.map((member) => ({
        participantId: member.participant_id,
        fullName: participantById.get(member.participant_id)?.full_name ?? '—',
        role: member.role,
        external: participantById.get(member.participant_id)?.group_id !== team.owner_group_id,
      })),
      valueLabel: sport ? formatCOP(sportFee(sport, settings)) : '—',
      adminNote: team.admin_note,
      edit: sport
        ? {
            sport: {
              id: sport.id,
              name: sport.name,
              teamSize: sport.team_size,
              substitutes: sport.substitutes,
              allowIntergroup: sport.allow_intergroup,
              maxExternal: sport.max_external,
            },
            participants: editParticipants,
            initialStarters: starters.map((m) => m.participant_id),
            initialSubstitutes: substitutes.map((m) => m.participant_id),
          }
        : null,
    };
  });

  // Filas de inscripciones individuales: participantes elegibles = activos
  // del grupo dueño, con rama habilitada para ese deporte (mismo filtro que
  // usa el grupo en /panel/deportes).
  const individualRowsForTable: IndividualRow[] = individualRows.map((registration) => {
    const sport = sportById.get(registration.sport_id);
    const eligibleBranches = branchIdsBySport.get(registration.sport_id) ?? new Set<string>();
    const eligibleParticipants = (participants ?? [])
      .filter((p) => p.group_id === registration.group_id && p.active && eligibleBranches.has(p.branch_id))
      .map((p) => ({
        id: p.id,
        fullName: p.full_name,
        branch: branchName.get(p.branch_id) ?? p.branch_id,
      }));

    return {
      id: registration.id,
      groupName: groupById.get(registration.group_id)?.name ?? '—',
      sportLabel: `${sport?.icon ?? ''} ${sport?.name ?? ''}`.trim(),
      participantsCount: participantsByRegistration.get(registration.id) ?? 0,
      amount: Number(registration.amount),
      status: registration.status,
      fee: sport ? sportFee(sport, settings) : 0,
      eligibleParticipants,
      selectedIds: participantIdsByRegistration.get(registration.id) ?? [],
    };
  });

  // Solo deportes/grupos que de verdad tienen equipos, para no llenar los
  // filtros de opciones que no van a traer resultados.
  const sportsWithTeams = [...new Map(teamRowsForFilter.map((t) => [t.sportId, t.sportName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const groupsWithTeams = [...new Map(teamRowsForFilter.map((t) => [t.groupId, t.groupName])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        title="Equipos e inscripciones"
        description="Todo lo que los grupos han inscrito, por deporte."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🤝" value={teamRows.length} label="Equipos creados" />
        <StatCard icon="✅" value={confirmed} label="Equipos confirmados" tone="success" />
        <StatCard icon="🏅" value={individualRows.length} label="Inscripciones individuales" />
      </div>

      <Panel title={`Equipos (${teamRows.length})`} className="mb-6">
        {teamRows.length === 0 ? (
          <EmptyState icon="🤝" title="Todavía no hay equipos inscritos" />
        ) : (
          <TeamsFilterList teams={teamRowsForFilter} sports={sportsWithTeams} groups={groupsWithTeams} />
        )}
      </Panel>

      <Panel title={`Inscripciones individuales (${individualRows.length})`}>
        {individualRows.length === 0 ? (
          <EmptyState icon="🏅" title="Todavía no hay inscripciones individuales" />
        ) : (
          <IndividualRegistrationsTable rows={individualRowsForTable} />
        )}
      </Panel>
    </>
  );
}
