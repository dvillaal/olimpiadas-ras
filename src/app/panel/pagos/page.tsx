import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, requiresPayment, sportFee } from '@/lib/domain/fees';
import { paymentStatusView } from '@/lib/domain/status';
import { formatDate, formatRelative } from '@/lib/utils';
import { Alert, EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { PaymentForm } from './payment-form';
import { ProofLink } from './proof-link';
import type { PayableType } from '@/types/database';

export const metadata: Metadata = { title: 'Pagos' };

interface PendingConcept {
  payableType: PayableType;
  payableId: string;
  label: string;
  amount: number;
  blocked?: string;
}

export default async function GroupPaymentsPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: payments },
    { data: teams },
    { data: teamMembers },
    { data: sports },
    { data: individuals },
    { data: stand },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false }),
    supabase.from('teams').select('*').eq('owner_group_id', group.id),
    supabase.from('team_members').select('team_id, role'),
    supabase.from('sports').select('*'),
    supabase.from('individual_registrations').select('*').eq('group_id', group.id),
    supabase.from('stands').select('*').eq('group_id', group.id).maybeSingle(),
  ]);

  const paymentRows = payments ?? [];
  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));

  // Conceptos que ya tienen un pago vivo (enviado o aprobado) no se ofrecen otra vez.
  const settled = new Set(
    paymentRows
      .filter((p) => p.status === 'sent' || p.status === 'approved')
      .map((p) => `${p.payable_type}:${p.payable_id}`),
  );

  const pending: PendingConcept[] = [];

  for (const team of teams ?? []) {
    const sport = sportById.get(team.sport_id);
    if (!sport) continue;

    const amount = sportFee(sport, settings);
    if (!requiresPayment(amount)) continue;
    if (settled.has(`team:${team.id}`)) continue;
    if (team.status === 'confirmed' || team.status === 'cancelled') continue;

    const starters = (teamMembers ?? []).filter(
      (m) => m.team_id === team.id && m.role === 'starter',
    ).length;

    pending.push({
      payableType: 'team',
      payableId: team.id,
      label: `Equipo · ${team.name}`,
      amount,
      // Un equipo incompleto no puede pagarse: evita cobrar por una inscripción
      // que la organización tendría que devolver.
      blocked:
        starters < sport.team_size
          ? `Faltan ${sport.team_size - starters} titular(es) para poder pagar.`
          : undefined,
    });
  }

  for (const registration of individuals ?? []) {
    const amount = Number(registration.amount);
    if (!requiresPayment(amount)) continue;
    if (settled.has(`individual:${registration.id}`)) continue;
    if (registration.status === 'confirmed' || registration.status === 'cancelled') continue;

    pending.push({
      payableType: 'individual',
      payableId: registration.id,
      label: `Individual · ${sportById.get(registration.sport_id)?.name ?? 'Deporte'}`,
      amount,
    });
  }

  if (
    stand &&
    requiresPayment(Number(stand.amount)) &&
    !settled.has(`stand:${stand.id}`) &&
    stand.status !== 'confirmed' &&
    stand.status !== 'cancelled'
  ) {
    pending.push({
      payableType: 'stand',
      payableId: stand.id,
      label: `Stand · ${stand.name}`,
      amount: Number(stand.amount),
    });
  }

  const paid = paymentRows
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.reported_amount), 0);
  const inReview = paymentRows.filter((p) => p.status === 'sent').length;
  const needsAction = paymentRows.filter(
    (p) => p.status === 'correction' || p.status === 'rejected',
  );
  const totalPending = pending.reduce((sum, concept) => sum + concept.amount, 0);

  return (
    <>
      <RealtimeRefresher groupId={group.id} tables={['payments']} announce={false} />

      <PageHeader
        title="Pagos"
        description="Consigna a la cuenta del evento y registra aquí el comprobante. La organización lo verificará."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="✅" value={formatCOP(paid)} label="Pagado y aprobado" tone="success" />
        <StatCard icon="⏳" value={inReview} label="En revisión" />
        <StatCard
          icon="📌"
          value={formatCOP(totalPending)}
          label="Pendiente por pagar"
          tone={totalPending > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon="↩️"
          value={needsAction.length}
          label="Requieren corrección"
          tone={needsAction.length > 0 ? 'danger' : 'default'}
        />
      </div>

      <Panel title="Cuenta para consignar" className="mb-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Entidad', settings.bank_name],
            ['Tipo de cuenta', settings.bank_account_type],
            ['Número de cuenta', settings.bank_account_number],
            ['NIT', settings.bank_nit],
            ['Titular', settings.bank_holder],
            ['Nombre de la cuenta', settings.bank_label],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-canvas p-3">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-bold text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {needsAction.length > 0 && (
        <Alert tone="warning" title="Pagos devueltos" className="mb-6">
          {needsAction.map((payment) => (
            <p key={payment.id} className="mt-1">
              <b>{payment.concept}</b> · {payment.admin_note}
            </p>
          ))}
          <p className="mt-2">Vuelve a registrar el pago con el comprobante corregido.</p>
        </Alert>
      )}

      <Panel
        title={`Conceptos por pagar (${pending.length})`}
        description="Registra un pago por cada concepto."
        className="mb-6"
      >
        {pending.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No tienes conceptos pendientes"
            description="Todo lo que has inscrito está pagado o no tiene costo."
          />
        ) : (
          <ul className="space-y-4">
            {pending.map((concept) => (
              <li
                key={`${concept.payableType}:${concept.payableId}`}
                className="rounded-2xl border border-line p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <b className="text-navy">{concept.label}</b>
                  <span className="text-lg font-extrabold text-scout-700">
                    {formatCOP(concept.amount)}
                  </span>
                </div>

                {concept.blocked ? (
                  <Alert tone="info">{concept.blocked}</Alert>
                ) : (
                  <PaymentForm
                    payableType={concept.payableType}
                    payableId={concept.payableId}
                    concept={concept.label}
                    expectedAmount={concept.amount}
                    maxProofMb={settings.max_proof_mb}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Historial de pagos">
        {paymentRows.length === 0 ? (
          <EmptyState icon="💳" title="Todavía no has registrado pagos" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Referencia</th>
                  <th className="text-right">Valor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-semibold text-navy">{payment.concept}</td>
                    <td className="font-mono text-xs">{payment.reference}</td>
                    <td className="whitespace-nowrap text-right">
                      {formatCOP(Number(payment.reported_amount))}
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
                        <p className="mt-1 max-w-[220px] text-xs text-slate-500">
                          {payment.admin_note}
                        </p>
                      )}
                    </td>
                    <td>
                      <ProofLink path={payment.proof_path} name={payment.proof_name} />
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
