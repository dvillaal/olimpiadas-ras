'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { saveParticipantAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Branch } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : 'Registrar participante'}
    </Button>
  );
}

export function ParticipantForm({
  groups,
  branches,
}: {
  groups: { id: string; code: string | null; name: string }[];
  branches: Branch[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveParticipantAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Grupo" htmlFor="groupId" error={errors.groupId} required>
        <select id="groupId" name="groupId" required className="field-input" defaultValue="">
          <option value="" disabled>
            Selecciona un grupo…
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.code ? `${group.code} · ` : ''}
              {group.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" htmlFor="firstNames" error={errors.firstNames} required>
          <input id="firstNames" name="firstNames" required className="field-input" />
        </Field>
        <Field label="Apellidos" htmlFor="lastNames" error={errors.lastNames} required>
          <input id="lastNames" name="lastNames" required className="field-input" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Field label="Tipo doc." htmlFor="docType" error={errors.docType} required>
          <select id="docType" name="docType" className="field-input" defaultValue="TI">
            {['RC', 'TI', 'CC', 'CE', 'PA', 'PEP'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número de documento" htmlFor="document" error={errors.document} required>
          <input id="document" name="document" required className="field-input" inputMode="numeric" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de nacimiento" htmlFor="birthdate" error={errors.birthdate} required>
          <input id="birthdate" name="birthdate" type="date" required className="field-input" />
        </Field>
        <Field label="Rama" htmlFor="branchId" error={errors.branchId} required>
          <select id="branchId" name="branchId" required className="field-input" defaultValue="">
            <option value="" disabled>
              Selecciona…
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Field label="Género" htmlFor="gender" error={errors.gender}>
          <select id="gender" name="gender" className="field-input" defaultValue="">
            <option value="">—</option>
            <option value="F">F</option>
            <option value="M">M</option>
            <option value="O">O</option>
          </select>
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
          <input id="phone" name="phone" className="field-input" inputMode="tel" />
        </Field>
      </div>

      <Field label="Correo" htmlFor="email" error={errors.email}>
        <input id="email" name="email" type="email" className="field-input" inputMode="email" />
      </Field>

      <Field
        label="Observaciones"
        htmlFor="notes"
        error={errors.notes}
        hint="Alergias, dieta, condiciones médicas relevantes."
      >
        <textarea id="notes" name="notes" rows={2} className="field-input resize-y" />
      </Field>

      <SubmitButton />
    </form>
  );
}
