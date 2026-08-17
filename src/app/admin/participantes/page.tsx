import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ageAt } from '@/lib/domain/eligibility';
import { maskDocument } from '@/lib/utils';
import { PageHeader, StatCard } from '@/components/ui';
import { ParticipantManager } from './participant-manager';
import type { ParticipantRow } from './participant-search';

export const metadata: Metadata = { title: 'Participantes' };

export default async function AdminParticipantsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: participants }, { data: groups }, { data: branches }, { data: teamMembers }] =
    await Promise.all([
      supabase.from('participants').select('*').order('full_name'),
      supabase.from('groups').select('id, code, name').eq('status', 'approved').order('code'),
      supabase.from('branches').select('*').eq('active', true).order('sort_order'),
      supabase.from('team_members').select('participant_id'),
    ]);

  const rows = participants ?? [];
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const inTeams = new Set((teamMembers ?? []).map((m) => m.participant_id));
  const active = rows.filter((p) => p.active);

  const participantRows: ParticipantRow[] = rows.map((participant) => ({
    id: participant.id,
    fullName: participant.full_name,
    document: maskDocument(participant.document),
    documentFull: participant.document,
    docType: participant.doc_type,
    age: ageAt(participant.birthdate),
    branch: branchName.get(participant.branch_id) ?? participant.branch_id,
    branchId: participant.branch_id,
    groupId: participant.group_id,
    groupName: groupById.get(participant.group_id)?.name ?? '—',
    groupCode: groupById.get(participant.group_id)?.code ?? '',
    firstNames: participant.first_names,
    lastNames: participant.last_names,
    birthdate: participant.birthdate,
    gender: participant.gender ?? '',
    notes: participant.notes,
    active: participant.active,
    hasRegistrations: inTeams.has(participant.id),
  }));

  return (
    <>
      <PageHeader
        title="Participantes"
        description="Registro central de todas las personas inscritas por los grupos."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="👥" value={active.length} label="Participantes activos" />
        <StatCard icon="🚫" value={rows.length - active.length} label="Inactivos" />
        <StatCard icon="🏅" value={inTeams.size} label="Con al menos una inscripción" />
      </div>

      <ParticipantManager
        participants={participantRows}
        groups={groups ?? []}
        branches={branches ?? []}
      />
    </>
  );
}
