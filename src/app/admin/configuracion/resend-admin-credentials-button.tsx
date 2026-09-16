'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { resendAdminCredentialsAction } from './admin-users-actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

function PendingButton({ children, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} disabled={pending}>
      {pending ? '…' : children}
    </Button>
  );
}

/** Botón para reenviar credenciales a un administrador que nunca entró. */
export function ResendAdminCredentialsButton({ adminId }: { adminId: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(resendAdminCredentialsAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (state.errors?._) toast.error(state.errors._);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="adminId" value={adminId} />
      <PendingButton
        type="submit"
        size="sm"
        variant="ghost"
        title="Genera una contraseña nueva y se la reenvía por correo"
      >
        📧 Reenviar
      </PendingButton>
    </form>
  );
}
