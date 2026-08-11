'use client';

import { useMemo, useState } from 'react';
import type { Competition } from '@/lib/competitions/load';
import { Badge, Button, EmptyState } from '@/components/ui';
import { CompetitionCard } from '@/components/competition-card';
import { deleteScheduleAction, unpublishScheduleAction } from './actions';

/**
 * Calendario completo con filtros.
 *
 * El administrador también puede registrar resultados: cuando un árbitro no
 * llega o falla el celular, alguien tiene que poder anotar el marcador.
 */
export function ScheduleList({ competitions }: { competitions: Competition[] }) {
  const [sportId, setSportId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [state, setState] = useState<'' | 'pending' | 'published'>('');

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of competitions) map.set(c.sportId, `${c.sportIcon} ${c.sportName}`);
    return [...map.entries()];
  }, [competitions]);

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of competitions) map.set(c.branchId, c.branchName);
    return [...map.entries()];
  }, [competitions]);

  const filtered = competitions.filter(
    (c) =>
      (!sportId || c.sportId === sportId) &&
      (!branchId || c.branchId === branchId) &&
      (!state ||
        (state === 'published' ? c.resultPublished : !c.resultPublished)),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="field-input"
          value={sportId}
          onChange={(e) => setSportId(e.target.value)}
          aria-label="Filtrar por deporte"
        >
          <option value="">Todos los deportes</option>
          {sports.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <select
          className="field-input"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Filtrar por rama"
        >
          <option value="">Todas las ramas</option>
          {branches.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        <select
          className="field-input"
          value={state}
          onChange={(e) => setState(e.target.value as '' | 'pending' | 'published')}
          aria-label="Filtrar por estado del resultado"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Sin publicar</option>
          <option value="published">Publicados</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Nada coincide con ese filtro" />
      ) : (
        filtered.map((competition) => (
          <div key={competition.id} className="space-y-2">
            <CompetitionCard competition={competition} canEnterResult showReferee />

            <div className="flex flex-wrap items-center gap-2 px-1">
              {!competition.refereeId && <Badge tone="orange">Sin árbitro</Badge>}

              {competition.resultPublished ? (
                <form action={unpublishScheduleAction}>
                  <input type="hidden" name="id" value={competition.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Retirar del portal público
                  </Button>
                </form>
              ) : (
                <form action={deleteScheduleAction}>
                  <input type="hidden" name="id" value={competition.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Eliminar
                  </Button>
                </form>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
