import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ResultOrder, ScheduleStatus, ScheduleType } from '@/types/database';

/**
 * Lectura de la programación con todo lo que hace falta para pintarla.
 *
 * Se resuelve con cinco consultas planas y un cruce en memoria, no con joins
 * anidados de PostgREST: los conjuntos son pequeños (un evento son decenas de
 * competencias, no miles) y así la forma del resultado queda explícita y
 * tipada, sin depender de cómo PostgREST decida anidar las relaciones.
 */

export interface CompetitionParticipant {
  participantId: string;
  name: string;
  groupName: string;
  value: number | null;
  disqualified: boolean;
  rank: number | null;
}

export interface Competition {
  id: string;
  type: ScheduleType;
  label: string;
  startsOn: string;
  startsAt: string;
  venue: string;
  status: ScheduleStatus;
  sportId: string;
  sportName: string;
  sportIcon: string;
  resultLabel: string;
  resultOrder: ResultOrder;
  branchId: string;
  branchName: string;
  refereeId: string | null;
  refereeName: string | null;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
  scoreA: number | null;
  scoreB: number | null;
  resultNotes: string;
  resultPublished: boolean;
  participants: CompetitionParticipant[];
}

export interface CompetitionFilter {
  /** Solo las competencias de este árbitro. */
  refereeId?: string;
  /** Solo aquellas en las que participa este grupo. */
  groupId?: string;
  sportId?: string;
  branchId?: string;
}

export async function loadCompetitions(
  supabase: SupabaseClient<Database>,
  filter: CompetitionFilter = {},
): Promise<Competition[]> {
  let query = supabase
    .from('schedules')
    .select('*')
    .order('starts_on')
    .order('starts_at');

  if (filter.refereeId) query = query.eq('referee_id', filter.refereeId);
  if (filter.sportId) query = query.eq('sport_id', filter.sportId);
  if (filter.branchId) query = query.eq('branch_id', filter.branchId);

  const { data: schedules } = await query;
  if (!schedules?.length) return [];

  const scheduleIds = schedules.map((s) => s.id);
  const teamIds = schedules.flatMap((s) => [s.team_a_id, s.team_b_id].filter(Boolean) as string[]);

  const [{ data: sports }, { data: branches }, { data: teams }, { data: entries }, { data: referees }] =
    await Promise.all([
      supabase.from('sports').select('id, name, icon, result_label, result_order'),
      supabase.from('branches').select('id, name'),
      teamIds.length
        ? supabase.from('teams').select('id, name, owner_group_id').in('id', teamIds)
        : Promise.resolve({ data: [] as { id: string; name: string; owner_group_id: string }[] }),
      supabase.from('schedule_participants').select('*').in('schedule_id', scheduleIds),
      supabase.from('profiles').select('id, full_name').eq('role', 'referee'),
    ]);

  const participantIds = [...new Set((entries ?? []).map((e) => e.participant_id))];
  const { data: people } = participantIds.length
    ? await supabase
        .from('participants')
        .select('id, full_name, group_id')
        .in('id', participantIds)
    : { data: [] as { id: string; full_name: string; group_id: string }[] };

  const groupIds = [
    ...new Set([
      ...(teams ?? []).map((t) => t.owner_group_id),
      ...(people ?? []).map((p) => p.group_id),
    ]),
  ];
  const { data: groups } = groupIds.length
    ? await supabase.from('groups').select('id, name').in('id', groupIds)
    : { data: [] as { id: string; name: string }[] };

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const refereeById = new Map((referees ?? []).map((r) => [r.id, r]));

  const entriesBySchedule = new Map<string, CompetitionParticipant[]>();
  for (const entry of entries ?? []) {
    const person = personById.get(entry.participant_id);
    const list = entriesBySchedule.get(entry.schedule_id) ?? [];
    list.push({
      participantId: entry.participant_id,
      name: person?.full_name ?? 'Participante',
      groupName: person ? (groupById.get(person.group_id)?.name ?? '') : '',
      value: entry.value,
      disqualified: entry.disqualified,
      rank: entry.rank,
    });
    entriesBySchedule.set(entry.schedule_id, list);
  }

  // Dentro de una sesión, primero los clasificados por puesto y al final los
  // que aún no tienen marca: es el orden en que el árbitro los va llenando.
  for (const list of entriesBySchedule.values()) {
    list.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.name.localeCompare(b.name));
  }

  const competitions: Competition[] = schedules.map((schedule) => {
    const sport = sportById.get(schedule.sport_id);
    const teamA = schedule.team_a_id ? teamById.get(schedule.team_a_id) : undefined;
    const teamB = schedule.team_b_id ? teamById.get(schedule.team_b_id) : undefined;

    return {
      id: schedule.id,
      type: schedule.type,
      label: schedule.label,
      startsOn: schedule.starts_on,
      startsAt: schedule.starts_at,
      venue: schedule.venue,
      status: schedule.status,
      sportId: schedule.sport_id,
      sportName: sport?.name ?? '',
      sportIcon: sport?.icon ?? '🏅',
      resultLabel: sport?.result_label ?? 'Resultado',
      resultOrder: (sport?.result_order ?? 'desc') as ResultOrder,
      branchId: schedule.branch_id,
      branchName: branchById.get(schedule.branch_id)?.name ?? schedule.branch_id,
      refereeId: schedule.referee_id,
      refereeName: schedule.referee_id
        ? (refereeById.get(schedule.referee_id)?.full_name ?? null)
        : null,
      teamAId: schedule.team_a_id,
      teamBId: schedule.team_b_id,
      teamAName: teamA?.name ?? 'Equipo A',
      teamBName: teamB?.name ?? 'Equipo B',
      scoreA: schedule.score_a,
      scoreB: schedule.score_b,
      resultNotes: schedule.result_notes,
      resultPublished: schedule.result_published,
      participants: entriesBySchedule.get(schedule.id) ?? [],
    };
  });

  if (!filter.groupId) return competitions;

  // Un grupo ve un partido si alguno de los dos equipos es suyo o lleva a
  // alguien suyo prestado, y una sesión si tiene gente citada en ella.
  const ownTeamIds = new Set(
    (teams ?? []).filter((t) => t.owner_group_id === filter.groupId).map((t) => t.id),
  );
  const ownPeople = new Set(
    (people ?? []).filter((p) => p.group_id === filter.groupId).map((p) => p.id),
  );

  return competitions.filter((competition) =>
    competition.type === 'match'
      ? (competition.teamAId && ownTeamIds.has(competition.teamAId)) ||
        (competition.teamBId && ownTeamIds.has(competition.teamBId))
      : competition.participants.some((p) => ownPeople.has(p.participantId)),
  );
}
