'use client';

import { useState } from 'react';
import { deleteTeamAsAdminAction } from './actions';
import { Button } from '@/components/ui';
import { AdminTeamEditor, type AdminEditorParticipant, type AdminEditorSport } from './admin-team-editor';

/**
 * Botón "Editar equipo" en el listado del administrador: despliega el mismo
 * motor de alineación que usa el jefe de grupo, pero sin la restricción de
 * `isEditableRegistration` — el administrador puede corregir un equipo aunque
 * su pago ya esté en curso.
 */
export function AdminEditTeamToggle({
  sport,
  participants,
  groupId,
  groupName,
  teamId,
  initialName,
  initialStarters,
  initialSubstitutes,
}: {
  sport: AdminEditorSport;
  participants: AdminEditorParticipant[];
  groupId: string;
  groupName: string;
  teamId: string;
  initialName: string;
  initialStarters: string[];
  initialSubstitutes: string[];
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <AdminTeamEditor
        sport={sport}
        participants={participants}
        groupId={groupId}
        groupName={groupName}
        teamId={teamId}
        initialName={initialName}
        initialStarters={initialStarters}
        initialSubstitutes={initialSubstitutes}
        onDone={() => setOpen(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Editar equipo
      </Button>
      <form
        action={deleteTeamAsAdminAction}
        onSubmit={(event) => {
          if (!window.confirm(`¿Eliminar el equipo "${initialName}"? Esta acción no se puede deshacer.`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={teamId} />
        <Button type="submit" size="sm" variant="danger">
          Eliminar
        </Button>
      </form>
    </div>
  );
}
