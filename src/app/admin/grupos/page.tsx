import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { groupStatusView } from '@/lib/domain/status';
import { formatCOP } from '@/lib/domain/fees';
import { formatDate } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';
import { CountryFlag } from '@/components/country-flag';
import { GroupRowActions } from './group-row-actions';

export const metadata: Metadata = { title: 'Grupos' };

export default async function AdminGroupsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: groups }, { data: countries }, { data: participants }, { data: payments }] =
    await Promise.all([
      supabase
        .from('groups')
        .select('*')
        .in('status', ['approved', 'suspended'])
        .order('code', { nullsFirst: false }),
      supabase.from('countries').select('code, name'),
      supabase.from('participants').select('group_id').eq('active', true),
      supabase.from('payments').select('group_id, reported_amount').eq('status', 'approved'),
    ]);

  const rows = groups ?? [];
  const countryName = new Map((countries ?? []).map((c) => [c.code, c.name]));

  // Se agrega en memoria: son decenas de grupos, no vale la pena una vista.
  const participantsByGroup = new Map<string, number>();
  for (const participant of participants ?? []) {
    participantsByGroup.set(
      participant.group_id,
      (participantsByGroup.get(participant.group_id) ?? 0) + 1,
    );
  }

  const paidByGroup = new Map<string, number>();
  for (const payment of payments ?? []) {
    paidByGroup.set(
      payment.group_id,
      (paidByGroup.get(payment.group_id) ?? 0) + Number(payment.reported_amount),
    );
  }

  const active = rows.filter((g) => g.status === 'approved');
  const withoutCountry = active.filter((g) => !g.country_code).length;

  return (
    <>
      <PageHeader
        title="Grupos scouts"
        description="Grupos aprobados y su avance en la inscripción."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🧭" value={active.length} label="Grupos activos" />
        <StatCard
          icon="🌍"
          value={withoutCountry}
          label="Sin país escogido"
          tone={withoutCountry > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon="👥"
          value={(participants ?? []).length}
          label="Participantes registrados"
        />
      </div>

      <Panel title={`Listado (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState
            icon="🧭"
            title="Todavía no hay grupos aprobados"
            description="Aprueba solicitudes desde la bandeja de registro."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th>País</th>
                  <th>Responsable</th>
                  <th className="text-right">Participantes</th>
                  <th className="text-right">Pagado</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((group) => (
                  <tr key={group.id}>
                    <td className="whitespace-nowrap font-mono text-xs font-bold">
                      {group.code ?? '—'}
                    </td>
                    <td>
                      <b className="text-navy">{group.name}</b>
                      <br />
                      <small className="text-slate-500">
                        {[group.city, group.department].filter(Boolean).join(', ') || '—'}
                      </small>
                    </td>
                    <td className="whitespace-nowrap">
                      {group.country_code ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CountryFlag
                            code={group.country_code}
                            name={countryName.get(group.country_code) ?? group.country_code}
                            size="sm"
                          />
                          {countryName.get(group.country_code) ?? group.country_code}
                        </span>
                      ) : (
                        <span className="text-amber-700">Sin escoger</span>
                      )}
                    </td>
                    <td>
                      {group.leader_name}
                      <br />
                      <small className="break-all text-slate-500">{group.leader_email}</small>
                      <br />
                      <small className="text-slate-500">{group.leader_phone}</small>
                    </td>
                    <td className="text-right font-semibold">
                      {participantsByGroup.get(group.id) ?? 0}
                    </td>
                    <td className="whitespace-nowrap text-right font-semibold text-scout-700">
                      {formatCOP(paidByGroup.get(group.id) ?? 0)}
                    </td>
                    <td>
                      <StatusBadge status={groupStatusView(group.status)} />
                      <br />
                      <small className="text-xs text-slate-400">
                        desde {formatDate(group.reviewed_at)}
                      </small>
                    </td>
                    <td>
                      <GroupRowActions
                        groupId={group.id}
                        groupName={group.name}
                        status={group.status}
                        hasCountry={Boolean(group.country_code)}
                      />
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
