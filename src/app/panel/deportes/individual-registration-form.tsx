'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveIndividualRegistrationAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { formatCOP } from '@/lib/domain/fees';

export interface SelectableParticipant {
  id: string;
  fullName: string;
  branch: string;
}

function SubmitButton({ count, total }: { count: number; total: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending
        ? 'Guardando…'
        : count === 0
          ? 'Selecciona participantes'
          : `Inscribir ${count} · ${formatCOP(total)}`}
    </Button>
  );
}

export function IndividualRegistrationForm({
  sportId,
  sportName,
  fee,
  participants,
  selectedIds,
  locked,
}: {
  sportId: string;
  sportName: string;
  fee: number;
  participants: SelectableParticipant[];
  selectedIds: string[];
  locked?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveIndividualRegistrationAction,
    {},
  );
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  if (locked) {
    return (
      <Alert tone="info">
        La inscripción en {sportName} ya está en revisión y no admite cambios. Si necesitas
        modificarla, escribe a la organización.
      </Alert>
    );
  }

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sportId" value={sportId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="participantIds" value={id} />
      ))}

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}
      {state.errors?.participantIds && (
        <Alert tone="error">{state.errors.participantIds}</Alert>
      )}

      <ul className="scrollbar-dark max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-white/20 p-2">
        {participants.map((participant) => (
          <li key={participant.id}>
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm transition-colors ${
                selected.includes(participant.id) ? 'bg-white/15' : 'hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(participant.id)}
                onChange={() => toggle(participant.id)}
                className="size-4 accent-white"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-white">
                  {participant.fullName}
                </span>
                <span className="text-xs text-white/70">{participant.branch}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <SubmitButton count={selected.length} total={selected.length * fee} />
    </form>
  );
}
