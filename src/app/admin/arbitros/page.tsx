import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Alert, PageHeader } from '@/components/ui';
import { RefereeManager } from './referee-manager';
import type { RefereeRow } from './referee-form';

export const metadata: Metadata = { title: 'Árbitros' };

export default async function AdminRefereesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: referees }, { data: profiles }, { data: sports }, { data: links }, { data: schedules }] =
    await Promise.all([
      supabase.from('referees').select('*').order('created_at'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'referee'),
      supabase.from('sports').select('id, name, icon').eq('active', true).order('sort_order'),
      supabase.from('referee_sports').select('referee_id, sport_id'),
      supabase.from('schedules').select('referee_id'),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const sportsByReferee = new Map<string, string[]>();
  for (const link of links ?? []) {
    sportsByReferee.set(link.referee_id, [
      ...(sportsByReferee.get(link.referee_id) ?? []),
      link.sport_id,
    ]);
  }

  const assignmentCounts: Record<string, number> = {};
  for (const schedule of schedules ?? []) {
    if (!schedule.referee_id) continue;
    assignmentCounts[schedule.referee_id] = (assignmentCounts[schedule.referee_id] ?? 0) + 1;
  }

  const rows: RefereeRow[] = (referees ?? []).map((referee) => {
    const profile = profileById.get(referee.id);
    return {
      id: referee.id,
      fullName: profile?.full_name ?? 'Sin nombre',
      email: profile?.email ?? '',
      phone: referee.phone,
      notes: referee.notes,
      active: referee.active,
      sportIds: sportsByReferee.get(referee.id) ?? [],
    };
  });

  return (
    <>
      <PageHeader
        title="Árbitros"
        description="Cada árbitro entra con su propia cuenta y solo ve las competencias que le asignes."
      />

      {(sports ?? []).length === 0 && (
        <Alert tone="warning" title="No hay deportes activos" className="mb-5">
          Crea al menos un deporte antes de registrar árbitros: la asignación se hace por deporte.
        </Alert>
      )}

      <RefereeManager
        referees={rows}
        sports={sports ?? []}
        assignmentCounts={assignmentCounts}
      />
    </>
  );
}
