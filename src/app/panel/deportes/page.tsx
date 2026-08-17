import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP, sportFee } from '@/lib/domain/fees';
import { isSportOpen, remainingTeamSlots, teamDisplayName } from '@/lib/domain/eligibility';
import { registrationStatusView } from '@/lib/domain/status';
import { formatDate } from '@/lib/utils';
import { Alert, Badge, LinkButton, StatusBadge } from '@/components/ui';
import { cardTitleClass } from '@/lib/fonts';
import { IndividualRegistrationForm } from './individual-registration-form';
import { TeamBuilder } from '../equipos/team-builder';

export const metadata: Metadata = { title: 'Deportes' };

export default async function GroupSportsPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { data: sports },
    { data: sportBranches },
    { data: branches },
    { data: participants },
    { data: teams },
    { data: teamMembers },
    { data: individuals },
    { data: individualLinks },
  ] = await Promise.all([
    supabase.from('sports').select('*').eq('active', true).order('sort_order'),
    supabase.from('sport_branches').select('*'),
    supabase.from('branches').select('*'),
    supabase
      .from('participants')
      .select('*')
      .eq('group_id', group.id)
      .eq('active', true)
      .order('full_name'),
    supabase.from('teams').select('*').eq('owner_group_id', group.id),
    supabase.from('team_members').select('*'),
    supabase.from('individual_registrations').select('*').eq('group_id', group.id),
    supabase.from('individual_registration_participants').select('*'),
  ]);

  const { data: country } = group.country_code
    ? await supabase.from('countries').select('name').eq('code', group.country_code).maybeSingle()
    : { data: null };

  const branchesBySport = new Map<string, string[]>();
  for (const link of sportBranches ?? []) {
    branchesBySport.set(link.sport_id, [...(branchesBySport.get(link.sport_id) ?? []), link.branch_id]);
  }
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const myParticipantIds = new Set((participants ?? []).map((p) => p.id));

  /** Cuántos deportes distintos tiene ya cada participante. */
  const sportCount = new Map<string, Set<string>>();
  for (const member of teamMembers ?? []) {
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

  const noCountry = !group.country_code;
  const noParticipants = (participants ?? []).length === 0;

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <h1 className={cardTitleClass}>Deportes</h1>
        <p className="mt-1 text-sm text-white/75">
          Inscribe a tus participantes en las disciplinas del evento.
        </p>
      </section>

      {noCountry && (
        <Alert tone="warning">
          Antes de inscribir deben escoger su país.{' '}
          <LinkButton href="/panel/pais" size="sm" variant="secondary" className="ml-1">
            Escoger ahora
          </LinkButton>
        </Alert>
      )}

      {noParticipants && (
        <Alert tone="info">
          Todavía no tienes participantes registrados. La organización es quien los carga: si
          falta alguien, escríbeles para que lo agreguen.
        </Alert>
      )}

      {(sports ?? []).length === 0 ? (
        <section className="rounded-3xl bg-scout-600 p-6 text-center text-white">
          <span className="mb-2 block text-3xl" aria-hidden>
            🏅
          </span>
          <p className="font-semibold text-white">
            La organización todavía no ha publicado deportes
          </p>
          <p className="mt-1 text-sm text-white/75">
            Vuelve más tarde: aquí aparecerán las disciplinas disponibles.
          </p>
        </section>
      ) : (
        <ul className="grid gap-5 xl:grid-cols-2">
          {(sports ?? []).map((sport, index) => {
            const fee = sportFee(sport, settings);
            const allowedBranches = branchesBySport.get(sport.id) ?? [];
            const open = isSportOpen(sport);

            // Elegibles: rama habilitada y sin superar el tope de deportes.
            const eligible = (participants ?? []).filter(
              (participant) =>
                allowedBranches.includes(participant.branch_id) &&
                (sportCount.get(participant.id)?.size ?? 0) < sport.max_sports_per_participant,
            );

            const myTeams = (teams ?? []).filter((t) => t.sport_id === sport.id);
            const myRegistration = (individuals ?? []).find((r) => r.sport_id === sport.id);
            const registeredIds = (individualLinks ?? [])
              .filter((link) => link.registration_id === myRegistration?.id)
              .map((link) => link.participant_id);

            const slotsLeft = remainingTeamSlots(
              sport,
              myTeams.filter((t) => t.status !== 'rejected' && t.status !== 'cancelled').length,
            );

            const frame = index % 2 === 0 ? 'bg-plum' : 'bg-scout-600';

            return (
              <li key={sport.id}>
                <section className={`rounded-3xl ${frame} p-6 text-white`}>
                  <div className="mb-4 flex items-start gap-4">
                    <span
                      aria-hidden
                      className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-3xl"
                    >
                      {sport.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className={cardTitleClass}>{sport.name}</h3>
                      <p className="text-sm text-white/75">{sport.description}</p>
                    </div>
                    <Badge tone={sport.type === 'group' ? 'blue' : 'yellow'}>
                      {sport.type === 'group' ? 'Por equipos' : 'Individual'}
                    </Badge>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-1.5 text-xs">
                    <Badge tone={fee > 0 ? 'green' : 'gray'}>
                      {fee > 0 ? formatCOP(fee) : 'Sin costo'}
                      {sport.type === 'individual' && fee > 0 && ' por participante'}
                    </Badge>
                    {sport.type === 'group' && (
                      <Badge tone="gray">
                        {sport.team_size} titulares
                        {sport.substitutes > 0 && ` + ${sport.substitutes} suplentes`}
                      </Badge>
                    )}
                    <Badge tone="gray">Máx. {sport.max_sports_per_participant} deportes/persona</Badge>
                    {sport.deadline && (
                      <Badge tone={open ? 'gray' : 'red'}>
                        {open ? `Cierra ${formatDate(sport.deadline)}` : 'Inscripción cerrada'}
                      </Badge>
                    )}
                  </div>

                  <p className="mb-4 text-sm text-white/75">
                    Ramas habilitadas:{' '}
                    {allowedBranches.map((id) => branchName.get(id) ?? id).join(', ') || '—'}
                  </p>

                  {myTeams.length > 0 && (
                    <ul className="mb-4 space-y-2">
                      {myTeams.map((team) => (
                        <li
                          key={team.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2.5 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate font-semibold text-white">
                            {team.name}
                          </span>
                          <StatusBadge status={registrationStatusView(team.status)} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {myRegistration && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-2.5 text-sm">
                      <span className="flex-1 font-semibold text-white">
                        {registeredIds.length} participante(s) inscrito(s)
                      </span>
                      <StatusBadge status={registrationStatusView(myRegistration.status)} />
                    </div>
                  )}

                  {!open ? (
                    <Alert tone="warning">Las inscripciones de este deporte ya cerraron.</Alert>
                  ) : noCountry || noParticipants ? (
                    <p className="text-sm text-white/75">
                      Completa los pasos anteriores para poder inscribir.
                    </p>
                  ) : eligible.length === 0 ? (
                    <Alert tone="info">
                      Ninguno de tus participantes cumple los requisitos de este deporte (rama
                      habilitada y cupo de deportes disponible).
                    </Alert>
                  ) : sport.type === 'individual' ? (
                    <div className="rounded-2xl bg-jade p-4">
                      <IndividualRegistrationForm
                        sportId={sport.id}
                        sportName={sport.name}
                        fee={fee}
                        participants={eligible.map((p) => ({
                          id: p.id,
                          fullName: p.full_name,
                          branch: branchName.get(p.branch_id) ?? p.branch_id,
                        }))}
                        selectedIds={registeredIds}
                        locked={
                          myRegistration?.status === 'payment_pending' ||
                          myRegistration?.status === 'confirmed'
                        }
                      />
                    </div>
                  ) : slotsLeft === 0 ? (
                    <Alert tone="info">
                      Ya alcanzaste el máximo de {sport.max_teams_per_group} equipo(s) en este
                      deporte.
                    </Alert>
                  ) : (
                    <div className="rounded-2xl bg-jade p-4">
                      <TeamBuilder
                        sport={{
                          id: sport.id,
                          name: sport.name,
                          teamSize: sport.team_size,
                          substitutes: sport.substitutes,
                          allowIntergroup: sport.allow_intergroup,
                          maxExternal: sport.max_external,
                        }}
                        groupName={group.name}
                        participants={eligible.map((p) => ({
                          id: p.id,
                          fullName: p.full_name,
                          branch: branchName.get(p.branch_id) ?? p.branch_id,
                          groupId: p.group_id,
                        }))}
                        defaultName={teamDisplayName(
                          group.name,
                          country?.name ?? null,
                          branchName.get(allowedBranches[0] ?? '') ?? '',
                          myTeams.filter((t) => t.status !== 'rejected' && t.status !== 'cancelled')
                            .length,
                        )}
                      />
                    </div>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
