'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteSportAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="danger" disabled={pending}>
      {pending ? 'Eliminando…' : 'Eliminar'}
    </Button>
  );
}

/**
 * Borra el deporte por completo. Solo se muestra cuando la página confirmó
 * que no tiene equipos, inscripciones individuales ni competencias
 * programadas; aun así la acción vuelve a verificarlo por si algo cambió
 * justo antes del clic.
 */
export function DeleteSportButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteSportAction, {});
  useActionResult(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar el deporte "${name}"? Esta acción no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
