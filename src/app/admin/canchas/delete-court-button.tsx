'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteCourtAction } from '../actions';
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

export function DeleteCourtButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteCourtAction, {});
  useActionResult(state);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`¿Eliminar la cancha "${name}"? Esta acción no se puede deshacer.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton />
    </form>
  );
}
