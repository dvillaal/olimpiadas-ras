'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSportAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Branch, Settings } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar deporte'}
    </Button>
  );
}

export function SportForm({ branches, settings }: { branches: Branch[]; settings: Settings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSportAction, {});
  const [type, setType] = useState<'group' | 'individual'>('group');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isGroup = type === 'group';
  const inheritedFee = isGroup ? settings.group_team_fee : settings.individual_fee;

  useActionResult(state, () => {
    formRef.current?.reset();
    setName('');
    setSlug('');
    setSlugTouched(false);
    setType('group');
  });

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[80px_minmax(0,1fr)]">
        <Field label="Icono" htmlFor="icon" error={errors.icon}>
          <input
            id="icon"
            name="icon"
            defaultValue="🏅"
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
        hint="Se usa en direcciones web. No lo cambies una vez publicado."
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
        <textarea id="description" name="description" rows={2} className="field-input resize-y" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoría" htmlFor="category" error={errors.category}>
          <input id="category" name="category" defaultValue="Mixta" className="field-input" />
        </Field>
        <Field label="Fecha de cierre" htmlFor="deadline" error={errors.deadline}>
          <input id="deadline" name="deadline" type="date" className="field-input" />
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
                defaultValue={5}
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
                defaultValue={2}
                required
                className="field-input"
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy">
            <input
              type="checkbox"
              name="allowIntergroup"
              defaultChecked
              className="size-4 accent-scout-600"
            />
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
              defaultValue={2}
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
            defaultValue={isGroup ? 2 : 1}
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
            defaultValue={3}
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
        />
      </Field>

      <fieldset>
        <legend className="field-label">
          Ramas habilitadas
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {branches.map((branch) => (
            <label
              key={branch.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-2.5 text-sm"
            >
              <input
                type="checkbox"
                name="branchIds"
                value={branch.id}
                className="size-4 accent-scout-600"
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

      <SubmitButton />
    </form>
  );
}
