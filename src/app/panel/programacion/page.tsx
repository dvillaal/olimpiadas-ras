import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { LinkButton } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { CompetitionCard } from '@/components/competition-card';
import { loadCompetitions } from '@/lib/competitions/load';
import { cardTitleClass } from '@/lib/fonts';

export const metadata: Metadata = { title: 'Mi programación' };

export default async function GroupSchedulePage() {
  const context = await requireGroup();
  const supabase = await createClient();

  const competitions = await loadCompetitions(supabase, { groupId: context.group.id });

  const now = new Date();
  const upcoming = competitions.filter((c) => new Date(`${c.startsOn}T${c.startsAt}`) >= now);
  const past = competitions.filter((c) => new Date(`${c.startsOn}T${c.startsAt}`) < now);

  const stats = [
    { icon: '🗓️', value: competitions.length, label: 'Competencias' },
    { icon: '⏭️', value: upcoming.length, label: 'Por disputar' },
    {
      icon: '🏁',
      value: competitions.filter((c) => c.resultPublished).length,
      label: 'Con resultado publicado',
    },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <RealtimeRefresher tables={['schedules']} groupId={context.group.id} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <div>
          <h1 className={cardTitleClass}>Mi programación</h1>
          <p className="mt-1 text-sm text-white/75">
            Partidos y sesiones en los que participa tu grupo.
          </p>
        </div>
        <LinkButton
          href="/resultados"
          variant="secondary"
          target="_blank"
          className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
        >
          🏁 Resultados generales
        </LinkButton>
      </section>

      {competitions.length === 0 ? (
        <section className="rounded-3xl bg-scout-600 p-6 text-center text-white">
          <span className="mb-2 block text-3xl" aria-hidden>
            🗓️
          </span>
          <p className="font-semibold text-white">
            Todavía no tienes competencias programadas
          </p>
          <p className="mt-1 text-sm text-white/75">
            Aparecerán aquí cuando la organización publique el calendario de los deportes en los
            que estás inscrito.
          </p>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-lilac px-3.5 py-3 text-white">
                <p className="text-xl font-black sm:text-2xl">
                  <span aria-hidden className="mr-1">
                    {stat.icon}
                  </span>
                  {stat.value}
                </p>
                <p className="text-xs font-semibold text-amber-300">{stat.label}</p>
              </div>
            ))}
          </div>

          {upcoming.length > 0 && (
            <section className="rounded-3xl bg-scout-600 p-5 text-white">
              <h3 className={`mb-3 ${cardTitleClass}`}>Próximas</h3>
              <div className="space-y-4">
                {upcoming.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                    showReferee
                    tone="dark"
                  />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="rounded-3xl bg-plum p-5 text-white">
              <h3 className={`mb-3 ${cardTitleClass}`}>Ya disputadas</h3>
              <div className="space-y-4">
                {past.map((competition) => (
                  <CompetitionCard
                    key={competition.id}
                    competition={competition}
                    showReferee
                    tone="dark"
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
