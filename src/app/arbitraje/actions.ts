'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors, matchResultSchema, sessionResultSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Registro de resultados.
 *
 * Las dos acciones sirven tanto al árbitro como al administrador: quién puede
 * tocar qué lo decide `can_manage_schedule()` dentro de la función de Postgres,
 * no esta capa. Aquí solo se valida la forma de los datos.
 */

async function requireResultAuthor(): Promise<string | null> {
  const context = await getSessionContext();
  if (!context) return null;
  if (!context.isAdmin && !context.isReferee) return null;
  return context.userId;
}

function refresh(): void {
  revalidatePath('/arbitraje');
  revalidatePath('/arbitraje/competencias');
  revalidatePath('/admin/programacion');
  revalidatePath('/panel/programacion');
  revalidatePath('/resultados');
}

export async function saveMatchResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireResultAuthor())) {
    return { errors: { _: 'Necesitas una sesión de árbitro o de administración.' } };
  }

  const parsed = matchResultSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    scoreA: formData.get('scoreA'),
    scoreB: formData.get('scoreB'),
    notes: formData.get('notes') ?? '',
    publish: formData.get('publish') === 'true',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('save_match_result', {
    p_schedule_id: input.scheduleId,
    p_score_a: input.scoreA,
    p_score_b: input.scoreB,
    p_notes: input.notes,
    p_publish: input.publish,
  });

  if (error) return { errors: { _: error.message } };

  refresh();
  return {
    ok: true,
    message: input.publish
      ? 'Resultado publicado. Ya es visible en el portal público.'
      : 'Borrador guardado. Nadie más lo ve todavía.',
  };
}

export async function saveSessionResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireResultAuthor())) {
    return { errors: { _: 'Necesitas una sesión de árbitro o de administración.' } };
  }

  // Los tres arreglos vienen en el mismo orden desde el formulario.
  const participantIds = formData.getAll('participantId').map(String);
  const values = formData.getAll('value').map(String);
  const disqualified = new Set(formData.getAll('disqualified').map(String));

  const parsed = sessionResultSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    entries: participantIds.map((participantId, index) => ({
      participantId,
      value: values[index] ?? '',
      disqualified: disqualified.has(participantId),
    })),
    notes: formData.get('notes') ?? '',
    publish: formData.get('publish') === 'true',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc('save_session_result', {
    p_schedule_id: input.scheduleId,
    p_entries: input.entries.map((entry) => ({
      participant_id: entry.participantId,
      // Cadena vacía = sin marca. Postgres la guarda como NULL, que no es cero.
      value: entry.value === '' || entry.value === undefined ? null : entry.value,
      disqualified: entry.disqualified,
    })),
    p_notes: input.notes,
    p_publish: input.publish,
  });

  if (error) return { errors: { _: error.message } };

  refresh();
  return {
    ok: true,
    message: input.publish
      ? 'Resultados publicados. Ya aparecen en la clasificación general.'
      : 'Borrador guardado. Nadie más lo ve todavía.',
  };
}
