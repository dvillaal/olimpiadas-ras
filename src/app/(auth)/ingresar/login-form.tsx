'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type ActionState } from '../actions';
import { Alert, Button, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block size="lg" disabled={pending}>
      {pending ? 'Ingresando…' : 'Ingresar'}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      <input type="hidden" name="siguiente" value={next ?? ''} />

      <Field label="Correo electrónico" htmlFor="email" error={state.errors?.email} required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          className="field-input"
          placeholder="responsable@ejemplo.com"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" error={state.errors?.password} required>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="field-input pr-20"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5
                       text-xs font-bold text-scout-700 hover:bg-scout-50"
            aria-pressed={showPassword}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </Field>

      <SubmitButton />

      <p className="pt-1 text-center text-xs text-slate-500">
        Si tu grupo fue aprobado, la contraseña temporal llegó al correo del responsable.
      </p>
    </form>
  );
}
