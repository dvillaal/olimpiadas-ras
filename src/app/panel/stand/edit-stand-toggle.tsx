'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { StandForm, type StandDraft } from './stand-form';

/**
 * Botón "Editar" que despliega el mismo `StandForm` usado para crear un
 * stand, pero precargado con los datos de ese stand puntual. Refleja
 * `EditTeamToggle` en /panel/equipos.
 */
export function EditStandToggle({ id, stand }: { id: string; stand: StandDraft }) {
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
        Editar
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-jade p-4">
      <StandForm id={id} stand={stand} onSaved={() => setOpen(false)} />
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
