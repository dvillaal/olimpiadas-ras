'use client';

import { useState } from 'react';
import type { Sport } from '@/types/database';
import { Badge, Button, EmptyState, Panel } from '@/components/ui';
import { RefereeForm, type RefereeRow } from './referee-form';
import { toggleRefereeAction } from './actions';

/**
 * Lista y formulario conviven en el cliente porque «Editar» debe rellenar el
 * formulario sin recargar la página.
 */
export function RefereeManager({
  referees,
  sports,
  assignmentCounts,
}: {
  referees: RefereeRow[];
  sports: Pick<Sport, 'id' | 'name' | 'icon'>[];
  assignmentCounts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<RefereeRow | null>(null);

  const sportName = (id: string) => sports.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
      <Panel
        title={editing ? `Editando a ${editing.fullName}` : 'Nuevo árbitro'}
        description={
          editing
            ? 'Los cambios de deportes se aplican de inmediato.'
            : 'Se crea la cuenta y se le envía la contraseña por correo.'
        }
      >
        <RefereeForm sports={sports} editing={editing} onCancelEdit={() => setEditing(null)} />
      </Panel>

      <Panel title={`Árbitros registrados (${referees.length})`}>
        {referees.length === 0 ? (
          <EmptyState
            icon="🧑‍⚖️"
            title="Todavía no hay árbitros"
            description="Regístralos antes de generar la programación: se asignan al crear cada competencia."
          />
        ) : (
          <ul className="space-y-2.5">
            {referees.map((referee) => {
              const assigned = assignmentCounts[referee.id] ?? 0;
              return (
                <li key={referee.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <b className="text-navy">{referee.fullName}</b>
                      <p className="truncate text-xs text-slate-500">{referee.email}</p>
                      {referee.phone && (
                        <p className="text-xs text-slate-400">{referee.phone}</p>
                      )}
                    </div>

                    <Badge tone={referee.active ? 'green' : 'gray'}>
                      {referee.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {referee.sportIds.length === 0 ? (
                      <span className="text-xs text-slate-400">Sin deportes asignados</span>
                    ) : (
                      referee.sportIds.map((id) => (
                        <Badge key={id} tone="blue">
                          {sportName(id)}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-xs text-slate-500">
                      {assigned} competencia{assigned === 1 ? '' : 's'} asignada
                      {assigned === 1 ? '' : 's'}
                    </span>

                    <Button size="sm" variant="secondary" onClick={() => setEditing(referee)}>
                      Editar
                    </Button>

                    <form action={toggleRefereeAction}>
                      <input type="hidden" name="id" value={referee.id} />
                      <input type="hidden" name="active" value={String(!referee.active)} />
                      <Button
                        type="submit"
                        size="sm"
                        variant={referee.active ? 'danger' : 'secondary'}
                      >
                        {referee.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
