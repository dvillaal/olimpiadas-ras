import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { formatRelative } from '@/lib/utils';
import { Alert, EmptyState, LinkButton, PageHeader, Panel, StatCard } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';

export const metadata: Metadata = { title: 'Inicio' };

export default async function AdminDashboardPage() {
  const context = await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [groups, participants, teams, individuals, stands, approvedPayments, pendingPayments, audit] =
    await Promise.all([
      supabase.from('groups').select('id, name, code, status, country_code, created_at'),
      supabase.from('participants').select('id', { count: 'exact', head: true }).eq('active', true),
      supabase.from('teams').select('id, status'),
      supabase.from('individual_registrations').select('id, status'),
      supabase.from('stands').select('id, status'),
      supabase.from('payments').select('reported_amount').eq('status', 'approved'),
      supabase
        .from('payments')
        .select('id, concept, reference, expected_amount, created_at, group_id, status')
        .in('status', ['sent', 'correction'])
        .order('created_at', { ascending: true })
        .limit(6),
      // Un admin de alcance 'limited' no debe ver la bitácora: se omite la
      // consulta directamente (además la RLS ya la bloquearía igual).
      context.isFullAdmin
        ? supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(8)
        : Promise.resolve({ data: null }),
    ]);

  const groupRows = groups.data ?? [];
  const approved = groupRows.filter((g) => g.status === 'approved');
  const pendingGroups = groupRows.filter((g) => g.status === 'pending');
  const withCountry = approved.filter((g) => g.country_code).length;

  const confirmedTeams = (teams.data ?? []).filter((t) => t.status === 'confirmed').length;
  const confirmedIndividuals = (individuals.data ?? []).filter((r) => r.status === 'confirmed').length;
  const confirmedStands = (stands.data ?? []).filter((s) => s.status === 'confirmed').length;

  const collected = (approvedPayments.data ?? []).reduce(
    (sum, payment) => sum + Number(payment.reported_amount),
    0,
  );

  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));

  return (
    <>
      <RealtimeRefresher tables={['groups', 'payments', 'stands', 'teams']} announce={false} />

      <PageHeader
        title="Panel de control"
        description={`Estado general de ${settings.event_name}.`}
        actions={
          <>
            <LinkButton href="/admin/reportes" variant="ghost" size="sm">
              📊 Reportes
            </LinkButton>
            <LinkButton href="/admin/configuracion" variant="secondary" size="sm">
              ⚙️ Configuración
            </LinkButton>
          </>
        }
      />

      {pendingGroups.length > 0 && (
        <Alert tone="warning" className="mb-5">
          Hay <b>{pendingGroups.length}</b> solicitud(es) de registro esperando revisión.{' '}
          <Link href="/admin/solicitudes" className="font-bold underline underline-offset-2">
            Revisarlas ahora
          </Link>
        </Alert>
      )}

      {settings.group_team_fee === 0 && (
        <Alert tone="info" className="mb-5">
          La tarifa de <b>deportes grupales</b> está en $0, así que los equipos se confirman sin
          pago. Defínela en{' '}
          <Link href="/admin/configuracion" className="font-bold underline underline-offset-2">
            Configuración
          </Link>{' '}
          si vas a cobrarlos.
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="🧭"
          value={approved.length}
          label="Grupos aprobados"
          hint={pendingGroups.length > 0 ? `${pendingGroups.length} por revisar` : 'Sin pendientes'}
        />
        <StatCard icon="👥" value={participants.count ?? 0} label="Participantes activos" />
        <StatCard
          icon="🌍"
          value={`${withCountry}/${approved.length}`}
          label="Países asignados"
          hint={
            approved.length > 0 && withCountry < approved.length
              ? `${approved.length - withCountry} sin escoger`
              : undefined
          }
        />
        <StatCard
          icon="💰"
          value={formatCOP(collected)}
          label="Recaudado"
          tone="success"
          hint="Solo pagos aprobados"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🤝" value={confirmedTeams} label="Equipos confirmados" />
        <StatCard icon="🏅" value={confirmedIndividuals} label="Inscripciones individuales" />
        <StatCard
          icon="🛍️"
          value={`${confirmedStands}/${settings.stand_limit}`}
          label="Stands confirmados"
          tone={confirmedStands >= settings.stand_limit ? 'warning' : 'default'}
        />
      </div>

      <div className={context.isFullAdmin ? 'grid gap-5 lg:grid-cols-2' : 'grid gap-5'}>
        <Panel
          title="Pagos por revisar"
          description="Los más antiguos primero."
          actions={
            <LinkButton href="/admin/pagos" variant="ghost" size="sm">
              Ver todos
            </LinkButton>
          }
        >
          {(pendingPayments.data ?? []).length === 0 ? (
            <EmptyState icon="✅" title="Todo al día" description="No hay pagos esperando revisión." />
          ) : (
            <ul className="space-y-2.5">
              {(pendingPayments.data ?? []).map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy">{payment.concept}</p>
                    <p className="text-xs text-slate-500">
                      {groupName.get(payment.group_id) ?? 'Grupo'} · Ref. {payment.reference} ·{' '}
                      {formatRelative(payment.created_at)}
                    </p>
                  </div>
                  <span className="font-bold text-scout-700">
                    {formatCOP(Number(payment.expected_amount))}
                  </span>
                  <LinkButton href="/admin/pagos" size="sm" variant="secondary">
                    Revisar
                  </LinkButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {context.isFullAdmin && (
          <Panel title="Actividad reciente" description="Últimos movimientos registrados.">
            {(audit.data ?? []).length === 0 ? (
              <EmptyState icon="📜" title="Sin actividad todavía" />
            ) : (
              <ul className="space-y-3">
                {(audit.data ?? []).map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-scout-400" />
                    <div>
                      <p className="text-navy">{entry.action}</p>
                      <p className="text-xs text-slate-500">
                        {entry.actor_name} · {formatRelative(entry.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
