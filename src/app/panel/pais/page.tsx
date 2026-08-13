import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert, PageHeader, Panel } from '@/components/ui';
import { CountryFlag } from '@/components/country-flag';
import { RealtimeRefresher } from '@/components/realtime-refresher';
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
    <>
      {/* Si otro grupo escoge un país mientras miras, la lista se actualiza sola. */}
      <RealtimeRefresher tables={['groups', 'countries']} announce={false} />

      <PageHeader
        title="Escoger país"
        description="Cada grupo representa a un país distinto durante las Olimpiadas. Una vez escogido, solo la organización puede cambiarlo."
      />

      {mine ? (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-center gap-5">
            <CountryFlag code={mine.code} name={mine.name} size="lg" />
            <div>
              <span className="kicker">Su país</span>
              <h3 className="text-2xl font-extrabold text-navy">{mine.name}</h3>
              <p className="mt-1 text-sm text-slate-500">
                Si necesitan cambiarlo, pídanle a la organización que lo libere primero.
              </p>
            </div>
          </div>
        </Panel>
      ) : (
        <Alert tone="info" className="mb-6">
          Todavía no han escogido país. Elijan uno de la lista: quedará reservado para su grupo de
          inmediato.
        </Alert>
      )}

      <Panel title="Países disponibles">
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
      </Panel>
    </>
  );
}
