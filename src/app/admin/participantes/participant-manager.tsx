'use client';

import { useState } from 'react';
import type { Branch } from '@/types/database';
import { Badge, EmptyState, Panel } from '@/components/ui';
import { ParticipantImporter } from '@/components/participant-importer';
import { RegionalMembersImporter } from '@/components/regional-members-importer';
import { ParticipantForm, type ParticipantEditing } from './participant-form';
import { ParticipantSearch, type ParticipantRow } from './participant-search';

/**
 * Formulario, importador y listado conviven en el cliente porque «Editar»
 * debe rellenar el formulario sin recargar la página, igual que en
 * `SportManager` y `RefereeManager`.
 *
 * La base regional se usa una vez cada tanto (para refrescarla), así que
 * vive en un acordeón colapsado por defecto; lo que se usa todo el tiempo
 * —importar y registrar— va apilado y siempre visible, con la importación
 * arriba porque es la vía principal para cargas grandes.
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
  const [regionalOpen, setRegionalOpen] = useState(false);

  return (
    <>
      <section className="panel mb-6">
        <button
          type="button"
          onClick={() => setRegionalOpen((v) => !v)}
          aria-expanded={regionalOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h3 className="text-lg font-bold text-navy">Base regional de miembros</h3>
            {!regionalOpen && (
              <p className="mt-1 text-sm text-slate-500">
                Toca para subirla o actualizarla. Completa documento, nacimiento, género y rama al
                importar por Id Scout.
              </p>
            )}
          </div>
          <span
            aria-hidden
            className={`grid size-8 shrink-0 place-items-center rounded-full border border-line text-slate-500 transition-transform ${
              regionalOpen ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </button>

        {regionalOpen && (
          <div className="mt-4">
            <p className="mb-4 text-sm text-slate-500">
              Súbela una vez y vuelve a subirla cuando llegue una versión más nueva. La importación
              de participantes la usa para completar documento, fecha de nacimiento, género y rama
              a partir del Id Scout.
            </p>
            <RegionalMembersImporter />
          </div>
        )}
      </section>

      <div className="mb-6 space-y-5">
        <Panel
          title="Importar desde Excel o CSV"
          description="El archivo se valida fila por fila antes de guardar nada."
        >
          <ParticipantImporter
            scope="admin"
            groupCodes={groups
              .filter((g) => g.code)
              .map((g) => ({ code: g.code as string, name: g.name }))}
            branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            pinnableGroups={groups}
          />
        </Panel>

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
