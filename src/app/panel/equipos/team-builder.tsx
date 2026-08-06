'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTeamAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { validateRoster, type RosterEntry } from '@/lib/domain/eligibility';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface BuilderSport {
  id: string;
  name: string;
  teamSize: number;
  substitutes: number;
  allowIntergroup: boolean;
  maxExternal: number;
}

export interface BuilderParticipant {
  id: string;
  fullName: string;
  branch: string;
  groupId: string;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? 'Guardando…' : 'Guardar equipo'}
    </Button>
  );
}

/**
 * Armador de alineaciones.
 *
 * Valida en vivo con las mismas reglas que aplica Postgres, de modo que el
 * usuario ve el problema mientras selecciona en lugar de descubrirlo al enviar.
 */
export function TeamBuilder({
  sport,
  participants,
  defaultName,
  groupName,
  teamId,
  initialStarters = [],
  initialSubstitutes = [],
  initialName,
}: {
  sport: BuilderSport;
  participants: BuilderParticipant[];
  defaultName: string;
  groupName: string;
  teamId?: string;
  initialStarters?: string[];
  initialSubstitutes?: string[];
  initialName?: string;
}) {
  const [starters, setStarters] = useState<string[]>(initialStarters);
  const [substitutes, setSubstitutes] = useState<string[]>(initialSubstitutes);
  const [captainId, setCaptainId] = useState('');
  const [state, formAction] = useActionState<ActionState, FormData>(saveTeamAction, {});

  // Al editar un equipo se conserva la selección; al crear uno nuevo se limpia.
  useActionResult(state, () => {
    if (teamId) return;
    setStarters([]);
    setSubstitutes([]);
    setCaptainId('');
  });

  const byId = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants],
  );

  const problems = useMemo(() => {
    const roster: RosterEntry[] = [
      ...starters.map((id) => ({
        participant: {
          id,
          group_id: byId.get(id)?.groupId ?? '',
          branch_id: '',
          active: true,
          full_name: byId.get(id)?.fullName ?? '',
          birthdate: '2000-01-01',
        },
        role: 'starter' as const,
      })),
      ...substitutes.map((id) => ({
        participant: {
          id,
          group_id: byId.get(id)?.groupId ?? '',
          branch_id: '',
          active: true,
          full_name: byId.get(id)?.fullName ?? '',
          birthdate: '2000-01-01',
        },
        role: 'substitute' as const,
      })),
    ];

    return validateRoster(
      roster,
      {
        id: sport.id,
        name: sport.name,
        type: 'group',
        team_size: sport.teamSize,
        substitutes: sport.substitutes,
        max_teams_per_group: 1,
        max_sports_per_participant: 99,
        allow_intergroup: sport.allowIntergroup,
        max_external: sport.maxExternal,
        active: true,
        deadline: null,
      },
      participants[0]?.groupId ?? '',
      captainId || null,
    );
  }, [starters, substitutes, captainId, sport, byId, participants]);

  const toggle = (id: string, role: 'starter' | 'substitute') => {
    const [list, setList] = role === 'starter' ? [starters, setStarters] : [substitutes, setSubstitutes];
    const other = role === 'starter' ? substitutes : starters;
    const setOther = role === 'starter' ? setSubstitutes : setStarters;

    if ((list as string[]).includes(id)) {
      (setList as (v: string[]) => void)((list as string[]).filter((x) => x !== id));
      if (captainId === id) setCaptainId('');
    } else {
      // Cambiar de rol quita a la persona del otro grupo automáticamente.
      setOther(other.filter((x) => x !== id));
      (setList as (v: string[]) => void)([...(list as string[]), id]);
    }
  };

  const complete = starters.length === sport.teamSize;

  return (
    <form action={formAction} className="space-y-4">
      {teamId && <input type="hidden" name="id" value={teamId} />}
      <input type="hidden" name="sportId" value={sport.id} />
      {starters.map((id) => (
        <input key={id} type="hidden" name="starters" value={id} />
      ))}
      {substitutes.map((id) => (
        <input key={id} type="hidden" name="substitutes" value={id} />
      ))}
      <input type="hidden" name="captainId" value={captainId} />

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      <Field label="Nombre del equipo" htmlFor={`team-name-${sport.id}`} error={state.errors?.name} required>
        <input
          id={`team-name-${sport.id}`}
          name="name"
          required
          className="field-input"
          defaultValue={initialName ?? defaultName}
          maxLength={80}
        />
      </Field>

      <fieldset>
        <legend className="field-label">
          Titulares ({starters.length}/{sport.teamSize})
        </legend>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
          {participants.map((participant) => {
            const checked = starters.includes(participant.id);
            const isSubstitute = substitutes.includes(participant.id);
            const isExternal = participant.groupId !== participants[0]?.groupId;
            return (
              <li key={participant.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm transition-colors ${
                    checked ? 'bg-scout-50' : 'hover:bg-canvas'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(participant.id, 'starter')}
                    disabled={!checked && starters.length >= sport.teamSize}
                    className="size-4 accent-scout-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy">
                      {participant.fullName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {participant.branch}
                      {isExternal && ' · de otro grupo'}
                      {isSubstitute && ' · suplente'}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {sport.substitutes > 0 && (
        <fieldset>
          <legend className="field-label">
            Suplentes ({substitutes.length}/{sport.substitutes})
          </legend>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2">
            {participants
              .filter((participant) => !starters.includes(participant.id))
              .map((participant) => {
                const checked = substitutes.includes(participant.id);
                return (
                  <li key={participant.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm ${
                        checked ? 'bg-scout-50' : 'hover:bg-canvas'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(participant.id, 'substitute')}
                        disabled={!checked && substitutes.length >= sport.substitutes}
                        className="size-4 accent-scout-600"
                      />
                      <span className="min-w-0 flex-1 truncate">{participant.fullName}</span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </fieldset>
      )}

      {starters.length > 0 && (
        <Field label="Capitán" htmlFor={`captain-${sport.id}`} hint="Opcional. Debe ser titular.">
          <select
            id={`captain-${sport.id}`}
            className="field-input"
            value={captainId}
            onChange={(event) => setCaptainId(event.target.value)}
          >
            <option value="">Sin capitán asignado</option>
            {starters.map((id) => (
              <option key={id} value={id}>
                {byId.get(id)?.fullName}
              </option>
            ))}
          </select>
        </Field>
      )}

      {problems.length > 0 && (
        <Alert tone="warning">
          <ul className="space-y-1">
            {problems.map((problem) => (
              <li key={problem.code}>{problem.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      {!complete && starters.length > 0 && (
        <p className="text-sm text-slate-500">
          Puedes guardarlo incompleto: hasta tener {sport.teamSize} titulares no podrás enviarlo a
          pago. Si te faltan personas, pide apoyo a otro grupo desde{' '}
          <b>Intergrupales</b>.
        </p>
      )}

      <SubmitButton disabled={starters.length === 0 || problems.length > 0} />
      <p className="text-xs text-slate-500">Equipo de {groupName}.</p>
    </form>
  );
}
