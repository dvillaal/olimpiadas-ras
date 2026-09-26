'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveCourtAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Sport } from '@/types/database';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface CourtRow {
  id: string;
  name: string;
  notes: string;
  active: boolean;
  sportIds: string[];
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear cancha'}
    </Button>
  );
}

export function CourtForm({
  sports,
  editing,
  onCancelEdit,
}: {
  sports: Pick<Sport, 'id' | 'name' | 'icon'>[];
  editing: CourtRow | null;
  onCancelEdit: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCourtAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<string[]>(editing?.sportIds ?? []);
  const [lastEditingId, setLastEditingId] = useState(editing?.id ?? null);

  // Al cambiar de cancha en edición hay que rehidratar los deportes marcados.
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
      // Fuerza a React a recrear el formulario al cambiar de cancha, para que
      // los `defaultValue` se refresquen.
      key={editing?.id ?? 'nueva'}
    >
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <Field label="Nombre" htmlFor="courtName" error={errors.name} required>
        <input
          id="courtName"
          name="name"
          required
          className="field-input"
          placeholder="Cancha 1 · Polideportivo"
          defaultValue={editing?.name ?? ''}
        />
      </Field>

      <Field
        label="Deportes que se juegan aquí"
        error={errors.sportIds}
        required
        hint="Solo aparecerá como opción al programar partidos de estos deportes."
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

      <Field label="Notas internas" htmlFor="courtNotes" error={errors.notes}>
        <textarea
          id="courtNotes"
          name="notes"
          rows={2}
          className="field-input"
          placeholder="Techada, con marcador, piso en mal estado…"
          defaultValue={editing?.notes ?? ''}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        {/*
          Un checkbox sin marcar no se envía. Sin este campo espejo, desactivar
          una cancha no tendría efecto: el servidor no distinguiría entre
          «desmarcado» y «no vino en el formulario».
          El orden importa: FormData.get() devuelve el PRIMER valor con ese
          nombre en el orden del documento. El checkbox va primero para que,
          si está marcado, su "true" gane; el campo oculto con "false" es el
          respaldo para cuando el checkbox no se envía (desmarcado).
        */}
        <Checkbox name="active" value="true" defaultChecked={editing?.active ?? true} />
        <input type="hidden" name="active" value="false" />
        Cancha activa
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
