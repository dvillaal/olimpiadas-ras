'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createIntergroupRequestAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export interface IncompleteTeam {
  id: string;
  name: string;
  sportName: string;
  missing: number;
  maxExternal: number;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar solicitud'}
    </Button>
  );
}

export function NewRequestForm({
  teams,
  groups,
}: {
  teams: IncompleteTeam[];
  groups: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createIntergroupRequestAction,
    {},
  );
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const team = teams.find((t) => t.id === teamId);
  // No tiene sentido pedir más cupos de los que faltan ni más externos de los
  // que el deporte permite.
  const maxSlots = team ? Math.min(team.missing, team.maxExternal) : 1;
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Equipo que necesita apoyo" htmlFor="teamId" error={errors.teamId} required>
        <select
          id="teamId"
          name="teamId"
          required
          className="field-input"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
        >
          {teams.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · faltan {option.missing}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Grupo al que pides apoyo" htmlFor="targetGroupId" error={errors.targetGroupId} required>
        <select id="targetGroupId" name="targetGroupId" required className="field-input" defaultValue="">
          <option value="" disabled>
            Selecciona un grupo…
          </option>
          {groups.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Cuántos participantes necesitas"
        htmlFor="slots"
        error={errors.slots}
        hint={
          team
            ? `Faltan ${team.missing} titular(es) y el deporte admite hasta ${team.maxExternal} externo(s).`
            : undefined
        }
        required
      >
        <input
          id="slots"
          name="slots"
          type="number"
          min={1}
          max={Math.max(1, maxSlots)}
          defaultValue={Math.max(1, maxSlots)}
          required
          className="field-input"
        />
      </Field>

      <Field label="Mensaje" htmlFor="message" error={errors.message}>
        <textarea
          id="message"
          name="message"
          rows={2}
          className="field-input resize-y"
          placeholder="Cuéntales qué necesitas: rama, experiencia, disponibilidad…"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
