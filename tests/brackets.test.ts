import { describe, expect, it } from 'vitest';
import {
  generateEliminationMold,
  generateGroupsKnockoutMold,
  generateRoundRobinMold,
  nextPowerOfTwo,
} from '@/lib/domain/brackets';

describe('nextPowerOfTwo', () => {
  it('devuelve la potencia de dos más chica mayor o igual al número', () => {
    expect(nextPowerOfTwo(1)).toBe(1);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(6)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
});

describe('generateEliminationMold', () => {
  it('rechaza menos de 2 equipos', () => {
    expect(() => generateEliminationMold(1)).toThrow();
  });

  it('con una potencia de dos exacta no hay byes', () => {
    const slots = generateEliminationMold(8);
    expect(slots.filter((s) => s.roundNumber === 1)).toHaveLength(4);
    expect(slots.some((s) => s.isBye)).toBe(false);
    // 8 → 4 → 2 → 1: tres rondas.
    expect(Math.max(...slots.map((s) => s.roundNumber))).toBe(3);
    expect(slots.find((s) => s.roundNumber === 3)?.roundName).toBe('Final');
    expect(slots.find((s) => s.roundNumber === 2)?.roundName).toBe('Semifinal');
    expect(slots.find((s) => s.roundNumber === 1)?.roundName).toBe('Cuartos de final');
  });

  it('con 6 equipos arma un cuadro de 8 con 2 byes en primera ronda', () => {
    const slots = generateEliminationMold(6);
    const round1 = slots.filter((s) => s.roundNumber === 1);
    expect(round1).toHaveLength(4);
    expect(round1.filter((s) => s.isBye)).toHaveLength(2);
    // Cada bye tiene exactamente un lado real.
    for (const bye of round1.filter((s) => s.isBye)) {
      expect((bye.teamASlot === null) !== (bye.teamBSlot === null)).toBe(true);
    }
    // Los partidos normales tienen los dos lados.
    for (const match of round1.filter((s) => !s.isBye)) {
      expect(match.teamASlot).not.toBeNull();
      expect(match.teamBSlot).not.toBeNull();
    }
  });

  it('cada posición abstracta de la primera ronda aparece una sola vez', () => {
    const slots = generateEliminationMold(5);
    const round1 = slots.filter((s) => s.roundNumber === 1);
    const positions = round1.flatMap((s) => [s.teamASlot, s.teamBSlot]).filter((p) => p !== null);
    expect(new Set(positions).size).toBe(positions.length);
    expect(positions.sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5]);
  });

  it('las rondas encadenan bien: el ganador de cada partido avanza a una sola casilla', () => {
    const slots = generateEliminationMold(4);
    const round1 = slots.filter((s) => s.roundNumber === 1);
    const final = slots.filter((s) => s.roundNumber === 2);
    expect(final).toHaveLength(1);
    expect(final[0]?.advancesTo).toBeNull();
    for (const match of round1) {
      expect(match.advancesTo).toEqual({ roundNumber: 2, bracketSlot: 1, side: expect.any(String) });
    }
    // Un partido entra por el lado 'a' y el otro por el lado 'b'.
    const sides = round1.map((m) => m.advancesTo?.side).sort();
    expect(sides).toEqual(['a', 'b']);
  });
});

describe('generateRoundRobinMold', () => {
  it('rechaza menos de 2 equipos', () => {
    expect(() => generateRoundRobinMold(1)).toThrow();
  });

  it('con número par de equipos, todos juegan todas las fechas', () => {
    const slots = generateRoundRobinMold(4);
    expect(slots).toHaveLength(6); // C(4,2)
    const rounds = new Set(slots.map((s) => s.roundNumber));
    expect(rounds.size).toBe(3); // n-1 fechas
    for (const round of rounds) {
      expect(slots.filter((s) => s.roundNumber === round)).toHaveLength(2);
    }
  });

  it('con número impar, alguien descansa cada fecha', () => {
    const slots = generateRoundRobinMold(5);
    expect(slots).toHaveLength(10); // C(5,2)
    const rounds = [...new Set(slots.map((s) => s.roundNumber))];
    expect(rounds).toHaveLength(5); // n-1 con la posición fantasma (n=6)
    for (const round of rounds) {
      expect(slots.filter((s) => s.roundNumber === round)).toHaveLength(2);
    }
  });

  it('cada pareja de equipos se enfrenta exactamente una vez', () => {
    const slots = generateRoundRobinMold(6);
    const pairs = slots.map((s) => [s.teamASlot, s.teamBSlot].sort((a, b) => a! - b!).join('-'));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength(15); // C(6,2)
  });
});

describe('generateGroupsKnockoutMold', () => {
  it('rechaza un tamaño de grupo que deja un solo grupo', () => {
    expect(() =>
      generateGroupsKnockoutMold({ teamCount: 4, groupSize: 8, advancePerGroup: 2 }),
    ).toThrow();
  });

  it('arma los grupos y, aparte, el cuadro de eliminación vacío', () => {
    // 8 equipos, grupos de 4 (2 grupos), avanzan 2 de cada uno → 4 en la llave.
    const slots = generateGroupsKnockoutMold({ teamCount: 8, groupSize: 4, advancePerGroup: 2 });

    const groupSlots = slots.filter((s) => s.groupLabel !== '');
    expect(new Set(groupSlots.map((s) => s.groupLabel))).toEqual(new Set(['Grupo A', 'Grupo B']));
    // Cada grupo de 4 en liga todos-contra-todos: C(4,2) = 6 partidos.
    expect(groupSlots.filter((s) => s.groupLabel === 'Grupo A')).toHaveLength(6);
    expect(groupSlots.filter((s) => s.groupLabel === 'Grupo B')).toHaveLength(6);

    const knockoutSlots = slots.filter((s) => s.groupLabel === '');
    // 4 equipos en la llave → semifinal (2) + final (1) = 3 casillas.
    expect(knockoutSlots).toHaveLength(3);
    for (const slot of knockoutSlots) {
      expect(slot.teamASlot).toBeNull();
      expect(slot.teamBSlot).toBeNull();
    }
    // Las rondas de la llave no chocan con las de la fase de grupos.
    const maxGroupRound = Math.max(...groupSlots.map((s) => s.roundNumber));
    for (const slot of knockoutSlots) {
      expect(slot.roundNumber).toBeGreaterThan(maxGroupRound);
    }
  });
});
