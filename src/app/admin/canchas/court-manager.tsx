'use client';

import { useState } from 'react';
import type { Sport } from '@/types/database';
import { Badge, Button, EmptyState, Panel } from '@/components/ui';
import { CourtForm, type CourtRow } from './court-form';
import { DeleteCourtButton } from './delete-court-button';
import { toggleCourtAction } from '../actions';

/**
 * Lista y formulario conviven en el cliente porque «Editar» debe rellenar el
 * formulario sin recargar la página, igual que en `RefereeManager`.
 */
export function CourtManager({
  courts,
  sports,
}: {
  courts: CourtRow[];
  sports: Pick<Sport, 'id' | 'name' | 'icon'>[];
}) {
  const [editing, setEditing] = useState<CourtRow | null>(null);

  const sportName = (id: string) => sports.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <Panel
        title={editing ? `Editando "${editing.name}"` : 'Nueva cancha'}
        description="Marca los deportes que se pueden jugar ahí. Al programar un partido, solo se ofrecerán las canchas habilitadas para ese deporte."
      >
        <CourtForm sports={sports} editing={editing} onCancelEdit={() => setEditing(null)} />
      </Panel>

      <Panel title={`Canchas configuradas (${courts.length})`}>
        {courts.length === 0 ? (
          <EmptyState
            icon="🏟️"
            title="Todavía no hay canchas"
            description="Créalas antes de programar partidos: cada partido necesitará una cancha asignada."
          />
        ) : (
          <ul className="space-y-2.5">
            {courts.map((court) => (
              <li key={court.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <b className="text-navy">{court.name}</b>
                    {court.notes && <p className="text-xs text-slate-500">{court.notes}</p>}
                  </div>

                  <Badge tone={court.active ? 'green' : 'gray'}>
                    {court.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {court.sportIds.length === 0 ? (
                    <span className="text-xs text-slate-400">Sin deportes asignados</span>
                  ) : (
                    court.sportIds.map((id) => (
                      <Badge key={id} tone="blue">
                        {sportName(id)}
                      </Badge>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mr-auto"
                    onClick={() => setEditing(court)}
                  >
                    Editar
                  </Button>

                  <form action={toggleCourtAction}>
                    <input type="hidden" name="id" value={court.id} />
                    <input type="hidden" name="active" value={String(!court.active)} />
                    <Button type="submit" size="sm" variant={court.active ? 'danger' : 'secondary'}>
                      {court.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </form>

                  <DeleteCourtButton id={court.id} name={court.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
