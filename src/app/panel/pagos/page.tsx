import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, requiresPayment, sportFee } from '@/lib/domain/fees';
import { paymentStatusView } from '@/lib/domain/status';
import { formatDate, formatRelative } from '@/lib/utils';
import { Alert, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { cardTitleClass } from '@/lib/fonts';
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

  const stats = [
    { icon: '✅', value: formatCOP(paid), label: 'Pagado y aprobado' },
    { icon: '⏳', value: String(inReview), label: 'En revisión' },
    { icon: '📌', value: formatCOP(totalPending), label: 'Pendiente por pagar' },
    { icon: '↩️', value: String(needsAction.length), label: 'Requieren corrección' },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <RealtimeRefresher groupId={group.id} tables={['payments']} announce={false} />

      <section className="rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <h1 className={cardTitleClass}>Pagos</h1>
        <p className="mt-1 text-sm text-white/75">
          Consigna a la cuenta del evento y registra aquí el comprobante. La organización lo
          verificará.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-lilac px-3.5 py-3">
              <p className="text-xl font-black text-white sm:text-2xl">
                <span aria-hidden className="mr-1">
                  {stat.icon}
                </span>
                {stat.value}
              </p>
              <p className="text-xs font-semibold text-amber-300">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>Cuenta para consignar</h3>
        <div className="rounded-2xl bg-jade p-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Entidad', settings.bank_name],
              ['Tipo de cuenta', settings.bank_account_type],
              ['Número de cuenta', settings.bank_account_number],
              ['NIT', settings.bank_nit],
              ['Titular', settings.bank_holder],
              ['Nombre de la cuenta', settings.bank_label],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-white/70">{label}</dt>
                <dd className="mt-0.5 font-bold text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {needsAction.length > 0 && (
        <Alert tone="warning" title="Pagos devueltos">
          {needsAction.map((payment) => (
            <p key={payment.id} className="mt-1">
              <b>{payment.concept}</b> · {payment.admin_note}
            </p>
          ))}
          <p className="mt-2">Vuelve a registrar el pago con el comprobante corregido.</p>
        </Alert>
      )}

      <section className="rounded-3xl bg-plum p-5 text-white">
        <h3 className={cardTitleClass}>Conceptos por pagar ({pending.length})</h3>
        <p className="mb-3 text-sm text-white/75">Registra un pago por cada concepto.</p>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/25 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              ✅
            </span>
            <p className="font-semibold text-white">No tienes conceptos pendientes</p>
            <p className="mt-1 text-sm text-white/75">
              Todo lo que has inscrito está pagado o no tiene costo.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pending.map((concept) => (
              <li
                key={`${concept.payableType}:${concept.payableId}`}
                className="rounded-2xl border border-white/20 bg-white/10 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <b className="text-white">{concept.label}</b>
                  <span className="text-lg font-extrabold text-amber-300">
                    {formatCOP(concept.amount)}
                  </span>
                </div>

                {concept.blocked ? (
                  <Alert tone="info">{concept.blocked}</Alert>
                ) : (
                  <div className="rounded-2xl bg-jade p-4">
                    <PaymentForm
                      payableType={concept.payableType}
                      payableId={concept.payableId}
                      concept={concept.label}
                      expectedAmount={concept.amount}
                      maxProofMb={settings.max_proof_mb}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>Historial de pagos</h3>

        {paymentRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/30 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              💳
            </span>
            <p className="font-semibold text-white">Todavía no has registrado pagos</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {paymentRows.map((payment) => (
              <li
                key={payment.id}
                className="rounded-2xl border border-white/20 bg-white/10 p-4"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <b className="block truncate text-white">{payment.concept}</b>
                    <p className="font-mono text-xs text-white/60">{payment.reference}</p>
                  </div>
                  <span className="text-lg font-extrabold text-amber-300">
                    {formatCOP(Number(payment.reported_amount))}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-white/70">
                    {formatDate(payment.payment_date)}
                    <br />
                    <small className="text-white/50">
                      enviado {formatRelative(payment.created_at)}
                    </small>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={paymentStatusView(payment.status)} />
                    <ProofLink path={payment.proof_path} name={payment.proof_name} />
                  </div>
                </div>

                {payment.admin_note && (
                  <p className="mt-2 text-xs text-white/70">{payment.admin_note}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
