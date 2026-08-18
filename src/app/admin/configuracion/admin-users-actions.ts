'use server';

import { revalidatePath } from 'next/cache';
import { requireFullAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/send';
import { adminWelcomeEmail } from '@/lib/email/templates';
import { fieldErrors, adminUserSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Alta de administradores adicionales.
 *
 * Solo un administrador de alcance 'full' puede llegar aquí (`requireFullAdmin`
 * redirige a cualquier otro perfil). Un administrador 'limited' no puede crear
 * ni ver esta lista, para que no pueda darse a sí mismo (ni a otros) más
 * permisos de los que tiene.
 *
 * Mismo circuito que el alta de árbitros: cuenta en Supabase Auth con
 * contraseña temporal, perfil con `must_change_password`, correo con las
 * credenciales, y reversión manual si algo falla a mitad de camino.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function createAdminUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireFullAdmin();

  const parsed = adminUserSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    scope: formData.get('scope'),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: settings } = await supabase.from('settings').select('event_name').single();
  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';

  const password = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (authError || !created.user) {
    const exists = authError?.message.toLowerCase().includes('already');
    return {
      errors: {
        email: exists
          ? 'Ya existe una cuenta con ese correo.'
          : `No fue posible crear la cuenta: ${authError?.message ?? 'error desconocido'}`,
      },
    };
  }

  const userId = created.user.id;
  const rollback = async () => {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  };

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role: 'admin',
    admin_scope: input.scope,
    group_id: null,
    full_name: input.fullName,
    email: input.email,
    must_change_password: true,
  });

  if (profileError) {
    await rollback();
    return { errors: { _: `No fue posible crear el perfil: ${profileError.message}` } };
  }

  const email = adminWelcomeEmail({
    eventName,
    adminName: input.fullName,
    email: input.email,
    password,
    loginUrl: siteUrl('/ingresar'),
    scope: input.scope,
  });
  const delivery = await sendEmail({ to: input.email, ...email });

  await supabase.rpc('log_audit', {
    p_action: `Registró al administrador ${input.fullName} (${input.scope === 'full' ? 'completo' : 'limitado'})`,
    p_entity_type: 'profile',
    p_entity_id: userId,
  });

  revalidatePath('/admin/configuracion');

  return {
    ok: true,
    message: delivery.ok
      ? `Administrador "${input.fullName}" registrado. Se le enviaron las credenciales por correo.`
      : `Administrador "${input.fullName}" registrado, pero el correo no pudo enviarse. `
        + `Entrégale estos datos: ${input.email} · contraseña ${password}`,
  };
}
