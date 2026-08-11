import type { Metadata } from 'next';
import { requireReferee } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { CompetitionCard } from '@/components/competition-card';
import { loadCompetitions } from '@/lib/competitions/load';

export const metadata: Metadata = { title: 'Mis competencias' };

export default async function RefereeAssignmentsPage() {
  const context = await requireReferee();
  const supabase = await createClient();

  const competitions = await loadCompetitions(supabase, { refereeId: context.userId });

  return (
    <>
      <PageHeader
        title="Mis competencias"
        description="Registra el marcador, el tiempo o los puntos, y publícalos cuando estén verificados."
        actions={
          <LinkButton href="/resultados" variant="secondary" target="_blank">
            Ver portal público
          </LinkButton>
        }
      />

      <RealtimeRefresher tables={['schedules']} />

      {competitions.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No tienes competencias asignadas"
          description="La organización te asignará partidos o sesiones cuando publique la programación."
        />
      ) : (
        <div className="space-y-4">
          {competitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} canEnterResult />
          ))}
        </div>
      )}
    </>
  );
}
