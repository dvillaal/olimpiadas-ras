import { createClient } from '@supabase/supabase-js';
import { supabaseServiceKey, supabaseUrl } from './env';
import type { Database } from '@/types/database';

/**
 * Cliente con clave de servicio: ignora RLS.
 *
 * Se usa exclusivamente para operaciones que ningún usuario puede hacer por sí
 * mismo: crear la cuenta de un grupo al aprobarlo, restablecer una contraseña o
 * ejecutar el seed. NUNCA debe importarse desde un componente de cliente.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
