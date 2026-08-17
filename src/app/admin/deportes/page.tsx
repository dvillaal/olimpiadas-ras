import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { SportManager, type SportListItem } from './sport-manager';

export const metadata: Metadata = { title: 'Deportes' };

export default async function AdminSportsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: sports },
    { data: branches },
    { data: sportBranches },
    { data: teams },
    { data: individualRegistrations },
    { data: schedules },
  ] = await Promise.all([
    supabase.from('sports').select('*').order('sort_order').order('name'),
    supabase.from('branches').select('*').eq('active', true).order('sort_order'),
    supabase.from('sport_branches').select('*'),
    supabase.from('teams').select('sport_id, status'),
    supabase.from('individual_registrations').select('sport_id'),
    supabase.from('schedules').select('sport_id'),
  ]);

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [...(branchesBySport.get(link.sport_id) ?? []), link.branch_id]);
  }

  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const teamsBySport = new Map<string, number>();
  for (const team of teams ?? []) {
    if (team.status === 'rejected' || team.status === 'cancelled') continue;
    teamsBySport.set(team.sport_id, (teamsBySport.get(team.sport_id) ?? 0) + 1);
  }

  // Un deporte solo se puede eliminar si nada depende de él: ni equipos, ni
  // inscripciones individuales, ni competencias ya programadas.
  const sportsWithTeams = new Set((teams ?? []).map((t) => t.sport_id));
  const sportsWithIndividuals = new Set((individualRegistrations ?? []).map((r) => r.sport_id));
  const sportsWithSchedules = new Set((schedules ?? []).map((s) => s.sport_id));

  const rows: SportListItem[] = (sports ?? []).map((sport) => ({
    id: sport.id,
    slug: sport.slug,
    name: sport.name,
    icon: sport.icon,
    type: sport.type,
    description: sport.description,
    category: sport.category,
    teamSize: sport.team_size,
    substitutes: sport.substitutes,
    maxTeamsPerGroup: sport.max_teams_per_group,
    maxSportsPerParticipant: sport.max_sports_per_participant,
    deadline: sport.deadline,
    fee: sport.fee,
    allowIntergroup: sport.allow_intergroup,
    maxExternal: sport.max_external,
    branchIds: branchesBySport.get(sport.id) ?? [],
    active: sport.active,
    linkedBranchNames: (branchesBySport.get(sport.id) ?? []).map(
      (id) => branchName.get(id) ?? id,
    ),
    teamsCount: teamsBySport.get(sport.id) ?? 0,
    deletable:
      !sportsWithTeams.has(sport.id) &&
      !sportsWithIndividuals.has(sport.id) &&
      !sportsWithSchedules.has(sport.id),
  }));

  return (
    <>
      <PageHeader
        title="Deportes"
        description="Define las disciplinas, sus cupos, tarifas y qué ramas pueden participar."
      />

      <SportManager sports={rows} branches={branches ?? []} settings={settings} />
    </>
  );
}
