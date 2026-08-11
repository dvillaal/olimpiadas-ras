'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  fieldErrors,
  generateScheduleSchema,
  manualScheduleSchema,
} from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Programación de competencias.
 *
 * La generación automática vive en `public.generate_schedule`: crea decenas de
 * filas de una vez y debe ser todo o nada. Aquí solo se valida el formulario y
 * se traduce el error de Postgres a algo legible.
 */

function refresh(): void {
  revalidatePath('/admin/programacion');
  revalidatePath('/panel/programacion');
  revalidatePath('/arbitraje');
  revalidatePath('/arbitraje/competencias');
  revalidatePath('/resultados');
}

export async function generateScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = generateScheduleSchema.safeParse({
    sportId: formData.get('sportId'),
    branchId: formData.get('branchId'),
    date: formData.get('date'),
    time: formData.get('time'),
    intervalMinutes: formData.get('intervalMinutes') || 45,
    venue: formData.get('venue') ?? '',
    refereeId: formData.get('refereeId') ?? '',
    includePending: formData.get('includePending') === 'on',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('generate_schedule', {
    p_sport_id: input.sportId,
    p_branch_id: input.branchId,
    p_starts_on: input.date,
    p_starts_at: input.time,
    p_interval_min: input.intervalMinutes,
    p_venue: input.venue,
    p_referee_id: input.refereeId || null,
    p_include_pending: input.includePending,
  });

  if (error) return { errors: { _: error.message } };

  refresh();
  return {
    ok: true,
    message: `${data} competencia(s) generadas. Las que ya tenían resultado publicado se conservaron.`,
  };
}

export async function saveManualScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = manualScheduleSchema.safeParse({
    id: formData.get('id') || undefined,
    sportId: formData.get('sportId'),
    branchId: formData.get('branchId'),
    label: formData.get('label'),
    date: formData.get('date'),
    time: formData.get('time'),
    venue: formData.get('venue') ?? '',
    refereeId: formData.get('refereeId') ?? '',
    type: formData.get('type'),
    teamAId: formData.get('teamAId') ?? '',
    teamBId: formData.get('teamBId') ?? '',
    participantIds: formData.getAll('participantIds').map(String),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const row = {
    sport_id: input.sportId,
    branch_id: input.branchId,
    type: input.type,
    label: input.label,
    starts_on: input.date,
    starts_at: input.time,
    venue: input.venue,
    referee_id: input.refereeId || null,
    team_a_id: input.type === 'match' ? (input.teamAId ?? null) : null,
    team_b_id: input.type === 'match' ? (input.teamBId ?? null) : null,
  };

  const { data: saved, error } = input.id
    ? await supabase.from('schedules').update(row).eq('id', input.id).select('id').single()
    : await supabase.from('schedules').insert(row).select('id').single();

  if (error || !saved) {
    return { errors: { _: error?.message ?? 'No fue posible guardar la competencia.' } };
  }

  if (input.type === 'session') {
    // Se reemplaza la lista completa: más simple y seguro que calcular deltas,
    // y las marcas ya registradas de quien siga en la lista se conservan.
    await supabase
      .from('schedule_participants')
      .delete()
      .eq('schedule_id', saved.id)
      .not('participant_id', 'in', `(${input.participantIds.join(',')})`);

    await supabase.from('schedule_participants').upsert(
      input.participantIds.map((participantId) => ({
        schedule_id: saved.id,
        participant_id: participantId,
      })),
      { onConflict: 'schedule_id,participant_id', ignoreDuplicates: true },
    );
  }

  await supabase.rpc('log_audit', {
    p_action: `${input.id ? 'Editó' : 'Creó'} la competencia ${input.label}`,
    p_entity_type: 'schedule',
    p_entity_id: saved.id,
  });

  refresh();
  return { ok: true, message: `Competencia "${input.label}" guardada.` };
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');

  // Un resultado ya publicado no se borra por accidente desde un botón de lista:
  // primero hay que despublicarlo, y eso es una decisión consciente.
  const { data: schedule } = await supabase
    .from('schedules')
    .select('result_published, label')
    .eq('id', id)
    .maybeSingle();

  if (!schedule || schedule.result_published) return;

  await supabase.from('schedules').delete().eq('id', id);

  await supabase.rpc('log_audit', {
    p_action: `Eliminó la competencia ${schedule.label}`,
    p_entity_type: 'schedule',
    p_entity_id: id,
  });

  refresh();
}

/** Retira una publicación: vuelve a borrador y desaparece del portal público. */
export async function unpublishScheduleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');

  await supabase
    .from('schedules')
    .update({ result_published: false, status: 'in_progress' })
    .eq('id', id);

  await supabase.rpc('log_audit', {
    p_action: 'Retiró del portal público un resultado',
    p_entity_type: 'schedule',
    p_entity_id: id,
  });

  refresh();
}
