import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert, PageHeader } from '@/components/ui';
import { CourtManager } from './court-manager';
import type { CourtRow } from './court-form';

export const metadata: Metadata = { title: 'Canchas' };

export default async function AdminCourtsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: courts }, { data: sports }, { data: links }] = await Promise.all([
    supabase.from('courts').select('*').order('created_at'),
    supabase.from('sports').select('id, name, icon').eq('active', true).order('sort_order'),
    supabase.from('court_sports').select('court_id, sport_id'),
  ]);

  const sportsByCourt = new Map<string, string[]>();
  for (const link of links ?? []) {
    sportsByCourt.set(link.court_id, [...(sportsByCourt.get(link.court_id) ?? []), link.sport_id]);
  }

  const rows: CourtRow[] = (courts ?? []).map((court) => ({
    id: court.id,
    name: court.name,
    notes: court.notes,
    active: court.active,
    sportIds: sportsByCourt.get(court.id) ?? [],
  }));

  return (
    <>
      <PageHeader
        title="Canchas"
        description="Dónde se juega cada partido. Una cancha puede admitir varios deportes, pero solo puede haber un partido a la vez en ella."
      />

      {(sports ?? []).length === 0 && (
        <Alert tone="warning" title="No hay deportes activos" className="mb-5">
          Crea al menos un deporte antes de configurar canchas: la asignación se hace por deporte.
        </Alert>
      )}

      <CourtManager courts={rows} sports={sports ?? []} />
    </>
  );
}
