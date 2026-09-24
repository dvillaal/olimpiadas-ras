'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveIndividualRegistrationAsAdminAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Checkbox } from '@/components/ui';
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
      {pending ? 'Guardando…' : `Guardar ${count} · ${formatCOP(total)}`}
    </Button>
  );
}

/**
 * Editor de participantes de una inscripción individual, para el
 * administrador. A diferencia del que usa el grupo, este no se bloquea
 * cuando la inscripción ya está confirmada (pago aprobado) — el disparador
 * de la base ya deja pasar el cambio solo para administradores. Si el monto
 * sube (se agregó gente a una inscripción ya paga), la diferencia aparece
 * sola como un concepto nuevo por pagar, tanto aquí como en el panel del
 * grupo.
 */
export function AdminEditIndividualForm({
  registrationId,
  fee,
  participants,
  selectedIds,
  onDone,
}: {
  registrationId: string;
  fee: number;
  participants: SelectableParticipant[];
  selectedIds: string[];
  onDone?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [state, formAction] = useActionState<ActionState, FormData>(
    saveIndividualRegistrationAsAdminAction,
    {},
  );
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="registrationId" value={registrationId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="participantIds" value={id} />
      ))}

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}
      {state.errors?.participantIds && <Alert tone="error">{state.errors.participantIds}</Alert>}

      <ul className="scrollbar-dark max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
        {participants.map((participant) => (
          <li key={participant.id}>
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm transition-colors ${
                selected.includes(participant.id) ? 'bg-scout-50' : 'hover:bg-slate-50'
              }`}
            >
              <Checkbox checked={selected.includes(participant.id)} onChange={() => toggle(participant.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-navy">{participant.fullName}</span>
                <span className="text-xs text-slate-500">{participant.branch}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <SubmitButton count={selected.length} total={selected.length * fee} />
    </form>
  );
}
