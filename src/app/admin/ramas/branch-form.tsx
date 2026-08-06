'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveBranchAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

/** Convierte "Lobatos Mayores" en "lobatos-mayores". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : 'Crear rama'}
    </Button>
  );
}

export function BranchForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(saveBranchAction, {});
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useActionResult(state, () => {
    formRef.current?.reset();
    setName('');
    setId('');
    setIdTouched(false);
  });

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      <Field label="Nombre visible" htmlFor="branchName" error={state.errors?.name} required>
        <input
          id="branchName"
          name="name"
          required
          className="field-input"
          placeholder="Lobatos"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            // El identificador se sugiere solo hasta que el usuario lo edite.
            if (!idTouched) setId(slugify(event.target.value));
          }}
        />
      </Field>

      <Field
        label="Identificador"
        htmlFor="branchId"
        error={state.errors?.id}
        hint="Se usa en la plantilla de importación. Solo minúsculas, números y guiones."
        required
      >
        <input
          id="branchId"
          name="id"
          required
          className="field-input font-mono"
          placeholder="lobatos"
          value={id}
          onChange={(event) => {
            setIdTouched(true);
            setId(slugify(event.target.value));
          }}
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
