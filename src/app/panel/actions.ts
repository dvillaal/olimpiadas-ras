'use server';

import { revalidatePath } from 'next/cache';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fieldErrors,
  intergroupProposalSchema,
  intergroupRequestSchema,
  paymentSchema,
  standSchema,
  teamSchema,
} from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';
import type { PayableType } from '@/types/database';

/**
 * Acciones del panel de grupo.
 *
 * Cada una vuelve a comprobar la propiedad de lo que toca. Aunque RLS ya lo
 * impide en la base, el mensaje de error resulta mucho más claro si se detecta
 * aquí.
 */

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ese registro ya existe.';
  if (error.code === '23503') return 'Falta información relacionada para completar la operación.';
  // Los disparadores usan RAISE EXCEPTION con mensajes ya redactados en español.
  return error.message || 'Ocurrió un error inesperado.';
}

// ─── País ────────────────────────────────────────────────────────────────────

export async function claimCountryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireGroup();
  const supabase = await createClient();

  const code = String(formData.get('code') ?? '').toUpperCase();
  if (code.length !== 2) return { errors: { _: 'Selecciona un país válido.' } };

  const { error } = await supabase.rpc('claim_country', { p_code: code });
  if (error) return { errors: { _: friendlyError(error) } };

  revalidatePath('/panel/pais');
  revalidatePath('/panel');
  return { ok: true, message: '¡País confirmado!' };
}

// ─── Equipos ─────────────────────────────────────────────────────────────────

export async function saveTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { group } = await requireGroup();

  const parsed = teamSchema.safeParse({
    id: formData.get('id') || undefined,
    sportId: formData.get('sportId'),
    name: formData.get('name'),
    starters: formData.getAll('starters').map(String),
    substitutes: formData.getAll('substitutes').map(String),
    captainId: formData.get('captainId') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  // Una persona no puede ser titular y suplente a la vez.
  const overlap = input.starters.filter((id) => input.substitutes.includes(id));
  if (overlap.length > 0) {
    return { errors: { starters: 'Una persona no puede ser titular y suplente al mismo tiempo.' } };
  }

  const { data: team, error: teamError } = input.id
    ? await supabase
        .from('teams')
        .update({ name: input.name })
        .eq('id', input.id)
        .eq('owner_group_id', group.id)
        .select('id')
        .single()
    : await supabase
        .from('teams')
        .insert({ owner_group_id: group.id, sport_id: input.sportId, name: input.name })
        .select('id')
        .single();

  if (teamError || !team) {
    return { errors: { _: friendlyError(teamError ?? { message: 'Error al guardar el equipo.' }) } };
  }

  // Se conservan los integrantes de otros grupos: los aportó una solicitud
  // intergrupal y borrarlos aquí sería destruir un acuerdo ya cerrado.
  const { data: currentMembers } = await supabase
    .from('team_members')
    .select('participant_id, participants(group_id)')
    .eq('team_id', team.id);

  const externalIds = (currentMembers ?? [])
    .filter((member) => {
      const participant = member.participants as unknown as { group_id: string } | null;
      return participant && participant.group_id !== group.id;
    })
    .map((member) => member.participant_id);

  await supabase
    .from('team_members')
    .delete()
    .eq('team_id', team.id)
    .not('participant_id', 'in', `(${externalIds.length > 0 ? externalIds.join(',') : '00000000-0000-0000-0000-000000000000'})`);

  const rows = [
    ...input.starters.map((participantId) => ({
      team_id: team.id,
      participant_id: participantId,
      role: 'starter' as const,
    })),
    ...input.substitutes.map((participantId) => ({
      team_id: team.id,
      participant_id: participantId,
      role: 'substitute' as const,
    })),
  ].filter((row) => !externalIds.includes(row.participant_id));

  const { error: membersError } = await supabase.from('team_members').insert(rows);
  if (membersError) return { errors: { _: friendlyError(membersError) } };

  if (input.captainId) {
    await supabase.from('teams').update({ captain_id: input.captainId }).eq('id', team.id);
  }

  revalidatePath('/panel/equipos');
  revalidatePath('/panel/deportes');
  return { ok: true, message: `Equipo "${input.name}" guardado.` };
}

export async function deleteTeamAction(formData: FormData): Promise<void> {
  const { group } = await requireGroup();
  const supabase = await createClient();

  await supabase
    .from('teams')
    .delete()
    .eq('id', String(formData.get('id') ?? ''))
    .eq('owner_group_id', group.id);

  revalidatePath('/panel/equipos');
}

// ─── Inscripciones individuales ──────────────────────────────────────────────

export async function saveIndividualRegistrationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const sportId = String(formData.get('sportId') ?? '');
  const participantIds = formData.getAll('participantIds').map(String);

  if (participantIds.length === 0) {
    return { errors: { participantIds: 'Selecciona al menos un participante.' } };
  }

  const { data: registration, error } = await supabase
    .from('individual_registrations')
    .upsert(
      { group_id: group.id, sport_id: sportId, status: 'draft' },
      { onConflict: 'group_id,sport_id' },
    )
    .select('id')
    .single();

  if (error || !registration) {
    return { errors: { _: friendlyError(error ?? { message: 'Error al guardar.' }) } };
  }

  await supabase
    .from('individual_registration_participants')
    .delete()
    .eq('registration_id', registration.id);

  const { error: linkError } = await supabase
    .from('individual_registration_participants')
    .insert(
      participantIds.map((participantId) => ({
        registration_id: registration.id,
        participant_id: participantId,
      })),
    );

  if (linkError) return { errors: { _: friendlyError(linkError) } };

  revalidatePath('/panel/deportes');
  revalidatePath('/panel/pagos');
  return { ok: true, message: 'Inscripción guardada.' };
}

// ─── Solicitudes intergrupales ───────────────────────────────────────────────

export async function createIntergroupRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { group } = await requireGroup();

  const parsed = intergroupRequestSchema.safeParse({
    teamId: formData.get('teamId'),
    targetGroupId: formData.get('targetGroupId'),
    slots: formData.get('slots'),
    message: formData.get('message') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from('intergroup_requests').insert({
    team_id: parsed.data.teamId,
    requester_group_id: group.id,
    target_group_id: parsed.data.targetGroupId,
    slots_requested: parsed.data.slots,
    message: parsed.data.message,
  });

  if (error) {
    if (error.code === '23505') {
      return { errors: { _: 'Ya enviaste una solicitud a ese grupo para este equipo.' } };
    }
    return { errors: { _: friendlyError(error) } };
  }

  await supabase.from('notifications').insert({
    group_id: parsed.data.targetGroupId,
    title: 'Nueva solicitud de apoyo',
    body: `${group.name} necesita ${parsed.data.slots} participante(s) para completar un equipo.`,
    link: '/panel/solicitudes',
    kind: 'info',
  });

  revalidatePath('/panel/solicitudes');
  return { ok: true, message: 'Solicitud enviada.' };
}

export async function proposeParticipantsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { group } = await requireGroup();

  const parsed = intergroupProposalSchema.safeParse({
    requestId: formData.get('requestId'),
    participantIds: formData.getAll('participantIds').map(String),
    note: formData.get('note') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();

  const { data: request } = await supabase
    .from('intergroup_requests')
    .select('*')
    .eq('id', parsed.data.requestId)
    .maybeSingle();

  if (!request || request.target_group_id !== group.id) {
    return { errors: { _: 'Esta solicitud no está dirigida a tu grupo.' } };
  }
  if (parsed.data.participantIds.length > request.slots_requested) {
    return {
      errors: {
        participantIds: `El grupo solicitó ${request.slots_requested} participante(s) como máximo.`,
      },
    };
  }

  await supabase.from('intergroup_proposals').delete().eq('request_id', request.id);

  const { error } = await supabase.from('intergroup_proposals').insert(
    parsed.data.participantIds.map((participantId) => ({
      request_id: request.id,
      participant_id: participantId,
    })),
  );

  if (error) return { errors: { _: friendlyError(error) } };

  await supabase
    .from('intergroup_requests')
    .update({
      status: 'proposed',
      response_note: parsed.data.note,
      responded_at: new Date().toISOString(),
    })
    .eq('id', request.id);

  await supabase.from('notifications').insert({
    group_id: request.requester_group_id,
    title: 'Te propusieron participantes',
    body: `${group.name} propuso ${parsed.data.participantIds.length} participante(s) para tu equipo.`,
    link: '/panel/solicitudes',
    kind: 'success',
  });

  revalidatePath('/panel/solicitudes');
  return { ok: true, message: 'Propuesta enviada.' };
}

export async function respondProposalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireGroup();
  const supabase = await createClient();

  const requestId = String(formData.get('requestId') ?? '');
  const decision = String(formData.get('decision') ?? '');

  if (decision === 'accept') {
    const { error } = await supabase.rpc('accept_intergroup_proposal', { p_request_id: requestId });
    if (error) return { errors: { _: friendlyError(error) } };
    revalidatePath('/panel/solicitudes');
    revalidatePath('/panel/equipos');
    return { ok: true, message: 'Participantes agregados al equipo.' };
  }

  await supabase
    .from('intergroup_requests')
    .update({ status: 'rejected', resolved_at: new Date().toISOString() })
    .eq('id', requestId);

  revalidatePath('/panel/solicitudes');
  return { ok: true, message: 'Propuesta rechazada.' };
}

export async function cancelIntergroupRequestAction(formData: FormData): Promise<void> {
  const { group } = await requireGroup();
  const supabase = await createClient();

  await supabase
    .from('intergroup_requests')
    .delete()
    .eq('id', String(formData.get('requestId') ?? ''))
    .eq('requester_group_id', group.id);

  revalidatePath('/panel/solicitudes');
}

// ─── Stand ───────────────────────────────────────────────────────────────────

export async function saveStandAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { group } = await requireGroup();

  const parsed = standSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    responsible: formData.get('responsible'),
    document: formData.get('document') ?? '',
    phone: formData.get('phone'),
    email: formData.get('email') ?? '',
    products: formData.get('products'),
    description: formData.get('description') ?? '',
    needsPower: formData.get('needsPower') === 'on',
    needsFurniture: formData.get('needsFurniture') === 'on',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  // Un grupo, un stand: se actualiza en lugar de crear otro. Corrige el error
  // del prototipo, que borraba el stand antes de saber si el usuario seguiría.
  const { error } = await supabase.from('stands').upsert(
    {
      group_id: group.id,
      name: input.name,
      responsible: input.responsible,
      document: input.document ?? '',
      phone: input.phone,
      email: input.email || null,
      products: input.products,
      description: input.description,
      needs_power: input.needsPower,
      needs_furniture: input.needsFurniture,
      notes: input.notes,
    },
    { onConflict: 'group_id' },
  );

  if (error) return { errors: { _: friendlyError(error) } };

  revalidatePath('/panel/stand');
  revalidatePath('/panel/pagos');
  return { ok: true, message: 'Solicitud de stand guardada.' };
}

// ─── Pagos ───────────────────────────────────────────────────────────────────

export interface UploadedProof {
  path: string;
  name: string;
  size: number;
}

/**
 * Sube el comprobante al bucket privado y devuelve su ruta.
 * Se llama antes de registrar el pago para que el archivo ya exista.
 */
export async function uploadProofAction(formData: FormData): Promise<
  { ok: true; proof: UploadedProof } | { ok: false; error: string }
> {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const file = formData.get('proof');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Adjunta el comprobante de pago.' };
  }

  const { data: settings } = await supabase.from('settings').select('max_proof_mb').single();
  const maxBytes = (settings?.max_proof_mb ?? 8) * 1024 * 1024;

  if (file.size > maxBytes) {
    return { ok: false, error: `El archivo supera ${settings?.max_proof_mb ?? 8} MB.` };
  }
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, error: 'Solo se admiten archivos PDF, JPG, PNG o WEBP.' };
  }

  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  // La ruta empieza por el id del grupo: es lo que verifican las políticas
  // de Storage.
  const path = `${group.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from('comprobantes')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { ok: false, error: `No se pudo subir el comprobante: ${error.message}` };

  return { ok: true, proof: { path, name: file.name, size: file.size } };
}

export async function submitPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireGroup();

  const upload = await uploadProofAction(formData);
  if (!upload.ok) return { errors: { proof: upload.error } };

  const parsed = paymentSchema.safeParse({
    payableType: formData.get('payableType'),
    payableId: formData.get('payableId'),
    concept: formData.get('concept'),
    expectedAmount: formData.get('expectedAmount'),
    reportedAmount: formData.get('reportedAmount'),
    paymentDate: formData.get('paymentDate'),
    payerName: formData.get('payerName'),
    payerDocument: formData.get('payerDocument') ?? '',
    originBank: formData.get('originBank') ?? '',
    reference: formData.get('reference'),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    // El archivo ya subió; se limpia para no dejar huérfanos en el bucket.
    await createAdminClient().storage.from('comprobantes').remove([upload.proof.path]);
    return { errors: fieldErrors(parsed.error) };
  }

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('submit_payment', {
    p_payable_type: input.payableType as PayableType,
    p_payable_id: input.payableId,
    p_concept: input.concept,
    p_expected_amount: input.expectedAmount,
    p_reported_amount: input.reportedAmount,
    p_payment_date: input.paymentDate,
    p_payer_name: input.payerName,
    p_payer_document: input.payerDocument ?? '',
    p_origin_bank: input.originBank ?? '',
    p_reference: input.reference,
    p_proof_path: upload.proof.path,
    p_proof_name: upload.proof.name,
    p_proof_size: upload.proof.size,
    p_notes: input.notes ?? '',
  });

  if (error) {
    await createAdminClient().storage.from('comprobantes').remove([upload.proof.path]);
    if (error.code === '23505') {
      return { errors: { reference: 'Esa referencia ya fue registrada en otro pago.' } };
    }
    return { errors: { _: friendlyError(error) } };
  }

  revalidatePath('/panel/pagos');
  revalidatePath('/panel');
  return { ok: true, message: 'Pago enviado para revisión.' };
}

/** Enlace firmado para que el grupo vuelva a ver su propio comprobante. */
export async function getOwnProofUrlAction(proofPath: string): Promise<string | null> {
  const { group } = await requireGroup();
  if (!proofPath.startsWith(`${group.id}/`)) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from('comprobantes').createSignedUrl(proofPath, 300);
  return data?.signedUrl ?? null;
}

/** Marca las notificaciones del grupo como leídas. */
export async function markNotificationsReadAction(): Promise<void> {
  const { group } = await requireGroup();
  const supabase = await createClient();

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('group_id', group.id)
    .is('read_at', null);

  revalidatePath('/panel');
}
