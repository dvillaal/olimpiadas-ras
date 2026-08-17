'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteBranchAction } from '../actions';
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
 * Borra la rama por completo. Solo se muestra cuando la página confirmó que
 * no tiene participantes ni competencias asociados; aun así la acción vuelve
 * a verificarlo por si algo cambió justo antes del clic.
 */
export function DeleteBranchButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteBranchAction, {});
  useActionResult(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar la rama "${name}"? Esta acción no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
