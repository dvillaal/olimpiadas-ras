'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/send';
import { registrationApprovedEmail, registrationRejectedEmail } from '@/lib/email/templates';
import { fieldErrors, reviewGroupSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Aprobación y rechazo de solicitudes de registro.
 *
 * Aprobar implica cuatro pasos que deben quedar consistentes:
 *   1. marcar el grupo como aprobado (el disparador le asigna el código GS-00X)
 *   2. crear la cuenta en Supabase Auth con una contraseña generada
 *   3. crear su perfil con `must_change_password`
 *   4. enviar el correo con las credenciales
 *
 * Postgres no puede envolver los pasos 2 y 4, así que si algo falla a mitad de
 * camino se revierte lo ya hecho para no dejar grupos aprobados sin cuenta.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function reviewGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireAdmin();

  const parsed = reviewGroupSchema.safeParse({
    groupId: formData.get('groupId'),
    decision: formData.get('decision'),
    reason: formData.get('reason') ?? '',
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const { groupId, decision, reason } = parsed.data;
  const supabase = await createClient();

  const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();

  if (!group) {
    return { errors: { _: 'La solicitud ya no existe.' } };
  }
  if (group.status !== 'pending') {
    return { errors: { _: 'Esta solicitud ya fue revisada.' } };
  }

  const { data: settings } = await supabase.from('settings').select('event_name').single();
  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';

  // ─── Rechazo ───────────────────────────────────────────────────────────────
  if (decision === 'reject') {
    const { error } = await supabase
      .from('groups')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq('id', groupId);

    if (error) {
      return { errors: { _: 'No fue posible registrar el rechazo.' } };
    }

    const email = registrationRejectedEmail({
      eventName,
      groupName: group.name,
      leaderName: group.leader_name,
      reason,
    });
    await sendEmail({ to: group.leader_email, ...email });

    await supabase.rpc('log_audit', {
      p_action: `Rechazó la solicitud de ${group.name}`,
      p_entity_type: 'group',
      p_entity_id: groupId,
    });

    revalidatePath('/admin/solicitudes');
    revalidatePath('/admin/grupos');
    return { ok: true, message: `Solicitud de ${group.name} rechazada.` };
  }

  // ─── Aprobación ────────────────────────────────────────────────────────────
  const admin = createAdminClient();
  const password = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: group.leader_email,
    password,
    email_confirm: true, // El administrador ya verificó la identidad del grupo.
    user_metadata: { full_name: group.leader_name, group_name: group.name },
  });

  if (authError || !created.user) {
    const alreadyExists = authError?.message.toLowerCase().includes('already');
    return {
      errors: {
        _: alreadyExists
          ? 'Ya existe una cuenta con ese correo. Revisa si el grupo fue aprobado antes.'
          : `No fue posible crear la cuenta: ${authError?.message ?? 'error desconocido'}`,
      },
    };
  }

  const userId = created.user.id;

  // A partir de aquí, cualquier fallo debe deshacer la cuenta recién creada.
  const rollback = async () => {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  };

  const { data: approved, error: groupError } = await admin
    .from('groups')
    .update({
      status: 'approved',
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    })
    .eq('id', groupId)
    .select('code, name')
    .single();

  if (groupError || !approved) {
    await rollback();
    return { errors: { _: 'No fue posible aprobar el grupo. No se creó ninguna cuenta.' } };
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: userId,
    role: 'group',
    group_id: groupId,
    full_name: group.leader_name,
    email: group.leader_email,
    must_change_password: true,
  });

  if (profileError) {
    await rollback();
    await admin
      .from('groups')
      .update({ status: 'pending', reviewed_at: null, reviewed_by: null })
      .eq('id', groupId);
    return { errors: { _: 'No fue posible crear el perfil del grupo. Nada quedó a medias.' } };
  }

  const email = registrationApprovedEmail({
    eventName,
    groupName: approved.name,
    groupCode: approved.code ?? '—',
    leaderName: group.leader_name,
    email: group.leader_email,
    password,
    loginUrl: siteUrl('/ingresar'),
  });

  const sent = await sendEmail({ to: group.leader_email, ...email });

  await admin.from('notifications').insert({
    group_id: groupId,
    title: '¡Bienvenidos!',
    body: 'Tu grupo fue aprobado. Empieza escogiendo el país que representarán.',
    link: '/panel/pais',
    kind: 'success',
  });

  await supabase.rpc('log_audit', {
    p_action: `Aprobó a ${approved.name} (${approved.code})`,
    p_entity_type: 'group',
    p_entity_id: groupId,
  });

  revalidatePath('/admin/solicitudes');
  revalidatePath('/admin/grupos');

  return {
    ok: true,
    message: sent.ok
      ? `${approved.name} aprobado. Las credenciales se enviaron a ${group.leader_email}.`
      : `${approved.name} aprobado, pero el correo no salió (${sent.error}). Contraseña temporal: ${password}`,
  };
}

/**
 * Reenvía las credenciales generando una contraseña nueva.
 * Útil cuando el responsable perdió el correo original.
 */
export async function resendCredentialsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const groupId = String(formData.get('groupId') ?? '');
  if (!groupId) return { errors: { _: 'Falta el grupo.' } };

  const admin = createAdminClient();

  const { data: group } = await admin.from('groups').select('*').eq('id', groupId).maybeSingle();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email')
    .eq('group_id', groupId)
    .maybeSingle();

  if (!group || !profile) {
    return { errors: { _: 'Este grupo todavía no tiene cuenta creada.' } };
  }

  const password = generateTemporaryPassword();

  const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (error) {
    return { errors: { _: `No fue posible restablecer la contraseña: ${error.message}` } };
  }

  await admin.from('profiles').update({ must_change_password: true }).eq('id', profile.id);

  const { data: settings } = await admin.from('settings').select('event_name').single();

  const email = registrationApprovedEmail({
    eventName: settings?.event_name ?? 'Olimpiadas Scouts',
    groupName: group.name,
    groupCode: group.code ?? '—',
    leaderName: group.leader_name,
    email: profile.email,
    password,
    loginUrl: siteUrl('/ingresar'),
  });

  const sent = await sendEmail({ to: profile.email, ...email });

  revalidatePath('/admin/grupos');

  return {
    ok: true,
    message: sent.ok
      ? `Credenciales nuevas enviadas a ${profile.email}.`
      : `Contraseña restablecida, pero el correo no salió. Nueva contraseña: ${password}`,
  };
}
