'use client';

import { Button } from '@/components/ui';

/** Imprime o guarda como PDF con el diálogo del navegador. */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" className="no-print" onClick={() => window.print()}>
      🖨 Imprimir o guardar en PDF
    </Button>
  );
}
