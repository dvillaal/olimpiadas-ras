'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { flagOf } from '@/lib/utils';
import { Badge, Button, EmptyState } from '@/components/ui';
import { releaseCountryAction, toggleCountryReservationAction } from '../actions';

export interface CountryRow {
  code: string;
  name: string;
  isReserved: boolean;
  groupId: string | null;
  groupName: string | null;
  groupCode: string | null;
}

type Filter = 'all' | 'available' | 'reserved' | 'assigned';

/** Quita acentos para que "Peru" encuentre "Perú". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function CountryExplorer({ countries }: { countries: CountryRow[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // 195 tarjetas: diferir la búsqueda mantiene fluido el tecleo.
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(() => {
    const needle = normalize(deferredQuery.trim());

    return countries.filter((country) => {
      if (needle && !normalize(country.name).includes(needle) && !normalize(country.code).includes(needle)) {
        return false;
      }
      if (filter === 'assigned') return country.groupId !== null;
      if (filter === 'reserved') return country.isReserved && !country.groupId;
      if (filter === 'available') return !country.isReserved && !country.groupId;
      return true;
    });
  }, [countries, deferredQuery, filter]);

  const filters: [Filter, string][] = [
    ['all', 'Todos'],
    ['available', 'Disponibles'],
    ['reserved', 'Reservados'],
    ['assigned', 'Asignados'],
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar país…"
          aria-label="Buscar país"
          className="field-input max-w-xs flex-1"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                filter === value
                  ? 'bg-scout-600 text-white'
                  : 'border border-line bg-white text-navy hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-500" aria-live="polite">
        {visible.length} de {countries.length} países
      </p>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title="Ningún país coincide" description="Prueba con otro término." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((country) => (
            <li key={country.code} className="rounded-2xl border border-line p-3.5">
              <div className="flex items-start gap-3">
                <span aria-hidden className="text-3xl leading-none">
                  {flagOf(country.code)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-navy">{country.name}</p>
                  <p className="font-mono text-xs text-slate-400">{country.code}</p>

                  <div className="mt-2">
                    {country.groupId ? (
                      <Badge tone="green">{country.groupName}</Badge>
                    ) : country.isReserved ? (
                      <Badge tone="orange">Reservado</Badge>
                    ) : (
                      <Badge tone="gray">Disponible</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {country.groupId ? (
                  <form action={releaseCountryAction}>
                    <input type="hidden" name="groupId" value={country.groupId} />
                    <Button type="submit" size="sm" variant="ghost">
                      Liberar
                    </Button>
                  </form>
                ) : (
                  <form action={toggleCountryReservationAction}>
                    <input type="hidden" name="code" value={country.code} />
                    <input type="hidden" name="reserve" value={String(!country.isReserved)} />
                    <Button type="submit" size="sm" variant={country.isReserved ? 'ghost' : 'secondary'}>
                      {country.isReserved ? 'Quitar reserva' : 'Reservar'}
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
