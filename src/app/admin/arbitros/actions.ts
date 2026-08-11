'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTemporaryPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/send';
import { refereeWelcomeEmail } from '@/lib/email/templates';
import { fieldErrors, refereeSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Alta y mantenimiento de árbitros.
 *
 * Crear un árbitro es el mismo circuito que aprobar un grupo: cuenta en
 * Supabase Auth con contraseña generada, perfil con `must_change_password` y
 * correo con las credenciales. Como Postgres no puede envolver la creación de
 * la cuenta ni el envío del correo, si algo falla a mitad se deshace lo hecho
 * para no dejar cuentas huérfanas sin perfil.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function saveRefereeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = refereeSchema.safeParse({
    id: formData.get('id') || undefined,
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone') ?? '',
    notes: formData.get('notes') ?? '',
    sportIds: formData.getAll('sportIds').map(String),
    // El formulario envía un `false` fijo y añade `true` solo si está marcado.
    active: formData.getAll('active').includes('true'),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: settings } = await supabase.from('settings').select('event_name').single();
  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';

  const { data: sports } = await supabase
    .from('sports')
    .select('id, name')
    .in('id', input.sportIds);
  const sportNames = (sports ?? []).map((s) => s.name);

  // ─── Edición ───────────────────────────────────────────────────────────────
  if (input.id) {
    const { error: profileError } = await admin
      .from('profiles')
      .update({ full_name: input.fullName })
      .eq('id', input.id);

    if (profileError) {
      return { errors: { _: `No fue posible actualizar el perfil: ${profileError.message}` } };
    }

    const { error } = await admin
      .from('referees')
      .update({ phone: input.phone, notes: input.notes, active: input.active })
      .eq('id', input.id);

    if (error) return { errors: { _: error.message } };

    // Se reemplaza el conjunto de deportes en vez de calcular diferencias.
    await admin.from('referee_sports').delete().eq('referee_id', input.id);
    await admin
      .from('referee_sports')
      .insert(input.sportIds.map((sportId) => ({ referee_id: input.id!, sport_id: sportId })));

    await supabase.rpc('log_audit', {
      p_action: `Actualizó al árbitro ${input.fullName}`,
      p_entity_type: 'referee',
      p_entity_id: input.id,
    });

    revalidatePath('/admin/arbitros');
    return { ok: true, message: `Árbitro "${input.fullName}" actualizado.` };
  }

  // ─── Alta ──────────────────────────────────────────────────────────────────
  const password = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true, // La organización ya conoce a la persona.
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
    role: 'referee',
    group_id: null,
    full_name: input.fullName,
    email: input.email,
    must_change_password: true,
  });

  if (profileError) {
    await rollback();
    return { errors: { _: `No fue posible crear el perfil: ${profileError.message}` } };
  }

  const { error: refereeError } = await admin.from('referees').insert({
    id: userId,
    phone: input.phone,
    notes: input.notes,
    active: input.active,
  });

  if (refereeError) {
    await admin.from('profiles').delete().eq('id', userId);
    await rollback();
    return { errors: { _: `No fue posible registrar al árbitro: ${refereeError.message}` } };
  }

  await admin
    .from('referee_sports')
    .insert(input.sportIds.map((sportId) => ({ referee_id: userId, sport_id: sportId })));

  const email = refereeWelcomeEmail({
    eventName,
    refereeName: input.fullName,
    email: input.email,
    password,
    loginUrl: siteUrl('/ingresar'),
    sports: sportNames,
  });
  const delivery = await sendEmail({ to: input.email, ...email });

  await supabase.rpc('log_audit', {
    p_action: `Registró al árbitro ${input.fullName}`,
    p_entity_type: 'referee',
    p_entity_id: userId,
  });

  revalidatePath('/admin/arbitros');

  // Si el correo no salió, la contraseña se muestra en pantalla: la cuenta ya
  // existe y dejar al administrador sin forma de entregarla sería peor.
  return {
    ok: true,
    message: delivery.ok
      ? `Árbitro "${input.fullName}" registrado. Se le enviaron las credenciales por correo.`
      : `Árbitro "${input.fullName}" registrado, pero el correo no pudo enviarse. `
        + `Entrégale estos datos: ${input.email} · contraseña ${password}`,
  };
}

export async function toggleRefereeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  // Un árbitro inactivo deja de ver sus competencias, pero el historial de
  // resultados que registró se conserva intacto.
  await supabase
    .from('referees')
    .update({ active: formData.get('active') === 'true' })
    .eq('id', String(formData.get('id') ?? ''));

  revalidatePath('/admin/arbitros');
  revalidatePath('/admin/programacion');
}
