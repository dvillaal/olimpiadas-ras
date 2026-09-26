'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { generateMold } from '@/lib/domain/brackets';
import { bracketSchema, bracketSlotSchema, fieldErrors } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Molde de llaves (fase 1).
 *
 * Aquí solo se genera el ESQUELETO: rondas, casillas, y a qué casilla avanza
 * el ganador de cada partido. Las casillas nacen sin equipos (o con un solo
 * lado si son bye) y sin fecha/hora/cancha — eso se completa después, casilla
 * por casilla, con `updateBracketSlotAction`. El sorteo que reparte los
 * equipos reales en las posiciones abstractas llega en la fase siguiente.
 */

function refresh(): void {
  revalidatePath('/admin/llaves');
}

export async function createBracketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bracketSchema.safeParse({
    sportId: formData.get('sportId'),
    branchId: formData.get('branchId'),
    format: formData.get('format'),
    teamCount: formData.get('teamCount'),
    groupSize: formData.get('groupSize') || undefined,
    advancePerGroup: formData.get('advancePerGroup') || undefined,
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const input = parsed.data;

  let mold;
  try {
    mold = generateMold(input.format, {
      teamCount: input.teamCount,
      groupSize: input.groupSize,
      advancePerGroup: input.advancePerGroup,
    });
  } catch (err) {
    return {
      errors: { _: err instanceof Error ? err.message : 'No fue posible calcular el molde.' },
    };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('brackets')
    .select('id')
    .eq('sport_id', input.sportId)
    .eq('branch_id', input.branchId)
    .maybeSingle();

  if (existing) {
    return {
      errors: {
        _: 'Ya existe una llave para este deporte y esta rama. Bórrala primero si quieres rehacerla.',
      },
    };
  }

  const { data: bracket, error: bracketError } = await supabase
    .from('brackets')
    .insert({
      sport_id: input.sportId,
      branch_id: input.branchId,
      format: input.format,
      team_count: input.teamCount,
      group_size: input.groupSize ?? null,
      advance_per_group: input.advancePerGroup ?? null,
    })
    .select('id')
    .single();

  if (bracketError || !bracket) {
    return { errors: { _: bracketError?.message ?? 'No fue posible crear la llave.' } };
  }

  const rows = mold.map((slot) => ({
    sport_id: input.sportId,
    branch_id: input.branchId,
    type: 'match' as const,
    label: slot.groupLabel ? `${slot.groupLabel} · ${slot.roundName}` : slot.roundName,
    bracket_id: bracket.id,
    round_number: slot.roundNumber,
    round_name: slot.roundName,
    bracket_slot: slot.bracketSlot,
    group_label: slot.groupLabel,
    team_a_slot: slot.teamASlot,
    team_b_slot: slot.teamBSlot,
    is_bye: slot.isBye,
    // Un bye no se juega: ya se sabe quién "gana" sin marcador.
    status: slot.isBye ? ('finished' as const) : ('scheduled' as const),
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('schedules')
    .insert(rows)
    .select('id, round_number, bracket_slot, group_label');

  if (insertError || !inserted) {
    await supabase.from('brackets').delete().eq('id', bracket.id);
    return {
      errors: { _: insertError?.message ?? 'No fue posible crear las casillas del molde.' },
    };
  }

  // Con los ids reales ya asignados, se completa a qué casilla avanza el
  // ganador de cada partido. El destino de un avance siempre está en la parte
  // de eliminación (group_label vacío): en la fase de grupos nadie "avanza"
  // solo, y la llave de eliminación de `groups_knockout` tampoco tiene
  // group_label.
  const idByKey = new Map<string, string>();
  for (const row of inserted) {
    idByKey.set(`${row.round_number}|${row.bracket_slot}|${row.group_label}`, row.id);
  }

  const advanceUpdates = mold
    .filter((slot) => slot.advancesTo)
    .map((slot) => {
      const fromId = idByKey.get(`${slot.roundNumber}|${slot.bracketSlot}|${slot.groupLabel}`);
      const toId = idByKey.get(`${slot.advancesTo!.roundNumber}|${slot.advancesTo!.bracketSlot}|`);
      return fromId && toId
        ? { id: fromId, advances_to_schedule_id: toId, advances_to_slot: slot.advancesTo!.side }
        : null;
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  for (const update of advanceUpdates) {
    const { error: advanceError } = await supabase
      .from('schedules')
      .update({
        advances_to_schedule_id: update.advances_to_schedule_id,
        advances_to_slot: update.advances_to_slot,
      })
      .eq('id', update.id);

    if (advanceError) {
      return { errors: { _: advanceError.message } };
    }
  }

  await supabase.rpc('log_audit', {
    p_action: `Creó el molde de llaves (${mold.length} casillas)`,
    p_entity_type: 'bracket',
    p_entity_id: bracket.id,
  });

  refresh();
  return { ok: true, message: `Molde creado: ${mold.length} casilla(s). Ahora asígnales cancha, fecha y hora.` };
}

export async function deleteBracketAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await supabase.from('brackets').delete().eq('id', id);

  await supabase.rpc('log_audit', {
    p_action: 'Eliminó un molde de llaves',
    p_entity_type: 'bracket',
    p_entity_id: id,
  });

  refresh();
}

export async function updateBracketSlotAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = bracketSlotSchema.safeParse({
    scheduleId: formData.get('scheduleId'),
    date: formData.get('date') ?? '',
    time: formData.get('time') ?? '',
    courtId: formData.get('courtId') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const input = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('schedules')
    .update({
      starts_on: input.date || null,
      starts_at: input.time || null,
      court_id: input.courtId || null,
    })
    .eq('id', input.scheduleId);

  if (error) {
    const duplicated = error.message.includes('schedules_court_time_unique');
    return {
      errors: {
        _: duplicated
          ? 'Ya hay otro partido en esa cancha, a esa misma fecha y hora.'
          : error.message,
      },
    };
  }

  refresh();
  return { ok: true, message: 'Casilla actualizada.' };
}
