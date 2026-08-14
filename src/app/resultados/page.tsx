import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCompetitionDate, shortTime } from '@/lib/domain/competitions';
import { ResultsExplorer } from './results-explorer';

/**
 * Portal público de resultados.
 *
 * Es la única pantalla del sistema que no pide sesión. Lee de tres vistas de
 * Postgres que solo exponen competencias con resultado publicado y nombres ya
 * públicos: ni documentos, ni correos, ni pagos, ni borradores.
 */

export const metadata: Metadata = {
  title: 'Resultados',
  description: 'Programación, tabla de posiciones y clasificación general de las Olimpiadas Scouts.',
};

// Los resultados cambian durante el evento; media hora de caché es demasiado.
export const revalidate = 30;

export default async function PublicResultsPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: schedule }, { data: standings }, { data: ranking }] =
    await Promise.all([
      supabase.from('settings').select('event_name').maybeSingle(),
      supabase
        .from('public_schedule')
        .select('*')
        .order('starts_on')
        .order('starts_at'),
      supabase.from('public_standings').select('*'),
      supabase.from('public_individual_ranking').select('*').order('position'),
    ]);

  const eventName = settings?.event_name ?? 'Olimpiadas Scouts';
  const competitions = schedule ?? [];
  const published = competitions.filter((c) => c.result_published);

  const nextUp = competitions
    .filter((c) => !c.result_published)
    .slice(0, 1)
    .map((c) => `${formatCompetitionDate(c.starts_on)} · ${shortTime(c.starts_at)}`)[0];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 lg:py-12">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold text-scout-700 hover:underline">
          ← Volver al inicio
        </Link>

        <div className="mt-4 rounded-2xl bg-scout-800 px-6 py-8 text-white">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
            <Image
              src="/login/trofeo.png"
              alt=""
              aria-hidden
              width={14}
              height={14}
              className="object-contain"
            />
            {eventName}
          </span>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Programación y resultados</h1>
          <p className="mt-2 max-w-2xl text-white/75">
            Consulta libre, sin usuario ni contraseña. Aquí aparecen únicamente los resultados
            que los árbitros ya publicaron como oficiales.
          </p>

          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <span>
              <b className="block text-2xl font-black">{competitions.length}</b>
              <span className="text-white/60">competencias</span>
            </span>
            <span>
              <b className="block text-2xl font-black">{published.length}</b>
              <span className="text-white/60">con resultado oficial</span>
            </span>
            {nextUp && (
              <span>
                <b className="block text-lg font-black">{nextUp}</b>
                <span className="text-white/60">próxima competencia</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {competitions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="mb-3 block text-4xl" aria-hidden>
            🗓️
          </span>
          <h2 className="text-lg font-bold text-navy">Todavía no hay programación publicada</h2>
          <p className="mt-1 text-slate-500">
            Vuelve más adelante: la organización publicará aquí el calendario y los resultados.
          </p>
        </div>
      ) : (
        <ResultsExplorer
          competitions={competitions}
          standings={standings ?? []}
          ranking={ranking ?? []}
        />
      )}

      <footer className="mt-12 border-t border-line pt-6 text-center text-sm text-slate-500">
        <p>
          ¿Eres responsable de un grupo o árbitro?{' '}
          <Link href="/ingresar" className="font-semibold text-scout-700 hover:underline">
            Ingresa al sistema
          </Link>
        </p>
      </footer>
    </main>
  );
}
