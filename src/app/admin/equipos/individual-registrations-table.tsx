'use client';

import { useState } from 'react';
import { Button, Modal, StatusBadge } from '@/components/ui';
import { registrationStatusView } from '@/lib/domain/status';
import { formatCOP } from '@/lib/domain/fees';
import { AdminEditIndividualForm, type SelectableParticipant } from './admin-edit-individual-form';
import type { RegistrationStatus } from '@/types/database';

export interface IndividualRow {
  id: string;
  groupName: string;
  sportLabel: string;
  participantsCount: number;
  amount: number;
  status: RegistrationStatus;
  fee: number;
  eligibleParticipants: SelectableParticipant[];
  selectedIds: string[];
}

export function IndividualRegistrationsTable({ rows }: { rows: IndividualRow[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = rows.find((r) => r.id === editingId) ?? null;

  return (
    <>
      <Modal open={Boolean(editing)} onClose={() => setEditingId(null)} title="Editar inscripción individual">
        {editing && (
          <AdminEditIndividualForm
            registrationId={editing.id}
            fee={editing.fee}
            participants={editing.eligibleParticipants}
            selectedIds={editing.selectedIds}
            onDone={() => setEditingId(null)}
          />
        )}
      </Modal>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Deporte</th>
              <th className="text-right">Participantes</th>
              <th className="text-right">Valor</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold text-navy">{row.groupName}</td>
                <td>{row.sportLabel}</td>
                <td className="text-right">{row.participantsCount}</td>
                <td className="whitespace-nowrap text-right">{formatCOP(row.amount)}</td>
                <td>
                  <StatusBadge status={registrationStatusView(row.status)} />
                </td>
                <td>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(row.id)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
