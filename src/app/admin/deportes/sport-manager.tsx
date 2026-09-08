'use client';

import { useMemo, useState } from 'react';
import type { Branch, Settings } from '@/types/database';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { formatDate, normalizeSearch } from '@/lib/utils';
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

type TypeFilter = 'all' | 'group' | 'individual';
type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * Lista y formulario conviven en el cliente porque «Editar» debe rellenar el
 * formulario sin recargar la página, igual que en `RefereeManager`.
 *
 * El formulario vive en un acordeón (colapsado por defecto) y la lista tiene
 * filtros: con muchos deportes configurados, buscar uno a simple vista se
 * complica.
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
  const [formOpen, setFormOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  function startEditing(sport: SportRow) {
    setEditing(sport);
    setFormOpen(true);
  }

  const filteredSports = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return sports.filter((sport) => {
      if (query && !normalizeSearch(`${sport.name} ${sport.category}`).includes(query)) {
        return false;
      }
      if (typeFilter !== 'all' && sport.type !== typeFilter) return false;
      if (branchFilter !== 'all' && !sport.branchIds.includes(branchFilter)) return false;
      if (statusFilter === 'active' && !sport.active) return false;
      if (statusFilter === 'inactive' && sport.active) return false;
      return true;
    });
  }, [sports, search, typeFilter, branchFilter, statusFilter]);

  const filtersActive =
    search.trim() !== '' ||
    typeFilter !== 'all' ||
    branchFilter !== 'all' ||
    statusFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setTypeFilter('all');
    setBranchFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="space-y-5">
      <section className="panel">
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div>
            <h3 className="text-lg font-bold text-navy">
              {editing ? `Editando "${editing.name}"` : 'Nuevo deporte'}
            </h3>
            {!formOpen && (
              <p className="mt-1 text-sm text-slate-500">
                {editing ? 'Toca para ver el formulario de edición.' : 'Toca para agregar un deporte.'}
              </p>
            )}
          </div>
          <span
            aria-hidden
            className={`grid size-8 shrink-0 place-items-center rounded-full border border-line text-slate-500 transition-transform ${
              formOpen ? 'rotate-180' : ''
            }`}
          >
            ⌄
          </span>
        </button>

        {formOpen && (
          <div className="mt-4">
            {editing && (
              <p className="mb-4 text-sm text-slate-500">
                Los cambios se aplican solo a esta rama; marcar otra crea un deporte nuevo.
              </p>
            )}
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
              onCancelEdit={() => {
                setEditing(null);
                setFormOpen(false);
              }}
            />
          </div>
        )}
      </section>

      <Panel title={`Deportes configurados (${filteredSports.length} de ${sports.length})`}>
        {sports.length > 0 && (
          <div className="mb-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o categoría…"
                className="field-input lg:col-span-2"
                aria-label="Buscar deporte"
              />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="field-input"
                aria-label="Filtrar por tipo"
              >
                <option value="all">Todos los tipos</option>
                <option value="group">Grupal</option>
                <option value="individual">Individual</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="field-input"
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            {branches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Rama:
                </span>
                <button
                  type="button"
                  onClick={() => setBranchFilter('all')}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    branchFilter === 'all'
                      ? 'border-scout-600 bg-scout-600 text-white'
                      : 'border-line text-slate-600 hover:border-scout-300'
                  }`}
                >
                  Todas
                </button>
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => setBranchFilter(branch.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      branchFilter === branch.id
                        ? 'border-scout-600 bg-scout-600 text-white'
                        : 'border-line text-slate-600 hover:border-scout-300'
                    }`}
                  >
                    {branch.name}
                  </button>
                ))}
                {filtersActive && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="ml-1 text-xs font-semibold text-scout-700 underline underline-offset-2"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {sports.length === 0 ? (
          <EmptyState icon="🏅" title="Todavía no hay deportes" />
        ) : filteredSports.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Ningún deporte coincide con los filtros"
            description="Prueba con otra búsqueda o quita algún filtro."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {filteredSports.map((sport) => {
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
                    <Button size="sm" variant="secondary" onClick={() => startEditing(sport)}>
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
