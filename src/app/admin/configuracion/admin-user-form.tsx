'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createAdminUserAction } from './admin-users-actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Creando…' : 'Crear administrador'}
    </Button>
  );
}

/**
 * Alta de administradores adicionales.
 *
 * Solo se muestra a administradores de alcance 'full' (la página ya lo
 * protege), así que un admin 'limited' no puede llegar a este formulario ni
 * darse a sí mismo más permisos.
 */
export function AdminUserForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createAdminUserAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useActionResult(state, () => {
    formRef.current?.reset();
  });

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName} required>
        <input
          id="fullName"
          name="fullName"
          required
          className="field-input"
          placeholder="Laura Gómez"
        />
      </Field>

      <Field
        label="Correo"
        htmlFor="email"
        error={errors.email}
        required
        hint="Ahí llegarán la contraseña temporal y las instrucciones de ingreso."
      >
        <input
          id="email"
          name="email"
          type="email"
          required
          className="field-input"
          placeholder="laura@ejemplo.org"
        />
      </Field>

      <Field
        label="Nivel de acceso"
        htmlFor="scope"
        error={errors.scope}
        required
        hint="El acceso limitado no puede ver la bitácora ni el registro de correos, ni crear otros administradores."
      >
        <select id="scope" name="scope" required className="field-input" defaultValue="limited">
          <option value="limited">Limitado (sin bitácora ni alta de administradores)</option>
          <option value="full">Completo (mismos permisos que tú)</option>
        </select>
      </Field>

      <SubmitButton />
    </form>
  );
}
