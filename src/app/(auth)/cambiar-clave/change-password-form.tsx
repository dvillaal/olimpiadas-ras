'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { changePasswordAction, type ActionState } from '../actions';
import { Alert, Button, Field } from '@/components/ui';

/** Fuerza aproximada de la contraseña, solo como guía visual. */
function strengthOf(password: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: 'Muy débil', tone: 'bg-red-500' },
    { label: 'Débil', tone: 'bg-orange-500' },
    { label: 'Aceptable', tone: 'bg-amber-500' },
    { label: 'Buena', tone: 'bg-lime-600' },
    { label: 'Fuerte', tone: 'bg-scout-600' },
    { label: 'Excelente', tone: 'bg-scout-700' },
  ];
  const level = levels[Math.min(score, levels.length - 1)]!;
  return { score, label: level.label, tone: level.tone };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block size="lg" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar contraseña'}
    </Button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(changePasswordAction, {});
  const [password, setPassword] = useState('');
  const strength = strengthOf(password);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      <Field label="Contraseña nueva" htmlFor="password" error={state.errors?.password} required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {password.length > 0 && (
          <div className="mt-2">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2, 3, 4].map((index) => (
                <span
                  key={index}
                  className={`h-1.5 flex-1 rounded-full ${
                    index < strength.score ? strength.tone : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Seguridad: {strength.label}
            </p>
          </div>
        )}
      </Field>

      <Field label="Repite la contraseña" htmlFor="confirm" error={state.errors?.confirm} required>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="field-input"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
