import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { registrationStatusView } from '@/lib/domain/status';
import { isEditableRegistration } from '@/lib/domain/fees';
import { Alert, Badge, Button, LinkButton, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { cardTitleClass } from '@/lib/fonts';
import { deleteTeamAction } from '../actions';

export const metadata: Metadata = { title: 'Mis equipos' };

export default async function GroupTeamsPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: teams }, { data: members }, { data: participants }, { data: sports }, { data: requests }] =
    await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('owner_group_id', group.id)
        .order('created_at', { ascending: false }),
      supabase.from('team_members').select('*'),
      supabase.from('participants').select('id, full_name, group_id'),
      supabase.from('sports').select('*'),
      supabase.from('intergroup_requests').select('*').eq('requester_group_id', group.id),
    ]);

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const participantById = new Map((participants ?? []).map((p) => [p.id, p]));

  const membersByTeam = new Map<string, NonNullable<typeof members>>();
  for (const member of members ?? []) {
    membersByTeam.set(member.team_id, [...(membersByTeam.get(member.team_id) ?? []), member]);
  }

  const rows = teams ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <RealtimeRefresher groupId={group.id} tables={['teams', 'intergroup_requests']} announce={false} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <div>
          <h1 className={cardTitleClass}>Mis equipos</h1>
          <p className="mt-1 text-sm text-white/75">
            Revisa las alineaciones y completa las que estén incompletas.
          </p>
        </div>
        <LinkButton
          href="/panel/deportes"
          variant="secondary"
          size="sm"
          className="!border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
        >
          + Crear equipo
        </LinkButton>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-3xl bg-scout-600 p-6 text-center text-white">
          <span className="mb-2 block text-3xl" aria-hidden>
            🤝
          </span>
          <p className="font-semibold text-white">Todavía no tienes equipos</p>
          <p className="mt-1 text-sm text-white/75">
            Ve a Deportes, escoge una disciplina por equipos y arma tu alineación.
          </p>
          <LinkButton
            href="/panel/deportes"
            size="sm"
            className="mt-3 !border-white/40 !bg-white/10 !text-white hover:!bg-white/20"
            variant="ghost"
          >
            Ver deportes
          </LinkButton>
        </section>
      ) : (
        <ul className="grid gap-5 xl:grid-cols-2">
          {rows.map((team, index) => {
            const sport = sportById.get(team.sport_id);
            const roster = membersByTeam.get(team.id) ?? [];
            const starters = roster.filter((m) => m.role === 'starter');
            const substitutes = roster.filter((m) => m.role === 'substitute');
            const missing = (sport?.team_size ?? 0) - starters.length;
            const editable = isEditableRegistration(team.status);
            const openRequest = (requests ?? []).find(
              (r) => r.team_id === team.id && ['pending', 'proposed'].includes(r.status),
            );

            // Los prestados solo cuentan cuando la organización los aprobó. Sin
            // eso el equipo se ve completo pero el pago está bloqueado, y hay
            // que decirlo aquí en lugar de dejar que lo descubra al intentarlo.
            const external = starters.filter(
              (m) => participantById.get(m.participant_id)?.group_id !== group.id,
            );
            const allianceReview = (requests ?? []).find(
              (r) => r.team_id === team.id && r.status === 'admin_review',
            );
            const allianceRejected = (requests ?? []).find(
              (r) => r.team_id === team.id && r.status === 'admin_rejected',
            );

            const frame = index % 2 === 0 ? 'bg-plum' : 'bg-scout-600';

            return (
              <li key={team.id}>
                <section className={`rounded-3xl ${frame} p-6 text-white`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className={cardTitleClass}>{team.name}</h3>
                      <p className="text-sm text-white/75">
                        {sport?.icon} {sport?.name} ·{' '}
                        {sport ? formatCOP(sportFee(sport, settings)) : '—'}
                      </p>
                    </div>
                    <StatusBadge status={registrationStatusView(team.status)} />
                  </div>

                  {missing > 0 && (
                    <Alert tone="warning" className="mb-3">
                      Faltan <b>{missing}</b> titular(es) para completar el equipo.
                      {sport?.allow_intergroup && !openRequest && (
                        <>
                          {' '}
                          Puedes pedir apoyo a otro grupo desde{' '}
                          <LinkButton
                            href="/panel/solicitudes"
                            size="sm"
                            variant="secondary"
                            className="ml-1"
                          >
                            Intergrupales
                          </LinkButton>
                        </>
                      )}
                      {openRequest && ' Ya tienes una solicitud de apoyo en curso.'}
                    </Alert>
                  )}

                  {allianceReview && (
                    <Alert tone="warning" title="Alianza en revisión" className="mb-3">
                      La organización está verificando a {external.length} participante(s) de otro
                      grupo. El pago del equipo se habilita cuando la aprueben.
                    </Alert>
                  )}

                  {allianceRejected && allianceRejected.admin_note && (
                    <Alert tone="error" title="Alianza rechazada" className="mb-3">
                      {allianceRejected.admin_note} Los participantes prestados salieron de la
                      alineación.
                    </Alert>
                  )}

                  {team.admin_note && (
                    <Alert tone="info" title="Observación de la organización" className="mb-3">
                      {team.admin_note}
                    </Alert>
                  )}

                  <div className="mb-3">
                    <p className="mb-1.5 text-sm font-semibold text-white">
                      Titulares ({starters.length}/{sport?.team_size ?? '?'})
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {starters.map((member) => {
                        const participant = participantById.get(member.participant_id);
                        const external = participant?.group_id !== group.id;
                        return (
                          <li key={member.participant_id}>
                            <Badge tone={external ? 'blue' : 'green'}>
                              {participant?.full_name ?? '—'}
                              {external && ' ↗'}
                              {team.captain_id === member.participant_id && ' ⭐'}
                            </Badge>
                          </li>
                        );
                      })}
                      {starters.length === 0 && (
                        <li className="text-sm text-white/70">Sin titulares.</li>
                      )}
                    </ul>
                  </div>

                  {substitutes.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-sm font-semibold text-white">Suplentes</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {substitutes.map((member) => (
                          <li key={member.participant_id}>
                            <Badge tone="gray">
                              {participantById.get(member.participant_id)?.full_name ?? '—'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {editable ? (
                    <form action={deleteTeamAction}>
                      <input type="hidden" name="id" value={team.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="!border-white/40 !text-white hover:!bg-white/10"
                      >
                        Eliminar equipo
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-white/70">
                      Este equipo ya no admite cambios porque su pago está en curso.
                    </p>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-white/60">
        <Badge tone="blue">↗</Badge> señala a los integrantes prestados por otro grupo ·{' '}
        <span aria-hidden>⭐</span> marca al capitán.
      </p>
    </div>
  );
}
