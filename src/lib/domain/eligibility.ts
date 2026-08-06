import type { Participant, Sport, TeamMemberRole } from '@/types/database';

/**
 * Reglas de elegibilidad e integridad de equipos.
 *
 * Cada función devuelve `null` cuando todo está bien o un mensaje en español
 * cuando algo falla, para poder mostrarlo tal cual en la interfaz. Los mismos
 * límites se aplican con disparadores en Postgres: esta capa solo adelanta el
 * mensaje al usuario.
 */

export type EligibilitySport = Pick<
  Sport,
  | 'id'
  | 'name'
  | 'type'
  | 'team_size'
  | 'substitutes'
  | 'max_teams_per_group'
  | 'max_sports_per_participant'
  | 'allow_intergroup'
  | 'max_external'
  | 'active'
  | 'deadline'
>;

export type EligibilityParticipant = Pick<
  Participant,
  'id' | 'group_id' | 'branch_id' | 'active' | 'full_name' | 'birthdate'
>;

export interface RosterEntry {
  participant: EligibilityParticipant;
  role: TeamMemberRole;
}

/** Edad cumplida a una fecha dada (por defecto, hoy). */
export function ageAt(birthdate: string, reference: Date = new Date()): number {
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  let age = reference.getFullYear() - born.getFullYear();
  const hadBirthday =
    reference.getMonth() > born.getMonth() ||
    (reference.getMonth() === born.getMonth() && reference.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return Math.max(0, age);
}

/** ¿La inscripción de este deporte sigue abierta? */
export function isSportOpen(sport: Pick<Sport, 'active' | 'deadline'>, today: Date = new Date()): boolean {
  if (!sport.active) return false;
  if (!sport.deadline) return true;
  const deadline = new Date(`${sport.deadline}T23:59:59`);
  return today <= deadline;
}

/**
 * ¿Esta persona puede inscribirse en este deporte?
 *
 * @param sportBranchIds ramas habilitadas para el deporte
 * @param currentSportCount deportes distintos en los que ya está inscrita,
 *                          sin contar el que se está editando
 */
export function participantEligibility(
  participant: EligibilityParticipant,
  sport: EligibilitySport,
  sportBranchIds: readonly string[],
  currentSportCount: number,
): string | null {
  if (!participant.active) {
    return `${participant.full_name} está inactivo.`;
  }
  if (!sportBranchIds.includes(participant.branch_id)) {
    return `La rama de ${participant.full_name} no está habilitada para "${sport.name}".`;
  }
  if (currentSportCount >= sport.max_sports_per_participant) {
    return `${participant.full_name} ya alcanzó el máximo de ${sport.max_sports_per_participant} deporte(s).`;
  }
  return null;
}

export interface RosterProblem {
  code:
    | 'too_many_starters'
    | 'too_many_substitutes'
    | 'incomplete'
    | 'duplicate'
    | 'external_not_allowed'
    | 'too_many_external'
    | 'captain_not_starter';
  message: string;
}

/**
 * Valida una alineación completa antes de guardarla.
 *
 * Devuelve todos los problemas encontrados, no solo el primero: así el usuario
 * corrige de una sola vez en lugar de descubrirlos de a uno.
 */
export function validateRoster(
  roster: readonly RosterEntry[],
  sport: EligibilitySport,
  ownerGroupId: string,
  captainId: string | null,
): RosterProblem[] {
  const problems: RosterProblem[] = [];

  const seen = new Set<string>();
  for (const entry of roster) {
    if (seen.has(entry.participant.id)) {
      problems.push({
        code: 'duplicate',
        message: `${entry.participant.full_name} está repetido en la alineación.`,
      });
    }
    seen.add(entry.participant.id);
  }

  const starters = roster.filter((r) => r.role === 'starter');
  const substitutes = roster.filter((r) => r.role === 'substitute');

  if (starters.length > sport.team_size) {
    problems.push({
      code: 'too_many_starters',
      message: `"${sport.name}" admite ${sport.team_size} titular(es); seleccionaste ${starters.length}.`,
    });
  }
  if (substitutes.length > sport.substitutes) {
    problems.push({
      code: 'too_many_substitutes',
      message: `"${sport.name}" admite ${sport.substitutes} suplente(s); seleccionaste ${substitutes.length}.`,
    });
  }

  const external = roster.filter((r) => r.participant.group_id !== ownerGroupId);
  if (external.length > 0 && !sport.allow_intergroup) {
    problems.push({
      code: 'external_not_allowed',
      message: `"${sport.name}" no permite integrantes de otros grupos.`,
    });
  } else if (external.length > sport.max_external) {
    problems.push({
      code: 'too_many_external',
      message: `"${sport.name}" admite máximo ${sport.max_external} integrante(s) de otros grupos.`,
    });
  }

  if (captainId && !starters.some((r) => r.participant.id === captainId)) {
    problems.push({
      code: 'captain_not_starter',
      message: 'El capitán debe estar entre los titulares.',
    });
  }

  return problems;
}

/** Un equipo solo puede pasar a pago cuando tiene todos sus titulares. */
export function isRosterComplete(roster: readonly RosterEntry[], sport: EligibilitySport): boolean {
  return roster.filter((r) => r.role === 'starter').length === sport.team_size;
}

/** Cuántos equipos más puede crear un grupo en este deporte. */
export function remainingTeamSlots(sport: EligibilitySport, currentTeamCount: number): number {
  return Math.max(0, sport.max_teams_per_group - currentTeamCount);
}

/**
 * Cupos de stand disponibles.
 *
 * A diferencia del prototipo, un stand con pago en curso YA consume cupo: de lo
 * contrario podrían registrarse solicitudes ilimitadas y sobrevender el evento.
 */
export function remainingStandSlots(standLimit: number, occupied: number): number {
  return Math.max(0, standLimit - occupied);
}
