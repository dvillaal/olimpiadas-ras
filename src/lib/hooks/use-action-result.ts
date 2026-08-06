'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/toast';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Reacciona al resultado de una Server Action.
 *
 * Dos cosas ocurren cuando una acción termina:
 *
 *  · Limpiar el formulario. Eso es un ajuste de estado derivado de un valor
 *    nuevo, así que se hace **durante el render** comparando la identidad del
 *    estado. `useActionState` devuelve un objeto distinto en cada envío, de
 *    modo que la comparación por referencia es fiable. Hacerlo en un efecto
 *    provocaría un render en cascada (y es lo que marca `set-state-in-effect`).
 *
 *  · Mostrar el aviso. Eso sí es un efecto secundario sobre el mundo exterior
 *    y por tanto vive en `useEffect`.
 */
export function useActionResult(state: ActionState, onSuccess?: () => void): void {
  const toast = useToast();
  const [handled, setHandled] = useState(state);

  if (state !== handled) {
    setHandled(state);
    if (state.ok) onSuccess?.();
  }

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    else if (state.errors?._) toast.error(state.errors._);
    // `toast` es estable dentro del proveedor; incluirlo repetiría el aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
