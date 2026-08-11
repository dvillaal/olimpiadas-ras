'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { reviewIntergroupAction } from './actions';
import type { ActionState } from '@/app/(auth)/actions';
import { Alert, Badge, Button, Field } from '@/components/ui';
import { useActionResult } from '@/lib/hooks/use-action-result';

export interface PendingAlliance {
  id: string;
  teamName: string;
  sportName: string;
  sportIcon: string;
  requesterName: string;
  targetName: string;
  createdAt: string;
  borrowed: { id: string; name: string; branchName: string }[];
}

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approve" disabled={pending}>
        {pending ? 'Procesando…' : 'Aprobar alianza'}
      </Button>
      <Button
        type="submit"
        name="decision"
        value="reject"
        variant="danger"
        disabled={pending}
      >
        Rechazar
      </Button>
    </div>
  );
}

function AllianceCard({ alliance }: { alliance: PendingAlliance }) {
  const [state, formAction] = useActionState<ActionState, FormData>(reviewIntergroupAction, {});
  const [note, setNote] = useState('');
  useActionResult(state);

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="rounded-xl border border-line p-4" noValidate>
      <input type="hidden" name="requestId" value={alliance.id} />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-navy">
            <span aria-hidden className="mr-1.5">
              {alliance.sportIcon}
            </span>
            {alliance.teamName}
          </h3>
          <p className="text-sm text-slate-500">
            {alliance.sportName} · <b>{alliance.requesterName}</b> recibe apoyo de{' '}
            <b>{alliance.targetName}</b>
          </p>
        </div>
        <Badge tone="orange">Esperando revisión</Badge>
      </div>

      <div className="mb-3 rounded-lg bg-slate-50 p-3">
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          Participantes prestados ({alliance.borrowed.length})
        </p>
        {alliance.borrowed.length === 0 ? (
          <p className="text-sm text-slate-500">Sin participantes registrados en la propuesta.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {alliance.borrowed.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-2">
                <span className="font-semibold text-navy">{person.name}</span>
                <span className="text-xs text-slate-500">{person.branchName}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errors._ && <Alert tone="error" className="mb-3">{errors._}</Alert>}

      <Field
        label="Observación"
        htmlFor={`note-${alliance.id}`}
        error={errors.note}
        hint="Obligatoria al rechazar. Se envía por correo a los dos grupos."
      >
        <textarea
          id={`note-${alliance.id}`}
          name="note"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="field-input"
          placeholder="Documentos verificados / falta autorización del acudiente…"
        />
      </Field>

      <Alert tone="info" className="my-3">
        Al rechazar, los participantes prestados salen de la alineación y el equipo vuelve a
        quedar incompleto. Al aprobar, el grupo podrá registrar el pago.
      </Alert>

      <Buttons />
    </form>
  );
}

export function AllianceReviewPanel({ alliances }: { alliances: PendingAlliance[] }) {
  return (
    <div className="space-y-4">
      {alliances.map((alliance) => (
        <AllianceCard key={alliance.id} alliance={alliance} />
      ))}
    </div>
  );
}
