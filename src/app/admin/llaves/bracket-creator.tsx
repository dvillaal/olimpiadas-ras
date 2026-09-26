'use client';

import { useActionState, useMemo, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { createBracketAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';
import type { BracketFormat } from '@/types/database';

/** Encabezado plegable: el formulario queda oculto hasta que se necesita. */
export function BracketCreatorAccordion({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel !p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-lg font-bold text-navy">Generar molde</h3>
          <p className="mt-1 text-sm text-slate-500">Define el formato y cuántos equipos entran.</p>
        </div>
        <span className="text-xl text-slate-400" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className="border-t border-line px-5 py-4">{children}</div>}
    </div>
  );
}

export interface SportOption {
  id: string;
  name: string;
  icon: string;
  branchIds: string[];
}

export interface BranchOption {
  id: string;
  name: string;
}

const FORMAT_LABELS: Record<BracketFormat, string> = {
  elimination: 'Eliminación directa',
  groups_knockout: 'Fase de grupos + eliminación',
  round_robin: 'Liga (todos contra todos)',
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending || disabled}>
      {pending ? 'Generando…' : 'Generar molde'}
    </Button>
  );
}

export function BracketCreator({
  sports,
  branches,
  teamCounts,
}: {
  sports: SportOption[];
  branches: BranchOption[];
  /** Equipos confirmados y con alineación completa, por "sportId:branchId". */
  teamCounts: Record<string, number>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createBracketAction, {});
  const [sportId, setSportId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [format, setFormat] = useState<BracketFormat>('elimination');
  useActionResult(state);

  const sport = sports.find((s) => s.id === sportId);
  const availableBranches = useMemo(
    () => (sport ? branches.filter((b) => sport.branchIds.includes(b.id)) : []),
    [sport, branches],
  );

  const teamCount = sportId && branchId ? (teamCounts[`${sportId}:${branchId}`] ?? 0) : null;
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Deporte" htmlFor="sportId" error={errors.sportId} required>
        <select
          id="sportId"
          name="sportId"
          required
          className="field-input"
          value={sportId}
          onChange={(event) => {
            setSportId(event.target.value);
            setBranchId('');
          }}
        >
          <option value="">Seleccionar…</option>
          {sports.map((option) => (
            <option key={option.id} value={option.id}>
              {option.icon} {option.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Rama"
        htmlFor="branchId"
        error={errors.branchId}
        required
        hint={sport ? undefined : 'Escoge primero el deporte.'}
      >
        <select
          id="branchId"
          name="branchId"
          required
          className="field-input"
          disabled={!sport}
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
        >
          <option value="">Seleccionar…</option>
          {availableBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Formato" htmlFor="format" error={errors.format} required>
        <select
          id="format"
          name="format"
          required
          className="field-input"
          value={format}
          onChange={(event) => setFormat(event.target.value as BracketFormat)}
        >
          {Object.entries(FORMAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Cantidad de equipos"
        error={errors.teamCount}
        hint="Se cuenta sola: equipos confirmados y con alineación completa en este deporte y esta rama."
      >
        <input
          type="number"
          value={teamCount ?? ''}
          placeholder={sportId && branchId ? undefined : 'Escoge deporte y rama'}
          readOnly
          disabled
          className="field-input bg-slate-50"
        />
        <input type="hidden" name="teamCount" value={teamCount ?? ''} />
        {teamCount !== null && teamCount < 2 && (
          <p className="field-error">
            Hacen falta al menos 2 equipos confirmados para generar un molde.
          </p>
        )}
      </Field>

      {format === 'groups_knockout' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Equipos por grupo"
            htmlFor="groupSize"
            error={errors.groupSize}
            required
          >
            <input
              id="groupSize"
              name="groupSize"
              type="number"
              min={2}
              max={64}
              required
              className="field-input"
            />
          </Field>
          <Field
            label="Avanzan por grupo"
            htmlFor="advancePerGroup"
            error={errors.advancePerGroup}
            required
          >
            <input
              id="advancePerGroup"
              name="advancePerGroup"
              type="number"
              min={1}
              max={16}
              required
              className="field-input"
            />
          </Field>
        </div>
      )}

      <Alert tone="info">
        Esto solo arma el esqueleto: rondas, casillas y a qué casilla avanza el ganador. Los
        equipos se reparten después, al azar (todavía no en esta pantalla).
      </Alert>

      <SubmitButton disabled={teamCount === null || teamCount < 2} />
    </form>
  );
}
