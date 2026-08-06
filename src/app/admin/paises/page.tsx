import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Panel, StatCard } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { CountryExplorer } from './country-explorer';

export const metadata: Metadata = { title: 'Países' };

export default async function AdminCountriesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: countries }, { data: groups }] = await Promise.all([
    supabase.from('countries').select('*').order('name'),
    supabase.from('groups').select('id, name, code, country_code').eq('status', 'approved'),
  ]);

  const rows = countries ?? [];
  const groupRows = groups ?? [];

  const assignedBy = new Map(
    groupRows.filter((g) => g.country_code).map((g) => [g.country_code as string, g]),
  );

  const assigned = assignedBy.size;
  const reserved = rows.filter((c) => c.is_reserved && !assignedBy.has(c.code)).length;

  return (
    <>
      <RealtimeRefresher tables={['groups', 'countries']} announce={false} />

      <PageHeader
        title="Países"
        description="Cada grupo representa a un país distinto. Reserva los que quieras apartar y libera los que deban volver a estar disponibles."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="🌍" value={rows.length} label="Países en el catálogo" />
        <StatCard icon="🏳️" value={assigned} label="Asignados a un grupo" tone="success" />
        <StatCard icon="🔒" value={reserved} label="Reservados por la organización" tone="warning" />
      </div>

      <Panel
        title="Catálogo"
        description="Busca por nombre o código y filtra por estado."
      >
        <CountryExplorer
          countries={rows.map((country) => {
            const group = assignedBy.get(country.code);
            return {
              code: country.code,
              name: country.name,
              isReserved: country.is_reserved,
              groupId: group?.id ?? null,
              groupName: group?.name ?? null,
              groupCode: group?.code ?? null,
            };
          })}
        />
      </Panel>
    </>
  );
}
