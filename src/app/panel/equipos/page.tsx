import type { Metadata } from 'next';
import Image from 'next/image';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { registrationStatusView } from '@/lib/domain/status';
import { isEditableRegistration } from '@/lib/domain/fees';
import { Alert, Badge, Button, LinkButton, StatusBadge } from '@/components/ui';
import { RealtimeRefresher } from '@/components/realtime-refresher';
import { cardTitleClass, titleFontClass } from '@/lib/fonts';
import { deleteTeamAction } from '../actions';
import { EditTeamToggle } from './edit-team-toggle';

export const metadata: Metadata = { title: 'Mis equipos' };

export default async function GroupTeamsPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: teams },
    { data: members },
    { data: allParticipants },
    { data: sports },
    { data: requests },
    { data: sportBranches },
    { data: branches },
    { data: individuals },
    { data: individualLinks },
  ] = await Promise.all([
    supabase
      .from('teams')
      .select('*')
      .eq('owner_group_id', group.id)
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('*'),
    supabase.from('participants').select('*').eq('active', true),
    supabase.from('sports').select('*'),
    supabase.from('intergroup_requests').select('*').eq('requester_group_id', group.id),
    supabase.from('sport_branches').select('*'),
    supabase.from('branches').select('*'),
    supabase.from('individual_registrations').select('*').eq('group_id', group.id),
    supabase.from('individual_registration_participants').select('*'),
  ]);

  const sportById = new Map((sports ?? []).map((s) => [s.id, s]));
  const participantById = new Map((allParticipants ?? []).map((p) => [p.id, p]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [...(branchesBySport.get(link.sport_id) ?? []), link.branch_id]);
  }

  const membersByTeam = new Map<string, NonNullable<typeof members>>();
  for (const member of members ?? []) {
    membersByTeam.set(member.team_id, [...(membersByTeam.get(member.team_id) ?? []), member]);
  }

  const myParticipants = (allParticipants ?? []).filter((p) => p.group_id === group.id);
  const myParticipantIds = new Set(myParticipants.map((p) => p.id));

  // Cuántos deportes distintos tiene ya cada participante propio, para no
  // dejarlo elegible más allá del tope del deporte al editar un equipo.
  const sportCount = new Map<string, Set<string>>();
  for (const member of members ?? []) {
    if (!myParticipantIds.has(member.participant_id)) continue;
    const team = (teams ?? []).find((t) => t.id === member.team_id);
    if (!team || team.status === 'rejected' || team.status === 'cancelled') continue;
    const set = sportCount.get(member.participant_id) ?? new Set();
    set.add(team.sport_id);
    sportCount.set(member.participant_id, set);
  }
  for (const link of individualLinks ?? []) {
    if (!myParticipantIds.has(link.participant_id)) continue;
    const registration = (individuals ?? []).find((r) => r.id === link.registration_id);
    if (!registration || registration.status === 'rejected' || registration.status === 'cancelled')
      continue;
    const set = sportCount.get(link.participant_id) ?? new Set();
    set.add(registration.sport_id);
    sportCount.set(link.participant_id, set);
  }

  const rows = teams ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <RealtimeRefresher groupId={group.id} tables={['teams', 'intergroup_requests']} announce={false} />

      <section className="grid grid-cols-1 items-stretch gap-3 rounded-3xl bg-[#c49551] p-3 text-navy sm:grid-cols-3 sm:px-4 pb-4 pt-8">
        <div className="relative h-40 sm:h-auto">
          <Image
            src="/home/goles-puntos-sets.png"
            alt="¡Goles, puntos, sets!"
            fill
            className="object-contain object-center"
          />
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-2 py-1 text-center">
          <h1 className={`${cardTitleClass} !text-3xl sm:!text-4xl`}>Mis equipos</h1>
          <p className="text-justify text-sm text-navy/75">
            En esta sección aparecen los equipos que conformaste. Si requieres completarlos con
            integrantes de otros grupos, ve a la sección Intergrupales.
          </p>
          <LinkButton
            href="/panel/deportes"
            variant="secondary"
            size="sm"
            className="!border-navy/30 !bg-navy/10 !text-navy hover:!bg-navy/20"
          >
            + Crear equipo
          </LinkButton>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-plum px-4 py-3 text-center text-white">
          <p className={`${titleFontClass} text-3xl font-black uppercase leading-none sm:text-4xl`}>
            ¡Pilas!
          </p>
          <p className="mt-1.5 text-justify text-xs leading-snug text-white/80">
            Debes pagar los equipos y las inscripciones a deportes individuales desde la sección
            «Pagos» para que queden correctamente inscritos.
          </p>
        </div>
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

            // Elegibles para editar este equipo: participantes propios de rama
            // habilitada que no excedan el tope de deportes (los que ya están
            // en ESTE equipo siempre cuentan como elegibles), más los externos
            // ya presentes en la alineación (aportados por una alianza).
            const allowedBranches = sport ? (branchesBySport.get(sport.id) ?? []) : [];
            const rosterParticipantIds = new Set(roster.map((m) => m.participant_id));
            const eligible = sport
              ? myParticipants.filter(
                  (participant) =>
                    allowedBranches.includes(participant.branch_id) &&
                    ((sportCount.get(participant.id)?.size ?? 0) < sport.max_sports_per_participant ||
                      rosterParticipantIds.has(participant.id)),
                )
              : [];
            const externalInRoster = roster
              .filter((m) => participantById.get(m.participant_id)?.group_id !== group.id)
              .map((m) => participantById.get(m.participant_id))
              .filter((p): p is NonNullable<typeof p> => Boolean(p));
            const editParticipants = [...eligible, ...externalInRoster].map((p) => ({
              id: p.id,
              fullName: p.full_name,
              branch: branchName.get(p.branch_id) ?? p.branch_id,
              groupId: p.group_id,
            }));

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
                    <div className="flex flex-wrap gap-2">
                      {sport && (
                        <EditTeamToggle
                          sport={{
                            id: sport.id,
                            name: sport.name,
                            teamSize: sport.team_size,
                            substitutes: sport.substitutes,
                            allowIntergroup: sport.allow_intergroup,
                            maxExternal: sport.max_external,
                          }}
                          participants={editParticipants}
                          groupName={group.name}
                          teamId={team.id}
                          initialName={team.name}
                          initialStarters={starters.map((m) => m.participant_id)}
                          initialSubstitutes={substitutes.map((m) => m.participant_id)}
                        />
                      )}
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
                    </div>
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
