import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { intergroupStatusView } from '@/lib/domain/status';
import { formatRelative } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { AllianceReviewPanel, type PendingAlliance } from './review-panel';

export const metadata: Metadata = { title: 'Solicitudes intergrupales' };

export default async function AdminIntergroupPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: requests },
    { data: groups },
    { data: teams },
    { data: sports },
    { data: proposals },
    { data: branches },
  ] = await Promise.all([
    supabase.from('intergroup_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('groups').select('id, name, code'),
    supabase.from('teams').select('id, name, sport_id'),
    supabase.from('sports').select('id, name, icon'),
    supabase.from('intergroup_proposals').select('request_id, participant_id, accepted'),
    supabase.from('branches').select('id, name'),
  ]);

  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b]));

  const rows = requests ?? [];
  const awaitingReview = rows.filter((r) => r.status === 'admin_review');
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'proposed');
  const approved = rows.filter((r) => r.status === 'admin_approved');

  // Solo se cargan los participantes de lo que hay que revisar ahora.
  const reviewParticipantIds = [
    ...new Set(
      (proposals ?? [])
        .filter((p) => p.accepted && awaitingReview.some((r) => r.id === p.request_id))
        .map((p) => p.participant_id),
    ),
  ];

  const { data: people } = reviewParticipantIds.length
    ? await supabase
        .from('participants')
        .select('id, full_name, branch_id')
        .in('id', reviewParticipantIds)
    : { data: [] as { id: string; full_name: string; branch_id: string }[] };

  const personById = new Map((people ?? []).map((p) => [p.id, p]));

  const alliances: PendingAlliance[] = awaitingReview.map((request) => {
    const team = teamById.get(request.team_id);
    const sport = team ? sportById.get(team.sport_id) : undefined;
    return {
      id: request.id,
      teamName: team?.name ?? 'Equipo',
      sportName: sport?.name ?? '',
      sportIcon: sport?.icon ?? '🏅',
      requesterName: groupById.get(request.requester_group_id)?.name ?? '',
      targetName: groupById.get(request.target_group_id)?.name ?? '',
      createdAt: request.created_at,
      borrowed: (proposals ?? [])
        .filter((p) => p.request_id === request.id && p.accepted)
        .map((p) => {
          const person = personById.get(p.participant_id);
          return {
            id: p.participant_id,
            name: person?.full_name ?? 'Participante',
            branchName: person ? (branchById.get(person.branch_id)?.name ?? '') : '',
          };
        }),
    };
  });

  return (
    <>
      <PageHeader
        title="Solicitudes intergrupales"
        description="Los grupos negocian entre ellos, pero la organización verifica a los participantes prestados antes de que el equipo pueda pagar."
      />

      <RealtimeRefresher tables={['intergroup_requests']} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard icon="🔄" value={rows.length} label="Solicitudes totales" />
        <StatCard icon="⏳" value={pending.length} label="Entre grupos" />
        <StatCard
          icon="🔎"
          value={awaitingReview.length}
          label="Esperando tu revisión"
          tone={awaitingReview.length > 0 ? 'warning' : 'default'}
        />
        <StatCard icon="✅" value={approved.length} label="Aprobadas" tone="success" />
      </div>

      <Panel
        title={`Por revisar (${alliances.length})`}
        description="Verifica que los participantes prestados existan y tengan la rama correcta."
        className="mb-5"
      >
        {alliances.length === 0 ? (
          <EmptyState
            icon="✅"
            title="Nada pendiente de revisión"
            description="Cuando dos grupos cierren un préstamo, aparecerá aquí para tu visto bueno."
          />
        ) : (
          <AllianceReviewPanel alliances={alliances} />
        )}
      </Panel>

      <Panel title="Historial completo">
        {rows.length === 0 ? (
          <EmptyState
            icon="🔄"
            title="Ningún grupo ha pedido apoyo todavía"
            description="Aparecerán aquí cuando un grupo necesite completar un equipo con participantes de otro."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Equipo</th>
                  <th>Grupo destino</th>
                  <th className="text-right">Cupos</th>
                  <th>Estado</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => {
                  const team = teamById.get(request.team_id);
                  const sport = team ? sportById.get(team.sport_id) : undefined;
                  return (
                    <tr key={request.id}>
                      <td className="font-semibold text-navy">
                        {groupById.get(request.requester_group_id)?.name}
                      </td>
                      <td>
                        {team?.name}
                        <br />
                        <small className="text-slate-500">
                          {sport?.icon} {sport?.name}
                        </small>
                      </td>
                      <td>{groupById.get(request.target_group_id)?.name}</td>
                      <td className="text-right">{request.slots_requested}</td>
                      <td>
                        <StatusBadge status={intergroupStatusView(request.status)} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {formatRelative(request.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
