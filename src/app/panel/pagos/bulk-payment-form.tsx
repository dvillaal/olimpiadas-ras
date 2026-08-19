'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitBulkPaymentAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import type { PayableType } from '@/types/database';
import { Alert, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';
import { formatBytes } from '@/lib/utils';
import { formatCOP as money } from '@/lib/domain/fees';

interface SelectedConcept {
  payableType: PayableType;
  payableId: string;
  label: string;
  amount: number;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar para revisión'}
    </Button>
  );
}

/**
 * Un solo comprobante y una sola referencia para pagar varios conceptos a la
 * vez, tal como consigna la mayoría de los grupos en la práctica.
 */
export function BulkPaymentForm({
  concepts,
  maxProofMb,
  onClose,
}: {
  concepts: SelectedConcept[];
  maxProofMb: number;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(submitBulkPaymentAction, {});
  const [file, setFile] = useState<File | null>(null);
  const total = concepts.reduce((sum, c) => sum + c.amount, 0);
  const [amount, setAmount] = useState(String(total));

  useActionResult(state, () => {
    setFile(null);
    onClose();
  });

  const errors = state.errors ?? {};
  const difference = Number(amount) - total;
  const today = new Date().toISOString().slice(0, 10);
  const inputClass =
    'w-full rounded-xl border border-white/30 bg-white/10 px-3.5 py-2.5 text-[15px] text-white ' +
    'transition-colors placeholder:text-white/50 focus:border-white/60 focus:outline-none ' +
    'focus:ring-2 focus:ring-white/20';

  const items = concepts.map((c) => ({
    payableType: c.payableType,
    payableId: c.payableId,
    concept: c.label,
    expectedAmount: c.amount,
  }));

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {errors._ && <Alert tone="error">{errors._}</Alert>}
      {errors.items && <Alert tone="error">{errors.items}</Alert>}

      <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5">
        <p className="mb-2 text-sm font-semibold text-white">
          Vas a pagar {concepts.length} concepto(s) juntos:
        </p>
        <ul className="space-y-1 text-sm text-white/85">
          {concepts.map((c) => (
            <li key={`${c.payableType}:${c.payableId}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{c.label}</span>
              <span className="whitespace-nowrap font-semibold">{money(c.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      <Alert tone="info">
        Valor total a consignar: <b>{money(total)}</b>. Conserva el comprobante original.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Valor consignado"
          htmlFor="bulk-amount"
          error={errors.reportedAmount}
          hint={
            difference !== 0
              ? difference < 0
                ? `Faltan ${money(Math.abs(difference))} respecto al total esperado.`
                : `Estás reportando ${money(difference)} de más.`
              : undefined
          }
          required
          className="[&_.field-label]:text-white [&_p]:text-white/70"
        >
          <input
            id="bulk-amount"
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
          htmlFor="bulk-date"
          error={errors.paymentDate}
          required
          className="[&_.field-label]:text-white"
        >
          <input
            id="bulk-date"
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
        htmlFor="bulk-reference"
        error={errors.reference}
        hint="El número que aparece en el recibo o en la transferencia."
        required
        className="[&_.field-label]:text-white [&_p]:text-white/60"
      >
        <input
          id="bulk-reference"
          name="reference"
          required
          className={`${inputClass} font-mono`}
          minLength={4}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nombre de quien pagó"
          htmlFor="bulk-payer"
          error={errors.payerName}
          required
          className="[&_.field-label]:text-white"
        >
          <input id="bulk-payer" name="payerName" required className={inputClass} />
        </Field>
        <Field
          label="Documento de quien pagó"
          htmlFor="bulk-payerDoc"
          error={errors.payerDocument}
          className="[&_.field-label]:text-white"
        >
          <input id="bulk-payerDoc" name="payerDocument" className={inputClass} />
        </Field>
      </div>

      <Field
        label="Banco de origen"
        htmlFor="bulk-bank"
        error={errors.originBank}
        className="[&_.field-label]:text-white"
      >
        <input
          id="bulk-bank"
          name="originBank"
          className={inputClass}
          placeholder="Bancolombia, Nequi, Davivienda…"
        />
      </Field>

      <Field
        label="Comprobante"
        htmlFor="bulk-proof"
        error={errors.proof}
        hint={`PDF, JPG, PNG o WEBP. Máximo ${maxProofMb} MB.`}
        required
        className="[&_.field-label]:text-white [&_p]:text-white/60"
      >
        <input
          id="bulk-proof"
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
        htmlFor="bulk-notes"
        error={errors.notes}
        className="[&_.field-label]:text-white"
      >
        <textarea
          id="bulk-notes"
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
          onClick={onClose}
          className="!border-white/40 !text-white hover:!bg-white/10"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
