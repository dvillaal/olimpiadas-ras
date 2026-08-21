import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime, formatRelative } from '@/lib/utils';
import { groupStatusView } from '@/lib/domain/status';
import { EmptyState, PageHeader, Panel, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { ReviewForm } from './review-form';

export const metadata: Metadata = { title: 'Solicitudes de registro' };

export default async function RequestsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase.from('groups').select('*').eq('status', 'pending').order('requested_at'),
    supabase
      .from('groups')
      .select('*')
      .in('status', ['approved', 'rejected'])
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(12),
  ]);

  const pendingRows = pending ?? [];

  return (
    <>
      <RealtimeRefresher tables={['groups']} announce={false} />

      <PageHeader
        title="Solicitudes de registro"
        description="Aprueba o rechaza los grupos que quieren participar. Al aprobar, el sistema crea la cuenta y envía las credenciales por correo."
      />

      <Panel
        title={`Pendientes (${pendingRows.length})`}
        description="Ordenadas de la más antigua a la más reciente."
        className="mb-6"
      >
        {pendingRows.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No hay solicitudes pendientes"
            description="Cuando un grupo se registre, aparecerá aquí para tu revisión."
          />
        ) : (
          <ul className="space-y-4">
            {pendingRows.map((group) => (
              <li key={group.id} className="rounded-2xl border border-line p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-navy">{group.name}</h4>
                    <p className="text-sm text-slate-500">
                      {[group.city, group.department].filter(Boolean).join(', ')} · solicitado{' '}
                      {formatRelative(group.requested_at)}
                    </p>
                  </div>
                  <StatusBadge status={groupStatusView(group.status)} />
                </div>

                <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ['Responsable', group.leader_name],
                    ['Correo', group.leader_email],
                    ['Teléfono', group.leader_phone || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-2">
                      <dt className="font-semibold text-slate-500">{label}:</dt>
                      <dd className="min-w-0 break-words text-navy">{value}</dd>
                    </div>
                  ))}
                </dl>

                {group.notes && (
                  <p className="mb-4 rounded-xl bg-canvas p-3 text-sm text-slate-600">
                    <b className="text-slate-500">Comentarios:</b> {group.notes}
                  </p>
                )}

                <ReviewForm groupId={group.id} groupName={group.name} email={group.leader_email} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Revisadas recientemente">
        {(recent ?? []).length === 0 ? (
          <EmptyState icon="📋" title="Todavía no has revisado solicitudes" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Código</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Revisada</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((group) => (
                  <tr key={group.id}>
                    <td>
                      <b className="text-navy">{group.name}</b>
                      <br />
                      <small className="text-slate-500">{group.city}</small>
                    </td>
                    <td className="font-mono text-xs">{group.code ?? '—'}</td>
                    <td>
                      {group.leader_name}
                      <br />
                      <small className="text-slate-500">{group.leader_email}</small>
                    </td>
                    <td>
                      <StatusBadge status={groupStatusView(group.status)} />
                      {group.rejection_reason && (
                        <p className="mt-1 max-w-xs text-xs text-slate-500">
                          {group.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(group.reviewed_at)}
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
