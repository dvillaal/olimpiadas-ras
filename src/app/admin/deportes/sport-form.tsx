'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSportAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Branch, Settings } from '@/types/database';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';
import { formatCOP } from '@/lib/domain/fees';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar deporte'}
    </Button>
  );
}

export interface SportRow {
  id: string;
  slug: string;
  name: string;
  icon: string;
  type: 'group' | 'individual';
  description: string;
  category: string;
  teamSize: number;
  substitutes: number;
  maxTeamsPerGroup: number;
  maxSportsPerParticipant: number;
  deadline: string | null;
  fee: number | null;
  allowIntergroup: boolean;
  maxExternal: number;
  branchIds: string[];
}

export function SportForm({
  branches,
  settings,
  editing = null,
  onCancelEdit,
}: {
  branches: Branch[];
  settings: Settings;
  editing?: SportRow | null;
  onCancelEdit?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSportAction, {});
  const [type, setType] = useState<'group' | 'individual'>(editing?.type ?? 'group');
  const [name, setName] = useState(editing?.name ?? '');
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(editing));
  const [selectedBranches, setSelectedBranches] = useState<string[]>(editing?.branchIds ?? []);
  const formRef = useRef<HTMLFormElement>(null);

  const isGroup = type === 'group';
  const inheritedFee = isGroup ? settings.group_team_fee : settings.individual_fee;

  useActionResult(state, () => {
    formRef.current?.reset();
    setName('');
    setSlug('');
    setSlugTouched(false);
    setType('group');
    setSelectedBranches([]);
    onCancelEdit?.();
  });

  const errors = state.errors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4"
      noValidate
      // Fuerza a React a recrear el formulario al cambiar de deporte, para que
      // los `defaultValue` se refresquen.
      key={editing?.id ?? 'nuevo'}
    >
      {errors._ && <Alert tone="error">{errors._}</Alert>}
      {editing && <input type="hidden" name="id" value={editing.id} />}

      <div className="grid gap-4 sm:grid-cols-[80px_minmax(0,1fr)]">
        <Field label="Icono" htmlFor="icon" error={errors.icon}>
          <input
            id="icon"
            name="icon"
            defaultValue={editing?.icon ?? '🏅'}
            maxLength={8}
            className="field-input text-center text-xl"
          />
        </Field>
        <Field label="Nombre" htmlFor="name" error={errors.name} required>
          <input
            id="name"
            name="name"
            required
            className="field-input"
            placeholder="Fútbol"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </Field>
      </div>

      <Field
        label="Identificador"
        htmlFor="slug"
        error={errors.slug}
        hint={
          editing
            ? 'Ya está publicado: si lo cambias, se recalculará el sufijo de rama.'
            : 'Se usa en direcciones web. No lo cambies una vez publicado.'
        }
        required
      >
        <input
          id="slug"
          name="slug"
          required
          className="field-input font-mono text-sm"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(slugify(event.target.value));
          }}
        />
      </Field>

      <Field label="Modalidad" htmlFor="type" error={errors.type} required>
        <select
          id="type"
          name="type"
          className="field-input"
          value={type}
          onChange={(event) => setType(event.target.value as 'group' | 'individual')}
        >
          <option value="group">Por equipos</option>
          <option value="individual">Individual</option>
        </select>
      </Field>

      <Field label="Descripción" htmlFor="description" error={errors.description}>
        <textarea
          id="description"
          name="description"
          rows={2}
          className="field-input resize-y"
          defaultValue={editing?.description ?? ''}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoría" htmlFor="category" error={errors.category}>
          <input
            id="category"
            name="category"
            defaultValue={editing?.category ?? 'Mixta'}
            className="field-input"
          />
        </Field>
        <Field label="Fecha de cierre" htmlFor="deadline" error={errors.deadline}>
          <input
            id="deadline"
            name="deadline"
            type="date"
            className="field-input"
            defaultValue={editing?.deadline ?? ''}
          />
        </Field>
      </div>

      {/* Los campos de equipo solo tienen sentido en deportes grupales. */}
      {isGroup ? (
        <div className="space-y-4 rounded-xl bg-canvas p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titulares" htmlFor="teamSize" error={errors.teamSize} required>
              <input
                id="teamSize"
                name="teamSize"
                type="number"
                min={1}
                defaultValue={editing?.teamSize ?? 5}
                required
                className="field-input"
              />
            </Field>
            <Field label="Suplentes" htmlFor="substitutes" error={errors.substitutes} required>
              <input
                id="substitutes"
                name="substitutes"
                type="number"
                min={0}
                defaultValue={editing?.substitutes ?? 2}
                required
                className="field-input"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy">
            <Checkbox name="allowIntergroup" defaultChecked={editing?.allowIntergroup ?? true} />
            Permite integrantes de otros grupos
          </label>

          <Field
            label="Máximo de integrantes externos"
            htmlFor="maxExternal"
            error={errors.maxExternal}
            hint="Cuántas personas prestadas de otros grupos admite un equipo."
            required
          >
            <input
              id="maxExternal"
              name="maxExternal"
              type="number"
              min={0}
              defaultValue={editing?.maxExternal ?? 2}
              required
              className="field-input"
            />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="teamSize" value="1" />
          <input type="hidden" name="substitutes" value="0" />
          <input type="hidden" name="maxExternal" value="0" />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={isGroup ? 'Equipos por grupo' : 'Inscripciones por grupo'}
          htmlFor="maxTeamsPerGroup"
          error={errors.maxTeamsPerGroup}
          required
        >
          <input
            id="maxTeamsPerGroup"
            name="maxTeamsPerGroup"
            type="number"
            min={1}
            defaultValue={editing?.maxTeamsPerGroup ?? (isGroup ? 2 : 1)}
            required
            className="field-input"
          />
        </Field>
        <Field
          label="Máx. deportes por persona"
          htmlFor="maxSportsPerParticipant"
          error={errors.maxSportsPerParticipant}
          required
        >
          <input
            id="maxSportsPerParticipant"
            name="maxSportsPerParticipant"
            type="number"
            min={1}
            defaultValue={editing?.maxSportsPerParticipant ?? 3}
            required
            className="field-input"
          />
        </Field>
      </div>

      <Field
        label="Tarifa propia"
        htmlFor="fee"
        error={errors.fee}
        hint={`Déjalo vacío para usar la tarifa general (${formatCOP(inheritedFee)}).`}
      >
        <input
          id="fee"
          name="fee"
          type="number"
          min={0}
          className="field-input"
          placeholder={String(inheritedFee)}
          defaultValue={editing?.fee != null ? String(editing.fee) : ''}
        />
      </Field>

      <fieldset>
        <legend className="field-label">
          Ramas que compiten
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        </legend>
        <p className="mb-2 text-xs text-slate-500">
          {editing
            ? 'Esta rama ya está marcada porque es la del deporte que editas. Si marcas otra además, se crea un deporte nuevo para esa rama en vez de moverse.'
            : 'Las ramas no compiten entre sí: por cada rama que marques se crea un deporte independiente (mismo nombre e ícono, pero inscripciones, calendario y resultados propios).'}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {branches.map((branch) => (
            <label
              key={branch.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-2.5 text-sm"
            >
              <Checkbox
                name="branchIds"
                value={branch.id}
                checked={selectedBranches.includes(branch.id)}
                onChange={() =>
                  setSelectedBranches((current) =>
                    current.includes(branch.id)
                      ? current.filter((id) => id !== branch.id)
                      : [...current, branch.id],
                  )
                }
              />
              {branch.name}
            </label>
          ))}
        </div>
        {errors.branchIds && (
          <p className="field-error" role="alert">
            <span aria-hidden>⚠</span>
            {errors.branchIds}
          </p>
        )}
      </fieldset>

      <SubmitButton editing={Boolean(editing)} />

      {editing && (
        <Button type="button" variant="secondary" block onClick={onCancelEdit}>
          Cancelar edición
        </Button>
      )}
    </form>
  );
}
