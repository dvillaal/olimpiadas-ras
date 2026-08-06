'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { respondProposalAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button } from '@/components/ui';
import { useToast } from '@/components/toast';

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <>
      <Button type="submit" name="decision" value="accept" size="sm" disabled={pending}>
        {pending ? '…' : '✓ Aceptar y sumar al equipo'}
      </Button>
      <Button type="submit" name="decision" value="reject" size="sm" variant="ghost" disabled={pending}>
        Rechazar
      </Button>
    </>
  );
}

export function ResolveButtons({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(respondProposalAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="requestId" value={requestId} />
      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Buttons />
      </div>
    </form>
  );
}
