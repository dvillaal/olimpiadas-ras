import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { computeGroupProgress, registrationStatusView } from '@/lib/domain/status';
import { ageAt } from '@/lib/domain/eligibility';
import { formatDate } from '@/lib/utils';
import { CountryFlag } from '@/components/country-flag';
import { Alert, Badge, ProgressBar, StatusBadge } from '@/components/ui';
import { cardTitleClass } from '@/lib/fonts';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Resumen' };

/**
 * Hoja consolidada de la inscripción del grupo. Está pensada para imprimirse o
 * guardarse en PDF y llevarla el día del evento.
 */
export default async function GroupSummaryPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: participants },
    { data: teams },
    { data: members },
    { data: sports },
    { data: individuals },
    { data: individualLinks },
    { data: stand },
    { data: payments },
    { data: branches },
    { data: country },
  ] = await Promise.all([
    supabase.from('participants').select('*').eq('group_id', group.id).order('full_name'),
    supabase.from('teams').select('*').eq('owner_group_id', group.id),
    supabase.from('team_members').select('*'),
    supabase.from('sports').select('*'),
    supabase.from('individual_registrations').select('*').eq('group_id', group.id),
    supabase.from('individual_registration_participants').select('*'),
    supabase.from('stands').select('*').eq('group_id', group.id).maybeSingle(),
    supabase.from('payments').select('*').eq('group_id', group.id),
    supabase.from('branches').select('*'),
    group.country_code
      ? supabase.from('countries').select('name').eq('code', group.country_code).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const teamRows = teams ?? [];
  const individualRows = individuals ?? [];
  const paymentRows = payments ?? [];
  const activeParticipants = (participants ?? []).filter((p) => p.active);

  const paid = paymentRows
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.reported_amount), 0);

  // Total comprometido: lo que el grupo debería pagar por todo lo inscrito.
  const committed =
    teamRows
      .filter((t) => t.status !== 'rejected' && t.status !== 'cancelled')
      .reduce((sum, team) => {
        const sport = sportById.get(team.sport_id);
        return sum + (sport ? sportFee(sport, settings) : 0);
      }, 0) +
    individualRows
      .filter((r) => r.status !== 'rejected' && r.status !== 'cancelled')
      .reduce((sum, r) => sum + Number(r.amount), 0) +
    (stand && stand.status !== 'rejected' && stand.status !== 'cancelled'
      ? Number(stand.amount)
      : 0);

  const progress = computeGroupProgress({
    hasCountry: Boolean(group.country_code),
    hasParticipants: activeParticipants.length > 0,
    hasRegistrations: teamRows.length > 0 || individualRows.length > 0,
    allPaymentsSettled: paymentRows.length > 0 && paymentRows.every((p) => p.status === 'approved'),
  });

  const balance = committed - paid;

  return (
    <div className="print-surface min-w-0 space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <div>
          <h1 className={cardTitleClass}>Resumen de inscripción</h1>
          <p className="mt-1 text-sm text-white/75">
            Todo lo que tu grupo ha inscrito, en una sola hoja.
          </p>
        </div>
        <PrintButton />
      </section>

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <div className="flex flex-wrap items-center gap-5">
          {group.country_code && country && (
            <CountryFlag code={group.country_code} name={country.name} size="lg" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className={cardTitleClass}>{group.name}</h2>
            <p className="text-white/75">
              {group.code && <span className="font-mono">{group.code}</span>}
              {country?.name && ` · representa a ${country.name}`}
              {group.city && ` · ${group.city}`}
            </p>
            <p className="mt-1 text-sm text-white/75">
              Responsable: {group.leader_name} · {group.leader_email}
            </p>
          </div>
        </div>

        <div className="mt-5 [&_*]:!text-white">
          <ProgressBar percent={progress.percent} label="Avance de la inscripción" />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-plum p-4 text-white">
          <span className="text-sm text-white/75">Total comprometido</span>
          <b className="mt-1 block text-2xl">{formatCOP(committed)}</b>
        </div>
        <div className="rounded-2xl bg-scout-600 p-4 text-white">
          <span className="text-sm text-white/75">Pagado y aprobado</span>
          <b className="mt-1 block text-2xl">{formatCOP(paid)}</b>
        </div>
        <div className="rounded-2xl bg-plum p-4 text-white">
          <span className="text-sm text-white/75">Saldo</span>
          <b className={`mt-1 block text-2xl ${balance > 0 ? 'text-amber-300' : 'text-white'}`}>
            {formatCOP(Math.max(0, balance))}
          </b>
        </div>
      </div>

      {balance > 0 && (
        <Alert tone="warning" className="no-print">
          Todavía queda un saldo de <b>{formatCOP(balance)}</b> por pagar o por aprobar.
        </Alert>
      )}

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>
          Participantes activos ({activeParticipants.length})
        </h3>
        {activeParticipants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/30 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              👥
            </span>
            <p className="font-semibold text-white">Sin participantes registrados</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {activeParticipants.map((participant) => (
              <li
                key={participant.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 p-3"
              >
                <div className="min-w-0">
                  <b className="block truncate text-white">{participant.full_name}</b>
                  <p className="text-xs text-white/70">
                    {branchName.get(participant.branch_id) ?? participant.branch_id} ·{' '}
                    {ageAt(participant.birthdate)} años · {formatDate(participant.birthdate)}
                  </p>
                </div>
                {participant.notes && (
                  <p className="text-xs text-white/60">{participant.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-plum p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>Equipos ({teamRows.length})</h3>
        {teamRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/25 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              🤝
            </span>
            <p className="font-semibold text-white">Sin equipos inscritos</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {teamRows.map((team) => {
              const sport = sportById.get(team.sport_id);
              const roster = (members ?? []).filter((m) => m.team_id === team.id);
              return (
                <li key={team.id} className="rounded-xl border border-white/20 bg-white/10 p-3.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-white">
                      {sport?.icon} {team.name}
                    </b>
                    <StatusBadge status={registrationStatusView(team.status)} />
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {roster.map((member) => (
                      <li key={member.participant_id}>
                        <Badge tone={member.role === 'starter' ? 'green' : 'gray'}>
                          {participantById.get(member.participant_id)?.full_name ?? 'Externo'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-white/75">
                    {sport?.name} · {sport ? formatCOP(sportFee(sport, settings)) : '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>
          Inscripciones individuales ({individualRows.length})
        </h3>
        {individualRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/30 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              🏅
            </span>
            <p className="font-semibold text-white">Sin inscripciones individuales</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {individualRows.map((registration) => {
              const linked = (individualLinks ?? []).filter(
                (link) => link.registration_id === registration.id,
              );
              return (
                <li
                  key={registration.id}
                  className="rounded-xl border border-white/20 bg-white/10 p-3.5"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-white">
                      {sportById.get(registration.sport_id)?.icon}{' '}
                      {sportById.get(registration.sport_id)?.name}
                    </b>
                    <StatusBadge status={registrationStatusView(registration.status)} />
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {linked.map((link) => (
                      <li key={link.participant_id}>
                        <Badge tone="green">
                          {participantById.get(link.participant_id)?.full_name ?? '—'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-white/75">
                    {formatCOP(Number(registration.amount))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {stand && (
        <section className="rounded-3xl bg-plum p-5 text-white">
          <h3 className={cardTitleClass}>Stand de ventas</h3>
          <div className="mt-2 mb-2 flex flex-wrap items-center justify-between gap-2">
            <b className="text-white">{stand.name}</b>
            <StatusBadge status={registrationStatusView(stand.status)} />
          </div>
          <p className="text-sm text-white/80">{stand.products}</p>
          <p className="mt-2 text-sm text-white/75">
            Responsable: {stand.responsible} · {formatCOP(Number(stand.amount))}
          </p>
        </section>
      )}

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>Pagos registrados</h3>
        {paymentRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/30 px-4 py-8 text-center">
            <span className="mb-2 block text-3xl" aria-hidden>
              💳
            </span>
            <p className="font-semibold text-white">Sin pagos registrados</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {paymentRows.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/10 p-3"
              >
                <div className="min-w-0">
                  <b className="block truncate text-white">{payment.concept}</b>
                  <p className="font-mono text-xs text-white/60">{payment.reference}</p>
                  <p className="text-xs text-white/70">{formatDate(payment.payment_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-amber-300">
                    {formatCOP(Number(payment.reported_amount))}
                  </span>
                  <StatusBadge
                    status={registrationStatusView(
                      payment.status === 'approved' ? 'confirmed' : 'payment_pending',
                    )}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-white/50">
        {settings.event_name} · Generado el {formatDate(new Date().toISOString().slice(0, 10))}
      </p>
    </div>
  );
}
