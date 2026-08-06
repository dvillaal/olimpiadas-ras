'use client';

import { useActionState, useDeferredValue, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { claimCountryAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Badge, Button, EmptyState } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';
import { flagOf } from '@/lib/utils';

export interface PickableCountry {
  code: string;
  name: string;
  isReserved: boolean;
  takenBy: string | null;
  isMine: boolean;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ConfirmButton({ countryName }: { countryName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Confirmando…' : `Confirmar ${countryName}`}
    </Button>
  );
}

export function CountryPicker({
  countries,
  hasCountry,
}: {
  countries: PickableCountry[];
  hasCountry: boolean;
}) {
  const [query, setQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(!hasCountry);
  const [selected, setSelected] = useState<PickableCountry | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(claimCountryAction, {});
  const deferredQuery = useDeferredValue(query);

  useActionResult(state, () => setSelected(null));

  const visible = useMemo(() => {
    const needle = normalize(deferredQuery.trim());
    return countries.filter((country) => {
      const available = !country.isReserved && !country.takenBy;
      if (onlyAvailable && !available && !country.isMine) return false;
      if (!needle) return true;
      return normalize(country.name).includes(needle) || normalize(country.code).includes(needle);
    });
  }, [countries, deferredQuery, onlyAvailable]);

  return (
    <div>
      {state.errors?._ && (
        <Alert tone="error" className="mb-4">
          {state.errors._}
        </Alert>
      )}

      {/* Confirmación explícita: la elección es prácticamente definitiva. */}
      {selected && (
        <div className="mb-5 rounded-2xl border-2 border-scout-400 bg-scout-50 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <span aria-hidden className="text-5xl leading-none">
              {flagOf(selected.code)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold text-navy">{selected.name}</p>
              <p className="text-sm text-slate-600">
                Su grupo representará a este país durante todo el evento.
              </p>
            </div>
          </div>
          <form action={formAction} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="code" value={selected.code} />
            <ConfirmButton countryName={selected.name} />
            <Button type="button" variant="ghost" size="lg" onClick={() => setSelected(null)}>
              Cancelar
            </Button>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar país…"
          aria-label="Buscar país"
          className="field-input max-w-xs flex-1"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-navy">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(event) => setOnlyAvailable(event.target.checked)}
            className="size-4 accent-scout-600"
          />
          Solo disponibles
        </label>
      </div>

      <p className="mb-3 text-sm text-slate-500" aria-live="polite">
        {visible.length} país(es)
      </p>

      {visible.length === 0 ? (
        <EmptyState icon="🔍" title="Ningún país coincide" description="Prueba con otro término." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((country) => {
            const available = !country.isReserved && !country.takenBy;
            return (
              <li key={country.code}>
                <button
                  type="button"
                  disabled={!available || hasCountry}
                  onClick={() => setSelected(country)}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                    country.isMine
                      ? 'border-scout-500 bg-scout-50'
                      : available && !hasCountry
                        ? 'border-line bg-white hover:border-scout-400 hover:bg-scout-50'
                        : 'cursor-not-allowed border-line bg-slate-50 opacity-70'
                  }`}
                >
                  <span aria-hidden className="text-3xl leading-none">
                    {flagOf(country.code)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-navy">{country.name}</span>
                    <span className="mt-1 block">
                      {country.isMine ? (
                        <Badge tone="green">Su país</Badge>
                      ) : country.takenBy ? (
                        <Badge tone="gray">{country.takenBy}</Badge>
                      ) : country.isReserved ? (
                        <Badge tone="orange">Reservado</Badge>
                      ) : (
                        <Badge tone="blue">Disponible</Badge>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
