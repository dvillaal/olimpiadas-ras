'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/toast';

/**
 * Sincronización en tiempo real entre dispositivos.
 *
 * Se suscribe a los cambios de Postgres que le importan a esta sesión y pide a
 * Next que revalide los Server Components. Como todo el estado vive en el
 * servidor, basta con `router.refresh()`: no hay que replicar la lógica en el
 * cliente.
 *
 * Los avisos se agrupan con un pequeño retardo para que una importación de 200
 * participantes no dispare 200 refrescos.
 */

type WatchedTable =
  | 'payments'
  | 'intergroup_requests'
  | 'notifications'
  | 'teams'
  | 'groups'
  | 'stands'
  | 'participants'
  | 'countries';

export function RealtimeRefresher({
  groupId,
  tables,
  announce = true,
}: {
  /** Si se indica, solo interesan las filas de este grupo. */
  groupId?: string;
  tables: WatchedTable[];
  announce?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `toast` cambia de identidad en cada render del proveedor; se guarda en una
  // referencia para no re-suscribirse al canal cada vez. La asignación va en un
  // efecto: escribir una ref durante el render rompe el modelo de React.
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const supabase = createClient();
    const channelName = `realtime:${groupId ?? 'global'}:${tables.join('-')}`;
    const channel = supabase.channel(channelName);

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    for (const table of tables) {
      // `notifications` y `groups` se filtran por columnas distintas.
      const filter =
        groupId && table !== 'groups'
          ? `group_id=eq.${groupId}`
          : groupId && table === 'groups'
            ? `id=eq.${groupId}`
            : undefined;

      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload) => {
          if (
            announce &&
            table === 'notifications' &&
            payload.eventType === 'INSERT' &&
            payload.new &&
            'title' in payload.new
          ) {
            toastRef.current.show(String(payload.new.title), 'info');
          }
          scheduleRefresh();
        },
      );
    }

    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
    // `tables` se serializa para evitar re-suscripciones por un array nuevo
    // con el mismo contenido.
  }, [groupId, tables.join('-'), announce, router]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
