'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTeamAsAdminAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { validateRoster, type RosterEntry } from '@/lib/domain/eligibility';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface AdminEditorSport {
  id: string;
  name: string;
  teamSize: number;
  substitutes: number;
  allowIntergroup: boolean;
  maxExternal: number;
}

export interface AdminEditorParticipant {
  id: string;
  fullName: string;
  branch: string;
  groupId: string;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || disabled}>
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </Button>
  );
}

/**
 * Editor de alineación para el administrador: mismo motor de reglas que
 * `TeamBuilder` (panel del jefe de grupo), en tono claro y limitado a editar
 * equipos ya existentes. Solo admite participantes del grupo dueño del
 * equipo, más los externos ya aportados por una alianza aceptada.
 */
export function AdminTeamEditor({
  sport,
  participants,
  groupId,
  groupName,
  teamId,
  initialName,
  initialStarters,
  initialSubstitutes,
  onDone,
}: {
  sport: AdminEditorSport;
  participants: AdminEditorParticipant[];
  groupId: string;
  groupName: string;
  teamId: string;
  initialName: string;
  initialStarters: string[];
  initialSubstitutes: string[];
  onDone: () => void;
}) {
  const [starters, setStarters] = useState<string[]>(initialStarters);
  const [substitutes, setSubstitutes] = useState<string[]>(initialSubstitutes);
  const [captainId, setCaptainId] = useState('');
  const [state, formAction] = useActionState<ActionState, FormData>(saveTeamAsAdminAction, {});

  useActionResult(state, onDone);

  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

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
      groupId,
      captainId || null,
    );
  }, [starters, substitutes, captainId, sport, byId, groupId]);

  const toggle = (id: string, role: 'starter' | 'substitute') => {
    const [list, setList] = role === 'starter' ? [starters, setStarters] : [substitutes, setSubstitutes];
    const other = role === 'starter' ? substitutes : starters;
    const setOther = role === 'starter' ? setSubstitutes : setStarters;

    if ((list as string[]).includes(id)) {
      (setList as (v: string[]) => void)((list as string[]).filter((x) => x !== id));
      if (captainId === id) setCaptainId('');
    } else {
      setOther(other.filter((x) => x !== id));
      (setList as (v: string[]) => void)([...(list as string[]), id]);
    }
  };

  return (
    <form action={formAction} className="space-y-4 rounded-xl bg-canvas p-4">
      <input type="hidden" name="id" value={teamId} />
      <input type="hidden" name="sportId" value={sport.id} />
      <input type="hidden" name="groupId" value={groupId} />
      {starters.map((id) => (
        <input key={id} type="hidden" name="starters" value={id} />
      ))}
      {substitutes.map((id) => (
        <input key={id} type="hidden" name="substitutes" value={id} />
      ))}
      <input type="hidden" name="captainId" value={captainId} />

      {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

      <Field label="Nombre del equipo" htmlFor={`admin-team-name-${teamId}`} error={state.errors?.name} required>
        <input
          id={`admin-team-name-${teamId}`}
          name="name"
          required
          className="field-input"
          defaultValue={initialName}
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
            const isExternal = participant.groupId !== groupId;
            return (
              <li key={participant.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm transition-colors ${
                    checked ? 'bg-scout-50' : 'hover:bg-slate-100'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(participant.id, 'starter')}
                    disabled={!checked && starters.length >= sport.teamSize}
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
                        checked ? 'bg-scout-50' : 'hover:bg-slate-100'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() => toggle(participant.id, 'substitute')}
                        disabled={!checked && substitutes.length >= sport.substitutes}
                      />
                      <span className="min-w-0 flex-1 truncate text-navy">
                        {participant.fullName}
                      </span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </fieldset>
      )}

      {starters.length > 0 && (
        <Field label="Capitán" htmlFor={`admin-captain-${teamId}`} hint="Opcional. Debe ser titular.">
          <select
            id={`admin-captain-${teamId}`}
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

      <div className="flex flex-wrap gap-2">
        <SubmitButton disabled={starters.length === 0 || problems.length > 0} />
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-slate-500">Equipo de {groupName}.</p>
    </form>
  );
}
