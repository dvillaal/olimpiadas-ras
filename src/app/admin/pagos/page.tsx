import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { paymentStatusView } from '@/lib/domain/status';
import { formatDate, formatRelative } from '@/lib/utils';
import { EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { PaymentReviewCard } from './payment-review-card';

export const metadata: Metadata = { title: 'Pagos' };

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  await requireAdmin();
  const { estado } = await searchParams;
  const supabase = await createClient();

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: groups } = await supabase.from('groups').select('id, name, code');
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  const rows = payments ?? [];
  const pending = rows.filter((p) => p.status === 'sent');
  const approved = rows.filter((p) => p.status === 'approved');
  const rejected = rows.filter((p) => p.status === 'rejected' || p.status === 'correction');

  const collected = approved.reduce((sum, p) => sum + Number(p.reported_amount), 0);
  const expectedPending = pending.reduce((sum, p) => sum + Number(p.expected_amount), 0);

  const history = estado === 'aprobados' ? approved : estado === 'devueltos' ? rejected : rows;

  return (
    <>
      <RealtimeRefresher tables={['payments']} announce={false} />

      <PageHeader
        title="Pagos"
        description="Verifica cada comprobante contra el extracto bancario antes de aprobar. Al aprobar, la inscripción del grupo queda confirmada automáticamente."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="⏳"
          value={pending.length}
          label="Por revisar"
          tone={pending.length > 0 ? 'warning' : 'default'}
          hint={pending.length > 0 ? formatCOP(expectedPending) : undefined}
        />
        <StatCard icon="✅" value={approved.length} label="Aprobados" tone="success" />
        <StatCard icon="↩️" value={rejected.length} label="Devueltos o rechazados" />
        <StatCard icon="💰" value={formatCOP(collected)} label="Total recaudado" tone="success" />
      </div>

      <Panel
        title={`Pendientes de revisión (${pending.length})`}
        description="Los más antiguos aparecen primero."
        className="mb-6"
      >
        {pending.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No hay pagos por revisar"
            description="Cuando un grupo registre un pago, aparecerá aquí con su comprobante."
          />
        ) : (
          <ul className="space-y-4">
            {[...pending]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((payment) => (
                <li key={payment.id}>
                  <PaymentReviewCard
                    payment={{
                      id: payment.id,
                      concept: payment.concept,
                      reference: payment.reference,
                      expectedAmount: Number(payment.expected_amount),
                      reportedAmount: Number(payment.reported_amount),
                      paymentDate: payment.payment_date,
                      payerName: payment.payer_name,
                      payerDocument: payment.payer_document,
                      originBank: payment.origin_bank,
                      notes: payment.notes,
                      proofPath: payment.proof_path,
                      proofName: payment.proof_name,
                      proofSize: payment.proof_size,
                      createdAt: payment.created_at,
                    }}
                    groupName={groupById.get(payment.group_id)?.name ?? 'Grupo'}
                    groupCode={groupById.get(payment.group_id)?.code ?? ''}
                  />
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Historial"
        description="Todos los pagos registrados, del más reciente al más antiguo."
      >
        {history.length === 0 ? (
          <EmptyState icon="📋" title="Todavía no hay pagos registrados" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Concepto</th>
                  <th>Referencia</th>
                  <th>Esperado</th>
                  <th>Reportado</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((payment) => {
                  const short = Number(payment.reported_amount) < Number(payment.expected_amount);
                  return (
                    <tr key={payment.id}>
                      <td>
                        <b className="text-navy">{groupById.get(payment.group_id)?.name}</b>
                        <br />
                        <small className="font-mono text-slate-400">
                          {groupById.get(payment.group_id)?.code}
                        </small>
                      </td>
                      <td className="max-w-[220px]">{payment.concept}</td>
                      <td className="font-mono text-xs">{payment.reference}</td>
                      <td className="whitespace-nowrap">
                        {formatCOP(Number(payment.expected_amount))}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={short ? 'font-bold text-red-700' : ''}>
                          {formatCOP(Number(payment.reported_amount))}
                        </span>
                        {short && (
                          <small className="block text-xs text-red-600">Menor al esperado</small>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {formatDate(payment.payment_date)}
                        <br />
                        <small className="text-slate-400">
                          enviado {formatRelative(payment.created_at)}
                        </small>
                      </td>
                      <td>
                        <StatusBadge status={paymentStatusView(payment.status)} />
                        {payment.admin_note && (
                          <p className="mt-1 max-w-[200px] text-xs text-slate-500">
                            {payment.admin_note}
                          </p>
                        )}
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
