import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert, EmptyState, LinkButton, PageHeader, Panel, StatCard } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { loadCompetitions } from '@/lib/competitions/load';
import { ScheduleGenerator, type SportOption } from './schedule-generator';
import { ScheduleList } from './schedule-list';

export const metadata: Metadata = { title: 'Programación' };

export default async function AdminSchedulePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: sports }, { data: branches }, { data: sportBranches }, { data: referees }, { data: profiles }, { data: links }] =
    await Promise.all([
      supabase
        .from('sports')
        .select('id, name, icon, type, session_capacity')
        .eq('active', true)
        .order('sort_order'),
      supabase.from('branches').select('id, name').eq('active', true).order('sort_order'),
      supabase.from('sport_branches').select('sport_id, branch_id'),
      supabase.from('referees').select('id').eq('active', true),
      supabase.from('profiles').select('id, full_name').eq('role', 'referee'),
      supabase.from('referee_sports').select('referee_id, sport_id'),
    ]);

  const competitions = await loadCompetitions(supabase);

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [
      ...(branchesBySport.get(link.sport_id) ?? []),
      link.branch_id,
    ]);
  }

  const sportsByReferee = new Map<string, string[]>();
  for (const link of links ?? []) {
    sportsByReferee.set(link.referee_id, [
      ...(sportsByReferee.get(link.referee_id) ?? []),
      link.sport_id,
    ]);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const sportOptions: SportOption[] = (sports ?? []).map((sport) => ({
    id: sport.id,
    name: sport.name,
    icon: sport.icon,
    type: sport.type,
    sessionCapacity: sport.session_capacity,
    branchIds: branchesBySport.get(sport.id) ?? [],
  }));

  const refereeOptions = (referees ?? []).map((referee) => ({
    id: referee.id,
    name: profileById.get(referee.id)?.full_name ?? 'Árbitro',
    sportIds: sportsByReferee.get(referee.id) ?? [],
  }));

  const published = competitions.filter((c) => c.resultPublished).length;
  const unassigned = competitions.filter((c) => !c.refereeId).length;

  return (
    <>
      <PageHeader
        title="Programación"
        description="Genera el calendario automáticamente y ajústalo a mano cuando haga falta."
        actions={
          <LinkButton href="/resultados" variant="secondary" target="_blank">
            Ver portal público
          </LinkButton>
        }
      />

      <RealtimeRefresher tables={['schedules']} announce={false} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="🗓️" value={competitions.length} label="Competencias programadas" />
        <StatCard icon="🏁" value={published} label="Resultados publicados" tone="success" />
        <StatCard
          icon="🧑‍⚖️"
          value={unassigned}
          label="Sin árbitro asignado"
          tone={unassigned > 0 ? 'warning' : 'default'}
        />
        <StatCard icon="👥" value={refereeOptions.length} label="Árbitros activos" />
      </div>

      {refereeOptions.length === 0 && (
        <Alert tone="warning" title="No hay árbitros activos" className="mb-5">
          Puedes generar el calendario igual y asignarlos después, pero nadie podrá registrar
          resultados hasta que exista al menos un árbitro.
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <Panel
          title="Generar competencias"
          description="Todos contra todos en deportes grupales; tandas por cupo en los individuales."
        >
          <ScheduleGenerator
            sports={sportOptions}
            branches={branches ?? []}
            referees={refereeOptions}
          />
        </Panel>

        <Panel title={`Calendario (${competitions.length})`}>
          {competitions.length === 0 ? (
            <EmptyState
              icon="🗓️"
              title="Todavía no hay competencias"
              description="Confirma inscripciones y pagos, registra a los árbitros y genera el calendario."
            />
          ) : (
            <ScheduleList competitions={competitions} />
          )}
        </Panel>
      </div>
    </>
  );
}
