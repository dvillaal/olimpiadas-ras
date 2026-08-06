'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { releaseCountryAction, setGroupStatusAction } from '../actions';
import { resendCredentialsAction } from '../solicitudes/actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { GroupStatus } from '@/types/database';
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

export function GroupRowActions({
  groupId,
  groupName,
  status,
  hasCountry,
}: {
  groupId: string;
  groupName: string;
  status: GroupStatus;
  hasCountry: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, resendAction] = useActionState<ActionState, FormData>(resendCredentialsAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (state.errors?._) toast.error(state.errors._);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Acciones de ${groupName}`}
      >
        ⋯
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-60 space-y-1 rounded-xl border border-line bg-white p-2 shadow-[var(--shadow-float)]">
            <form action={resendAction}>
              <input type="hidden" name="groupId" value={groupId} />
              <PendingButton type="submit" size="sm" variant="ghost" block className="justify-start">
                📧 Reenviar credenciales
              </PendingButton>
            </form>

            {hasCountry && (
              <form action={releaseCountryAction}>
                <input type="hidden" name="groupId" value={groupId} />
                <PendingButton
                  type="submit"
                  size="sm"
                  variant="ghost"
                  block
                  className="justify-start"
                >
                  🌍 Liberar su país
                </PendingButton>
              </form>
            )}

            <form action={setGroupStatusAction}>
              <input type="hidden" name="groupId" value={groupId} />
              <input
                type="hidden"
                name="status"
                value={status === 'suspended' ? 'approved' : 'suspended'}
              />
              <PendingButton
                type="submit"
                size="sm"
                variant={status === 'suspended' ? 'secondary' : 'ghost'}
                block
                className="justify-start"
              >
                {status === 'suspended' ? '✓ Reactivar grupo' : '⏸ Suspender grupo'}
              </PendingButton>
            </form>

            <p className="px-2 pb-1 pt-2 text-xs text-slate-500">
              Reenviar credenciales genera una contraseña nueva y anula la anterior.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
