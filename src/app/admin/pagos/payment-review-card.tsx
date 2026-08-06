'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { getProofUrlAction, reviewPaymentAction } from '../actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Badge, Button, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import { formatCOP } from '@/lib/domain/fees';
import { formatBytes, formatDate, formatRelative } from '@/lib/utils';

export interface PaymentForReview {
  id: string;
  concept: string;
  reference: string;
  expectedAmount: number;
  reportedAmount: number;
  paymentDate: string;
  payerName: string;
  payerDocument: string;
  originBank: string;
  notes: string;
  proofPath: string;
  proofName: string;
  proofSize: number;
  createdAt: string;
}

function SubmitButtons({
  mode,
  onChangeMode,
}: {
  mode: 'idle' | 'reject' | 'correction';
  onChangeMode: (mode: 'idle' | 'reject' | 'correction') => void;
}) {
  const { pending } = useFormStatus();

  if (mode !== 'idle') {
    return (
      <>
        <Button
          type="submit"
          name="status"
          value={mode === 'reject' ? 'rejected' : 'correction'}
          variant={mode === 'reject' ? 'danger' : 'gold'}
          disabled={pending}
        >
          {pending ? 'Enviando…' : mode === 'reject' ? 'Confirmar rechazo' : 'Solicitar corrección'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onChangeMode('idle')} disabled={pending}>
          Cancelar
        </Button>
      </>
    );
  }

  return (
    <>
      <Button type="submit" name="status" value="approved" disabled={pending}>
        {pending ? 'Aprobando…' : '✓ Aprobar pago'}
      </Button>
      <Button
        type="button"
        variant="gold"
        onClick={() => onChangeMode('correction')}
        disabled={pending}
      >
        Pedir corrección
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChangeMode('reject')}
        disabled={pending}
      >
        Rechazar
      </Button>
    </>
  );
}

export function PaymentReviewCard({
  payment,
  groupName,
  groupCode,
}: {
  payment: PaymentForReview;
  groupName: string;
  groupCode: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewPaymentAction, {});
  const [mode, setMode] = useState<'idle' | 'reject' | 'correction'>('idle');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingProof, startLoadingProof] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.message]);

  const shortfall = payment.reportedAmount - payment.expectedAmount;

  const openProof = () => {
    if (proofUrl) {
      window.open(proofUrl, '_blank', 'noopener');
      return;
    }
    startLoadingProof(async () => {
      // El enlace se firma en el servidor y caduca en 5 minutos: el bucket es
      // privado y los comprobantes traen datos bancarios.
      const url = await getProofUrlAction(payment.proofPath);
      if (!url) {
        toast.error('No fue posible abrir el comprobante.');
        return;
      }
      setProofUrl(url);
      window.open(url, '_blank', 'noopener');
    });
  };

  return (
    <article className="rounded-2xl border border-line p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-bold text-navy">{payment.concept}</h4>
          <p className="text-sm text-slate-500">
            {groupName} {groupCode && <span className="font-mono text-xs">· {groupCode}</span>} ·
            enviado {formatRelative(payment.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-extrabold text-scout-700">
            {formatCOP(payment.reportedAmount)}
          </p>
          <p className="text-xs text-slate-500">
            esperado {formatCOP(payment.expectedAmount)}
          </p>
        </div>
      </header>

      {shortfall < 0 && (
        <Alert tone="warning" className="mb-4">
          El valor reportado es <b>{formatCOP(Math.abs(shortfall))}</b> menor al esperado. Verifica
          antes de aprobar.
        </Alert>
      )}
      {shortfall > 0 && (
        <Alert tone="info" className="mb-4">
          El grupo consignó {formatCOP(shortfall)} de más.
        </Alert>
      )}

      <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {[
          ['Referencia', payment.reference],
          ['Fecha del pago', formatDate(payment.paymentDate)],
          ['Pagó', payment.payerName],
          ['Documento', payment.payerDocument || '—'],
          ['Banco de origen', payment.originBank || '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="font-semibold text-slate-500">{label}:</dt>
            <dd className="min-w-0 break-words text-navy">{value}</dd>
          </div>
        ))}
      </dl>

      {payment.notes && (
        <p className="mb-4 rounded-xl bg-canvas p-3 text-sm text-slate-600">
          <b className="text-slate-500">Nota del grupo:</b> {payment.notes}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-canvas p-3">
        <span aria-hidden className="text-2xl">
          📎
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-navy">
            {payment.proofName || 'Comprobante'}
          </p>
          <p className="text-xs text-slate-500">{formatBytes(payment.proofSize)}</p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={openProof} disabled={loadingProof}>
          {loadingProof ? 'Abriendo…' : 'Ver comprobante'}
        </Button>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="paymentId" value={payment.id} />

        {state.errors?._ && <Alert tone="error">{state.errors._}</Alert>}

        {mode !== 'idle' && (
          <Field
            label={mode === 'reject' ? 'Motivo del rechazo' : '¿Qué debe corregir el grupo?'}
            htmlFor={`note-${payment.id}`}
            error={state.errors?.note}
            hint="Se enviará por correo al responsable del grupo."
            required
          >
            <textarea
              id={`note-${payment.id}`}
              name="note"
              rows={2}
              required
              className="field-input resize-y"
              placeholder={
                mode === 'reject'
                  ? 'No encontramos esta consignación en el extracto bancario…'
                  : 'El comprobante está borroso; envía una foto más nítida…'
              }
            />
          </Field>
        )}

        <div className="flex flex-wrap gap-2">
          <SubmitButtons mode={mode} onChangeMode={setMode} />
        </div>
      </form>

      {state.ok && (
        <Badge tone="green" className="mt-3">
          Revisado
        </Badge>
      )}
    </article>
  );
}
