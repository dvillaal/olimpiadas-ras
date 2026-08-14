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

      <Field
        label="Equipo que necesita apoyo"
        htmlFor="teamId"
        error={errors.teamId}
        required
        className="[&_.field-label]:text-white"
      >
        <select
          id="teamId"
          name="teamId"
          required
          className="w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px]
                     text-white transition-colors focus:border-white/60 focus:outline-none
                     focus:ring-2 focus:ring-white/20"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
        >
          {teams.map((option) => (
            <option key={option.id} value={option.id} className="text-navy">
              {option.name} · faltan {option.missing}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Grupo al que pides apoyo"
        htmlFor="targetGroupId"
        error={errors.targetGroupId}
        required
        className="[&_.field-label]:text-white"
      >
        <select
          id="targetGroupId"
          name="targetGroupId"
          required
          className="w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px]
                     text-white transition-colors focus:border-white/60 focus:outline-none
                     focus:ring-2 focus:ring-white/20"
          defaultValue=""
        >
          <option value="" disabled className="text-navy">
            Selecciona un grupo…
          </option>
          {groups.map((option) => (
            <option key={option.id} value={option.id} className="text-navy">
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
        className="[&_.field-label]:text-white [&_p]:text-white/60"
      >
        <input
          id="slots"
          name="slots"
          type="number"
          min={1}
          max={Math.max(1, maxSlots)}
          defaultValue={Math.max(1, maxSlots)}
          required
          className="w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px]
                     text-white transition-colors focus:border-white/60 focus:outline-none
                     focus:ring-2 focus:ring-white/20"
        />
      </Field>

      <Field
        label="Mensaje"
        htmlFor="message"
        error={errors.message}
        className="[&_.field-label]:text-white"
      >
        <textarea
          id="message"
          name="message"
          rows={2}
          className="w-full resize-y rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5
                     text-[15px] text-white placeholder:text-white/50 transition-colors
                     focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
          placeholder="Cuéntales qué necesitas: rama, experiencia, disponibilidad…"
        />
      </Field>

      <SubmitButton />
    </form>
  );
}
