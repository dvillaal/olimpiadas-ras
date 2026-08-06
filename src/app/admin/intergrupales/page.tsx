import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { intergroupStatusView } from '@/lib/domain/status';
import { formatRelative } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';

export const metadata: Metadata = { title: 'Solicitudes intergrupales' };

export default async function AdminIntergroupPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: requests }, { data: groups }, { data: teams }, { data: sports }] =
    await Promise.all([
      supabase.from('intergroup_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('id, name, code'),
      supabase.from('teams').select('id, name, sport_id'),
      supabase.from('sports').select('id, name, icon'),
    ]);

  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));

  const rows = requests ?? [];
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'proposed');
  const accepted = rows.filter((r) => r.status === 'accepted');

  return (
    <>
      <PageHeader
        title="Solicitudes intergrupales"
        description="Seguimiento de los préstamos de participantes entre grupos. La organización solo observa: la negociación es entre los grupos."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🔄" value={rows.length} label="Solicitudes totales" />
        <StatCard icon="⏳" value={pending.length} label="En curso" />
        <StatCard icon="✅" value={accepted.length} label="Aceptadas" tone="success" />
      </div>

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
