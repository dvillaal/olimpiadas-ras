'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { proposeParticipantsAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button } from '@/components/ui';
import { useToast } from '@/components/toast';

function SubmitButton({ count, alreadyProposed }: { count: number; alreadyProposed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || count === 0}>
      {pending
        ? 'Enviando…'
        : alreadyProposed
          ? 'Actualizar propuesta'
          : `Proponer ${count || ''}`.trim()}
    </Button>
  );
}

export function ProposeForm({
  requestId,
  maxSlots,
  participants,
  selectedIds,
  alreadyProposed,
}: {
  requestId: string;
  maxSlots: number;
  participants: { id: string; fullName: string; branch: string }[];
  selectedIds: string[];
  alreadyProposed: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [state, formAction] = useActionState<ActionState, FormData>(proposeParticipantsAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="participantIds" value={id} />
      ))}

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}
      {state.errors?.participantIds && <Alert tone="error">{state.errors.participantIds}</Alert>}

      <p className="text-sm font-semibold text-navy">
        Escoge hasta {maxSlots} participante(s) ({selected.length} seleccionado
        {selected.length === 1 ? '' : 's'})
      </p>

      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
        {participants.map((participant) => {
          const checked = selected.includes(participant.id);
          return (
            <li key={participant.id}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm ${
                  checked ? 'bg-scout-50' : 'hover:bg-canvas'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(participant.id)}
                  disabled={!checked && selected.length >= maxSlots}
                  className="size-4 accent-scout-600"
                />
                <span className="min-w-0 flex-1 truncate">{participant.fullName}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <textarea
        name="note"
        rows={2}
        className="field-input resize-y text-sm"
        placeholder="Mensaje para el grupo solicitante (opcional)"
      />

      <SubmitButton count={selected.length} alreadyProposed={alreadyProposed} />
    </form>
  );
}
