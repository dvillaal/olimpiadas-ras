'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { internalRoute } from '@/lib/routes';
import { homeForRole } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import {
  newRegistrationAdminEmail,
  registrationReceivedEmail,
} from '@/lib/email/templates';
import {
  fieldErrors,
  loginSchema,
  newPasswordSchema,
  registerGroupSchema,
} from '@/lib/validation/schemas';

/**
 * Acciones de autenticación.
 *
 * Todas devuelven `{ errors }` en lugar de lanzar, para poder pintar los
 * mensajes junto a cada campo con `useActionState`.
 */

export interface ActionState {
  errors?: Record<string, string>;
  message?: string;
  ok?: boolean;
}

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

// ─── Ingreso ─────────────────────────────────────────────────────────────────

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Mensaje deliberadamente genérico: no revela si el correo existe.
    return { errors: { _: 'Correo o contraseña incorrectos.' } };
  }

  // `internalRoute` descarta destinos externos: sin eso, `?siguiente=//sitio.com`
  // sacaría al usuario del sistema justo después de escribir su contraseña.
  redirect(internalRoute(String(formData.get('siguiente') ?? '')));
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/ingresar');
}

// ─── Registro público del grupo ──────────────────────────────────────────────

export async function registerGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerGroupSchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city'),
    department: formData.get('department') ?? '',
    leaderName: formData.get('leaderName'),
    leaderDocument: formData.get('leaderDocument'),
    leaderEmail: formData.get('leaderEmail'),
    leaderPhone: formData.get('leaderPhone'),
    notes: formData.get('notes') ?? '',
    acceptsTerms: formData.get('acceptsTerms') === 'on',
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  // El registro es público: no hay sesión, así que se usa la clave de servicio
  // acotada a esta única inserción.
  const admin = createAdminClient();

  const { data: settings } = await admin.from('settings').select('event_name, registration_open').single();

  if (settings && !settings.registration_open) {
    return { errors: { _: 'Las inscripciones están cerradas por ahora.' } };
  }

  const { error } = await admin.from('groups').insert({
    name: input.name,
    city: input.city,
    department: input.department,
    leader_name: input.leaderName,
    leader_document: input.leaderDocument,
    leader_email: input.leaderEmail,
    leader_phone: input.leaderPhone,
    notes: input.notes,
    status: 'pending',
  });

  if (error) {
    if (error.code === '23505') {
      return {
        errors: {
          leaderEmail:
            'Ya existe una solicitud con este correo. Si no recuerdas su estado, escríbenos.',
        },
      };
    }
    return { errors: { _: 'No fue posible registrar la solicitud. Intenta de nuevo.' } };
  }

  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';

  // Los correos no bloquean: si Resend falla, la solicitud ya quedó guardada.
  const received = registrationReceivedEmail({
    eventName,
    groupName: input.name,
    leaderName: input.leaderName,
  });
  await sendEmail({ to: input.leaderEmail, ...received });

  const adminEmail = process.env.EMAIL_ADMIN;
  if (adminEmail) {
    const notice = newRegistrationAdminEmail({
      eventName,
      groupName: input.name,
      city: input.city,
      leaderName: input.leaderName,
      leaderEmail: input.leaderEmail,
      leaderPhone: input.leaderPhone,
      reviewUrl: siteUrl('/admin/solicitudes'),
    });
    await sendEmail({ to: adminEmail, ...notice });
  }

  revalidatePath('/admin/solicitudes');
  redirect('/registro/enviado');
}

// ─── Cambio de contraseña obligatorio ────────────────────────────────────────

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/ingresar');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      errors: {
        password:
          error.message.includes('different')
            ? 'La contraseña nueva debe ser distinta de la temporal.'
            : 'No fue posible actualizar la contraseña. Intenta de nuevo.',
      },
    };
  }

  await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  redirect(homeForRole(profile?.role ?? 'group'));
}
