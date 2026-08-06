'use client';

import { useTransition } from 'react';
import { getOwnProofUrlAction } from '../actions';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

/**
 * Abre el comprobante con un enlace firmado y temporal.
 * El bucket es privado: no existe una URL permanente que se pueda compartir.
 */
export function ProofLink({ path, name }: { path: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const url = await getOwnProofUrlAction(path);
          if (!url) {
            toast.error('No fue posible abrir el comprobante.');
            return;
          }
          window.open(url, '_blank', 'noopener');
        })
      }
    >
      {pending ? 'Abriendo…' : `📎 ${name || 'Ver'}`}
    </Button>
  );
}
