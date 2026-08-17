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

/**
 * Elimina una rama por completo (a diferencia de desactivarla). Solo tiene
 * sentido si nadie la usa todavía: `participants.branch_id` y
 * `schedules.branch_id` no tienen `on delete cascade`, así que Postgres
 * rechazaría el borrado con un error de llave foránea si hay algo asociado.
 * Se verifica antes para dar un mensaje claro en vez de dejar que ese error
 * llegue crudo (el botón en la UI ya se oculta en ese caso, pero esto cubre
 * condiciones de carrera: alguien inscribió a alguien un segundo antes).
 */
export async function deleteBranchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');

  const [{ data: branch }, { count: participantCount }, { count: scheduleCount }] = await Promise.all([
    supabase.from('branches').select('name').eq('id', id).maybeSingle(),
    supabase
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', id),
    supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('branch_id', id),
  ]);

  if (!branch) return { errors: { _: 'Esa rama ya no existe.' } };

  if ((participantCount ?? 0) > 0 || (scheduleCount ?? 0) > 0) {
    return {
      errors: {
        _: 'No se puede eliminar: hay participantes o competencias asociados a esta rama. Desactívala en su lugar.',
      },
    };
  }

  const { error } = await supabase.from('branches').delete().eq('id', id);
  if (error) return { errors: { _: friendlyError(error) } };

  await supabase.rpc('log_audit', {
    p_action: `Eliminó la rama ${branch.name}`,
    p_entity_type: 'branch',
    p_entity_id: id,
  });

  revalidatePath('/admin/ramas');
  return { ok: true, message: `Rama "${branch.name}" eliminada.` };
}

// ─── Deportes ────────────────────────────────────────────────────────────────

/**
 * Las ramas nunca compiten entre sí (un lobato no se mide contra un scout), así
 * que cada rama seleccionada en el formulario produce su propio deporte
 * independiente, ligado a esa única rama en `sport_branches`. Comparten nombre,
 * ícono y reglas, pero cada uno tiene su slug (sufijado con la rama para que
 * sea único) y su propio ciclo de vida: inscripciones, calendario y resultados
 * de una rama no afectan a los de otra.
 *
 * Al editar: la primera rama seleccionada actualiza el deporte que se estaba
 * editando; cualquier rama adicional crea un deporte nuevo con los mismos
 * datos del formulario, igual que si se estuviera creando desde cero.
 */
function slugForBranch(baseSlug: string, branchId: string): string {
  const safeBranch = branchId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${baseSlug}-${safeBranch}`;
}

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

  const baseRow = {
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

  // La primera rama reutiliza el registro que se está editando (si lo hay);
  // el resto siempre crea deportes nuevos. `sportSchema` exige al menos una
  // rama, pero TypeScript no lo infiere del `.min(1)`, de ahí la guarda.
  const [firstBranchId, ...extraBranchIds] = input.branchIds;
  if (!firstBranchId) return { errors: { branchIds: 'Selecciona al menos una rama.' } };
  const savedIds: string[] = [];

  const { data: firstSaved, error: firstError } = input.id
    ? await supabase
        .from('sports')
        .update({ ...baseRow, slug: slugForBranch(input.slug, firstBranchId) })
        .eq('id', input.id)
        .select('id')
        .single()
    : await supabase
        .from('sports')
        .insert({ ...baseRow, slug: slugForBranch(input.slug, firstBranchId) })
        .select('id')
        .single();

  if (firstError || !firstSaved) {
    return { errors: { _: friendlyError(firstError ?? { message: 'Error' }) } };
  }
  savedIds.push(firstSaved.id);

  await supabase.from('sport_branches').delete().eq('sport_id', firstSaved.id);
  await supabase
    .from('sport_branches')
    .insert({ sport_id: firstSaved.id, branch_id: firstBranchId });

  for (const branchId of extraBranchIds) {
    const { data: cloned, error: cloneError } = await supabase
      .from('sports')
      .insert({ ...baseRow, slug: slugForBranch(input.slug, branchId) })
      .select('id')
      .single();

    if (cloneError || !cloned) {
      return {
        errors: {
          _: `Se guardó el deporte para algunas ramas, pero falló al crear el de "${branchId}": ${friendlyError(cloneError ?? { message: 'Error' })}`,
        },
      };
    }

    savedIds.push(cloned.id);
    await supabase.from('sport_branches').insert({ sport_id: cloned.id, branch_id: branchId });
  }

  await supabase.rpc('log_audit', {
    p_action: `${input.id ? 'Actualizó' : 'Creó'} el deporte ${input.name} (${savedIds.length} rama${savedIds.length === 1 ? '' : 's'})`,
    p_entity_type: 'sport',
    p_entity_id: firstSaved.id,
  });

  revalidatePath('/admin/deportes');
  revalidatePath('/panel/deportes');
  return {
    ok: true,
    message:
      savedIds.length > 1
        ? `Se crearon ${savedIds.length} deportes "${input.name}", uno por cada rama seleccionada.`
        : `Deporte "${input.name}" guardado.`,
  };
}

export async function deleteSportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');

  const [{ data: sport }, { count: teamCount }, { count: individualCount }, { count: scheduleCount }] =
    await Promise.all([
      supabase.from('sports').select('name').eq('id', id).maybeSingle(),
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('sport_id', id),
      supabase
        .from('individual_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('sport_id', id),
      supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('sport_id', id),
    ]);

  if (!sport) return { errors: { _: 'Ese deporte ya no existe.' } };

  if ((teamCount ?? 0) > 0 || (individualCount ?? 0) > 0 || (scheduleCount ?? 0) > 0) {
    return {
      errors: {
        _: 'No se puede eliminar: hay equipos, inscripciones o competencias asociadas a este deporte. Desactívalo en su lugar.',
      },
    };
  }

  const { error } = await supabase.from('sports').delete().eq('id', id);
  if (error) return { errors: { _: friendlyError(error) } };

  await supabase.rpc('log_audit', {
    p_action: `Eliminó el deporte ${sport.name}`,
    p_entity_type: 'sport',
    p_entity_id: id,
  });

  revalidatePath('/admin/deportes');
  revalidatePath('/panel/deportes');
  return { ok: true, message: `Deporte "${sport.name}" eliminado.` };
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
