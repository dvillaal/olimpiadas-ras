import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { registrationStatusView } from '@/lib/domain/status';
import { Badge, EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';
import { AdminEditTeamToggle } from './admin-edit-team-toggle';

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
  ] = await Promise.all([
    supabase.from('teams').select('*').order('created_at', { ascending: false }),
    supabase.from('team_members').select('*'),
    supabase.from('participants').select('id, full_name, group_id, branch_id, active'),
    supabase.from('sports').select('*'),
    supabase.from('groups').select('id, name, code'),
    supabase.from('individual_registrations').select('*'),
    supabase.from('individual_registration_participants').select('*'),
    supabase.from('branches').select('id, name'),
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
  for (const link of individualParticipants ?? []) {
    participantsByRegistration.set(
      link.registration_id,
      (participantsByRegistration.get(link.registration_id) ?? 0) + 1,
    );
  }

  const teamRows = teams ?? [];
  const confirmed = teamRows.filter((t) => t.status === 'confirmed').length;
  const individualRows = individuals ?? [];

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
          <ul className="grid gap-4 lg:grid-cols-2">
            {teamRows.map((team) => {
              const sport = sportById.get(team.sport_id);
              const roster = membersByTeam.get(team.id) ?? [];
              const starters = roster.filter((m) => m.role === 'starter');
              const substitutes = roster.filter((m) => m.role === 'substitute');
              const owner = groupById.get(team.owner_group_id);
              const external = roster.filter(
                (m) => participantById.get(m.participant_id)?.group_id !== team.owner_group_id,
              );

              // Elegibles para editar: participantes activos del grupo dueño,
              // más los externos ya presentes en la alineación (aportados por
              // una alianza aceptada).
              const ownParticipants = (participants ?? []).filter(
                (p) => p.group_id === team.owner_group_id && p.active,
              );
              const externalInRoster = roster
                .map((m) => participantById.get(m.participant_id))
                .filter(
                  (p): p is NonNullable<typeof p> =>
                    Boolean(p) && p!.group_id !== team.owner_group_id,
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

              return (
                <li key={team.id} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-navy">{team.name}</h4>
                      <p className="text-sm text-slate-500">
                        {sport?.icon} {sport?.name} · {owner?.name}
                      </p>
                    </div>
                    <StatusBadge status={registrationStatusView(team.status)} />
                  </div>

                  <p className="mb-2 text-sm">
                    <b className="text-navy">
                      {starters.length}/{sport?.team_size ?? '?'}
                    </b>{' '}
                    titulares
                    {substitutes.length > 0 && ` · ${substitutes.length} suplentes`}
                    {external.length > 0 && (
                      <Badge tone="blue" className="ml-2">
                        {external.length} externo(s)
                      </Badge>
                    )}
                  </p>

                  <ul className="mb-3 flex flex-wrap gap-1.5">
                    {roster.map((member) => {
                      const participant = participantById.get(member.participant_id);
                      const isExternal = participant?.group_id !== team.owner_group_id;
                      return (
                        <li key={member.participant_id}>
                          <Badge tone={member.role === 'starter' ? 'green' : 'gray'}>
                            {participant?.full_name ?? '—'}
                            {isExternal && ' ↗'}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>

                  <p className="text-sm text-slate-500">
                    Valor: {sport ? formatCOP(sportFee(sport, settings)) : '—'}
                  </p>

                  {team.admin_note && (
                    <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-slate-600">
                      {team.admin_note}
                    </p>
                  )}

                  {sport && (
                    <div className="mt-3">
                      <AdminEditTeamToggle
                        sport={{
                          id: sport.id,
                          name: sport.name,
                          teamSize: sport.team_size,
                          substitutes: sport.substitutes,
                          allowIntergroup: sport.allow_intergroup,
                          maxExternal: sport.max_external,
                        }}
                        participants={editParticipants}
                        groupId={team.owner_group_id}
                        groupName={owner?.name ?? '—'}
                        teamId={team.id}
                        initialName={team.name}
                        initialStarters={starters.map((m) => m.participant_id)}
                        initialSubstitutes={substitutes.map((m) => m.participant_id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={`Inscripciones individuales (${individualRows.length})`}>
        {individualRows.length === 0 ? (
          <EmptyState icon="🏅" title="Todavía no hay inscripciones individuales" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Deporte</th>
                  <th className="text-right">Participantes</th>
                  <th className="text-right">Valor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {individualRows.map((registration) => (
                  <tr key={registration.id}>
                    <td className="font-semibold text-navy">
                      {groupById.get(registration.group_id)?.name}
                    </td>
                    <td>
                      {sportById.get(registration.sport_id)?.icon}{' '}
                      {sportById.get(registration.sport_id)?.name}
                    </td>
                    <td className="text-right">
                      {participantsByRegistration.get(registration.id) ?? 0}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {formatCOP(Number(registration.amount))}
                    </td>
                    <td>
                      <StatusBadge status={registrationStatusView(registration.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
