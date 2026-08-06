import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { computeGroupProgress, registrationStatusView } from '@/lib/domain/status';
import { ageAt } from '@/lib/domain/eligibility';
import { flagOf, formatDate } from '@/lib/utils';
import {
  Alert,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  ProgressBar,
  StatusBadge,
} from '@/components/ui';
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
    <>
      <PageHeader
        title="Resumen de inscripción"
        description="Todo lo que tu grupo ha inscrito, en una sola hoja."
        actions={<PrintButton />}
      />

      <Panel className="mb-5">
        <div className="flex flex-wrap items-center gap-5">
          {group.country_code && (
            <span aria-hidden className="text-5xl leading-none">
              {flagOf(group.country_code)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-navy">{group.name}</h2>
            <p className="text-slate-500">
              {group.code && <span className="font-mono">{group.code}</span>}
              {country?.name && ` · representa a ${country.name}`}
              {group.city && ` · ${group.city}`}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Responsable: {group.leader_name} · {group.leader_email}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <ProgressBar percent={progress.percent} label="Avance de la inscripción" />
        </div>
      </Panel>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <span className="text-sm text-slate-500">Total comprometido</span>
          <b className="mt-1 block text-2xl text-navy">{formatCOP(committed)}</b>
        </div>
        <div className="panel">
          <span className="text-sm text-slate-500">Pagado y aprobado</span>
          <b className="mt-1 block text-2xl text-scout-700">{formatCOP(paid)}</b>
        </div>
        <div className="panel">
          <span className="text-sm text-slate-500">Saldo</span>
          <b
            className={`mt-1 block text-2xl ${balance > 0 ? 'text-amber-700' : 'text-scout-700'}`}
          >
            {formatCOP(Math.max(0, balance))}
          </b>
        </div>
      </div>

      {balance > 0 && (
        <Alert tone="warning" className="mb-5 no-print">
          Todavía queda un saldo de <b>{formatCOP(balance)}</b> por pagar o por aprobar.
        </Alert>
      )}

      <Panel title={`Participantes activos (${activeParticipants.length})`} className="mb-5">
        {activeParticipants.length === 0 ? (
          <EmptyState icon="👥" title="Sin participantes registrados" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rama</th>
                  <th className="text-right">Edad</th>
                  <th>Nacimiento</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {activeParticipants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="font-semibold text-navy">{participant.full_name}</td>
                    <td>{branchName.get(participant.branch_id) ?? participant.branch_id}</td>
                    <td className="text-right">{ageAt(participant.birthdate)}</td>
                    <td className="whitespace-nowrap text-xs">
                      {formatDate(participant.birthdate)}
                    </td>
                    <td className="text-xs text-slate-500">{participant.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Equipos (${teamRows.length})`} className="mb-5">
        {teamRows.length === 0 ? (
          <EmptyState icon="🤝" title="Sin equipos inscritos" />
        ) : (
          <ul className="space-y-4">
            {teamRows.map((team) => {
              const sport = sportById.get(team.sport_id);
              const roster = (members ?? []).filter((m) => m.team_id === team.id);
              return (
                <li key={team.id} className="rounded-xl border border-line p-3.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-navy">
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
                  <p className="mt-2 text-sm text-slate-500">
                    {sport?.name} · {sport ? formatCOP(sportFee(sport, settings)) : '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title={`Inscripciones individuales (${individualRows.length})`} className="mb-5">
        {individualRows.length === 0 ? (
          <EmptyState icon="🏅" title="Sin inscripciones individuales" />
        ) : (
          <ul className="space-y-3">
            {individualRows.map((registration) => {
              const linked = (individualLinks ?? []).filter(
                (link) => link.registration_id === registration.id,
              );
              return (
                <li key={registration.id} className="rounded-xl border border-line p-3.5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-navy">
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
                  <p className="mt-2 text-sm text-slate-500">
                    {formatCOP(Number(registration.amount))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {stand && (
        <Panel title="Stand de ventas" className="mb-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <b className="text-navy">{stand.name}</b>
            <StatusBadge status={registrationStatusView(stand.status)} />
          </div>
          <p className="text-sm text-slate-600">{stand.products}</p>
          <p className="mt-2 text-sm text-slate-500">
            Responsable: {stand.responsible} · {formatCOP(Number(stand.amount))}
          </p>
        </Panel>
      )}

      <Panel title="Pagos registrados">
        {paymentRows.length === 0 ? (
          <EmptyState icon="💳" title="Sin pagos registrados" />
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
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.concept}</td>
                    <td className="font-mono text-xs">{payment.reference}</td>
                    <td className="whitespace-nowrap text-right">
                      {formatCOP(Number(payment.reported_amount))}
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td>
                      <StatusBadge
                        status={registrationStatusView(
                          payment.status === 'approved' ? 'confirmed' : 'payment_pending',
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="mt-6 text-center text-xs text-slate-400">
        {settings.event_name} · Generado el {formatDate(new Date().toISOString().slice(0, 10))}
      </p>
    </>
  );
}
