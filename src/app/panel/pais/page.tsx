import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert } from '@/components/ui';
import { CountryFlag } from '@/components/country-flag';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { cardTitleClass } from '@/lib/fonts';
import { CountryPicker } from './country-picker';

export const metadata: Metadata = { title: 'Escoger país' };

export default async function GroupCountryPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const [{ data: countries }, { data: groups }] = await Promise.all([
    supabase.from('countries').select('*').order('name'),
    supabase.from('groups').select('id, name, country_code').eq('status', 'approved'),
  ]);

  const takenBy = new Map(
    (groups ?? []).filter((g) => g.country_code).map((g) => [g.country_code as string, g.name]),
  );

  const mine = (countries ?? []).find((c) => c.code === group.country_code);

  return (
    <div className="min-w-0 space-y-5">
      {/* Si otro grupo escoge un país mientras miras, la lista se actualiza sola. */}
      <RealtimeRefresher tables={['groups', 'countries']} announce={false} />

      <section className="rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <h1 className={cardTitleClass}>Escoger país</h1>
        <p className="mt-1 text-sm text-white/75">
          Cada grupo representa a un país distinto durante las Olimpiadas. Una vez escogido, solo
          la organización puede cambiarlo.
        </p>
      </section>

      {mine ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-scout-600 px-6 py-4 text-white">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-white/70">Su país</p>
            <p className={`truncate ${cardTitleClass} sm:text-3xl`}>{mine.name}</p>
            <p className="mt-1 text-sm text-white/75">
              Si necesitan cambiarlo, pídanle a la organización que lo libere primero.
            </p>
          </div>
          <CountryFlag code={mine.code} name={mine.name} size="lg" />
        </div>
      ) : (
        <Alert tone="info">
          Todavía no han escogido país. Elijan uno de la lista: quedará reservado para su grupo de
          inmediato.
        </Alert>
      )}

      <section className="rounded-3xl bg-scout-600 p-5 text-white">
        <h3 className={`mb-3 ${cardTitleClass}`}>Países disponibles</h3>
        <div className="rounded-2xl bg-jade p-4">
          <CountryPicker
            hasCountry={Boolean(mine)}
            countries={(countries ?? []).map((country) => ({
              code: country.code,
              name: country.name,
              isReserved: country.is_reserved,
              takenBy: takenBy.get(country.code) ?? null,
              isMine: country.code === group.country_code,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
