import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente con clave de servicio: ignora RLS.
 *
 * Se usa exclusivamente para operaciones que ningún usuario puede hacer por sí
 * mismo: crear la cuenta de un grupo al aprobarlo, restablecer una contraseña o
 * ejecutar el seed. NUNCA debe importarse desde un componente de cliente.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY. Cópiala desde Supabase → Project Settings → API.',
    );
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
