'use client';

import { useMemo, useState } from 'react';
import { Alert, Checkbox } from '@/components/ui';
import { formatCOP as money } from '@/lib/domain/fees';
import type { PayableType } from '@/types/database';
import { PaymentForm } from './payment-form';
import { BulkPaymentForm } from './bulk-payment-form';

export interface PendingConceptView {
  payableType: PayableType;
  payableId: string;
  label: string;
  amount: number;
  blocked?: string;
}

/**
 * Lista de conceptos pendientes con selección múltiple: muchos grupos
 * consignan todo junto en lugar de pagar un concepto a la vez, así que se
 * puede marcar varios y registrar un solo comprobante/referencia para todos.
 */
export function PendingConcepts({
  concepts,
  maxProofMb,
}: {
  concepts: PendingConceptView[];
  maxProofMb: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkForm, setShowBulkForm] = useState(false);

  const payable = concepts.filter((c) => !c.blocked);
  const key = (c: PendingConceptView) => `${c.payableType}:${c.payableId}`;

  const selectedConcepts = useMemo(
    () => payable.filter((c) => selected.has(key(c))),
    [payable, selected],
  );
  const selectedTotal = selectedConcepts.reduce((sum, c) => sum + c.amount, 0);

  function toggle(concept: PendingConceptView) {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(concept);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function closeBulkForm() {
    setShowBulkForm(false);
    setSelected(new Set());
  }

  if (concepts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/25 px-4 py-8 text-center">
        <span className="mb-2 block text-3xl" aria-hidden>
          ✅
        </span>
        <p className="font-semibold text-white">No tienes conceptos pendientes</p>
        <p className="mt-1 text-sm text-white/75">
          Todo lo que has inscrito está pagado o no tiene costo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {payable.length > 1 && (
        <Alert tone="info">
          ¿Vas a consignar todo junto? Marca los conceptos que quieras pagar en una sola
          transferencia y regístralos con un solo comprobante.
        </Alert>
      )}

      {showBulkForm && selectedConcepts.length > 1 && (
        <div className="rounded-2xl bg-jade p-4">
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">
            Pago combinado
          </h4>
          <BulkPaymentForm
            concepts={selectedConcepts}
            maxProofMb={maxProofMb}
            onClose={closeBulkForm}
          />
        </div>
      )}

      <ul className="space-y-4">
        {concepts.map((concept) => {
          const selectable = !concept.blocked;
          const isChecked = selected.has(key(concept));
          return (
            <li
              key={key(concept)}
              className="rounded-2xl border border-white/20 bg-white/10 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {selectable && (
                    <Checkbox
                      tone="dark"
                      checked={isChecked}
                      onChange={() => toggle(concept)}
                      aria-label={`Seleccionar ${concept.label} para pago combinado`}
                    />
                  )}
                  <b className="truncate text-white">{concept.label}</b>
                </div>
                <span className="text-lg font-extrabold text-amber-300">
                  {money(concept.amount)}
                </span>
              </div>

              {concept.blocked ? (
                <Alert tone="info">{concept.blocked}</Alert>
              ) : (
                <div className="rounded-2xl bg-jade p-4">
                  <PaymentForm
                    payableType={concept.payableType}
                    payableId={concept.payableId}
                    concept={concept.label}
                    expectedAmount={concept.amount}
                    maxProofMb={maxProofMb}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {selected.size > 0 && !showBulkForm && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/25 bg-plum/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm text-white">
            <b>{selected.size}</b> concepto(s) seleccionado(s) · Total{' '}
            <b className="text-amber-300">{money(selectedTotal)}</b>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-xl border border-white/40 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Limpiar
            </button>
            <button
              type="button"
              disabled={selected.size < 2}
              onClick={() => setShowBulkForm(true)}
              className="rounded-xl bg-lilac px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pagar seleccionados juntos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
