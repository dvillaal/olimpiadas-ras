'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { Badge, Button, Checkbox, EmptyState } from '@/components/ui';
import type { ParticipantEditing } from './participant-form';

export interface ParticipantRow {
  id: string;
  fullName: string;
  document: string;
  documentFull: string;
  docType: string;
  age: number;
  branch: string;
  branchId: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  firstNames: string;
  lastNames: string;
  birthdate: string;
  gender: string;
  notes: string;
  active: boolean;
  hasRegistrations: boolean;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Búsqueda y filtrado en el cliente. Con unos pocos miles de filas es más ágil
 * que ir al servidor en cada tecla; si el evento creciera mucho, convendría
 * paginar del lado de Postgres.
 */
export function ParticipantSearch({
  participants,
  onEdit,
}: {
  participants: ParticipantRow[];
  onEdit: (editing: ParticipantEditing) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const groups = useMemo(
    () => [...new Set(participants.map((p) => p.groupName))].sort(),
    [participants],
  );

  const visible = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    return participants.filter((p) => {
      if (onlyActive && !p.active) return false;
      if (group && p.groupName !== group) return false;
      if (!needle) return true;
      return (
        normalize(p.fullName).includes(needle) ||
        normalize(p.branch).includes(needle) ||
        normalize(p.groupCode).includes(needle)
      );
    });
  }, [participants, deferredQuery, group, onlyActive]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, rama o código…"
          aria-label="Buscar participante"
          className="field-input min-w-56 flex-1"
        />
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          aria-label="Filtrar por grupo"
          className="field-input max-w-56"
        >
          <option value="">Todos los grupos</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
          <Checkbox
            checked={onlyActive}
            onChange={(event) => setOnlyActive(event.target.checked)}
          />
          Solo activos
        </label>
      </div>

      <p className="mb-3 text-sm text-slate-500" aria-live="polite">
        {visible.length} de {participants.length} participantes
      </p>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title="Ningún participante coincide" />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Participante</th>
                <th>Grupo</th>
                <th>Rama</th>
                <th className="text-right">Edad</th>
                <th>Documento</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 300).map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-navy">{p.fullName}</td>
                  <td>
                    {p.groupName}
                    <br />
                    <small className="font-mono text-slate-400">{p.groupCode}</small>
                  </td>
                  <td>{p.branch}</td>
                  <td className="text-right">{p.age}</td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {p.docType} {p.document}
                  </td>
                  <td>
                    <Badge tone={p.active ? 'green' : 'gray'}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                    {p.hasRegistrations && (
                      <Badge tone="blue" className="ml-1">
                        Inscrito
                      </Badge>
                    )}
                  </td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        onEdit({
                          id: p.id,
                          groupId: p.groupId,
                          firstNames: p.firstNames,
                          lastNames: p.lastNames,
                          docType: p.docType,
                          document: p.documentFull,
                          birthdate: p.birthdate,
                          branchId: p.branchId,
                          gender: p.gender,
                          active: p.active,
                          notes: p.notes,
                        })
                      }
                    >
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 300 && (
            <p className="mt-3 text-sm text-slate-500">
              Mostrando los primeros 300. Afina la búsqueda para ver el resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
