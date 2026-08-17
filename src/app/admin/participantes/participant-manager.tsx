'use client';

import { useState } from 'react';
import type { Branch } from '@/types/database';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { ParticipantImporter } from '@/components/participant-importer';
import { ParticipantForm, type ParticipantEditing } from './participant-form';
import { ParticipantSearch, type ParticipantRow } from './participant-search';

/**
 * Formulario, importador y listado conviven en el cliente porque «Editar»
 * debe rellenar el formulario sin recargar la página, igual que en
 * `SportManager` y `RefereeManager`.
 */
export function ParticipantManager({
  participants,
  groups,
  branches,
}: {
  participants: ParticipantRow[];
  groups: { id: string; code: string | null; name: string }[];
  branches: Branch[];
}) {
  const [editing, setEditing] = useState<ParticipantEditing | null>(null);

  return (
    <>
      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <Panel
          title={editing ? 'Editar participante' : 'Registrar participante'}
          description={editing ? undefined : 'Para cargas grandes usa la importación.'}
        >
          <ParticipantForm
            groups={groups}
            branches={branches}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
        </Panel>

        <Panel
          title="Importar desde Excel o CSV"
          description="El archivo se valida fila por fila antes de guardar nada."
        >
          <ParticipantImporter
            scope="admin"
            groupCodes={groups
              .filter((g) => g.code)
              .map((g) => ({ code: g.code as string, name: g.name }))}
            branchIds={branches.map((b) => b.id)}
          />
        </Panel>
      </div>

      <Panel title={`Listado (${participants.length})`}>
        {participants.length === 0 ? (
          <EmptyState
            icon="👥"
            title="Todavía no hay participantes"
            description="Regístralos uno a uno o importa la plantilla diligenciada."
          />
        ) : (
          <ParticipantSearch participants={participants} onEdit={setEditing} />
        )}
      </Panel>

      <p className="mt-4 text-sm text-slate-500">
        <Badge tone="gray">Nota</Badge> Los documentos se muestran enmascarados en el listado. Al
        editar a alguien, el formulario sí muestra el documento completo para poder corregirlo.
      </p>
    </>
  );
}
