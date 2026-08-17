'use client';

import { useState } from 'react';
import type { Branch, Settings } from '@/types/database';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { formatDate } from '@/lib/utils';
import { Alert, Badge, Button, EmptyState, Panel } from '@/components/ui';
import { toggleSportAction } from '../actions';
import { SportForm, type SportRow } from './sport-form';
import { DeleteSportButton } from './delete-sport-button';

export interface SportListItem extends SportRow {
  active: boolean;
  fee: number | null;
  linkedBranchNames: string[];
  teamsCount: number;
  deletable: boolean;
}

/**
 * Lista y formulario conviven en el cliente porque «Editar» debe rellenar el
 * formulario sin recargar la página, igual que en `RefereeManager`.
 */
export function SportManager({
  sports,
  branches,
  settings,
}: {
  sports: SportListItem[];
  branches: Branch[];
  settings: Settings;
}) {
  const [editing, setEditing] = useState<SportRow | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="xl:sticky xl:top-24 xl:self-start">
        <Panel
          title={editing ? `Editando "${editing.name}"` : 'Nuevo deporte'}
          description={
            editing
              ? 'Los cambios se aplican solo a esta rama; marcar otra crea un deporte nuevo.'
              : undefined
          }
        >
          {settings.group_team_fee === 0 && !editing && (
            <Alert tone="info" className="mb-4">
              La tarifa general de deportes grupales es <b>$0</b>. Los deportes que no tengan
              tarifa propia se inscribirán sin pago.
            </Alert>
          )}
          <SportForm
            branches={branches}
            settings={settings}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
        </Panel>
      </div>

      <Panel title={`Deportes configurados (${sports.length})`}>
        {sports.length === 0 ? (
          <EmptyState icon="🏅" title="Todavía no hay deportes" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {sports.map((sport) => {
              const fee = sportFee({ fee: sport.fee, type: sport.type }, settings);
              return (
                <li
                  key={sport.id}
                  className={`rounded-2xl border p-4 ${
                    sport.active ? 'border-line' : 'border-line bg-slate-50 opacity-70'
                  }`}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span
                      aria-hidden
                      className="grid size-12 shrink-0 place-items-center rounded-xl bg-scout-50 text-2xl"
                    >
                      {sport.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-navy">{sport.name}</h4>
                      <p className="text-xs text-slate-500">{sport.category}</p>
                    </div>
                    <Badge tone={sport.type === 'group' ? 'blue' : 'yellow'}>
                      {sport.type === 'group' ? 'Grupal' : 'Individual'}
                    </Badge>
                  </div>

                  {sport.description && (
                    <p className="mb-3 text-sm text-slate-600">{sport.description}</p>
                  )}

                  <dl className="mb-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tarifa</dt>
                      <dd className="font-semibold text-scout-700">
                        {fee > 0 ? formatCOP(fee) : 'Sin costo'}
                        {sport.fee === null && (
                          <span className="ml-1 text-xs font-normal text-slate-400">(general)</span>
                        )}
                      </dd>
                    </div>
                    {sport.type === 'group' && (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Equipo</dt>
                          <dd>
                            {sport.teamSize} titulares
                            {sport.substitutes > 0 && ` + ${sport.substitutes} suplentes`}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Externos</dt>
                          <dd>{sport.allowIntergroup ? `Hasta ${sport.maxExternal}` : 'No permite'}</dd>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Máx. deportes/persona</dt>
                      <dd>{sport.maxSportsPerParticipant}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Cierre</dt>
                      <dd>{sport.deadline ? formatDate(sport.deadline) : 'Sin fecha'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Inscritos</dt>
                      <dd>{sport.teamsCount}</dd>
                    </div>
                  </dl>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {sport.linkedBranchNames.map((name) => (
                      <Badge key={name} tone="gray">
                        {name}
                      </Badge>
                    ))}
                    {sport.linkedBranchNames.length === 0 && (
                      <Badge tone="red">Sin ramas: nadie puede inscribirse</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(sport)}>
                      Editar
                    </Button>

                    <form action={toggleSportAction}>
                      <input type="hidden" name="id" value={sport.id} />
                      <input type="hidden" name="active" value={String(!sport.active)} />
                      <Button type="submit" size="sm" variant="ghost">
                        {sport.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </form>

                    {sport.deletable ? (
                      <DeleteSportButton id={sport.id} name={sport.name} />
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled
                        title="No se puede eliminar: tiene equipos, inscripciones o competencias asociadas. Desactívalo en su lugar."
                      >
                        Eliminar
                      </Button>
                    )}
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
