'use client';

import { useActionState, useDeferredValue, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { claimCountryAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Badge, Button } from '@/components/ui';
import { CountryFlag } from '@/components/country-flag';
import { useActionResult } from '@/lib/hooks/use-action-result';

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
        <div className="mb-5 rounded-2xl border-2 border-white/40 bg-white/10 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <CountryFlag code={selected.code} name={selected.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold text-white">{selected.name}</p>
              <p className="text-sm text-white/75">
                Su grupo representará a este país durante todo el evento.
              </p>
            </div>
          </div>
          <form action={formAction} className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="code" value={selected.code} />
            <ConfirmButton countryName={selected.name} />
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setSelected(null)}
              className="!border-white/40 !text-white hover:!bg-white/10"
            >
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
          className="max-w-xs flex-1 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5
                     text-[15px] text-white placeholder:text-white/50 transition-colors
                     focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-white">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(event) => setOnlyAvailable(event.target.checked)}
            className="size-4 accent-white"
          />
          Solo disponibles
        </label>
      </div>

      <p className="mb-3 text-sm text-white/70" aria-live="polite">
        {visible.length} país(es)
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/30 px-4 py-8 text-center">
          <span className="mb-2 block text-3xl" aria-hidden>
            🔍
          </span>
          <p className="font-semibold text-white">Ningún país coincide</p>
          <p className="mt-1 text-sm text-white/75">Prueba con otro término.</p>
        </div>
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
                      ? 'border-white/50 bg-white/15'
                      : available && !hasCountry
                        ? 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                        : 'cursor-not-allowed border-white/10 bg-white/5 opacity-60'
                  }`}
                >
                  <CountryFlag code={country.code} name={country.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-white">{country.name}</span>
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
