'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveMatchResultAction, saveSessionResultAction } from '@/app/arbitraje/actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { ResultOrder } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

/**
 * Registro de resultados, en dos formas según el tipo de competencia.
 *
 * En ambos casos hay dos botones distintos, no un interruptor: guardar un
 * borrador y publicar tienen consecuencias muy diferentes —lo publicado lo ve
 * cualquiera sin iniciar sesión— y conviene que la diferencia se note.
 */

function ActionButtons({ published }: { published: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="publish" value="false" variant="secondary" disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar borrador'}
      </Button>
      <Button type="submit" name="publish" value="true" disabled={pending}>
        {published ? 'Actualizar publicación' : 'Publicar resultado'}
      </Button>
    </div>
  );
}

// ─── Partidos ────────────────────────────────────────────────────────────────

export function MatchResultForm({
  scheduleId,
  teamAName,
  teamBName,
  scoreA,
  scoreB,
  notes,
  published,
  resultLabel,
}: {
  scheduleId: string;
  teamAName: string;
  teamBName: string;
  scoreA: number | null;
  scoreB: number | null;
  notes: string;
  published: boolean;
  resultLabel: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveMatchResultAction, {});
  useActionResult(state);

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      <input type="hidden" name="scheduleId" value={scheduleId} />

      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Field label={teamAName} htmlFor={`scoreA-${scheduleId}`} error={errors.scoreA}>
          <input
            id={`scoreA-${scheduleId}`}
            name="scoreA"
            type="number"
            min={0}
            required
            defaultValue={scoreA ?? 0}
            className="field-input text-center text-2xl font-black"
          />
        </Field>

        <span className="pb-3 text-center text-sm font-bold text-slate-400">VS</span>

        <Field label={teamBName} htmlFor={`scoreB-${scheduleId}`} error={errors.scoreB}>
          <input
            id={`scoreB-${scheduleId}`}
            name="scoreB"
            type="number"
            min={0}
            required
            defaultValue={scoreB ?? 0}
            className="field-input text-center text-2xl font-black"
          />
        </Field>
      </div>

      <p className="text-xs text-slate-500">Se registra en {resultLabel.toLowerCase()}.</p>

      <Field label="Observaciones del árbitro" htmlFor={`notes-${scheduleId}`}>
        <textarea
          id={`notes-${scheduleId}`}
          name="notes"
          rows={2}
          defaultValue={notes}
          className="field-input"
          placeholder="Incidencias, cambios, reclamaciones."
        />
      </Field>

      <Alert tone="info">
        Puedes guardar un borrador y publicarlo después. Al publicar, cualquier persona podrá
        verlo sin iniciar sesión.
      </Alert>

      <ActionButtons published={published} />
    </form>
  );
}

// ─── Sesiones individuales ───────────────────────────────────────────────────

export interface SessionRow {
  participantId: string;
  name: string;
  groupName: string;
  value: number | null;
  disqualified: boolean;
  rank: number | null;
}

export function SessionResultForm({
  scheduleId,
  rows,
  notes,
  published,
  resultLabel,
  resultOrder,
}: {
  scheduleId: string;
  rows: SessionRow[];
  notes: string;
  published: boolean;
  resultLabel: string;
  resultOrder: ResultOrder;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSessionResultAction, {});
  const [dq, setDq] = useState<string[]>(rows.filter((r) => r.disqualified).map((r) => r.participantId));
  useActionResult(state);

  const errors = state.errors ?? {};

  const toggleDq = (id: string) =>
    setDq((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      <input type="hidden" name="scheduleId" value={scheduleId} />

      <Alert tone="info">
        Se mide en <b>{resultLabel.toLowerCase()}</b> y gana el valor{' '}
        <b>{resultOrder === 'asc' ? 'más bajo' : 'más alto'}</b>. Deja la casilla vacía si alguien
        no compitió: no es lo mismo que marcar cero.
      </Alert>

      <ul className="space-y-2">
        {rows.map((row) => {
          const isDq = dq.includes(row.participantId);
          return (
            <li
              key={row.participantId}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
            >
              <input type="hidden" name="participantId" value={row.participantId} />

              <div className="min-w-0 flex-1">
                <b className="text-navy">{row.name}</b>
                <p className="truncate text-xs text-slate-500">{row.groupName}</p>
              </div>

              {row.rank && !isDq && (
                <span className="text-xs font-bold text-slate-400">#{row.rank}</span>
              )}

              <input
                name="value"
                type="number"
                step="any"
                inputMode="decimal"
                defaultValue={row.value ?? ''}
                disabled={isDq}
                placeholder={resultLabel}
                aria-label={`${resultLabel} de ${row.name}`}
                className="field-input w-32 text-center disabled:opacity-50"
              />

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  name="disqualified"
                  value={row.participantId}
                  checked={isDq}
                  onChange={() => toggleDq(row.participantId)}
                />
                Descalificado
              </label>
            </li>
          );
        })}
      </ul>

      <Field label="Observaciones" htmlFor={`notes-${scheduleId}`}>
        <textarea
          id={`notes-${scheduleId}`}
          name="notes"
          rows={2}
          defaultValue={notes}
          className="field-input"
        />
      </Field>

      <ActionButtons published={published} />
    </form>
  );
}
