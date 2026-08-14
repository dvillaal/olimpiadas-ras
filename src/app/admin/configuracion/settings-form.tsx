'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSettingsAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { Settings } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';

/** El input datetime-local necesita "YYYY-MM-DDTHH:mm" en hora local, sin zona. */
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar configuración'}
    </Button>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettingsAction, {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <fieldset className="space-y-4">
        <legend className="kicker mb-2">Evento</legend>

        <Field label="Nombre del evento" htmlFor="eventName" error={errors.eventName} required>
          <input
            id="eventName"
            name="eventName"
            required
            className="field-input"
            defaultValue={settings.event_name}
          />
        </Field>

        <Field
          label="Fecha y hora de inicio"
          htmlFor="eventStartsAt"
          error={errors.eventStartsAt}
          hint="Alimenta la cuenta regresiva que ven los grupos en su panel. Déjalo vacío para ocultarla."
        >
          <input
            id="eventStartsAt"
            name="eventStartsAt"
            type="datetime-local"
            className="field-input"
            defaultValue={toDatetimeLocal(settings.event_starts_at)}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-canvas p-4 text-sm">
          <input
            type="checkbox"
            name="registrationOpen"
            defaultChecked={settings.registration_open}
            className="mt-0.5 size-4 accent-scout-600"
          />
          <span>
            <b className="text-navy">Registro de grupos abierto</b>
            <br />
            <span className="text-slate-500">
              Al desactivarlo, el formulario público deja de aceptar solicitudes nuevas. Los grupos
              ya aprobados siguen trabajando con normalidad.
            </span>
          </span>
        </label>
      </fieldset>

      <hr className="border-line" />

      <fieldset className="space-y-4">
        <legend className="kicker mb-2">Tarifas</legend>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Deporte individual"
            htmlFor="individualFee"
            error={errors.individualFee}
            hint="Por participante."
            required
          >
            <input
              id="individualFee"
              name="individualFee"
              type="number"
              min={0}
              required
              className="field-input"
              defaultValue={settings.individual_fee}
            />
          </Field>

          <Field
            label="Deporte grupal"
            htmlFor="groupTeamFee"
            error={errors.groupTeamFee}
            hint="Por equipo. En $0 los equipos no pagan."
            required
          >
            <input
              id="groupTeamFee"
              name="groupTeamFee"
              type="number"
              min={0}
              required
              className="field-input"
              defaultValue={settings.group_team_fee}
            />
          </Field>

          <Field label="Stand de ventas" htmlFor="standFee" error={errors.standFee} required>
            <input
              id="standFee"
              name="standFee"
              type="number"
              min={0}
              required
              className="field-input"
              defaultValue={settings.stand_fee}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Cupo máximo de stands"
            htmlFor="standLimit"
            error={errors.standLimit}
            required
          >
            <input
              id="standLimit"
              name="standLimit"
              type="number"
              min={0}
              required
              className="field-input"
              defaultValue={settings.stand_limit}
            />
          </Field>
          <Field
            label="Tamaño máx. del comprobante (MB)"
            htmlFor="maxProofMb"
            error={errors.maxProofMb}
            required
          >
            <input
              id="maxProofMb"
              name="maxProofMb"
              type="number"
              min={1}
              max={50}
              required
              className="field-input"
              defaultValue={settings.max_proof_mb}
            />
          </Field>
        </div>
      </fieldset>

      <hr className="border-line" />

      <fieldset className="space-y-4">
        <legend className="kicker mb-2">Cuenta para pagos</legend>
        <p className="-mt-1 text-sm text-slate-500">
          Estos datos se muestran a los grupos cuando van a registrar un pago.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la cuenta" htmlFor="bankLabel" error={errors.bankLabel} required>
            <input
              id="bankLabel"
              name="bankLabel"
              required
              className="field-input"
              defaultValue={settings.bank_label}
            />
          </Field>
          <Field label="Entidad" htmlFor="bankName" error={errors.bankName} required>
            <input
              id="bankName"
              name="bankName"
              required
              className="field-input"
              defaultValue={settings.bank_name}
            />
          </Field>
          <Field
            label="Tipo de cuenta"
            htmlFor="bankAccountType"
            error={errors.bankAccountType}
            required
          >
            <input
              id="bankAccountType"
              name="bankAccountType"
              required
              className="field-input"
              defaultValue={settings.bank_account_type}
            />
          </Field>
          <Field
            label="Número de cuenta"
            htmlFor="bankAccountNumber"
            error={errors.bankAccountNumber}
            required
          >
            <input
              id="bankAccountNumber"
              name="bankAccountNumber"
              required
              className="field-input font-mono"
              defaultValue={settings.bank_account_number}
            />
          </Field>
          <Field label="NIT" htmlFor="bankNit" error={errors.bankNit} required>
            <input
              id="bankNit"
              name="bankNit"
              required
              className="field-input font-mono"
              defaultValue={settings.bank_nit}
            />
          </Field>
          <Field label="Titular" htmlFor="bankHolder" error={errors.bankHolder} required>
            <input
              id="bankHolder"
              name="bankHolder"
              required
              className="field-input"
              defaultValue={settings.bank_holder}
            />
          </Field>
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}
