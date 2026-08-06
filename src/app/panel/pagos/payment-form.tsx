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
        >
          <input
            id={`amount-${payableId}`}
            name="reportedAmount"
            type="number"
            min={1}
            required
            className="field-input"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field
          label="Fecha del pago"
          htmlFor={`date-${payableId}`}
          error={errors.paymentDate}
          required
        >
          <input
            id={`date-${payableId}`}
            name="paymentDate"
            type="date"
            max={today}
            defaultValue={today}
            required
            className="field-input"
          />
        </Field>
      </div>

      <Field
        label="Referencia de la consignación"
        htmlFor={`reference-${payableId}`}
        error={errors.reference}
        hint="El número que aparece en el recibo o en la transferencia. No puede repetirse."
        required
      >
        <input
          id={`reference-${payableId}`}
          name="reference"
          required
          className="field-input font-mono"
          minLength={4}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre de quien pagó"
          htmlFor={`payer-${payableId}`}
          error={errors.payerName}
          required
        >
          <input id={`payer-${payableId}`} name="payerName" required className="field-input" />
        </Field>
        <Field
          label="Documento de quien pagó"
          htmlFor={`payerDoc-${payableId}`}
          error={errors.payerDocument}
        >
          <input id={`payerDoc-${payableId}`} name="payerDocument" className="field-input" />
        </Field>
      </div>

      <Field label="Banco de origen" htmlFor={`bank-${payableId}`} error={errors.originBank}>
        <input
          id={`bank-${payableId}`}
          name="originBank"
          className="field-input"
          placeholder="Bancolombia, Nequi, Davivienda…"
        />
      </Field>

      <Field
        label="Comprobante"
        htmlFor={`proof-${payableId}`}
        error={errors.proof}
        hint={`PDF, JPG, PNG o WEBP. Máximo ${maxProofMb} MB.`}
        required
      >
        <input
          id={`proof-${payableId}`}
          name="proof"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
          className="field-input file:mr-3 file:rounded-lg file:border-0 file:bg-scout-50
                     file:px-3 file:py-1.5 file:font-semibold file:text-scout-700"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="mt-1.5 text-xs text-slate-500">
            {file.name} · {formatBytes(file.size)}
          </p>
        )}
      </Field>

      <Field label="Observaciones" htmlFor={`notes-${payableId}`} error={errors.notes}>
        <textarea
          id={`notes-${payableId}`}
          name="notes"
          rows={2}
          className="field-input resize-y"
          placeholder="Cualquier detalle que la organización deba saber."
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <SubmitButton />
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
