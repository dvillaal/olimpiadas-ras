'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/toast';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Reacciona al resultado de una Server Action, una vez que termina.
 *
 * Todo esto vive en `useEffect`, no durante el render: `onSuccess` puede
 * actualizar estado de un componente padre (por ejemplo, cerrar el modo
 * edición), y React no permite actualizar un componente distinto mientras
 * otro se está renderizando ("Cannot update a component while rendering a
 * different component"). `useActionState` devuelve un objeto nuevo en cada
 * envío, así que basta con depender de `state` para que el efecto solo
 * corra una vez por resultado, sin necesidad de rastrear "ya lo procesé".
 */
export function useActionResult(state: ActionState, onSuccess?: () => void): void {
  const toast = useToast();

  useEffect(() => {
    if (state.ok) {
      onSuccess?.();
      if (state.message) toast.success(state.message);
    } else if (state.errors?._) {
      toast.error(state.errors._);
    }
    // Solo debe correr cuando cambia el resultado de la acción: `toast` es
    // estable dentro del proveedor y `onSuccess` no debe disparar el efecto
    // de nuevo si el padre lo recrea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
