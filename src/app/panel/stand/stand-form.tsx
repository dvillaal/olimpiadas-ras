'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStandAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

export interface StandDraft {
  name: string;
  responsible: string;
  document: string;
  phone: string;
  email: string;
  products: string;
  description: string;
  needsPower: boolean;
  needsFurniture: boolean;
  notes: string;
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Guardando…' : editing ? 'Actualizar solicitud' : 'Guardar solicitud'}
    </Button>
  );
}

export function StandForm({ stand }: { stand?: StandDraft }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveStandAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field label="Nombre del stand" htmlFor="standName" error={errors.name} required>
        <input
          id="standName"
          name="name"
          required
          className="field-input"
          defaultValue={stand?.name}
          placeholder="Delicias Scout"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsable" htmlFor="responsible" error={errors.responsible} required>
          <input
            id="responsible"
            name="responsible"
            required
            className="field-input"
            defaultValue={stand?.responsible}
          />
        </Field>
        <Field label="Documento" htmlFor="standDocument" error={errors.document}>
          <input
            id="standDocument"
            name="document"
            className="field-input"
            defaultValue={stand?.document}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" htmlFor="standPhone" error={errors.phone} required>
          <input
            id="standPhone"
            name="phone"
            required
            className="field-input"
            inputMode="tel"
            defaultValue={stand?.phone}
          />
        </Field>
        <Field label="Correo" htmlFor="standEmail" error={errors.email}>
          <input
            id="standEmail"
            name="email"
            type="email"
            className="field-input"
            defaultValue={stand?.email}
          />
        </Field>
      </div>

      <Field
        label="Productos que van a vender"
        htmlFor="products"
        error={errors.products}
        hint="Sé específico: ayuda a la organización a distribuir los stands sin repetir oferta."
        required
      >
        <textarea
          id="products"
          name="products"
          rows={3}
          required
          className="field-input resize-y"
          defaultValue={stand?.products}
          placeholder="Empanadas, jugos naturales, artesanías hechas por la tropa…"
        />
      </Field>

      <Field label="Descripción del stand" htmlFor="standDescription" error={errors.description}>
        <textarea
          id="standDescription"
          name="description"
          rows={2}
          className="field-input resize-y"
          defaultValue={stand?.description}
        />
      </Field>

      <fieldset className="space-y-2 rounded-xl bg-canvas p-4">
        <legend className="kicker mb-1">Requerimientos</legend>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy">
          <input
            type="checkbox"
            name="needsPower"
            defaultChecked={stand?.needsPower}
            className="size-4 accent-scout-600"
          />
          ⚡ Necesitamos toma de energía
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-navy">
          <input
            type="checkbox"
            name="needsFurniture"
            defaultChecked={stand?.needsFurniture}
            className="size-4 accent-scout-600"
          />
          🪑 Necesitamos mesas y sillas
        </label>
      </fieldset>

      <Field label="Observaciones" htmlFor="standNotes" error={errors.notes}>
        <textarea
          id="standNotes"
          name="notes"
          rows={2}
          className="field-input resize-y"
          defaultValue={stand?.notes}
        />
      </Field>

      <SubmitButton editing={Boolean(stand)} />
    </form>
  );
}
