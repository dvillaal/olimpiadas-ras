import type { Metadata } from 'next';
import Image from 'next/image';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { computeGroupProgress, registrationStatusView } from '@/lib/domain/status';
import { formatRelative } from '@/lib/utils';
import { displayFont, bodyFont } from '@/lib/fonts';
import { CountryFlag } from '@/components/country-flag';
import { Alert, LinkButton, StatusBadge } from '@/components/ui';
import { NotificationList } from './notification-list';
import { CountdownBanner } from './countdown-banner';

export const metadata: Metadata = { title: 'Inicio' };

export default async function PanelHomePage() {
  const { group, profile } = await requireGroup();
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

  const stats = [
    { label: 'Equipos creados', value: teamRows.length },
    { label: 'Inscripciones individuales', value: individualRows.length },
    { label: 'Participantes activos', value: activeParticipants },
    { label: 'Pagado y aprobado', value: formatCOP(paid) },
  ];

  /** FatFrank para los títulos vistosos de cada tarjeta; Seravek es la base del resto del texto. */
  const titleFont = 'font-[family-name:var(--font-display)]';
  const cardTitle = `${titleFont} text-2xl font-black uppercase tracking-wide`;

  return (
    <>
      <CountdownBanner targetIso={settings.event_starts_at} />

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

      <div
        className={`${displayFont.variable} ${bodyFont.variable} min-w-0 space-y-5 font-[family-name:var(--font-seravek)]`}
      >
        {/* ─── Bienvenida ──────────────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-[0.9fr_1.3fr_0.9fr]">
              <div className="flex flex-col justify-center">
                <p
                  className={`${titleFont} text-6xl font-extrabold uppercase leading-[0.82] text-lilac sm:text-7xl`}
                  style={{ textShadow: '0 2px 0 rgba(0,0,0,0.18)' }}
                >
                  ¡Olim
                  <br />
                  <span className="ml-[0.35em]">pia</span>
                  <br />
                  das!
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                <p className="text-center text-lg font-semibold text-white/80">
                  Hola, {profile.full_name || group.name}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-lilac px-3.5 py-3">
                      <p className="text-xl font-black text-white sm:text-2xl">{stat.value}</p>
                      <p className="text-xs font-semibold text-amber-300">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[160px] self-center sm:mx-0 sm:ml-auto sm:max-w-[200px]">
                <Image
                  src="/login/balon.png"
                  alt=""
                  aria-hidden
                  fill
                  className="object-contain opacity-90"
                  style={{ transform: 'scale(1.55)' }}
                />
                <Image
                  src="/login/trofeo.png"
                  alt=""
                  aria-hidden
                  fill
                  className="object-contain"
                  style={{ transform: 'translateX(-35%) scale(0.9)' }}
                />
              </div>
            </div>
          </section>

          {/* ─── País + Primeros pasos | Avisos ─────────────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              {group.country_code && country && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-scout-600 px-6 py-4 text-white">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                      El país que elegiste es
                    </p>
                    <p className={`truncate ${titleFont} text-2xl font-black uppercase tracking-wide sm:text-3xl`}>
                      {country.name}
                    </p>
                  </div>
                  <CountryFlag code={group.country_code} name={country.name} size="lg" />
                </div>
              )}

              {/* ─── Primeros pasos ──────────────────────────────────────── */}
              <section className="flex flex-col rounded-3xl bg-plum p-6 text-white">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    <h3 className={cardTitle}>Primeros pasos</h3>
                    <p className="text-sm text-white/75">
                      Cuatro pasos para completar la inscripción.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm font-black">
                    {Math.round(progress.percent)}%
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(progress.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progreso de inscripción"
                  className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"
                >
                  <div
                    className="h-full rounded-full bg-white transition-[width] duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, Math.round(progress.percent)))}%` }}
                  />
                </div>

                <ul className="mt-4 flex-1 space-y-2.5">
                  {progress.steps.map((step) => (
                    <li key={step.key} className="flex items-center gap-3 text-sm">
                      <span
                        aria-hidden
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-black ${
                          step.done ? 'bg-white text-scout-700' : 'bg-white/15 text-white/60'
                        }`}
                      >
                        {step.done ? '✓' : '·'}
                      </span>
                      <span className={step.done ? 'text-white' : 'text-white/60'}>
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* ─── Avisos ──────────────────────────────────────────────── */}
            <section className="rounded-3xl bg-scout-600 p-6 text-white">
              <h3 className={cardTitle}>Avisos{unreadCount > 0 ? ` (${unreadCount})` : ''}</h3>
              <p className="mb-4 text-sm text-white/75">Novedades sobre tus pagos y solicitudes.</p>

              {(notifications ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/25 px-4 py-8 text-center">
                  <span className="mb-2 block text-3xl" aria-hidden>
                    🔔
                  </span>
                  <p className="font-semibold text-white">Sin avisos por ahora</p>
                </div>
              ) : (
                <NotificationList
                  tone="dark"
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
            </section>
          </div>

          {/* ─── Mis inscripciones | Datos para pagos ───────────────────── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl bg-scout-600 p-5 text-white">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={cardTitle}>Mis inscripciones</h3>
                <LinkButton
                  href="/panel/deportes"
                  size="sm"
                  className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
                  variant="ghost"
                >
                  Inscribir en un deporte
                </LinkButton>
              </div>

              <div className="rounded-2xl bg-jade p-4">
                {teamRows.length === 0 && individualRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/30 px-4 py-8 text-center">
                    <span className="mb-2 block text-3xl" aria-hidden>
                      🏅
                    </span>
                    <p className="font-semibold text-white">Todavía no tienes inscripciones</p>
                    <p className="mt-1 text-sm text-white/75">
                      Explora los deportes disponibles y arma tus equipos.
                    </p>
                    <LinkButton
                      href="/panel/deportes"
                      size="sm"
                      className="mt-3 !border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
                      variant="ghost"
                    >
                      Ver deportes
                    </LinkButton>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {teamRows.map((team) => (
                      <li
                        key={team.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-white/25 p-3"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">
                          🤝 {team.name}
                        </span>
                        <StatusBadge status={registrationStatusView(team.status)} />
                      </li>
                    ))}
                    {individualRows.map((registration) => (
                      <li
                        key={registration.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-white/25 p-3"
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">
                          🏅 Inscripción individual
                        </span>
                        <span className="text-sm text-white/75">
                          {formatCOP(Number(registration.amount))}
                        </span>
                        <StatusBadge status={registrationStatusView(registration.status)} />
                      </li>
                    ))}
                    {stand && (
                      <li className="flex flex-wrap items-center gap-3 rounded-xl border border-white/25 p-3">
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">
                          🛍️ {stand.name}
                        </span>
                        <span className="text-sm text-white/75">
                          {formatCOP(Number(stand.amount))}
                        </span>
                        <StatusBadge status={registrationStatusView(stand.status)} />
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </section>

            <section className="rounded-3xl bg-plum p-5 text-white">
              <h3 className={`mb-3 ${cardTitle}`}>Datos para pagos</h3>
              <div className="rounded-2xl bg-lilac p-4">
                <dl className="space-y-2 text-sm">
                  {[
                    ['Entidad', settings.bank_name],
                    ['Tipo', settings.bank_account_type],
                    ['Número', settings.bank_account_number],
                    ['NIT', settings.bank_nit],
                    ['Titular', settings.bank_holder],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-white/70">{label}</dt>
                      <dd className="font-semibold text-white">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          </div>
        </div>
    </>
  );
}
