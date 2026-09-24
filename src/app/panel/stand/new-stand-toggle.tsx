'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { StandForm } from './stand-form';

/**
 * Botón "Solicitar otro stand" que despliega el formulario de creación. Un
 * grupo puede tener varios stands, así que este toggle queda disponible
 * incluso cuando ya tiene uno o más.
 */
export function NewStandToggle() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        + Solicitar otro stand
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-jade p-4">
      <StandForm onSaved={() => setOpen(false)} />
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
