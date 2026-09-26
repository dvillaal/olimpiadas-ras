import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert, EmptyState, PageHeader } from '@/components/ui';
import { BracketCreator, BracketCreatorAccordion, type SportOption } from './bracket-creator';
import { BracketPanel, type BracketSummary, type RoundGroup } from './bracket-panel';
import type { TreeRound } from './bracket-tree';

export const metadata: Metadata = { title: 'Llaves' };

export default async function AdminBracketsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: sports },
    { data: branches },
    { data: sportBranches },
    { data: courts },
    { data: brackets },
    { data: schedules },
  ] = await Promise.all([
    supabase.from('sports').select('id, name, icon').eq('active', true).eq('type', 'group').order('sort_order'),
    supabase.from('branches').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('sport_branches').select('sport_id, branch_id'),
    supabase.from('courts').select('id, name').eq('active', true).order('name'),
    supabase.from('brackets').select('*').order('created_at'),
    supabase
      .from('schedules')
      .select(
        'id, bracket_id, round_number, round_name, bracket_slot, group_label, team_a_slot, team_b_slot, is_bye, starts_on, starts_at, ends_at, court_id',
      )
      .not('bracket_id', 'is', null)
      .order('round_number')
      .order('bracket_slot'),
  ]);

  // Cuántos equipos hay realmente confirmados y con alineación completa por
  // cada combinación deporte+rama: se lo lleva al formulario en lugar de
  // dejar que el admin lo tipee a ojo.
  const links = sportBranches ?? [];
  const teamCountEntries = await Promise.all(
    links.map(async (link) => {
      const { data } = await supabase.rpc('schedulable_teams', {
        p_sport_id: link.sport_id,
        p_branch_id: link.branch_id,
      });
      return [`${link.sport_id}:${link.branch_id}`, data?.length ?? 0] as const;
    }),
  );
  const teamCounts = Object.fromEntries(teamCountEntries);

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [
      ...(branchesBySport.get(link.sport_id) ?? []),
      link.branch_id,
    ]);
  }

  const sportOptions: SportOption[] = (sports ?? []).map((sport) => ({
    id: sport.id,
    name: sport.name,
    icon: sport.icon,
    branchIds: branchesBySport.get(sport.id) ?? [],
  }));

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const branchById = new Map((branches ?? []).map((b) => [b.id, b]));
  const bracketById = new Map((brackets ?? []).map((b) => [b.id, b]));
  const courtOptions = (courts ?? []).map((c) => ({ id: c.id, name: c.name }));
  const courtNameById = new Map((courts ?? []).map((c) => [c.id, c.name]));

  // Árbol de llaves: solo la parte de eliminación directa (rondas que se
  // alimentan una a otra) tiene sentido dibujarla así. La liga se queda con
  // la lista de casillas de abajo.
  const treeRoundsByBracket = new Map<string, TreeRound[]>();
  const treeRoundByKey = new Map<string, TreeRound>();
  for (const row of schedules ?? []) {
    if (!row.bracket_id || row.round_number === null || row.group_label !== '') continue;
    if (bracketById.get(row.bracket_id)?.format === 'round_robin') continue;

    const key = `${row.bracket_id}:${row.round_number}`;
    let round = treeRoundByKey.get(key);
    if (!round) {
      round = { roundNumber: row.round_number, roundName: row.round_name, matches: [] };
      treeRoundByKey.set(key, round);
      treeRoundsByBracket.set(row.bracket_id, [
        ...(treeRoundsByBracket.get(row.bracket_id) ?? []),
        round,
      ]);
    }
    round.matches.push({
      id: row.id,
      isBye: row.is_bye,
      teamADesc:
        row.team_a_slot !== null ? `Posición ${row.team_a_slot}` : row.is_bye ? '' : 'Por definir',
      teamBDesc:
        row.team_b_slot !== null ? `Posición ${row.team_b_slot}` : row.is_bye ? '' : 'Por definir',
      startsOn: row.starts_on,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      courtName: row.court_id ? (courtNameById.get(row.court_id) ?? null) : null,
    });
  }

  const roundsByBracket = new Map<string, RoundGroup>();
  const roundGroupsByBracket = new Map<string, RoundGroup[]>();
  for (const row of schedules ?? []) {
    if (!row.bracket_id || row.round_number === null) continue;
    const key = `${row.bracket_id}:${row.round_number}`;
    let round = roundsByBracket.get(key);
    if (!round) {
      round = { roundNumber: row.round_number, roundName: row.round_name, slots: [] };
      roundsByBracket.set(key, round);
      roundGroupsByBracket.set(row.bracket_id, [
        ...(roundGroupsByBracket.get(row.bracket_id) ?? []),
        round,
      ]);
    }
    round.slots.push({
      id: row.id,
      groupLabel: row.group_label,
      bracketSlot: row.bracket_slot,
      teamASlot: row.team_a_slot,
      teamBSlot: row.team_b_slot,
      isBye: row.is_bye,
      startsOn: row.starts_on,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      courtId: row.court_id,
    });
  }

  const brandedBrackets = (brackets ?? [])
    .map((bracket) => {
      const sport = sportById.get(bracket.sport_id);
      const branch = branchById.get(bracket.branch_id);
      if (!sport || !branch) return null;

      const summary: BracketSummary = {
        id: bracket.id,
        sportName: sport.name,
        sportIcon: sport.icon,
        branchName: branch.name,
        format: bracket.format,
        status: bracket.status,
        teamCount: bracket.team_count,
      };

      const rounds = (roundGroupsByBracket.get(bracket.id) ?? [])
        .slice()
        .sort((a, b) => a.roundNumber - b.roundNumber);

      const treeRounds = (treeRoundsByBracket.get(bracket.id) ?? [])
        .slice()
        .sort((a, b) => a.roundNumber - b.roundNumber);

      return { summary, rounds, treeRounds };
    })
    .filter(
      (b): b is { summary: BracketSummary; rounds: RoundGroup[]; treeRounds: TreeRound[] } =>
        b !== null,
    );

  return (
    <>
      <PageHeader
        title="Llaves"
        description="Arma el molde de cada torneo —rondas, casillas, cancha y horario— antes de saber qué equipo juega en cada una. El sorteo que reparte los equipos reales llega en una fase siguiente."
      />

      {sportOptions.length === 0 && (
        <Alert tone="warning" title="No hay deportes grupales activos" className="mb-5">
          Las llaves solo aplican a deportes grupales (fútbol, voleibol, etc.). Los deportes
          individuales siguen usando sesiones, como hoy.
        </Alert>
      )}

      <div className="space-y-5">
        <BracketCreatorAccordion>
          <BracketCreator sports={sportOptions} branches={branches ?? []} teamCounts={teamCounts} />
        </BracketCreatorAccordion>

        {brandedBrackets.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="Todavía no hay ninguna llave"
            description="Genera el molde de la primera arriba."
          />
        ) : (
          brandedBrackets.map(({ summary, rounds, treeRounds }) => (
            <BracketPanel
              key={summary.id}
              bracket={summary}
              rounds={rounds}
              treeRounds={treeRounds}
              courts={courtOptions}
            />
          ))
        )}
      </div>
    </>
  );
}
