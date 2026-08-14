import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { intergroupStatusView } from '@/lib/domain/status';
import { formatRelative } from '@/lib/utils';
import { Alert, Badge, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { cardTitleClass } from '@/lib/fonts';
import { NewRequestForm } from './new-request-form';
import { ProposeForm } from './propose-form';
import { ResolveButtons } from './resolve-buttons';

export const metadata: Metadata = { title: 'Solicitudes intergrupales' };

export default async function GroupIntergroupPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const [
    { data: requests },
    { data: teams },
    { data: teamMembers },
    { data: sports },
    { data: groups },
    { data: participants },
    { data: proposals },
  ] = await Promise.all([
    supabase
      .from('intergroup_requests')
      .select('*')
      .or(`requester_group_id.eq.${group.id},target_group_id.eq.${group.id}`)
      .order('created_at', { ascending: false }),
    supabase.from('teams').select('*'),
    supabase.from('team_members').select('team_id, role, participant_id'),
    supabase.from('sports').select('*'),
    supabase.from('groups').select('id, name, code').eq('status', 'approved'),
    supabase.from('participants').select('*').eq('active', true),
    supabase.from('intergroup_proposals').select('*'),
  ]);

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));

  const rows = requests ?? [];
  const sent = rows.filter((r) => r.requester_group_id === group.id);
  const received = rows.filter((r) => r.target_group_id === group.id);

  // Equipos propios incompletos: los únicos que justifican pedir apoyo.
  const incompleteTeams = (teams ?? [])
    .filter((team) => team.owner_group_id === group.id)
    .map((team) => {
      const sport = sportById.get(team.sport_id);
      const starters = (teamMembers ?? []).filter(
        (m) => m.team_id === team.id && m.role === 'starter',
      ).length;
      return {
        id: team.id,
        name: team.name,
        sportName: sport?.name ?? '',
        allowIntergroup: sport?.allow_intergroup ?? false,
        missing: (sport?.team_size ?? 0) - starters,
        maxExternal: sport?.max_external ?? 0,
      };
    })
    .filter((team) => team.allowIntergroup && team.missing > 0);

  const otherGroups = (groups ?? [])
    .filter((g) => g.id !== group.id)
    .map((g) => ({ id: g.id, name: g.name }));

  const myParticipants = (participants ?? [])
    .filter((p) => p.group_id === group.id)
    .map((p) => ({ id: p.id, fullName: p.full_name, branch: p.branch_id }));

  return (
    <div className="min-w-0 space-y-5">
      <RealtimeRefresher groupId={group.id} tables={['intergroup_requests', 'teams']} announce={false} />

      <section className="rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <h1 className={cardTitleClass}>Solicitudes intergrupales</h1>
        <p className="mt-1 text-sm text-white/75">
          Cuando te falten participantes para completar un equipo, pide apoyo a otro grupo scout.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <section className="rounded-3xl bg-scout-600 p-5 text-white">
            <h3 className={cardTitleClass}>Pedir apoyo</h3>
            <p className="mb-3 text-sm text-white/75">
              Solo aparecen los equipos incompletos que admiten integrantes externos.
            </p>
            <div className="rounded-2xl bg-jade p-4">
              {incompleteTeams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/30 px-4 py-8 text-center">
                  <span className="mb-2 block text-3xl" aria-hidden>
                    ✅
                  </span>
                  <p className="font-semibold text-white">No necesitas apoyo</p>
                  <p className="mt-1 text-sm text-white/75">
                    Todos tus equipos están completos o no admiten integrantes de otros grupos.
                  </p>
                </div>
              ) : (
                <NewRequestForm teams={incompleteTeams} groups={otherGroups} />
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-plum p-5 text-white">
            <h3 className={`mb-3 ${cardTitleClass}`}>Solicitudes enviadas ({sent.length})</h3>
            {sent.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/25 px-4 py-8 text-center">
                <span className="mb-2 block text-3xl" aria-hidden>
                  📤
                </span>
                <p className="font-semibold text-white">Todavía no has pedido apoyo</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {sent.map((request) => {
                  const team = teamById.get(request.team_id);
                  const proposed = (proposals ?? []).filter((p) => p.request_id === request.id);

                  return (
                    <li key={request.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <b className="text-white">{groupById.get(request.target_group_id)?.name}</b>
                          <p className="text-sm text-white/75">
                            {team?.name} · {request.slots_requested} cupo(s) ·{' '}
                            {formatRelative(request.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={intergroupStatusView(request.status)} />
                      </div>

                      {request.message && (
                        <p className="mb-2 text-sm text-white/80">{request.message}</p>
                      )}

                      {request.status === 'proposed' && (
                        <>
                          <p className="mb-2 text-sm font-semibold text-white">
                            Participantes propuestos:
                          </p>
                          <ul className="mb-3 flex flex-wrap gap-1.5">
                            {proposed.map((proposal) => (
                              <li key={proposal.participant_id}>
                                <Badge tone="blue">
                                  {participantById.get(proposal.participant_id)?.full_name ?? '—'}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                          {request.response_note && (
                            <p className="mb-3 rounded-lg bg-white/10 p-2 text-sm text-white/80">
                              {request.response_note}
                            </p>
                          )}
                          <ResolveButtons requestId={request.id} />
                        </>
                      )}

                      {request.status === 'pending' && (
                        <p className="text-sm text-white/70">
                          Esperando que el otro grupo proponga participantes.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-3xl bg-scout-600 p-5 text-white">
          <h3 className={`mb-3 ${cardTitleClass}`}>Solicitudes recibidas ({received.length})</h3>
          {received.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/30 px-4 py-8 text-center">
              <span className="mb-2 block text-3xl" aria-hidden>
                📥
              </span>
              <p className="font-semibold text-white">Ningún grupo te ha pedido apoyo</p>
              <p className="mt-1 text-sm text-white/75">
                Cuando otro grupo necesite participantes, aparecerá aquí.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {received.map((request) => {
                const team = teamById.get(request.team_id);
                const sport = team ? sportById.get(team.sport_id) : undefined;
                const proposed = (proposals ?? [])
                  .filter((p) => p.request_id === request.id)
                  .map((p) => p.participant_id);

                return (
                  <li key={request.id} className="rounded-2xl border border-white/20 bg-white/10 p-4">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <b className="text-white">
                          {groupById.get(request.requester_group_id)?.name}
                        </b>
                        <p className="text-sm text-white/75">
                          {sport?.icon} {sport?.name} · necesita {request.slots_requested}{' '}
                          participante(s)
                        </p>
                      </div>
                      <StatusBadge status={intergroupStatusView(request.status)} />
                    </div>

                    {request.message && (
                      <p className="mb-3 rounded-lg bg-white/10 p-2 text-sm text-white/80">
                        {request.message}
                      </p>
                    )}

                    {request.status === 'pending' || request.status === 'proposed' ? (
                      <div className="rounded-2xl bg-jade p-4">
                        <ProposeForm
                          requestId={request.id}
                          maxSlots={request.slots_requested}
                          participants={myParticipants}
                          selectedIds={proposed}
                          alreadyProposed={request.status === 'proposed'}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-white/70">
                        {request.status === 'accepted'
                          ? 'Tus participantes fueron integrados al equipo solicitante.'
                          : 'Esta solicitud ya se cerró.'}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Alert tone="info">
        Una persona prestada sigue perteneciendo a su grupo de origen y cuenta dentro de su límite
        de deportes. El equipo que la recibe es el responsable del pago de esa inscripción.
      </Alert>
    </div>
  );
}
