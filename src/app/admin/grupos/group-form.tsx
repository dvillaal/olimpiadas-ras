'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createGroupAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Creando…' : 'Crear grupo'}
    </Button>
  );
}

/**
 * Alta manual de un grupo desde el panel del administrador, para no depender
 * de que el jefe de grupo complete el registro público. El grupo queda
 * aprobado de inmediato y las credenciales llegan por correo, igual que al
 * aprobar una solicitud.
 */
export function GroupForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createGroupAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useActionResult(state, () => formRef.current?.reset());

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Nombre del grupo" htmlFor="name" error={errors.name} required>
        <input
          id="name"
          name="name"
          required
          className="field-input"
          placeholder="Grupo Scout 12 Medellín"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ciudad" htmlFor="city" error={errors.city} required>
          <input id="city" name="city" required className="field-input" placeholder="Medellín" />
        </Field>
        <Field label="Departamento" htmlFor="department" error={errors.department}>
          <input id="department" name="department" className="field-input" placeholder="Antioquia" />
        </Field>
      </div>

      <Field label="Nombre del responsable" htmlFor="leaderName" error={errors.leaderName} required>
        <input
          id="leaderName"
          name="leaderName"
          required
          className="field-input"
          placeholder="Camila Restrepo"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Documento" htmlFor="leaderDocument" error={errors.leaderDocument} required>
          <input
            id="leaderDocument"
            name="leaderDocument"
            required
            className="field-input"
            placeholder="1020304050"
          />
        </Field>
        <Field label="Teléfono" htmlFor="leaderPhone" error={errors.leaderPhone} required>
          <input
            id="leaderPhone"
            name="leaderPhone"
            required
            className="field-input"
            placeholder="3001234567"
          />
        </Field>
      </div>

      <Field
        label="Correo del responsable"
        htmlFor="leaderEmail"
        error={errors.leaderEmail}
        required
        hint="Ahí llegarán la contraseña temporal y las instrucciones de ingreso."
      >
        <input
          id="leaderEmail"
          name="leaderEmail"
          type="email"
          required
          className="field-input"
          placeholder="camila@ejemplo.org"
        />
      </Field>

      <Field label="Notas internas" htmlFor="notes" error={errors.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="field-input"
          placeholder="Observaciones, contexto de la creación manual, etc."
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
