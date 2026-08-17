'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStandAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Button, Checkbox, Field } from '@/components/ui';
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
  const inputClass =
    'w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px] text-white ' +
    'transition-colors placeholder:text-white/50 focus:border-white/60 focus:outline-none ' +
    'focus:ring-2 focus:ring-white/20';
  const fieldLabelClass = '[&_.field-label]:text-white';
  const fieldHintClass = '[&_p]:text-white/60';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Field
        label="Nombre del stand"
        htmlFor="standName"
        error={errors.name}
        required
        className={fieldLabelClass}
      >
        <input
          id="standName"
          name="name"
          required
          className={inputClass}
          defaultValue={stand?.name}
          placeholder="Delicias Scout"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Responsable"
          htmlFor="responsible"
          error={errors.responsible}
          required
          className={fieldLabelClass}
        >
          <input
            id="responsible"
            name="responsible"
            required
            className={inputClass}
            defaultValue={stand?.responsible}
          />
        </Field>
        <Field
          label="Documento"
          htmlFor="standDocument"
          error={errors.document}
          className={fieldLabelClass}
        >
          <input
            id="standDocument"
            name="document"
            className={inputClass}
            defaultValue={stand?.document}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Teléfono"
          htmlFor="standPhone"
          error={errors.phone}
          required
          className={fieldLabelClass}
        >
          <input
            id="standPhone"
            name="phone"
            required
            className={inputClass}
            inputMode="tel"
            defaultValue={stand?.phone}
          />
        </Field>
        <Field
          label="Correo"
          htmlFor="standEmail"
          error={errors.email}
          className={fieldLabelClass}
        >
          <input
            id="standEmail"
            name="email"
            type="email"
            className={inputClass}
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
        className={`${fieldLabelClass} ${fieldHintClass}`}
      >
        <textarea
          id="products"
          name="products"
          rows={3}
          required
          className={`${inputClass} resize-y`}
          defaultValue={stand?.products}
          placeholder="Empanadas, jugos naturales, artesanías hechas por la tropa…"
        />
      </Field>

      <Field
        label="Descripción del stand"
        htmlFor="standDescription"
        error={errors.description}
        className={fieldLabelClass}
      >
        <textarea
          id="standDescription"
          name="description"
          rows={2}
          className={`${inputClass} resize-y`}
          defaultValue={stand?.description}
        />
      </Field>

      <fieldset className="space-y-2 rounded-xl border border-white/20 bg-white/10 p-4">
        <legend className="mb-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/70">
          Requerimientos
        </legend>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-white">
          <Checkbox tone="dark" name="needsPower" defaultChecked={stand?.needsPower} />
          ⚡ Necesitamos toma de energía
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-white">
          <Checkbox tone="dark" name="needsFurniture" defaultChecked={stand?.needsFurniture} />
          🪑 Necesitamos mesas y sillas
        </label>
      </fieldset>

      <Field
        label="Observaciones"
        htmlFor="standNotes"
        error={errors.notes}
        className={fieldLabelClass}
      >
        <textarea
          id="standNotes"
          name="notes"
          rows={2}
          className={`${inputClass} resize-y`}
          defaultValue={stand?.notes}
        />
      </Field>

      <SubmitButton editing={Boolean(stand)} />
    </form>
  );
}
