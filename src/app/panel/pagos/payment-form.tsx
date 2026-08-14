'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitPaymentAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { PayableType } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';
import { formatBytes } from '@/lib/utils';
import { formatCOP as money } from '@/lib/domain/fees';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar para revisión'}
    </Button>
  );
}

export function PaymentForm({
  payableType,
  payableId,
  concept,
  expectedAmount,
  maxProofMb,
}: {
  payableType: PayableType;
  payableId: string;
  concept: string;
  expectedAmount: number;
  maxProofMb: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(submitPaymentAction, {});
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(String(expectedAmount));

  useActionResult(state, () => {
    setOpen(false);
    setFile(null);
  });

  const errors = state.errors ?? {};
  const difference = Number(amount) - expectedAmount;
  const today = new Date().toISOString().slice(0, 10);
  const inputClass =
    'w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px] text-white ' +
    'transition-colors placeholder:text-white/50 focus:border-white/60 focus:outline-none ' +
    'focus:ring-2 focus:ring-white/20';

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        Registrar pago
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="payableType" value={payableType} />
      <input type="hidden" name="payableId" value={payableId} />
      <input type="hidden" name="concept" value={concept} />
      <input type="hidden" name="expectedAmount" value={expectedAmount} />

      {errors._ && <Alert tone="error">{errors._}</Alert>}

      <Alert tone="info">
        Valor a consignar: <b>{money(expectedAmount)}</b>. Conserva el comprobante original.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Valor consignado"
          htmlFor={`amount-${payableId}`}
          error={errors.reportedAmount}
          hint={
            difference !== 0
              ? difference < 0
                ? `Faltan ${money(Math.abs(difference))} respecto al valor esperado.`
                : `Estás reportando ${money(difference)} de más.`
              : undefined
          }
          required
          className="[&_.field-label]:text-white [&_p]:text-white/70"
        >
          <input
            id={`amount-${payableId}`}
            name="reportedAmount"
            type="number"
            min={1}
            required
            className={inputClass}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field
          label="Fecha del pago"
          htmlFor={`date-${payableId}`}
          error={errors.paymentDate}
          required
          className="[&_.field-label]:text-white"
        >
          <input
            id={`date-${payableId}`}
            name="paymentDate"
            type="date"
            max={today}
            defaultValue={today}
            required
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Referencia de la consignación"
        htmlFor={`reference-${payableId}`}
        error={errors.reference}
        hint="El número que aparece en el recibo o en la transferencia. No puede repetirse."
        required
        className="[&_.field-label]:text-white [&_p]:text-white/60"
      >
        <input
          id={`reference-${payableId}`}
          name="reference"
          required
          className={`${inputClass} font-mono`}
          minLength={4}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre de quien pagó"
          htmlFor={`payer-${payableId}`}
          error={errors.payerName}
          required
          className="[&_.field-label]:text-white"
        >
          <input id={`payer-${payableId}`} name="payerName" required className={inputClass} />
        </Field>
        <Field
          label="Documento de quien pagó"
          htmlFor={`payerDoc-${payableId}`}
          error={errors.payerDocument}
          className="[&_.field-label]:text-white"
        >
          <input id={`payerDoc-${payableId}`} name="payerDocument" className={inputClass} />
        </Field>
      </div>

      <Field
        label="Banco de origen"
        htmlFor={`bank-${payableId}`}
        error={errors.originBank}
        className="[&_.field-label]:text-white"
      >
        <input
          id={`bank-${payableId}`}
          name="originBank"
          className={inputClass}
          placeholder="Bancolombia, Nequi, Davivienda…"
        />
      </Field>

      <Field
        label="Comprobante"
        htmlFor={`proof-${payableId}`}
        error={errors.proof}
        hint={`PDF, JPG, PNG o WEBP. Máximo ${maxProofMb} MB.`}
        required
        className="[&_.field-label]:text-white [&_p]:text-white/60"
      >
        <input
          id={`proof-${payableId}`}
          name="proof"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-white/20
                     file:px-3 file:py-1.5 file:font-semibold file:text-white`}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="mt-1.5 text-xs text-white/70">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
      </Field>

      <Field
        label="Observaciones"
        htmlFor={`notes-${payableId}`}
        error={errors.notes}
        className="[&_.field-label]:text-white"
      >
        <textarea
          id={`notes-${payableId}`}
          name="notes"
          rows={2}
          className={`${inputClass} resize-y`}
          placeholder="Cualquier detalle que la organización deba saber."
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <SubmitButton />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(false)}
          className="!border-white/40 !text-white hover:!bg-white/10"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
