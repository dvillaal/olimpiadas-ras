'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors, teamSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Edición de equipos desde el administrador.
 *
 * Mismo circuito que `saveTeamAction`/`deleteTeamAction` en `panel/actions.ts`,
 * pero sin el filtro por `owner_group_id`: el administrador puede corregir la
 * alineación de cualquier equipo, típicamente cuando un jefe de grupo pide
 * ayuda para arreglar algo o el equipo ya no admite cambios desde el panel
 * (pago en curso). El `groupId` del equipo llega en el formulario porque el
 * administrador no tiene un grupo propio del que inferirlo.
 */

function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Ese registro ya existe.';
  if (error.code === '23503') return 'Falta información relacionada para completar la operación.';
  return error.message || 'Ocurrió un error inesperado.';
}

export async function saveTeamAsAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = teamSchema.safeParse({
    id: formData.get('id') || undefined,
    sportId: formData.get('sportId'),
    name: formData.get('name'),
    starters: formData.getAll('starters').map(String),
    substitutes: formData.getAll('substitutes').map(String),
    captainId: formData.get('captainId') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const groupId = String(formData.get('groupId') ?? '');
  if (!groupId) return { errors: { _: 'Falta el grupo dueño del equipo.' } };

  const input = parsed.data;
  const supabase = await createClient();

  // Una persona no puede ser titular y suplente a la vez.
  const overlap = input.starters.filter((id) => input.substitutes.includes(id));
  if (overlap.length > 0) {
    return { errors: { starters: 'Una persona no puede ser titular y suplente al mismo tiempo.' } };
  }

  if (!input.id) return { errors: { _: 'Este formulario solo edita equipos existentes.' } };

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .update({ name: input.name })
    .eq('id', input.id)
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
      return participant && participant.group_id !== groupId;
    })
    .map((member) => member.participant_id);

  await supabase
    .from('team_members')
    .delete()
    .eq('team_id', team.id)
    .not(
      'participant_id',
      'in',
      `(${externalIds.length > 0 ? externalIds.join(',') : '00000000-0000-0000-0000-000000000000'})`,
    );

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

  await supabase
    .from('teams')
    .update({ captain_id: input.captainId || null })
    .eq('id', team.id);

  await supabase.rpc('log_audit', {
    p_action: `Editó el equipo ${input.name} desde el panel de administración`,
    p_entity_type: 'team',
    p_entity_id: team.id,
  });

  revalidatePath('/admin/equipos');
  revalidatePath('/panel/equipos');
  return { ok: true, message: `Equipo "${input.name}" actualizado.` };
}

export async function deleteTeamAsAdminAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id') ?? '');
  const { data: team } = await supabase.from('teams').select('name').eq('id', id).maybeSingle();

  await supabase.from('teams').delete().eq('id', id);

  if (team) {
    await supabase.rpc('log_audit', {
      p_action: `Eliminó el equipo ${team.name} desde el panel de administración`,
      p_entity_type: 'team',
      p_entity_id: id,
    });
  }

  revalidatePath('/admin/equipos');
  revalidatePath('/panel/equipos');
}
