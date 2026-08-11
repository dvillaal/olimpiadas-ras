'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { generateScheduleAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface SportOption {
  id: string;
  name: string;
  icon: string;
  type: 'group' | 'individual';
  sessionCapacity: number;
  branchIds: string[];
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface RefereeOption {
  id: string;
  name: string;
  sportIds: string[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Generando…' : 'Generar automáticamente'}
    </Button>
  );
}

export function ScheduleGenerator({
  sports,
  branches,
  referees,
}: {
  sports: SportOption[];
  branches: BranchOption[];
  referees: RefereeOption[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(generateScheduleAction, {});
  const [sportId, setSportId] = useState('');
  useActionResult(state);

  const sport = sports.find((s) => s.id === sportId);

  // Solo se ofrecen las ramas habilitadas para ese deporte y los árbitros que
  // lo dirigen: cualquier otra combinación sería un error a punto de ocurrir.
  const availableBranches = useMemo(
    () => (sport ? branches.filter((b) => sport.branchIds.includes(b.id)) : []),
    [sport, branches],
  );
  const availableReferees = useMemo(
    () => (sport ? referees.filter((r) => r.sportIds.includes(sport.id)) : []),
    [sport, referees],
  );

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
          onChange={(event) => setSportId(event.target.value)}
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
        <select id="branchId" name="branchId" required className="field-input" disabled={!sport}>
          <option value="">Seleccionar…</option>
          {availableBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor="date" error={errors.date} required>
          <input id="date" name="date" type="date" required className="field-input" />
        </Field>
        <Field label="Hora de inicio" htmlFor="time" error={errors.time} required>
          <input id="time" name="time" type="time" required className="field-input" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Minutos entre competencias"
          htmlFor="intervalMinutes"
          error={errors.intervalMinutes}
        >
          <input
            id="intervalMinutes"
            name="intervalMinutes"
            type="number"
            min={5}
            max={600}
            defaultValue={45}
            className="field-input"
          />
        </Field>
        <Field label="Lugar" htmlFor="venue" error={errors.venue}>
          <input id="venue" name="venue" className="field-input" placeholder="Cancha principal" />
        </Field>
      </div>

      <Field
        label="Árbitro"
        htmlFor="refereeId"
        error={errors.refereeId}
        hint={
          sport && availableReferees.length === 0
            ? 'Ningún árbitro tiene asignado este deporte todavía.'
            : 'Puedes dejarlo sin asignar y hacerlo después.'
        }
      >
        <select id="refereeId" name="refereeId" className="field-input" disabled={!sport}>
          <option value="">Sin asignar</option>
          {availableReferees.map((referee) => (
            <option key={referee.id} value={referee.id}>
              {referee.name}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="includePending" className="mt-1" />
        <span>
          Incluir inscripciones que aún no están confirmadas.
          <span className="block text-xs text-slate-500">
            Útil para armar el calendario sin esperar a que todos los pagos estén revisados.
          </span>
        </span>
      </label>

      {sport && (
        <Alert tone="info">
          {sport.type === 'group'
            ? 'Se creará un partido por cada pareja de equipos completos (todos contra todos).'
            : `Se crearán sesiones de hasta ${sport.sessionCapacity} participantes cada una.`}{' '}
          Lo que ya tenga resultado publicado no se toca.
        </Alert>
      )}

      <SubmitButton />
    </form>
  );
}
