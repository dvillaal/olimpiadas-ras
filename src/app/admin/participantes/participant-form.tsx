'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { saveParticipantAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Branch } from '@/types/database';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar participante'}
    </Button>
  );
}

export interface ParticipantEditing {
  id: string;
  groupId: string;
  firstNames: string;
  lastNames: string;
  docType: string;
  document: string;
  birthdate: string;
  branchId: string;
  gender: string;
  active: boolean;
  notes: string;
}

export function ParticipantForm({
  groups,
  branches,
  editing = null,
  onCancelEdit,
}: {
  groups: { id: string; code: string | null; name: string }[];
  branches: Branch[];
  editing?: ParticipantEditing | null;
  onCancelEdit?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveParticipantAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useActionResult(state, () => {
    formRef.current?.reset();
    onCancelEdit?.();
  });

  const errors = state.errors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
      // Fuerza a React a recrear el formulario al cambiar de participante,
      // para que los `defaultValue` se refresquen.
      key={editing?.id ?? 'nuevo'}
    >
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <Field label="Grupo" htmlFor="groupId" error={errors.groupId} required>
        <select
          id="groupId"
          name="groupId"
          required
          className="field-input"
          defaultValue={editing?.groupId ?? ''}
        >
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
          <input
            id="firstNames"
            name="firstNames"
            required
            className="field-input"
            defaultValue={editing?.firstNames ?? ''}
          />
        </Field>
        <Field label="Apellidos" htmlFor="lastNames" error={errors.lastNames} required>
          <input
            id="lastNames"
            name="lastNames"
            required
            className="field-input"
            defaultValue={editing?.lastNames ?? ''}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
        <Field label="Tipo doc." htmlFor="docType" error={errors.docType} required>
          <select
            id="docType"
            name="docType"
            className="field-input"
            defaultValue={editing?.docType ?? 'TI'}
          >
            {['RC', 'TI', 'CC', 'CE', 'PA', 'PEP'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Número de documento" htmlFor="document" error={errors.document} required>
          <input
            id="document"
            name="document"
            required
            className="field-input"
            inputMode="numeric"
            defaultValue={editing?.document ?? ''}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de nacimiento" htmlFor="birthdate" error={errors.birthdate} required>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            required
            className="field-input"
            defaultValue={editing?.birthdate ?? ''}
          />
        </Field>
        <Field label="Rama" htmlFor="branchId" error={errors.branchId} required>
          <select
            id="branchId"
            name="branchId"
            required
            className="field-input"
            defaultValue={editing?.branchId ?? ''}
          >
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

      <Field label="Género" htmlFor="gender" error={errors.gender} className="sm:w-[130px]">
        <select
          id="gender"
          name="gender"
          className="field-input"
          defaultValue={editing?.gender ?? ''}
        >
          <option value="">—</option>
          <option value="F">F</option>
          <option value="M">M</option>
          <option value="O">O</option>
        </select>
      </Field>

      {editing && (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy">
          {/*
            Un checkbox sin marcar no se envía. Sin este campo espejo, marcar a
            alguien como inactivo no tendría efecto en el envío del formulario.
          */}
          <input type="hidden" name="active" value="false" />
          <Checkbox name="active" value="true" defaultChecked={editing.active} />
          Participante activo
        </label>
      )}

      <Field
        label="Observaciones"
        htmlFor="notes"
        error={errors.notes}
        hint="Alergias, dieta, condiciones médicas relevantes."
      >
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="field-input resize-y"
          defaultValue={editing?.notes ?? ''}
        />
      </Field>

      <SubmitButton editing={Boolean(editing)} />

      {editing && (
        <Button type="button" variant="secondary" block onClick={onCancelEdit}>
          Cancelar edición
        </Button>
      )}
    </form>
  );
}
