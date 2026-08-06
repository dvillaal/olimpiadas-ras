import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { formatDate } from '@/lib/utils';
import { Alert, Badge, Button, EmptyState, PageHeader, Panel } from '@/components/ui';
import { toggleSportAction } from '../actions';
import { SportForm } from './sport-form';

export const metadata: Metadata = { title: 'Deportes' };

export default async function AdminSportsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: sports }, { data: branches }, { data: sportBranches }, { data: teams }] =
    await Promise.all([
      supabase.from('sports').select('*').order('sort_order').order('name'),
      supabase.from('branches').select('*').eq('active', true).order('sort_order'),
      supabase.from('sport_branches').select('*'),
      supabase.from('teams').select('sport_id, status'),
    ]);

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [...(branchesBySport.get(link.sport_id) ?? []), link.branch_id]);
  }

  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const teamsBySport = new Map<string, number>();
  for (const team of teams ?? []) {
    if (team.status === 'rejected' || team.status === 'cancelled') continue;
    teamsBySport.set(team.sport_id, (teamsBySport.get(team.sport_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Deportes"
        description="Define las disciplinas, sus cupos, tarifas y qué ramas pueden participar."
      />

      {settings.group_team_fee === 0 && (
        <Alert tone="info" className="mb-5">
          La tarifa general de deportes grupales es <b>$0</b>. Los deportes que no tengan tarifa
          propia se inscribirán sin pago.
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Panel title="Nuevo deporte">
            <SportForm branches={branches ?? []} settings={settings} />
          </Panel>
        </div>

        <Panel title={`Deportes configurados (${(sports ?? []).length})`}>
          {(sports ?? []).length === 0 ? (
            <EmptyState icon="🏅" title="Todavía no hay deportes" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {(sports ?? []).map((sport) => {
                const fee = sportFee(sport, settings);
                const linkedBranches = branchesBySport.get(sport.id) ?? [];
                return (
                  <li
                    key={sport.id}
                    className={`rounded-2xl border p-4 ${
                      sport.active ? 'border-line' : 'border-line bg-slate-50 opacity-70'
                    }`}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-12 shrink-0 place-items-center rounded-xl bg-scout-50 text-2xl"
                      >
                        {sport.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-navy">{sport.name}</h4>
                        <p className="text-xs text-slate-500">{sport.category}</p>
                      </div>
                      <Badge tone={sport.type === 'group' ? 'blue' : 'yellow'}>
                        {sport.type === 'group' ? 'Grupal' : 'Individual'}
                      </Badge>
                    </div>

                    {sport.description && (
                      <p className="mb-3 text-sm text-slate-600">{sport.description}</p>
                    )}

                    <dl className="mb-3 space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Tarifa</dt>
                        <dd className="font-semibold text-scout-700">
                          {fee > 0 ? formatCOP(fee) : 'Sin costo'}
                          {sport.fee === null && (
                            <span className="ml-1 text-xs font-normal text-slate-400">(general)</span>
                          )}
                        </dd>
                      </div>
                      {sport.type === 'group' && (
                        <>
                          <div className="flex justify-between">
                            <dt className="text-slate-500">Equipo</dt>
                            <dd>
                              {sport.team_size} titulares
                              {sport.substitutes > 0 && ` + ${sport.substitutes} suplentes`}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-slate-500">Externos</dt>
                            <dd>
                              {sport.allow_intergroup ? `Hasta ${sport.max_external}` : 'No permite'}
                            </dd>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Máx. deportes/persona</dt>
                        <dd>{sport.max_sports_per_participant}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Cierre</dt>
                        <dd>{sport.deadline ? formatDate(sport.deadline) : 'Sin fecha'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Inscritos</dt>
                        <dd>{teamsBySport.get(sport.id) ?? 0}</dd>
                      </div>
                    </dl>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {linkedBranches.map((branchId) => (
                        <Badge key={branchId} tone="gray">
                          {branchName.get(branchId) ?? branchId}
                        </Badge>
                      ))}
                      {linkedBranches.length === 0 && (
                        <Badge tone="red">Sin ramas: nadie puede inscribirse</Badge>
                      )}
                    </div>

                    <form action={toggleSportAction}>
                      <input type="hidden" name="id" value={sport.id} />
                      <input type="hidden" name="active" value={String(!sport.active)} />
                      <Button type="submit" size="sm" variant="ghost">
                        {sport.active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
