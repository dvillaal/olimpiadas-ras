import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Route } from 'next';
import { createClient } from '@/lib/supabase/server';
import type { Group, Profile, Settings } from '@/types/database';

/**
 * Acceso a la sesión desde el servidor.
 *
 * `cache()` de React evita repetir la misma consulta cuando varios componentes
 * de la misma página piden el perfil.
 */

export interface SessionContext {
  userId: string;
  profile: Profile;
  group: Group | null;
  isAdmin: boolean;
  isReferee: boolean;
}

/** Panel que le corresponde a cada rol tras iniciar sesión. */
export function homeForRole(role: Profile['role']): Route {
  if (role === 'admin') return '/admin';
  if (role === 'referee') return '/arbitraje';
  return '/panel';
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  let group: Group | null = null;
  if (profile.group_id) {
    const { data } = await supabase.from('groups').select('*').eq('id', profile.group_id).maybeSingle();
    group = data ?? null;
  }

  return {
    userId: user.id,
    profile,
    group,
    isAdmin: profile.role === 'admin',
    isReferee: profile.role === 'referee',
  };
});

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error || !data) {
    throw new Error(
      'No se pudo leer la configuración del evento. ¿Ejecutaste las migraciones y el seed?',
    );
  }
  return data;
});

/** Exige sesión de administrador; si no, redirige. */
export async function requireAdmin(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect('/ingresar');
  if (!context.isAdmin) redirect(homeForRole(context.profile.role));
  if (context.profile.must_change_password) redirect('/cambiar-clave');
  return context;
}

/** Exige sesión de árbitro activo. */
export async function requireReferee(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect('/ingresar');
  if (!context.isReferee) redirect(homeForRole(context.profile.role));
  if (context.profile.must_change_password) redirect('/cambiar-clave');
  return context;
}

/** Exige sesión de grupo aprobado; si no, redirige a la pantalla que toque. */
export async function requireGroup(): Promise<SessionContext & { group: Group }> {
  const context = await getSessionContext();
  if (!context) redirect('/ingresar');
  if (context.isAdmin || context.isReferee) redirect(homeForRole(context.profile.role));
  if (context.profile.must_change_password) redirect('/cambiar-clave');
  if (!context.group) redirect('/ingresar');
  if (context.group.status !== 'approved') redirect('/registro/estado');
  return context as SessionContext & { group: Group };
}

/** Exige sesión, sin importar el rol ni el cambio de contraseña pendiente. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect('/ingresar');
  return context;
}
