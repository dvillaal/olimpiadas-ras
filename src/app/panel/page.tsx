import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { computeGroupProgress, registrationStatusView } from '@/lib/domain/status';
import { formatRelative } from '@/lib/utils';
import { CountryFlag } from '@/components/country-flag';
import {
  Alert,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  ProgressBar,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import { NotificationList } from './notification-list';

export const metadata: Metadata = { title: 'Inicio' };

export default async function PanelHomePage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: participants },
    { data: teams },
    { data: individuals },
    { data: stand },
    { data: payments },
    { data: notifications },
    { data: country },
    { data: requests },
  ] = await Promise.all([
    supabase.from('participants').select('id, active').eq('group_id', group.id),
    supabase.from('teams').select('id, name, status').eq('owner_group_id', group.id),
    supabase.from('individual_registrations').select('id, status, amount').eq('group_id', group.id),
    supabase.from('stands').select('*').eq('group_id', group.id).maybeSingle(),
    supabase.from('payments').select('*').eq('group_id', group.id),
    supabase
      .from('notifications')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false })
      .limit(8),
    group.country_code
      ? supabase.from('countries').select('name').eq('code', group.country_code).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('intergroup_requests')
      .select('id, status')
      .eq('target_group_id', group.id)
      .eq('status', 'pending'),
  ]);

  const activeParticipants = (participants ?? []).filter((p) => p.active).length;
  const teamRows = teams ?? [];
  const individualRows = individuals ?? [];
  const paymentRows = payments ?? [];

  const paid = paymentRows
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + Number(p.reported_amount), 0);

  const needsAttention = paymentRows.filter(
    (p) => p.status === 'correction' || p.status === 'rejected',
  );

  const progress = computeGroupProgress({
    hasCountry: Boolean(group.country_code),
    hasParticipants: activeParticipants > 0,
    hasRegistrations: teamRows.length > 0 || individualRows.length > 0,
    allPaymentsSettled:
      paymentRows.length > 0 && paymentRows.every((p) => p.status === 'approved'),
  });

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length;

  return (
    <>
      <PageHeader
        title={`Hola, ${group.name}`}
        description={
          group.country_code
            ? `Representan a ${country?.name ?? group.country_code}.`
            : 'Empieza escogiendo el país que van a representar.'
        }
        actions={
          group.country_code ? (
            <span className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5">
              {country && <CountryFlag code={group.country_code} name={country.name} size="sm" />}
              <b className="text-navy">{country?.name}</b>
            </span>
          ) : (
            <LinkButton href="/panel/pais">🌍 Escoger país</LinkButton>
          )
        }
      />

      {needsAttention.length > 0 && (
        <Alert tone="warning" title="Tienes pagos que requieren tu atención" className="mb-5">
          {needsAttention.map((payment) => (
            <p key={payment.id} className="mt-1">
              <b>{payment.concept}</b>: {payment.admin_note}
            </p>
          ))}
          <LinkButton href="/panel/pagos" size="sm" variant="secondary" className="mt-3">
            Ver mis pagos
          </LinkButton>
        </Alert>
      )}

      {(requests ?? []).length > 0 && (
        <Alert tone="info" className="mb-5">
          Otro grupo pidió apoyo de tus participantes.{' '}
          <LinkButton href="/panel/solicitudes" size="sm" variant="secondary" className="ml-1">
            Responder
          </LinkButton>
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="👥" value={activeParticipants} label="Participantes activos" />
        <StatCard icon="🤝" value={teamRows.length} label="Equipos creados" />
        <StatCard icon="🏅" value={individualRows.length} label="Inscripciones individuales" />
        <StatCard icon="💳" value={formatCOP(paid)} label="Pagado y aprobado" tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Panel title="Tu avance" description="Cuatro pasos para completar la inscripción.">
            <ProgressBar percent={progress.percent} label="Inscripción" />
            <ul className="mt-4 space-y-2.5">
              {progress.steps.map((step) => (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                      step.done ? 'bg-scout-600 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step.done ? '✓' : '·'}
                  </span>
                  <span className={step.done ? 'text-navy' : 'text-slate-500'}>{step.label}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Mis inscripciones"
            actions={
              <LinkButton href="/panel/deportes" size="sm" variant="ghost">
                Inscribir en un deporte
              </LinkButton>
            }
          >
            {teamRows.length === 0 && individualRows.length === 0 ? (
              <EmptyState
                icon="🏅"
                title="Todavía no tienes inscripciones"
                description="Explora los deportes disponibles y arma tus equipos."
                action={<LinkButton href="/panel/deportes">Ver deportes</LinkButton>}
              />
            ) : (
              <ul className="space-y-2.5">
                {teamRows.map((team) => (
                  <li
                    key={team.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy">
                      🤝 {team.name}
                    </span>
                    <StatusBadge status={registrationStatusView(team.status)} />
                  </li>
                ))}
                {individualRows.map((registration) => (
                  <li
                    key={registration.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy">
                      🏅 Inscripción individual
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatCOP(Number(registration.amount))}
                    </span>
                    <StatusBadge status={registrationStatusView(registration.status)} />
                  </li>
                ))}
                {stand && (
                  <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy">
                      🛍️ {stand.name}
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatCOP(Number(stand.amount))}
                    </span>
                    <StatusBadge status={registrationStatusView(stand.status)} />
                  </li>
                )}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title={`Avisos${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            description="Novedades sobre tus pagos y solicitudes."
          >
            {(notifications ?? []).length === 0 ? (
              <EmptyState icon="🔔" title="Sin avisos por ahora" />
            ) : (
              <NotificationList
                notifications={(notifications ?? []).map((n) => ({
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  link: n.link,
                  kind: n.kind,
                  unread: !n.read_at,
                  when: formatRelative(n.created_at),
                }))}
                hasUnread={unreadCount > 0}
              />
            )}
          </Panel>

          <Panel title="Datos para pagos">
            <dl className="space-y-2 text-sm">
              {[
                ['Entidad', settings.bank_name],
                ['Tipo', settings.bank_account_type],
                ['Número', settings.bank_account_number],
                ['NIT', settings.bank_nit],
                ['Titular', settings.bank_holder],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="font-semibold text-navy">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
