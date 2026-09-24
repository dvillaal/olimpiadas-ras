import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { requiresPayment, sportFee } from '@/lib/domain/fees';
import { EmptyState, PageHeader, Panel, StatCard } from '@/components/ui';
import { GroupForm } from './group-form';
import { GroupsAccordion, type ConceptRow, type GroupAccordionRow } from './groups-accordion';

export const metadata: Metadata = { title: 'Grupos' };

export default async function AdminGroupsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: groups },
    { data: countries },
    { data: participants },
    { data: payments },
    { data: teams },
    { data: sports },
    { data: individuals },
    { data: stands },
  ] = await Promise.all([
    supabase
      .from('groups')
      .select('*')
      .in('status', ['approved', 'suspended'])
      .order('code', { nullsFirst: false }),
    supabase.from('countries').select('code, name'),
    supabase.from('participants').select('group_id').eq('active', true),
    supabase.from('payments').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('sports').select('*'),
    supabase.from('individual_registrations').select('*'),
    supabase.from('stands').select('*'),
  ]);

  const rows = groups ?? [];
  const countryName = new Map((countries ?? []).map((c) => [c.code, c.name]));
  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));

  // Se agrega en memoria: son decenas de grupos, no vale la pena una vista.
  const participantsByGroup = new Map<string, number>();
  for (const participant of participants ?? []) {
    participantsByGroup.set(
      participant.group_id,
      (participantsByGroup.get(participant.group_id) ?? 0) + 1,
    );
  }

  const paidByGroup = new Map<string, number>();
  for (const payment of payments ?? []) {
    if (payment.status !== 'approved') continue;
    paidByGroup.set(
      payment.group_id,
      (paidByGroup.get(payment.group_id) ?? 0) + Number(payment.reported_amount),
    );
  }

  const active = rows.filter((g) => g.status === 'approved');
  const withoutCountry = active.filter((g) => !g.country_code).length;

  // Filas del acordeón: totales de pagos por estado, más el detalle de cada
  // concepto (pagos ya enviados, y lo que todavía no se ha pagado en
  // absoluto — mismo cálculo de "conceptos por pagar" que ve el grupo en
  // /panel/pagos, para que el admin vea exactamente lo mismo).
  const accordionRows: GroupAccordionRow[] = rows.map((group) => {
    const groupPayments = (payments ?? []).filter((p) => p.group_id === group.id);
    const approvedPayments = groupPayments.filter((p) => p.status === 'approved');
    const inReviewPayments = groupPayments.filter((p) => p.status === 'sent');

    const settled = new Set(
      groupPayments
        .filter((p) => p.status === 'sent' || p.status === 'approved')
        .map((p) => `${p.payable_type}:${p.payable_id}`),
    );

    // Solo lo "en curso" (enviado o en corrección) bloquea volver a ofrecer
    // el concepto: uno ya aprobado no debe impedir cobrar una diferencia
    // posterior (equipos individuales a los que se les agregó gente después
    // de confirmados — ver más abajo).
    const openPayable = new Set(
      groupPayments
        .filter((p) => p.status === 'sent' || p.status === 'correction')
        .map((p) => `${p.payable_type}:${p.payable_id}`),
    );

    const pendingConcepts: ConceptRow[] = [];

    for (const team of (teams ?? []).filter((t) => t.owner_group_id === group.id)) {
      const sport = sportById.get(team.sport_id);
      if (!sport) continue;
      const amount = sportFee(sport, settings);
      if (!requiresPayment(amount)) continue;
      if (settled.has(`team:${team.id}`)) continue;
      if (team.status === 'confirmed' || team.status === 'cancelled') continue;
      pendingConcepts.push({ concept: `Equipo · ${team.name}`, amount, status: 'pending' });
    }

    for (const registration of (individuals ?? []).filter((r) => r.group_id === group.id)) {
      if (registration.status === 'cancelled') continue;

      // `amount` se recalcula solo (tarifa × personas): si se agregó gente a
      // una inscripción ya confirmada, lo que falta por pagar es la
      // diferencia contra lo ya aprobado, no el total otra vez.
      const alreadyApproved = groupPayments
        .filter(
          (p) => p.payable_type === 'individual' && p.payable_id === registration.id && p.status === 'approved',
        )
        .reduce((sum, p) => sum + Number(p.reported_amount), 0);
      const owed = Number(registration.amount) - alreadyApproved;

      if (!requiresPayment(owed)) continue;
      if (openPayable.has(`individual:${registration.id}`)) continue;

      pendingConcepts.push({
        concept:
          `Individual · ${sportById.get(registration.sport_id)?.name ?? 'Deporte'}` +
          (alreadyApproved > 0 ? ' (diferencia por integrantes nuevos)' : ''),
        amount: owed,
        status: 'pending',
      });
    }

    for (const stand of (stands ?? []).filter((s) => s.group_id === group.id)) {
      if (
        requiresPayment(Number(stand.amount)) &&
        !settled.has(`stand:${stand.id}`) &&
        stand.status !== 'confirmed' &&
        stand.status !== 'cancelled'
      ) {
        pendingConcepts.push({
          concept: `Stand · ${stand.name}`,
          amount: Number(stand.amount),
          status: 'pending',
        });
      }
    }

    const concepts: ConceptRow[] = [
      ...groupPayments
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((p) => ({
          concept: p.concept,
          amount: Number(p.reported_amount),
          status: p.status,
          payment: {
            id: p.id,
            concept: p.concept,
            reference: p.reference,
            expectedAmount: Number(p.expected_amount),
            reportedAmount: Number(p.reported_amount),
            paymentDate: p.payment_date,
            payerName: p.payer_name,
            payerDocument: p.payer_document,
            originBank: p.origin_bank,
            notes: p.notes,
            proofPath: p.proof_path,
            proofName: p.proof_name,
            proofSize: p.proof_size,
            createdAt: p.created_at,
          },
        })),
      ...pendingConcepts,
    ];

    return {
      id: group.id,
      code: group.code,
      name: group.name,
      city: group.city,
      department: group.department,
      countryCode: group.country_code,
      countryName: group.country_code
        ? (countryName.get(group.country_code) ?? group.country_code)
        : '',
      leaderName: group.leader_name,
      leaderEmail: group.leader_email,
      leaderPhone: group.leader_phone,
      status: group.status,
      reviewedAt: group.reviewed_at,
      participantsCount: participantsByGroup.get(group.id) ?? 0,
      paidTotal: paidByGroup.get(group.id) ?? 0,
      approvedTotal: approvedPayments.reduce((sum, p) => sum + Number(p.reported_amount), 0),
      approvedCount: approvedPayments.length,
      inReviewTotal: inReviewPayments.reduce((sum, p) => sum + Number(p.reported_amount), 0),
      inReviewCount: inReviewPayments.length,
      pendingTotal: pendingConcepts.reduce((sum, c) => sum + c.amount, 0),
      pendingCount: pendingConcepts.length,
      concepts,
    };
  });

  return (
    <>
      <PageHeader
        title="Grupos scouts"
        description="Grupos aprobados y su avance en la inscripción."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🧭" value={active.length} label="Grupos activos" />
        <StatCard
          icon="🌍"
          value={withoutCountry}
          label="Sin país escogido"
          tone={withoutCountry > 0 ? 'warning' : 'success'}
        />
        <StatCard
          icon="👥"
          value={(participants ?? []).length}
          label="Participantes registrados"
        />
      </div>

      <div className="mb-5">
        <Panel
          title="Crear grupo"
          description="El grupo queda aprobado de inmediato y las credenciales se envían por correo."
        >
          <GroupForm />
        </Panel>
      </div>

      <div>
        <Panel title={`Listado (${rows.length})`}>
          {rows.length === 0 ? (
            <EmptyState
              icon="🧭"
              title="Todavía no hay grupos aprobados"
              description="Aprueba solicitudes desde la bandeja de registro o crea un grupo manualmente."
            />
          ) : (
            <GroupsAccordion groups={accordionRows} />
          )}
        </Panel>
      </div>
    </>
  );
}
