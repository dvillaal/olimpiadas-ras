import type { BracketFormat } from '@/types/database';

/**
 * Generación del "molde" de una llave: qué casillas existen (ronda, posición,
 * a qué casilla avanza el ganador) sin saber todavía qué equipo juega en cada
 * una. Espejo puro (sin base de datos) para poder probarlo sin Postgres; la
 * fuente de verdad final son las filas que crea `createBracketAction` en
 * `public.schedules`.
 *
 * `teamASlot`/`teamBSlot` son posiciones ABSTRACTAS (1..N). El sorteo (fase
 * siguiente, todavía no implementada) es lo que reparte al azar los equipos
 * reales en esas posiciones. Una casilla de ronda 2 en adelante no tiene
 * posición abstracta: se llena sola cuando se conoce el ganador de la ronda
 * anterior (`advancesTo`).
 */

export interface MoldSlot {
  roundNumber: number;
  roundName: string;
  /** Posición dentro de la ronda (o de la fecha, en liga). Empieza en 1. */
  bracketSlot: number;
  /** Ej. "Grupo A". Vacío fuera de la fase de grupos. */
  groupLabel: string;
  teamASlot: number | null;
  teamBSlot: number | null;
  /** Casilla con un solo lado real: el equipo pasa directo, no se juega. */
  isBye: boolean;
  advancesTo: { roundNumber: number; bracketSlot: number; side: 'a' | 'b' } | null;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function eliminationRoundName(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Cuartos de final';
    case 8:
      return 'Octavos de final';
    case 16:
      return 'Dieciseisavos de final';
    default:
      return `Ronda de ${matchesInRound * 2}`;
  }
}

/**
 * Eliminación directa. `bracketSize` (potencia de dos) puede ser mayor que
 * `teamCount`: la diferencia son los byes de la primera ronda, repartidos
 * automáticamente (no importa cuáles posiciones abstractas caigan como bye,
 * porque el sorteo asigna los equipos reales al azar de todas formas).
 */
export function generateEliminationMold(teamCount: number): MoldSlot[] {
  if (teamCount < 2) {
    throw new Error('Hacen falta al menos 2 equipos para armar una llave de eliminación.');
  }

  const bracketSize = nextPowerOfTwo(teamCount);
  const numRounds = Math.log2(bracketSize);
  const firstRoundMatches = bracketSize / 2;
  // De las `firstRoundMatches` casillas, `posA` siempre es real (hay al menos
  // tantos equipos como partidos). Los que sobran tras llenar `posA` ocupan
  // `posB` en orden; lo que falte queda como bye — repartido uno por partido,
  // nunca dos phantom en la misma casilla.
  const realPosBCount = teamCount - firstRoundMatches;
  const slots: MoldSlot[] = [];

  for (let round = 1; round <= numRounds; round++) {
    const matches = bracketSize / 2 ** round;
    const name = eliminationRoundName(matches);

    for (let i = 1; i <= matches; i++) {
      let teamASlot: number | null = null;
      let teamBSlot: number | null = null;
      let isBye = false;

      if (round === 1) {
        const isRealB = i <= realPosBCount;
        teamASlot = i;
        teamBSlot = isRealB ? firstRoundMatches + i : null;
        isBye = !isRealB;
      }

      const side: 'a' | 'b' = i % 2 === 1 ? 'a' : 'b';
      const advancesTo =
        round < numRounds
          ? { roundNumber: round + 1, bracketSlot: Math.ceil(i / 2), side }
          : null;

      slots.push({
        roundNumber: round,
        roundName: name,
        bracketSlot: i,
        groupLabel: '',
        teamASlot,
        teamBSlot,
        isBye,
        advancesTo,
      });
    }
  }

  return slots;
}

/**
 * Liga (todos contra todos), método del círculo. Con número impar de
 * equipos se agrega una posición fantasma que representa "descansa esta
 * fecha"; los cruces contra esa posición simplemente no generan casilla.
 */
export function generateRoundRobinMold(teamCount: number): MoldSlot[] {
  if (teamCount < 2) {
    throw new Error('Hacen falta al menos 2 equipos para armar una liga.');
  }

  const n = teamCount % 2 !== 0 ? teamCount + 1 : teamCount;
  const numRounds = n - 1;
  const half = n / 2;

  let positions = Array.from({ length: n }, (_, i) => i + 1);
  const slots: MoldSlot[] = [];

  for (let round = 1; round <= numRounds; round++) {
    let slotIndex = 1;

    for (let i = 0; i < half; i++) {
      const a = positions[i]!;
      const b = positions[n - 1 - i]!;
      if (a > teamCount || b > teamCount) continue; // uno de los dos descansa esta fecha

      slots.push({
        roundNumber: round,
        roundName: `Fecha ${round}`,
        bracketSlot: slotIndex++,
        groupLabel: '',
        teamASlot: a,
        teamBSlot: b,
        isBye: false,
        advancesTo: null,
      });
    }

    // Método del círculo: la posición 1 queda fija, el resto rota un lugar.
    positions = [positions[0]!, positions[n - 1]!, ...positions.slice(1, n - 1)];
  }

  return slots;
}

export interface GroupsKnockoutConfig {
  teamCount: number;
  groupSize: number;
  advancePerGroup: number;
}

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Fase de grupos (liga chica por grupo) + eliminación directa entre los
 * clasificados. La fase de eliminación se genera con las casillas de entrada
 * VACÍAS (sin `teamASlot`/`teamBSlot`): quién ocupa cada una depende de la
 * tabla de posiciones de cada grupo, algo que se decide por reglamento, no al
 * azar — el administrador las asigna a mano una vez termine la fase de
 * grupos.
 */
export function generateGroupsKnockoutMold(config: GroupsKnockoutConfig): MoldSlot[] {
  const { teamCount, groupSize, advancePerGroup } = config;

  if (groupSize < 2) {
    throw new Error('Cada grupo necesita al menos 2 equipos.');
  }
  if (advancePerGroup < 1) {
    throw new Error('Debe avanzar al menos un equipo por grupo.');
  }

  const numGroups = Math.ceil(teamCount / groupSize);
  if (numGroups < 2) {
    throw new Error(
      'Con ese tamaño de grupo solo sale un grupo; usa eliminación directa o liga en su lugar.',
    );
  }

  const groupSlots: MoldSlot[] = [];

  for (let g = 0; g < numGroups; g++) {
    const remaining = teamCount - g * groupSize;
    const sizeOfThisGroup = Math.min(groupSize, remaining);
    // Un grupo residual de un solo equipo no genera partidos: ese equipo
    // avanza directo (se resuelve a mano, igual que la fase de eliminación).
    if (sizeOfThisGroup < 2) continue;

    const fixtures = generateRoundRobinMold(sizeOfThisGroup);
    for (const fixture of fixtures) {
      groupSlots.push({ ...fixture, groupLabel: `Grupo ${GROUP_LETTERS[g] ?? g + 1}` });
    }
  }

  const maxGroupRound = groupSlots.reduce((max, s) => Math.max(max, s.roundNumber), 0);
  const knockoutTeams = numGroups * advancePerGroup;

  const knockoutSlots = generateEliminationMold(knockoutTeams).map((slot) => ({
    ...slot,
    roundNumber: slot.roundNumber + maxGroupRound,
    advancesTo: slot.advancesTo
      ? { ...slot.advancesTo, roundNumber: slot.advancesTo.roundNumber + maxGroupRound }
      : null,
    // Se limpia lo que generateEliminationMold pensó para sorteo al azar:
    // aquí la asignación es manual, por posición en el grupo.
    teamASlot: null,
    teamBSlot: null,
    isBye: false,
  }));

  return [...groupSlots, ...knockoutSlots];
}

export function generateMold(
  format: BracketFormat,
  config: { teamCount: number; groupSize?: number; advancePerGroup?: number },
): MoldSlot[] {
  switch (format) {
    case 'elimination':
      return generateEliminationMold(config.teamCount);
    case 'round_robin':
      return generateRoundRobinMold(config.teamCount);
    case 'groups_knockout':
      if (!config.groupSize || !config.advancePerGroup) {
        throw new Error('Falta el tamaño de grupo o cuántos avanzan por grupo.');
      }
      return generateGroupsKnockoutMold({
        teamCount: config.teamCount,
        groupSize: config.groupSize,
        advancePerGroup: config.advancePerGroup,
      });
  }
}
