'use client';

import { useTransition } from 'react';
import { getOwnProofUrlAction } from '../actions';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';

/**
 * Abre (o descarga) el comprobante con un enlace firmado y temporal.
 * El bucket es privado: no existe una URL permanente que se pueda compartir.
 */
export function ProofLink({ path, name }: { path: string; name: string }) {
  const [pending, start] = useTransition();
  const [downloading, startDownload] = useTransition();
  const toast = useToast();

  return (
    <div className="flex items-center gap-1.5">
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
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={downloading}
        title="Descargar comprobante"
        onClick={() =>
          startDownload(async () => {
            const url = await getOwnProofUrlAction(path, { download: true });
            if (!url) {
              toast.error('No fue posible descargar el comprobante.');
              return;
            }
            window.open(url, '_blank', 'noopener');
          })
        }
      >
        {downloading ? '…' : '⬇'}
      </Button>
    </div>
  );
}
