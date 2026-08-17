'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/send';
import { registrationApprovedEmail } from '@/lib/email/templates';
import { createGroupSchema, fieldErrors } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Alta manual de un grupo desde el panel del administrador.
 *
 * Mismo circuito que aprobar una solicitud (ver `admin/solicitudes/actions.ts`),
 * pero sin pasar por el estado `pending`: el grupo nace directamente aprobado,
 * con su código asignado por el disparador `groups_assign_code`, cuenta en
 * Supabase Auth y correo con las credenciales. Como Postgres no puede envolver
 * la creación de la cuenta ni el envío del correo, cualquier fallo a mitad de
 * camino deshace lo que ya se hizo para no dejar registros huérfanos.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireAdmin();

  const parsed = createGroupSchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city'),
    department: formData.get('department') ?? '',
    leaderName: formData.get('leaderName'),
    leaderDocument: formData.get('leaderDocument'),
    leaderEmail: formData.get('leaderEmail'),
    leaderPhone: formData.get('leaderPhone'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: settings } = await supabase.from('settings').select('event_name').single();
  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';

  const password = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.leaderEmail,
    password,
    email_confirm: true, // El administrador ya conoce al grupo.
    user_metadata: { full_name: input.leaderName, group_name: input.name },
  });

  if (authError || !created.user) {
    const exists = authError?.message.toLowerCase().includes('already');
    return {
      errors: {
        leaderEmail: exists
          ? 'Ya existe una cuenta con ese correo.'
          : `No fue posible crear la cuenta: ${authError?.message ?? 'error desconocido'}`,
      },
    };
  }

  const userId = created.user.id;

  // A partir de aquí, cualquier fallo debe deshacer la cuenta recién creada.
  const rollback = async () => {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  };

  const { data: group, error: groupError } = await admin
    .from('groups')
    .insert({
      name: input.name,
      city: input.city,
      department: input.department,
      leader_name: input.leaderName,
      leader_document: input.leaderDocument,
      leader_email: input.leaderEmail,
      leader_phone: input.leaderPhone,
      notes: input.notes,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    })
    .select('id, code, name')
    .single();

  if (groupError || !group) {
    await rollback();
    return { errors: { _: `No fue posible crear el grupo: ${groupError?.message ?? 'error desconocido'}` } };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role: 'group',
    group_id: group.id,
    full_name: input.leaderName,
    email: input.leaderEmail,
    must_change_password: true,
  });

  if (profileError) {
    await admin.from('groups').delete().eq('id', group.id);
    await rollback();
    return { errors: { _: `No fue posible crear el perfil del grupo: ${profileError.message}` } };
  }

  const email = registrationApprovedEmail({
    eventName,
    groupName: group.name,
    groupCode: group.code ?? '—',
    leaderName: input.leaderName,
    email: input.leaderEmail,
    password,
    loginUrl: siteUrl('/ingresar'),
  });

  const sent = await sendEmail({ to: input.leaderEmail, ...email });

  await admin.from('notifications').insert({
    group_id: group.id,
    title: '¡Bienvenidos!',
    body: 'Tu grupo fue creado. Empieza escogiendo el país que representarán.',
    link: '/panel/pais',
    kind: 'success',
  });

  await supabase.rpc('log_audit', {
    p_action: `Creó manualmente al grupo ${group.name} (${group.code})`,
    p_entity_type: 'group',
    p_entity_id: group.id,
  });

  revalidatePath('/admin/grupos');

  return {
    ok: true,
    message: sent.ok
      ? `${group.name} creado con código ${group.code}. Las credenciales se enviaron a ${input.leaderEmail}.`
      : `${group.name} creado (${group.code}), pero el correo no salió (${sent.error}). Contraseña temporal: ${password}`,
  };
}
