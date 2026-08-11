import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Panel, StatCard } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { CompetitionCard } from '@/components/competition-card';
import { loadCompetitions } from '@/lib/competitions/load';

export const metadata: Metadata = { title: 'Mi programación' };

export default async function GroupSchedulePage() {
  const context = await requireGroup();
  const supabase = await createClient();

  const competitions = await loadCompetitions(supabase, { groupId: context.group.id });

  const now = new Date();
  const upcoming = competitions.filter((c) => new Date(`${c.startsOn}T${c.startsAt}`) >= now);
  const past = competitions.filter((c) => new Date(`${c.startsOn}T${c.startsAt}`) < now);

  return (
    <>
      <PageHeader
        title="Mi programación"
        description="Partidos y sesiones en los que participa tu grupo."
        actions={
          <LinkButton href="/resultados" variant="secondary" target="_blank">
            🏁 Resultados generales
          </LinkButton>
        }
      />

      <RealtimeRefresher tables={['schedules']} groupId={context.group.id} />

      {competitions.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="Todavía no tienes competencias programadas"
          description="Aparecerán aquí cuando la organización publique el calendario de los deportes en los que estás inscrito."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard icon="🗓️" value={competitions.length} label="Competencias" />
            <StatCard icon="⏭️" value={upcoming.length} label="Por disputar" />
            <StatCard
              icon="🏁"
              value={competitions.filter((c) => c.resultPublished).length}
              label="Con resultado publicado"
              tone="success"
            />
          </div>

          {upcoming.length > 0 && (
            <Panel title="Próximas" className="mb-5">
              <div className="space-y-4">
                {upcoming.map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} showReferee />
                ))}
              </div>
            </Panel>
          )}

          {past.length > 0 && (
            <Panel title="Ya disputadas">
              <div className="space-y-4">
                {past.map((competition) => (
                  <CompetitionCard key={competition.id} competition={competition} showReferee />
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
