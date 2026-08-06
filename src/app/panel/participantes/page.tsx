import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ageAt } from '@/lib/domain/eligibility';
import { Badge, EmptyState, PageHeader, Panel, StatCard } from '@/components/ui';
import { ParticipantImporter } from '@/components/participant-importer';
import { OwnParticipantForm } from './own-participant-form';

export const metadata: Metadata = { title: 'Mis participantes' };

export default async function GroupParticipantsPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const [{ data: participants }, { data: branches }, { data: teamMembers }, { data: individualLinks }] =
    await Promise.all([
      supabase.from('participants').select('*').eq('group_id', group.id).order('full_name'),
      supabase.from('branches').select('*').eq('active', true).order('sort_order'),
      supabase.from('team_members').select('participant_id'),
      supabase.from('individual_registration_participants').select('participant_id'),
    ]);

  const rows = participants ?? [];
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const registered = new Set([
    ...(teamMembers ?? []).map((m) => m.participant_id),
    ...(individualLinks ?? []).map((l) => l.participant_id),
  ]);

  const active = rows.filter((p) => p.active);

  return (
    <>
      <PageHeader
        title="Mis participantes"
        description="Registra a las personas de tu grupo. Solo quienes estén activos podrán inscribirse en deportes."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="👥" value={active.length} label="Activos" />
        <StatCard icon="🚫" value={rows.length - active.length} label="Inactivos" />
        <StatCard
          icon="🏅"
          value={rows.filter((p) => registered.has(p.id)).length}
          label="Ya inscritos en algún deporte"
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Panel title="Registrar participante">
          <OwnParticipantForm branches={branches ?? []} />
        </Panel>

        <Panel
          title="Importar desde Excel o CSV"
          description="Todas las filas se asignarán a tu grupo automáticamente."
        >
          <ParticipantImporter
            scope="group"
            groupCodes={group.code ? [{ code: group.code, name: group.name }] : []}
            branchIds={(branches ?? []).map((b) => b.id)}
          />
        </Panel>
      </div>

      <Panel title={`Listado (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Todavía no tienes participantes"
            description="Regístralos uno a uno o descarga la plantilla e impórtalos de una vez."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participante</th>
                  <th>Rama</th>
                  <th className="text-right">Edad</th>
                  <th>Documento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((participant) => (
                  <tr key={participant.id}>
                    <td>
                      <b className="text-navy">{participant.full_name}</b>
                      {participant.notes && (
                        <>
                          <br />
                          <small className="text-slate-500">{participant.notes}</small>
                        </>
                      )}
                    </td>
                    <td>{branchName.get(participant.branch_id) ?? participant.branch_id}</td>
                    <td className="text-right">{ageAt(participant.birthdate)}</td>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {participant.doc_type} {participant.document}
                    </td>
                    <td>
                      <Badge tone={participant.active ? 'green' : 'gray'}>
                        {participant.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      {registered.has(participant.id) && (
                        <Badge tone="blue" className="ml-1">
                          Inscrito
                        </Badge>
                      )}
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
