import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAnonKey, supabaseUrl } from './env';
import type { Database } from '@/types/database';

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 * Lee y refresca la sesión desde las cookies de la petición.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Un Server Component no puede escribir cookies. El middleware ya
            // se encargó de refrescar la sesión, así que ignorarlo es correcto.
          }
      },
    },
  });
}
