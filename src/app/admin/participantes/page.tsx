import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ageAt } from '@/lib/domain/eligibility';
import { maskDocument } from '@/lib/utils';
import { Badge, EmptyState, PageHeader, Panel, StatCard } from '@/components/ui';
import { ParticipantImporter } from '@/components/participant-importer';
import { ParticipantForm } from './participant-form';
import { ParticipantSearch } from './participant-search';

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

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Panel
          title="Registrar participante"
          description="Para cargas grandes usa la importación."
        >
          <ParticipantForm groups={groups ?? []} branches={branches ?? []} />
        </Panel>

        <Panel
          title="Importar desde Excel o CSV"
          description="El archivo se valida fila por fila antes de guardar nada."
        >
          <ParticipantImporter
            scope="admin"
            groupCodes={(groups ?? [])
              .filter((g) => g.code)
              .map((g) => ({ code: g.code as string, name: g.name }))}
            branchIds={(branches ?? []).map((b) => b.id)}
          />
        </Panel>
      </div>

      <Panel title={`Listado (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Todavía no hay participantes"
            description="Regístralos uno a uno o importa la plantilla diligenciada."
          />
        ) : (
          <ParticipantSearch
            participants={rows.map((participant) => ({
              id: participant.id,
              fullName: participant.full_name,
              document: maskDocument(participant.document),
              docType: participant.doc_type,
              age: ageAt(participant.birthdate),
              branch: branchName.get(participant.branch_id) ?? participant.branch_id,
              groupName: groupById.get(participant.group_id)?.name ?? '—',
              groupCode: groupById.get(participant.group_id)?.code ?? '',
              active: participant.active,
              hasRegistrations: inTeams.has(participant.id),
            }))}
          />
        )}
      </Panel>

      <p className="mt-4 text-sm text-slate-500">
        <Badge tone="gray">Nota</Badge> Los documentos se muestran enmascarados. Solo se guardan
        completos en la base de datos, protegidos por las políticas de acceso.
      </p>
    </>
  );
}
