'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { TeamBuilder, type BuilderParticipant, type BuilderSport } from './team-builder';

/**
 * Botón "Editar equipo" que despliega el mismo `TeamBuilder` usado para crear
 * equipos, pero en modo edición (con la alineación actual precargada).
 */
export function EditTeamToggle({
  sport,
  participants,
  groupName,
  teamId,
  initialName,
  initialStarters,
  initialSubstitutes,
}: {
  sport: BuilderSport;
  participants: BuilderParticipant[];
  groupName: string;
  teamId: string;
  initialName: string;
  initialStarters: string[];
  initialSubstitutes: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="!border-white/40 !text-white hover:!bg-white/10"
        onClick={() => setOpen(true)}
      >
        Editar equipo
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-jade p-4">
      <TeamBuilder
        sport={sport}
        participants={participants}
        groupName={groupName}
        defaultName={initialName}
        teamId={teamId}
        initialName={initialName}
        initialStarters={initialStarters}
        initialSubstitutes={initialSubstitutes}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="mt-2 !border-white/40 !text-white hover:!bg-white/10"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </Button>
    </div>
  );
}
