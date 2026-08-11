'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/send';
import { intergroupReviewedEmail } from '@/lib/email/templates';
import { fieldErrors, reviewIntergroupSchema } from '@/lib/validation/schemas';
import type { ActionState } from '@/app/(auth)/actions';

/**
 * Revisión administrativa de las alianzas entre grupos.
 *
 * La cascada real (retirar a los prestados del equipo, avisar a los dos grupos,
 * dejar constancia) ocurre dentro de `public.review_intergroup_request`, en una
 * sola transacción. Aquí solo se valida el formulario y se manda el correo, que
 * es lo único que Postgres no puede hacer.
 */

function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function reviewIntergroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = reviewIntergroupSchema.safeParse({
    requestId: formData.get('requestId'),
    decision: formData.get('decision'),
    note: formData.get('note') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { requestId, decision, note } = parsed.data;
  const approve = decision === 'approve';
  const supabase = await createClient();

  // Se leen los datos antes de resolver: al rechazar, la función retira a los
  // participantes y después ya no se sabría a quién avisar.
  const { data: request } = await supabase
    .from('intergroup_requests')
    .select('id, team_id, requester_group_id, target_group_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (!request) return { errors: { _: 'La solicitud ya no existe.' } };
  if (request.status !== 'admin_review') {
    return { errors: { _: 'Esta solicitud no está esperando revisión.' } };
  }

  const [{ data: team }, { data: groups }, { data: settings }] = await Promise.all([
    supabase.from('teams').select('name').eq('id', request.team_id).maybeSingle(),
    supabase
      .from('groups')
      .select('id, name, leader_email')
      .in('id', [request.requester_group_id, request.target_group_id]),
    supabase.from('settings').select('event_name').single(),
  ]);

  const { error } = await supabase.rpc('review_intergroup_request', {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note,
  });

  if (error) return { errors: { _: error.message } };

  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';
  const teamName = team?.name ?? 'el equipo';

  for (const group of groups ?? []) {
    const email = intergroupReviewedEmail({
      eventName,
      groupName: group.name,
      teamName,
      approved: approve,
      note,
      panelUrl: siteUrl('/panel/solicitudes'),
    });
    await sendEmail({ to: group.leader_email, ...email });
  }

  revalidatePath('/admin/intergrupales');
  revalidatePath('/admin/equipos');
  revalidatePath('/panel/solicitudes');
  revalidatePath('/panel/equipos');

  return {
    ok: true,
    message: approve
      ? `Alianza de "${teamName}" aprobada. El equipo ya puede pagar.`
      : `Alianza de "${teamName}" rechazada y participantes retirados del equipo.`,
  };
}
