'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Cliente para componentes del navegador.
 *
 * Solo lleva la clave pública (anon). Todo lo que este cliente puede hacer está
 * acotado por las políticas RLS: no hay forma de escalar privilegios desde aquí,
 * a diferencia del prototipo donde bastaba editar `session` en la consola.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
