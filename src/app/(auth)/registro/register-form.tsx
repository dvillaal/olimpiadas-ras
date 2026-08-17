'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { registerGroupAction, type ActionState } from '../actions';
import { Alert, Button, Checkbox, Field } from '@/components/ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending}>
      {pending ? 'Enviando solicitud…' : 'Enviar solicitud'}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(registerGroupAction, {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <fieldset className="space-y-4">
        <legend className="kicker mb-2">Datos del grupo</legend>

        <Field label="Nombre del grupo scout" htmlFor="name" error={errors.name} required>
          <input
            id="name"
            name="name"
            required
            className="field-input"
            placeholder="Grupo Scout Horizonte"
            autoComplete="organization"
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
      </fieldset>

      <hr className="border-line" />

      <fieldset className="space-y-4">
        <legend className="kicker mb-2">Persona responsable</legend>
        <p className="-mt-1 mb-3 text-sm text-slate-500">
          Será quien administre la inscripción del grupo y quien reciba las credenciales.
        </p>

        <Field
          label="Nombre completo"
          htmlFor="leaderName"
          error={errors.leaderName}
          required
        >
          <input
            id="leaderName"
            name="leaderName"
            required
            className="field-input"
            placeholder="Laura Gómez Restrepo"
            autoComplete="name"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Documento"
            htmlFor="leaderDocument"
            error={errors.leaderDocument}
            required
          >
            <input
              id="leaderDocument"
              name="leaderDocument"
              required
              className="field-input"
              placeholder="1020304050"
              inputMode="numeric"
            />
          </Field>
          <Field label="Teléfono" htmlFor="leaderPhone" error={errors.leaderPhone} required>
            <input
              id="leaderPhone"
              name="leaderPhone"
              required
              className="field-input"
              placeholder="3001234567"
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field
          label="Correo electrónico"
          htmlFor="leaderEmail"
          error={errors.leaderEmail}
          hint="A este correo llegarán las credenciales de acceso. Revísalo bien."
          required
        >
          <input
            id="leaderEmail"
            name="leaderEmail"
            type="email"
            required
            className="field-input"
            placeholder="responsable@ejemplo.com"
            inputMode="email"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Comentarios para la organización"
          htmlFor="notes"
          error={errors.notes}
          hint="Opcional: cuántos participantes esperan traer, si necesitan algo especial, etc."
        >
          <textarea id="notes" name="notes" rows={3} className="field-input resize-y" />
        </Field>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-scout-50 p-4 text-sm text-slate-700">
        <Checkbox name="acceptsTerms" className="mt-0.5" required />
        <span>
          Autorizo el tratamiento de los datos personales del grupo y de sus participantes con el
          único fin de gestionar la inscripción y participación en el evento, conforme a la Ley 1581
          de 2012.
        </span>
      </label>
      {errors.acceptsTerms && (
        <p className="field-error" role="alert">
          <span aria-hidden>⚠</span>
          {errors.acceptsTerms}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
