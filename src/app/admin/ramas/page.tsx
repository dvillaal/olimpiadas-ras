import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { Badge, Button, EmptyState, PageHeader, Panel } from '@/components/ui';
import { toggleBranchAction } from '../actions';
import { BranchForm } from './branch-form';

export const metadata: Metadata = { title: 'Ramas' };

export default async function AdminBranchesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: branches }, { data: participants }] = await Promise.all([
    supabase.from('branches').select('*').order('sort_order').order('name'),
    supabase.from('participants').select('branch_id'),
  ]);

  const usage = new Map<string, number>();
  for (const participant of participants ?? []) {
    usage.set(participant.branch_id, (usage.get(participant.branch_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Ramas"
        description="Las ramas determinan qué participantes pueden inscribirse en cada deporte."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title="Nueva rama" description="El identificador no se puede cambiar después.">
          <BranchForm />
        </Panel>

        <Panel title={`Ramas configuradas (${(branches ?? []).length})`}>
          {(branches ?? []).length === 0 ? (
            <EmptyState icon="🌿" title="No hay ramas configuradas" />
          ) : (
            <ul className="space-y-2.5">
              {(branches ?? []).map((branch) => {
                const count = usage.get(branch.id) ?? 0;
                return (
                  <li
                    key={branch.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <b className="text-navy">{branch.name}</b>
                      <p className="font-mono text-xs text-slate-400">{branch.id}</p>
                    </div>

                    <span className="text-sm text-slate-500">
                      {count} participante{count === 1 ? '' : 's'}
                    </span>

                    <Badge tone={branch.active ? 'green' : 'gray'}>
                      {branch.active ? 'Activa' : 'Inactiva'}
                    </Badge>

                    <form action={toggleBranchAction}>
                      <input type="hidden" name="id" value={branch.id} />
                      <input type="hidden" name="active" value={String(!branch.active)} />
                      <Button type="submit" size="sm" variant="ghost">
                        {branch.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-sm text-slate-500">
            Una rama inactiva deja de ofrecerse en formularios nuevos, pero los participantes que ya
            la tienen conservan su información.
          </p>
        </Panel>
      </div>
    </>
  );
}
