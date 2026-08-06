import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { EmptyState, PageHeader, Panel, ProgressBar, StatCard } from '@/components/ui';
import { ExportButtons } from './export-buttons';

export const metadata: Metadata = { title: 'Reportes' };

export default async function AdminReportsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: groups },
    { data: participants },
    { data: sports },
    { data: teams },
    { data: teamMembers },
    { data: individuals },
    { data: individualParticipants },
    { data: payments },
    { data: stands },
    { data: branches },
  ] = await Promise.all([
    supabase.from('groups').select('*').in('status', ['approved', 'suspended']).order('code'),
    supabase.from('participants').select('*'),
    supabase.from('sports').select('*').order('sort_order'),
    supabase.from('teams').select('*'),
    supabase.from('team_members').select('*'),
    supabase.from('individual_registrations').select('*'),
    supabase.from('individual_registration_participants').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('stands').select('*'),
    supabase.from('branches').select('*').order('sort_order'),
  ]);

  const groupRows = groups ?? [];
  const participantRows = participants ?? [];
  const sportRows = sports ?? [];
  const paymentRows = payments ?? [];

  const groupById = new Map(groupRows.map((g) => [g.id, g]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  // ─── Recaudo ──────────────────────────────────────────────────────────────
  const approvedPayments = paymentRows.filter((p) => p.status === 'approved');
  const collected = approvedPayments.reduce((sum, p) => sum + Number(p.reported_amount), 0);
  const pendingAmount = paymentRows
    .filter((p) => p.status === 'sent')
    .reduce((sum, p) => sum + Number(p.expected_amount), 0);

  // ─── Participación por deporte ────────────────────────────────────────────
  const teamsBySport = new Map<string, number>();
  const athletesBySport = new Map<string, number>();

  for (const team of teams ?? []) {
    if (team.status === 'rejected' || team.status === 'cancelled') continue;
    teamsBySport.set(team.sport_id, (teamsBySport.get(team.sport_id) ?? 0) + 1);
    const roster = (teamMembers ?? []).filter((m) => m.team_id === team.id).length;
    athletesBySport.set(team.sport_id, (athletesBySport.get(team.sport_id) ?? 0) + roster);
  }

  for (const registration of individuals ?? []) {
    if (registration.status === 'rejected' || registration.status === 'cancelled') continue;
    const count = (individualParticipants ?? []).filter(
      (link) => link.registration_id === registration.id,
    ).length;
    athletesBySport.set(
      registration.sport_id,
      (athletesBySport.get(registration.sport_id) ?? 0) + count,
    );
  }

  const maxAthletes = Math.max(1, ...athletesBySport.values());

  // ─── Distribución por rama ────────────────────────────────────────────────
  const byBranch = new Map<string, number>();
  for (const participant of participantRows) {
    if (!participant.active) continue;
    byBranch.set(participant.branch_id, (byBranch.get(participant.branch_id) ?? 0) + 1);
  }

  // ─── Avance por grupo ─────────────────────────────────────────────────────
  const progressRows = groupRows.map((group) => {
    const own = participantRows.filter((p) => p.group_id === group.id && p.active).length;
    const groupTeams = (teams ?? []).filter((t) => t.owner_group_id === group.id);
    const confirmedTeams = groupTeams.filter((t) => t.status === 'confirmed').length;
    const paid = approvedPayments
      .filter((p) => p.group_id === group.id)
      .reduce((sum, p) => sum + Number(p.reported_amount), 0);
    const hasStand = (stands ?? []).some((s) => s.group_id === group.id);

    const steps = [
      Boolean(group.country_code),
      own > 0,
      groupTeams.length > 0 || (individuals ?? []).some((r) => r.group_id === group.id),
      paid > 0 || groupTeams.every((t) => t.status === 'confirmed'),
    ];

    return {
      id: group.id,
      code: group.code ?? '—',
      name: group.name,
      country: group.country_code ?? '',
      participants: own,
      teams: groupTeams.length,
      confirmedTeams,
      paid,
      hasStand,
      percent: Math.round((steps.filter(Boolean).length / steps.length) * 100),
    };
  });

  // Datos ya aplanados para las exportaciones del cliente.
  const exportData = {
    participantes: participantRows.map((p) => ({
      GRUPO: groupById.get(p.group_id)?.name ?? '',
      CODIGO_GRUPO: groupById.get(p.group_id)?.code ?? '',
      TIPO_DOCUMENTO: p.doc_type,
      NUMERO_DOCUMENTO: p.document,
      NOMBRES: p.first_names,
      APELLIDOS: p.last_names,
      FECHA_NACIMIENTO: p.birthdate,
      RAMA: branchName.get(p.branch_id) ?? p.branch_id,
      GENERO: p.gender ?? '',
      TELEFONO: p.phone,
      CORREO: p.email ?? '',
      ESTADO: p.active ? 'ACTIVO' : 'INACTIVO',
      OBSERVACIONES: p.notes,
    })),
    pagos: paymentRows.map((p) => ({
      GRUPO: groupById.get(p.group_id)?.name ?? '',
      CODIGO_GRUPO: groupById.get(p.group_id)?.code ?? '',
      CONCEPTO: p.concept,
      REFERENCIA: p.reference,
      VALOR_ESPERADO: p.expected_amount,
      VALOR_REPORTADO: p.reported_amount,
      FECHA_PAGO: p.payment_date,
      PAGADOR: p.payer_name,
      BANCO_ORIGEN: p.origin_bank,
      ESTADO: p.status,
      OBSERVACION_ADMIN: p.admin_note,
    })),
    equipos: (teams ?? []).map((t) => {
      const sport = sportRows.find((s) => s.id === t.sport_id);
      const roster = (teamMembers ?? []).filter((m) => m.team_id === t.id);
      return {
        GRUPO: groupById.get(t.owner_group_id)?.name ?? '',
        CODIGO_GRUPO: groupById.get(t.owner_group_id)?.code ?? '',
        DEPORTE: sport?.name ?? '',
        EQUIPO: t.name,
        TITULARES: roster.filter((m) => m.role === 'starter').length,
        SUPLENTES: roster.filter((m) => m.role === 'substitute').length,
        VALOR: sport ? sportFee(sport, settings) : 0,
        ESTADO: t.status,
      };
    }),
    grupos: progressRows.map((g) => ({
      CODIGO: g.code,
      GRUPO: g.name,
      PAIS: g.country,
      PARTICIPANTES: g.participants,
      EQUIPOS: g.teams,
      EQUIPOS_CONFIRMADOS: g.confirmedTeams,
      PAGADO: g.paid,
      STAND: g.hasStand ? 'SI' : 'NO',
      AVANCE: `${g.percent}%`,
    })),
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Consolidados del evento y exportaciones para trabajar fuera del sistema."
        actions={<ExportButtons data={exportData} eventName={settings.event_name} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="💰" value={formatCOP(collected)} label="Recaudado" tone="success" />
        <StatCard icon="⏳" value={formatCOP(pendingAmount)} label="Por confirmar" tone="warning" />
        <StatCard icon="👥" value={participantRows.filter((p) => p.active).length} label="Participantes activos" />
        <StatCard icon="🧭" value={groupRows.length} label="Grupos" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Participación por deporte" description="Deportistas inscritos en cada disciplina.">
          {sportRows.length === 0 ? (
            <EmptyState icon="🏅" title="Sin deportes configurados" />
          ) : (
            <ul className="space-y-3">
              {sportRows.map((sport) => {
                const athletes = athletesBySport.get(sport.id) ?? 0;
                return (
                  <li key={sport.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-navy">
                        {sport.icon} {sport.name}
                      </span>
                      <span className="text-slate-500">
                        {athletes} deportista{athletes === 1 ? '' : 's'}
                        {sport.type === 'group' && ` · ${teamsBySport.get(sport.id) ?? 0} equipos`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-scout-500"
                        style={{ width: `${(athletes / maxAthletes) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Distribución por rama">
          {byBranch.size === 0 ? (
            <EmptyState icon="🌿" title="Sin participantes todavía" />
          ) : (
            <ul className="space-y-3">
              {[...byBranch.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([branchId, count]) => (
                  <li key={branchId} className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-navy">
                      {branchName.get(branchId) ?? branchId}
                    </span>
                    <span className="text-slate-500">{count}</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Avance por grupo" className="mt-5">
        {progressRows.length === 0 ? (
          <EmptyState icon="🧭" title="Sin grupos aprobados" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Grupo</th>
                  <th className="text-right">Participantes</th>
                  <th className="text-right">Equipos</th>
                  <th className="text-right">Pagado</th>
                  <th>Stand</th>
                  <th className="min-w-40">Avance</th>
                </tr>
              </thead>
              <tbody>
                {progressRows.map((group) => (
                  <tr key={group.id}>
                    <td className="font-mono text-xs font-bold">{group.code}</td>
                    <td className="font-semibold text-navy">{group.name}</td>
                    <td className="text-right">{group.participants}</td>
                    <td className="text-right">
                      {group.confirmedTeams}/{group.teams}
                    </td>
                    <td className="whitespace-nowrap text-right">{formatCOP(group.paid)}</td>
                    <td>{group.hasStand ? '✓' : '—'}</td>
                    <td>
                      <ProgressBar percent={group.percent} />
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
