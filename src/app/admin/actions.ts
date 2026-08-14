'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { paymentReviewedEmail } from '@/lib/email/templates';
import {
  branchSchema,
  fieldErrors,
  participantSchema,
  reviewPaymentSchema,
  settingsSchema,
  sportSchema,
} from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Acciones del administrador.
 *
 * Las que tienen efectos en cascada (revisar un pago, liberar un país) delegan
 * en funciones de Postgres: así la transacción es atómica y ningún estado
 * intermedio queda visible, que era el punto débil del prototipo.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

/** Traduce los errores de Postgres a algo que una persona pueda entender. */
function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ya existe un registro con esos datos.';
  if (error.code === '23503') return 'No se puede completar: hay información relacionada.';
  if (error.code === '23514' || error.code === 'P0001') return error.message;
  return error.message || 'Ocurrió un error inesperado.';
}

// ─── Revisión de pagos ───────────────────────────────────────────────────────

export async function reviewPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = reviewPaymentSchema.safeParse({
    paymentId: formData.get('paymentId'),
    status: formData.get('status'),
    note: formData.get('note') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { paymentId, status, note } = parsed.data;
  const supabase = await createClient();

  const { data: payment, error } = await supabase.rpc('review_payment', {
    p_payment_id: paymentId,
    p_status: status,
    p_note: note,
  });

  if (error) return { errors: { _: friendlyError(error) } };

  // Aviso por correo al grupo, sin bloquear la respuesta si falla.
  if (payment) {
    const [{ data: group }, { data: settings }] = await Promise.all([
      supabase.from('groups').select('name, leader_email').eq('id', payment.group_id).maybeSingle(),
      supabase.from('settings').select('event_name').single(),
    ]);

    if (group) {
      const email = paymentReviewedEmail({
        eventName: settings?.event_name ?? 'Olimpiadas Scouts',
        groupName: group.name,
        concept: payment.concept,
        reference: payment.reference,
        status,
        note,
        panelUrl: siteUrl('/panel/pagos'),
      });
      await sendEmail({ to: group.leader_email, ...email });
    }
  }

  revalidatePath('/admin/pagos');
  revalidatePath('/admin');

  const labels = {
    approved: 'Pago aprobado y notificado al grupo.',
    rejected: 'Pago rechazado. El grupo recibió la explicación.',
    correction: 'Se solicitó la corrección al grupo.',
  } as const;

  return { ok: true, message: labels[status] };
}

// ─── Países ──────────────────────────────────────────────────────────────────

export async function toggleCountryReservationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const code = String(formData.get('code') ?? '');
  const reserve = formData.get('reserve') === 'true';

  await supabase.from('countries').update({ is_reserved: reserve }).eq('code', code);
  await supabase.rpc('log_audit', {
    p_action: `${reserve ? 'Reservó' : 'Liberó la reserva de'} el país ${code}`,
    p_entity_type: 'country',
    p_entity_id: code,
  });

  revalidatePath('/admin/paises');
}

export async function releaseCountryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  await supabase.rpc('release_country', { p_group_id: String(formData.get('groupId') ?? '') });

  revalidatePath('/admin/paises');
  revalidatePath('/admin/grupos');
}

// ─── Ramas ───────────────────────────────────────────────────────────────────

export async function saveBranchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = branchSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    active: formData.get('active') !== 'false',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('branches').upsert({
    id: parsed.data.id,
    name: parsed.data.name,
    active: parsed.data.active,
  });

  if (error) return { errors: { _: friendlyError(error) } };

  revalidatePath('/admin/ramas');
  return { ok: true, message: `Rama "${parsed.data.name}" guardada.` };
}

export async function toggleBranchAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';

  await supabase.from('branches').update({ active }).eq('id', id);
  revalidatePath('/admin/ramas');
}

// ─── Deportes ────────────────────────────────────────────────────────────────

export async function saveSportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = sportSchema.safeParse({
    id: formData.get('id') || undefined,
    slug: formData.get('slug'),
    name: formData.get('name'),
    icon: formData.get('icon') || '🏅',
    type: formData.get('type'),
    description: formData.get('description') ?? '',
    category: formData.get('category') || 'Mixta',
    teamSize: formData.get('teamSize'),
    substitutes: formData.get('substitutes'),
    maxTeamsPerGroup: formData.get('maxTeamsPerGroup'),
    maxSportsPerParticipant: formData.get('maxSportsPerParticipant'),
    deadline: formData.get('deadline') ?? '',
    fee: formData.get('fee') ?? '',
    allowIntergroup: formData.get('allowIntergroup') === 'on',
    maxExternal: formData.get('maxExternal'),
    branchIds: formData.getAll('branchIds').map(String),
    active: formData.get('active') !== 'false',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const row = {
    slug: input.slug,
    name: input.name,
    icon: input.icon,
    type: input.type,
    description: input.description,
    category: input.category,
    team_size: input.teamSize,
    substitutes: input.substitutes,
    max_teams_per_group: input.maxTeamsPerGroup,
    max_sports_per_participant: input.maxSportsPerParticipant,
    deadline: input.deadline || null,
    // Cadena vacía significa "hereda la tarifa general", que en la base es NULL.
    fee: input.fee === '' || input.fee === undefined ? null : Number(input.fee),
    allow_intergroup: input.type === 'group' ? input.allowIntergroup : false,
    max_external: input.type === 'group' ? input.maxExternal : 0,
    active: input.active,
  };

  const { data: saved, error } = input.id
    ? await supabase.from('sports').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('sports').insert(row).select('id').single();

  if (error || !saved) return { errors: { _: friendlyError(error ?? { message: 'Error' }) } };

  // Se reemplaza el conjunto de ramas: más simple y seguro que calcular deltas.
  await supabase.from('sport_branches').delete().eq('sport_id', saved.id);
  await supabase
    .from('sport_branches')
    .insert(input.branchIds.map((branchId) => ({ sport_id: saved.id, branch_id: branchId })));

  await supabase.rpc('log_audit', {
    p_action: `${input.id ? 'Actualizó' : 'Creó'} el deporte ${input.name}`,
    p_entity_type: 'sport',
    p_entity_id: saved.id,
  });

  revalidatePath('/admin/deportes');
  revalidatePath('/panel/deportes');
  return { ok: true, message: `Deporte "${input.name}" guardado.` };
}

export async function toggleSportAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from('sports')
    .update({ active: formData.get('active') === 'true' })
    .eq('id', String(formData.get('id') ?? ''));

  revalidatePath('/admin/deportes');
}

// ─── Participantes ───────────────────────────────────────────────────────────

export async function saveParticipantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = participantSchema.safeParse({
    id: formData.get('id') || undefined,
    groupId: formData.get('groupId'),
    docType: formData.get('docType'),
    document: formData.get('document'),
    firstNames: formData.get('firstNames'),
    lastNames: formData.get('lastNames'),
    birthdate: formData.get('birthdate'),
    branchId: formData.get('branchId'),
    gender: formData.get('gender') || undefined,
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    active: formData.get('active') !== 'false',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const row = {
    group_id: input.groupId,
    doc_type: input.docType,
    document: input.document,
    first_names: input.firstNames,
    last_names: input.lastNames,
    birthdate: input.birthdate,
    branch_id: input.branchId,
    gender: input.gender ?? null,
    phone: input.phone ?? '',
    email: input.email || null,
    active: input.active,
    notes: input.notes,
  };

  const { error } = input.id
    ? await supabase.from('participants').update(row).eq('id', input.id)
    : await supabase.from('participants').insert(row);

  if (error) {
    if (error.code === '23505') {
      return { errors: { document: 'Ese documento ya está registrado con ese mismo tipo.' } };
    }
    return { errors: { _: friendlyError(error) } };
  }

  revalidatePath('/admin/participantes');
  return { ok: true, message: `${input.firstNames} ${input.lastNames} guardado.` };
}

export async function deleteParticipantAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  // El borrado falla si tiene inscripciones: la clave foránea lo impide y es
  // el comportamiento correcto, para no perder historia.
  await supabase.from('participants').delete().eq('id', String(formData.get('id') ?? ''));
  revalidatePath('/admin/participantes');
}

// ─── Configuración ───────────────────────────────────────────────────────────

export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    eventName: formData.get('eventName'),
    eventStartsAt: formData.get('eventStartsAt'),
    individualFee: formData.get('individualFee'),
    groupTeamFee: formData.get('groupTeamFee'),
    standFee: formData.get('standFee'),
    standLimit: formData.get('standLimit'),
    maxProofMb: formData.get('maxProofMb'),
    registrationOpen: formData.get('registrationOpen') === 'on',
    bankLabel: formData.get('bankLabel'),
    bankName: formData.get('bankName'),
    bankAccountType: formData.get('bankAccountType'),
    bankAccountNumber: formData.get('bankAccountNumber'),
    bankNit: formData.get('bankNit'),
    bankHolder: formData.get('bankHolder'),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('settings')
    .update({
      event_name: input.eventName,
      event_starts_at: input.eventStartsAt,
      individual_fee: input.individualFee,
      group_team_fee: input.groupTeamFee,
      stand_fee: input.standFee,
      stand_limit: input.standLimit,
      max_proof_mb: input.maxProofMb,
      registration_open: input.registrationOpen,
      bank_label: input.bankLabel,
      bank_name: input.bankName,
      bank_account_type: input.bankAccountType,
      bank_account_number: input.bankAccountNumber,
      bank_nit: input.bankNit,
      bank_holder: input.bankHolder,
    })
    .eq('id', true);

  if (error) return { errors: { _: friendlyError(error) } };

  await supabase.rpc('log_audit', { p_action: 'Actualizó la configuración del evento' });

  revalidatePath('/admin/configuracion');
  revalidatePath('/admin');
  return { ok: true, message: 'Configuración guardada.' };
}

// ─── Grupos ──────────────────────────────────────────────────────────────────

export async function setGroupStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('groupId') ?? '');
  const status = String(formData.get('status') ?? '') as 'approved' | 'suspended';

  await supabase.from('groups').update({ status }).eq('id', id);
  await supabase.rpc('log_audit', {
    p_action: status === 'suspended' ? 'Suspendió un grupo' : 'Reactivó un grupo',
    p_entity_type: 'group',
    p_entity_id: id,
  });

  revalidatePath('/admin/grupos');
}

/** Enlace firmado y temporal para ver un comprobante del bucket privado. */
export async function getProofUrlAction(proofPath: string): Promise<string | null> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data } = await admin.storage.from('comprobantes').createSignedUrl(proofPath, 300);
  return data?.signedUrl ?? null;
}
