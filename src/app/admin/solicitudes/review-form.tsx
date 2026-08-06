'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { reviewGroupAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

function Actions({ mode, onReject }: { mode: 'idle' | 'rejecting'; onReject: () => void }) {
  const { pending } = useFormStatus();

  if (mode === 'rejecting') {
    return (
      <Button type="submit" name="decision" value="reject" variant="danger" disabled={pending}>
        {pending ? 'Enviando…' : 'Confirmar rechazo'}
      </Button>
    );
  }

  return (
    <>
      <Button type="submit" name="decision" value="approve" disabled={pending}>
        {pending ? 'Aprobando…' : '✓ Aprobar y enviar credenciales'}
      </Button>
      <Button type="button" variant="ghost" onClick={onReject} disabled={pending}>
        Rechazar
      </Button>
    </>
  );
}

export function ReviewForm({
  groupId,
  groupName,
  email,
}: {
  groupId: string;
  groupName: string;
  email: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewGroupAction, {});
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // `toast` es estable dentro del provider; incluirlo dispararía el aviso dos veces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      {mode === 'rejecting' ? (
        <>
          <Field
            label={`Motivo del rechazo de ${groupName}`}
            htmlFor={`reason-${groupId}`}
            error={state.errors?.reason}
            hint="Este texto se enviará tal cual al responsable, así que sé claro y amable."
            required
          >
            <textarea
              id={`reason-${groupId}`}
              name="reason"
              rows={3}
              required
              className="field-input resize-y"
              placeholder="Los datos del responsable no coinciden con los registros de la asociación…"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Actions mode={mode} onReject={() => setMode('rejecting')} />
            <Button type="button" variant="ghost" onClick={() => setMode('idle')}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Al aprobar se creará la cuenta de <b>{email}</b> con una contraseña temporal que llegará
            a ese correo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Actions mode={mode} onReject={() => setMode('rejecting')} />
          </div>
        </>
      )}
    </form>
  );
}
