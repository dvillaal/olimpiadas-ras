import type { Metadata } from 'next';
import { requireReferee } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Panel, StatCard } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { CompetitionCard } from '@/components/competition-card';
import { loadCompetitions } from '@/lib/competitions/load';

export const metadata: Metadata = { title: 'Inicio' };

export default async function RefereeDashboardPage() {
  const context = await requireReferee();
  const supabase = await createClient();

  const competitions = await loadCompetitions(supabase, { refereeId: context.userId });

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const todays = competitions.filter((c) => c.startsOn === today);
  const pending = competitions.filter((c) => !c.resultPublished);
  const published = competitions.filter((c) => c.resultPublished);

  // La próxima por empezar, para ponerla al frente el día del evento.
  const next = competitions.find(
    (c) => new Date(`${c.startsOn}T${c.startsAt}`) >= now && !c.resultPublished,
  );

  return (
    <>
      <PageHeader
        title={`Hola, ${context.profile.full_name || 'árbitro'}`}
        description="Aquí aparecen únicamente las competencias que te asignó la organización."
        actions={
          <LinkButton href="/resultados" variant="secondary" target="_blank">
            Portal público
          </LinkButton>
        }
      />

      <RealtimeRefresher tables={['schedules']} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="🗓️" value={competitions.length} label="Competencias asignadas" />
        <StatCard icon="☀️" value={todays.length} label="Programadas para hoy" />
        <StatCard
          icon="✍️"
          value={pending.length}
          label="Resultados pendientes"
          tone={pending.length > 0 ? 'warning' : 'default'}
        />
        <StatCard icon="🏁" value={published.length} label="Resultados publicados" tone="success" />
      </div>

      {next ? (
        <Panel title="Próxima competencia" className="mb-6">
          <CompetitionCard competition={next} canEnterResult />
        </Panel>
      ) : (
        <Panel className="mb-6">
          <EmptyState
            icon="🧑‍⚖️"
            title="No tienes competencias próximas"
            description={
              competitions.length === 0
                ? 'La organización te asignará partidos o sesiones cuando publique la programación.'
                : 'Ya registraste todo lo que tenías asignado.'
            }
          />
        </Panel>
      )}

      <Panel
        title="Cómo registrar un resultado"
        description="El mismo procedimiento para partidos y para sesiones individuales."
      >
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-slate-600">
          <li>Abre «Mis competencias» y busca la que vas a dirigir.</li>
          <li>Pulsa «Registrar resultado».</li>
          <li>
            Anota el marcador, el tiempo, la marca o los puntos. En las sesiones, deja vacío a
            quien no compitió y marca «Descalificado» cuando corresponda.
          </li>
          <li>
            Guarda un <b>borrador</b> mientras verificas, o <b>publica</b> cuando estés seguro.
          </li>
        </ol>
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Lo que publiques queda visible para cualquier persona sin iniciar sesión. Puedes
          corregirlo después, pero conviene revisarlo antes.
        </p>
      </Panel>
    </>
  );
}
