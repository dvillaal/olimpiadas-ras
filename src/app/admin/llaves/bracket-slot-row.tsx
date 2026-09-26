'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateBracketSlotAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Badge, Button } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface SlotRow {
  id: string;
  groupLabel: string;
  bracketSlot: number | null;
  teamASlot: number | null;
  teamBSlot: number | null;
  isBye: boolean;
  startsOn: string | null;
  startsAt: string | null;
  endsAt: string | null;
  courtId: string | null;
}

export interface CourtOption {
  id: string;
  name: string;
}

/** Qué se sabe de esta casilla antes de que exista un sorteo o un resultado. */
function slotDescription(slot: SlotRow): string {
  if (slot.isBye) {
    const known = slot.teamASlot ?? slot.teamBSlot;
    return `Pase directo (posición ${known})`;
  }
  if (slot.teamASlot !== null && slot.teamBSlot !== null) {
    return `Posición ${slot.teamASlot} vs. posición ${slot.teamBSlot}`;
  }
  return 'Se completa después: ganador de la ronda anterior (o de la fase de grupos)';
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </Button>
  );
}

export function BracketSlotRow({ slot, courts }: { slot: SlotRow; courts: CourtOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateBracketSlotAction, {});
  useActionResult(state);

  const errors = state.errors ?? {};

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
    >
      <input type="hidden" name="scheduleId" value={slot.id} />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {slot.groupLabel && <Badge tone="blue">{slot.groupLabel}</Badge>}
          {slot.isBye && <Badge tone="gray">Bye</Badge>}
        </div>
        <p className="text-sm text-slate-600">{slotDescription(slot)}</p>
        {errors._ && <p className="field-error">{errors._}</p>}
      </div>

      <label className="text-sm">
        <span className="field-label">Hora inicio</span>
        <input
          type="time"
          name="time"
          defaultValue={slot.startsAt ?? ''}
          className="field-input"
          disabled={slot.isBye}
        />
        {errors.time && <p className="field-error">{errors.time}</p>}
      </label>

      <label className="text-sm">
        <span className="field-label">Hora fin</span>
        <input
          type="time"
          name="endTime"
          defaultValue={slot.endsAt ?? ''}
          className="field-input"
          disabled={slot.isBye}
        />
        {errors.endTime && <p className="field-error">{errors.endTime}</p>}
      </label>

      <label className="text-sm">
        <span className="field-label">Cancha</span>
        <select
          name="courtId"
          defaultValue={slot.courtId ?? ''}
          className="field-input"
          disabled={slot.isBye}
        >
          <option value="">Sin asignar</option>
          {courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
            </option>
          ))}
        </select>
      </label>

      {!slot.isBye && <SaveButton />}
    </form>
  );
}
