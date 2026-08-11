import type { Branch, ResultOrder, ScheduleType, Sport } from '@/types/database';

/**
 * Reglas de competencia: ramas por edad, emparejamientos y clasificaciones.
 *
 * Igual que el resto de `domain/`, estas funciones son puras y reflejan lo que
 * la base de datos ya aplica por su cuenta. Existen para poder mostrar el
 * calendario y las tablas sin ida y vuelta al servidor, y para poder probar la
 * lógica sin levantar Postgres.
 */

// ─── Ramas y edad ────────────────────────────────────────────────────────────

export type AgeBracket = Pick<Branch, 'id' | 'name' | 'min_age' | 'max_age'>;

/** Edad cumplida a una fecha dada. */
export function ageOn(birthdate: string, reference: Date = new Date()): number {
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  let age = reference.getFullYear() - born.getFullYear();
  const hadBirthday =
    reference.getMonth() > born.getMonth() ||
    (reference.getMonth() === born.getMonth() && reference.getDate() >= born.getDate());
  if (!hadBirthday) age -= 1;
  return Math.max(0, age);
}

/**
 * ¿La edad corresponde a la rama? Devuelve `null` si todo está bien o el
 * mensaje a mostrar si no.
 *
 * Los rangos se solapan a propósito (Webelos 10–11 y Scouts 11–14): un chico de
 * once años puede estar en cualquiera de las dos, y eso lo decide su grupo.
 */
export function branchAgeProblem(
  birthdate: string,
  branch: AgeBracket,
  reference: Date = new Date(),
): string | null {
  const age = ageOn(birthdate, reference);
  if (age >= branch.min_age && age <= branch.max_age) return null;
  return `${branch.name} admite de ${branch.min_age} a ${branch.max_age} años, y esta persona tiene ${age}.`;
}

export function branchAgeText(branch: AgeBracket): string {
  return branch.max_age >= 99
    ? `${branch.min_age} años en adelante`
    : `${branch.min_age} a ${branch.max_age} años`;
}

/** Ramas compatibles con una fecha de nacimiento, para sugerirlas en el formulario. */
export function branchesForAge(
  birthdate: string,
  branches: readonly AgeBracket[],
  reference: Date = new Date(),
): AgeBracket[] {
  const age = ageOn(birthdate, reference);
  return branches.filter((b) => age >= b.min_age && age <= b.max_age);
}

// ─── Generación del calendario ───────────────────────────────────────────────

export interface PlannedCompetition {
  type: ScheduleType;
  label: string;
  /** Minutos transcurridos desde la hora de inicio de la jornada. */
  offsetMinutes: number;
  teamAId?: string;
  teamBId?: string;
  participantIds?: string[];
}

/**
 * Todos contra todos: cada equipo se enfrenta una vez con cada uno de los demás.
 * Con n equipos salen n·(n−1)/2 partidos, encadenados por el intervalo dado.
 */
export function roundRobin(teamIds: readonly string[], intervalMinutes = 45): PlannedCompetition[] {
  const out: PlannedCompetition[] = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      out.push({
        type: 'match',
        label: `Partido ${out.length + 1}`,
        offsetMinutes: out.length * intervalMinutes,
        teamAId: teamIds[i],
        teamBId: teamIds[j],
      });
    }
  }
  return out;
}

/** Reparte a los inscritos en tandas del tamaño que admite el deporte. */
export function sessionsFor(
  participantIds: readonly string[],
  capacity: number,
  intervalMinutes = 45,
): PlannedCompetition[] {
  const size = Math.max(1, Math.floor(capacity));
  const out: PlannedCompetition[] = [];
  for (let i = 0; i < participantIds.length; i += size) {
    out.push({
      type: 'session',
      label: `Sesión ${out.length + 1}`,
      offsetMinutes: out.length * intervalMinutes,
      participantIds: participantIds.slice(i, i + size),
    });
  }
  return out;
}

export function planCompetitions(
  sport: Pick<Sport, 'type' | 'session_capacity'>,
  entrants: readonly string[],
  intervalMinutes = 45,
): PlannedCompetition[] {
  return sport.type === 'group'
    ? roundRobin(entrants, intervalMinutes)
    : sessionsFor(entrants, sport.session_capacity, intervalMinutes);
}

/** Hora de una competencia dentro de la jornada, en formato `HH:MM`. */
export function slotTime(startTime: string, offsetMinutes: number): string {
  const [h = 0, m = 0] = startTime.split(':').map(Number);
  const total = h * 60 + m + offsetMinutes;
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ─── Resultados ──────────────────────────────────────────────────────────────

export interface SessionEntry {
  participantId: string;
  value: number | null;
  disqualified: boolean;
}

export interface RankedEntry extends SessionEntry {
  /** `null` para descalificados y para quien no tiene marca registrada. */
  rank: number | null;
}

/**
 * Ordena las marcas de una sesión.
 *
 * Descalificados y marcas vacías quedan sin puesto en lugar de ir al final con
 * un número: aparecer como «último» y no aparecer clasificado no son lo mismo.
 */
export function rankSession(
  entries: readonly SessionEntry[],
  order: ResultOrder,
): RankedEntry[] {
  const eligible = entries
    .filter((e) => !e.disqualified && e.value !== null && Number.isFinite(e.value))
    .sort((a, b) => (order === 'asc' ? a.value! - b.value! : b.value! - a.value!));

  const positions = new Map<string, number>();
  eligible.forEach((entry, index) => positions.set(entry.participantId, index + 1));

  return entries.map((entry) => ({
    ...entry,
    rank: positions.get(entry.participantId) ?? null,
  }));
}

/** Mejor marca de una persona entre varias sesiones, según el sentido del deporte. */
export function bestMark(values: readonly number[], order: ResultOrder): number | null {
  const usable = values.filter((v) => Number.isFinite(v));
  if (!usable.length) return null;
  return order === 'asc' ? Math.min(...usable) : Math.max(...usable);
}

// ─── Tabla de posiciones ─────────────────────────────────────────────────────

export interface MatchResult {
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Tabla de posiciones clásica: 3 puntos por victoria, 1 por empate.
 * Desempata por diferencia y luego por anotados, como en la mayoría de torneos.
 */
export function buildStandings(matches: readonly MatchResult[]): StandingRow[] {
  const table = new Map<string, StandingRow>();

  const row = (teamId: string): StandingRow => {
    let existing = table.get(teamId);
    if (!existing) {
      existing = {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
      table.set(teamId, existing);
    }
    return existing;
  };

  for (const match of matches) {
    const a = row(match.teamAId);
    const b = row(match.teamBId);

    a.played += 1;
    b.played += 1;
    a.goalsFor += match.scoreA;
    a.goalsAgainst += match.scoreB;
    b.goalsFor += match.scoreB;
    b.goalsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      a.won += 1;
      a.points += 3;
      b.lost += 1;
    } else if (match.scoreB > match.scoreA) {
      b.won += 1;
      b.points += 3;
      a.lost += 1;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }
  }

  for (const entry of table.values()) {
    entry.goalDifference = entry.goalsFor - entry.goalsAgainst;
  }

  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor,
  );
}

// ─── Formato ─────────────────────────────────────────────────────────────────

export function formatCompetitionDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parsed);
}

/** `14:30:00` → `14:30`. Postgres devuelve la hora con segundos. */
export function shortTime(time: string): string {
  return time.slice(0, 5);
}
