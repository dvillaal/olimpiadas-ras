'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveRefereeAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Sport } from '@/types/database';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface RefereeRow {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  sportIds: string[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar árbitro'}
    </Button>
  );
}

export function RefereeForm({
  sports,
  editing,
  onCancelEdit,
}: {
  sports: Pick<Sport, 'id' | 'name' | 'icon'>[];
  editing: RefereeRow | null;
  onCancelEdit: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveRefereeAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>(editing?.sportIds ?? []);
  const [lastEditingId, setLastEditingId] = useState(editing?.id ?? null);

  // Al cambiar de árbitro en edición hay que rehidratar los deportes marcados.
  if ((editing?.id ?? null) !== lastEditingId) {
    setLastEditingId(editing?.id ?? null);
    setSelected(editing?.sportIds ?? []);
  }

  useActionResult(state, () => {
    formRef.current?.reset();
    setSelected([]);
    onCancelEdit();
  });

  const errors = state.errors ?? {};

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
      // Fuerza a React a recrear el formulario al cambiar de árbitro, para que
      // los `defaultValue` se refresquen.
      key={editing?.id ?? 'nuevo'}
    >
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <Field label="Nombre completo" htmlFor="fullName" error={errors.fullName} required>
        <input
          id="fullName"
          name="fullName"
          required
          className="field-input"
          placeholder="Camila Restrepo"
          defaultValue={editing?.fullName ?? ''}
        />
      </Field>

      <Field
        label="Correo"
        htmlFor="email"
        error={errors.email}
        required
        hint={
          editing
            ? 'El correo no se puede cambiar: es la llave de la cuenta.'
            : 'Ahí llegarán la contraseña temporal y las instrucciones de ingreso.'
        }
      >
        <input
          id="email"
          name="email"
          type="email"
          required
          className="field-input"
          placeholder="camila@ejemplo.org"
          defaultValue={editing?.email ?? ''}
          readOnly={Boolean(editing)}
        />
      </Field>

      <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
        <input
          id="phone"
          name="phone"
          className="field-input"
          placeholder="3001234567"
          defaultValue={editing?.phone ?? ''}
        />
      </Field>

      <Field
        label="Deportes que dirige"
        error={errors.sportIds}
        required
        hint="Solo aparecerá como opción al programar estos deportes."
      >
        <div className="grid gap-1.5 rounded-xl border border-line p-3 sm:grid-cols-2">
          {sports.map((sport) => (
            <label key={sport.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                name="sportIds"
                value={sport.id}
                checked={selected.includes(sport.id)}
                onChange={() => toggle(sport.id)}
              />
              <span aria-hidden>{sport.icon}</span>
              <span>{sport.name}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Notas internas" htmlFor="notes" error={errors.notes}>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="field-input"
          placeholder="Disponibilidad, experiencia, observaciones."
          defaultValue={editing?.notes ?? ''}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        {/*
          Un checkbox sin marcar no se envía. Sin este campo espejo, desactivar
          a un árbitro no tendría efecto: el servidor no distinguiría entre
          «desmarcado» y «no vino en el formulario».
        */}
        <input type="hidden" name="active" value="false" />
        <Checkbox name="active" value="true" defaultChecked={editing?.active ?? true} />
        Árbitro activo
      </label>

      <SubmitButton editing={Boolean(editing)} />

      {editing && (
        <Button type="button" variant="secondary" block onClick={onCancelEdit}>
          Cancelar edición
        </Button>
      )}
    </form>
  );
}
