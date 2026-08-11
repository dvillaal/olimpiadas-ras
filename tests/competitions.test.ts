import { describe, expect, it } from 'vitest';
import {
  ageOn,
  bestMark,
  branchAgeProblem,
  branchAgeText,
  branchesForAge,
  buildStandings,
  planCompetitions,
  rankSession,
  roundRobin,
  sessionsFor,
  slotTime,
} from '@/lib/domain/competitions';

/**
 * Reglas de competencia. Cada bloque corresponde a algo que en el prototipo
 * vivía suelto en el navegador y que aquí queremos fijar por escrito.
 */

// ─── Ramas y edad ────────────────────────────────────────────────────────────

const SCOUTS = { id: 'scouts', name: 'Scouts', min_age: 11, max_age: 14 };
const WEBELOS = { id: 'webelos', name: 'Webelos', min_age: 10, max_age: 11 };
const ADULTOS = { id: 'adultos', name: 'Consejeros y Dirigentes', min_age: 21, max_age: 99 };

describe('ageOn', () => {
  it('no cuenta el cumpleaños que aún no ha llegado', () => {
    // Nace el 31 de diciembre; el 30 de diciembre todavía tiene 11.
    expect(ageOn('2014-12-31', new Date('2026-12-30T12:00:00'))).toBe(11);
    expect(ageOn('2014-12-31', new Date('2026-12-31T12:00:00'))).toBe(12);
  });

  it('devuelve 0 ante una fecha ilegible en lugar de NaN', () => {
    expect(ageOn('no-es-una-fecha')).toBe(0);
  });
});

describe('branchAgeProblem', () => {
  const hoy = new Date('2026-08-11T12:00:00');

  it('acepta una edad dentro del rango', () => {
    expect(branchAgeProblem('2013-01-01', SCOUTS, hoy)).toBeNull();
  });

  it('rechaza a quien se queda corto y dice por qué', () => {
    const problema = branchAgeProblem('2020-01-01', SCOUTS, hoy);
    expect(problema).toContain('Scouts');
    expect(problema).toContain('11 a 14');
  });

  it('rechaza a quien se pasa', () => {
    expect(branchAgeProblem('2000-01-01', SCOUTS, hoy)).not.toBeNull();
  });

  it('acepta los extremos del rango', () => {
    // Cumple 11 justo hoy, y cumple 14 justo hoy.
    expect(branchAgeProblem('2015-08-11', SCOUTS, hoy)).toBeNull();
    expect(branchAgeProblem('2012-08-11', SCOUTS, hoy)).toBeNull();
  });

  it('trata la rama de adultos como abierta por arriba', () => {
    expect(branchAgeProblem('1970-01-01', ADULTOS, hoy)).toBeNull();
  });
});

describe('branchesForAge', () => {
  it('devuelve las dos ramas cuando los rangos se solapan', () => {
    // A los once años caben Webelos (10–11) y Scouts (11–14): lo decide el grupo.
    const opciones = branchesForAge('2015-01-01', [WEBELOS, SCOUTS], new Date('2026-08-11'));
    expect(opciones.map((b) => b.id)).toEqual(['webelos', 'scouts']);
  });
});

describe('branchAgeText', () => {
  it('describe un rango cerrado', () => {
    expect(branchAgeText(SCOUTS)).toBe('11 a 14 años');
  });

  it('describe la rama de adultos sin techo', () => {
    expect(branchAgeText(ADULTOS)).toBe('21 años en adelante');
  });
});

// ─── Generación del calendario ───────────────────────────────────────────────

describe('roundRobin', () => {
  it('cruza a cada equipo con todos los demás una sola vez', () => {
    const partidos = roundRobin(['a', 'b', 'c', 'd']);
    // n·(n−1)/2 = 6
    expect(partidos).toHaveLength(6);

    const parejas = partidos.map((p) => [p.teamAId, p.teamBId].sort().join('-')).sort();
    expect(new Set(parejas).size).toBe(6);
    expect(parejas).toEqual(['a-b', 'a-c', 'a-d', 'b-c', 'b-d', 'c-d']);
  });

  it('nunca enfrenta a un equipo consigo mismo', () => {
    for (const partido of roundRobin(['a', 'b', 'c'])) {
      expect(partido.teamAId).not.toBe(partido.teamBId);
    }
  });

  it('encadena los partidos con el intervalo indicado', () => {
    const partidos = roundRobin(['a', 'b', 'c'], 30);
    expect(partidos.map((p) => p.offsetMinutes)).toEqual([0, 30, 60]);
  });

  it('no genera nada con menos de dos equipos', () => {
    expect(roundRobin([])).toHaveLength(0);
    expect(roundRobin(['a'])).toHaveLength(0);
  });
});

describe('sessionsFor', () => {
  it('reparte a los inscritos en tandas del tamaño del cupo', () => {
    const sesiones = sessionsFor(['1', '2', '3', '4', '5'], 2);
    expect(sesiones).toHaveLength(3);
    expect(sesiones[0]?.participantIds).toEqual(['1', '2']);
    // La última tanda queda incompleta, y está bien: nadie se queda fuera.
    expect(sesiones[2]?.participantIds).toEqual(['5']);
  });

  it('mete a todos en una sola tanda si el cupo alcanza', () => {
    expect(sessionsFor(['1', '2', '3'], 8)).toHaveLength(1);
  });

  it('no pierde a nadie', () => {
    const gente = Array.from({ length: 17 }, (_, i) => String(i));
    const todos = sessionsFor(gente, 5).flatMap((s) => s.participantIds ?? []);
    expect(todos).toEqual(gente);
  });

  it('trata un cupo inválido como uno por tanda en vez de dividir por cero', () => {
    expect(sessionsFor(['1', '2'], 0)).toHaveLength(2);
  });
});

describe('planCompetitions', () => {
  it('usa todos contra todos en deportes grupales', () => {
    const plan = planCompetitions({ type: 'group', session_capacity: 8 }, ['a', 'b', 'c']);
    expect(plan).toHaveLength(3);
    expect(plan.every((p) => p.type === 'match')).toBe(true);
  });

  it('usa tandas en deportes individuales', () => {
    const plan = planCompetitions({ type: 'individual', session_capacity: 2 }, ['a', 'b', 'c']);
    expect(plan).toHaveLength(2);
    expect(plan.every((p) => p.type === 'session')).toBe(true);
  });
});

describe('slotTime', () => {
  it('avanza la hora según el desplazamiento', () => {
    expect(slotTime('08:00', 0)).toBe('08:00');
    expect(slotTime('08:00', 45)).toBe('08:45');
    expect(slotTime('08:30', 45)).toBe('09:15');
  });

  it('da la vuelta al pasar de medianoche sin producir una hora imposible', () => {
    expect(slotTime('23:30', 60)).toBe('00:30');
  });
});

// ─── Resultados de sesión ────────────────────────────────────────────────────

describe('rankSession', () => {
  const entradas = [
    { participantId: 'a', value: 13.2, disqualified: false },
    { participantId: 'b', value: 12.1, disqualified: false },
    { participantId: 'c', value: 11.4, disqualified: true },
    { participantId: 'd', value: null, disqualified: false },
  ];

  it('gana el tiempo más bajo cuando el orden es ascendente', () => {
    const puestos = new Map(rankSession(entradas, 'asc').map((e) => [e.participantId, e.rank]));
    expect(puestos.get('b')).toBe(1);
    expect(puestos.get('a')).toBe(2);
  });

  it('gana el puntaje más alto cuando el orden es descendente', () => {
    const puestos = new Map(rankSession(entradas, 'desc').map((e) => [e.participantId, e.rank]));
    expect(puestos.get('a')).toBe(1);
    expect(puestos.get('b')).toBe(2);
  });

  it('deja sin puesto al descalificado, aunque tenga la mejor marca', () => {
    // «c» hizo 11.4, el mejor tiempo, pero fue descalificado.
    const puestos = new Map(rankSession(entradas, 'asc').map((e) => [e.participantId, e.rank]));
    expect(puestos.get('c')).toBeNull();
  });

  it('deja sin puesto a quien no tiene marca, en vez de contarlo como cero', () => {
    const puestos = new Map(rankSession(entradas, 'asc').map((e) => [e.participantId, e.rank]));
    expect(puestos.get('d')).toBeNull();
  });

  it('conserva a todos en el resultado, con puesto o sin él', () => {
    expect(rankSession(entradas, 'asc')).toHaveLength(4);
  });
});

describe('bestMark', () => {
  it('toma la marca más baja en pruebas de tiempo', () => {
    expect(bestMark([13.2, 12.1, 12.9], 'asc')).toBe(12.1);
  });

  it('toma la marca más alta en pruebas de puntaje', () => {
    expect(bestMark([3, 7, 5], 'desc')).toBe(7);
  });

  it('devuelve null si no hay marcas', () => {
    expect(bestMark([], 'asc')).toBeNull();
  });
});

// ─── Tabla de posiciones ─────────────────────────────────────────────────────

describe('buildStandings', () => {
  it('da tres puntos por victoria y uno por empate', () => {
    const tabla = buildStandings([
      { teamAId: 'a', teamBId: 'b', scoreA: 2, scoreB: 1 },
      { teamAId: 'a', teamBId: 'c', scoreA: 1, scoreB: 1 },
    ]);

    const a = tabla.find((r) => r.teamId === 'a');
    expect(a?.points).toBe(4);
    expect(a?.won).toBe(1);
    expect(a?.drawn).toBe(1);
    expect(a?.played).toBe(2);
  });

  it('contabiliza los goles de los dos lados del partido', () => {
    const tabla = buildStandings([{ teamAId: 'a', teamBId: 'b', scoreA: 3, scoreB: 1 }]);

    const a = tabla.find((r) => r.teamId === 'a');
    const b = tabla.find((r) => r.teamId === 'b');

    expect(a?.goalsFor).toBe(3);
    expect(a?.goalsAgainst).toBe(1);
    expect(a?.goalDifference).toBe(2);
    expect(b?.goalsFor).toBe(1);
    expect(b?.goalsAgainst).toBe(3);
    expect(b?.goalDifference).toBe(-2);
    expect(b?.lost).toBe(1);
  });

  it('desempata por diferencia de gol antes que por goles a favor', () => {
    // Los dos terminan con 3 puntos; «b» ganó por más diferencia.
    const tabla = buildStandings([
      { teamAId: 'a', teamBId: 'x', scoreA: 5, scoreB: 4 },
      { teamAId: 'b', teamBId: 'y', scoreA: 3, scoreB: 0 },
    ]);

    expect(tabla[0]?.teamId).toBe('b');
    expect(tabla[1]?.teamId).toBe('a');
  });

  it('desempata por goles a favor cuando puntos y diferencia coinciden', () => {
    const tabla = buildStandings([
      { teamAId: 'a', teamBId: 'x', scoreA: 5, scoreB: 4 },
      { teamAId: 'b', teamBId: 'y', scoreA: 1, scoreB: 0 },
    ]);

    expect(tabla[0]?.teamId).toBe('a');
  });

  it('ordena de mayor a menor puntaje', () => {
    const tabla = buildStandings([
      { teamAId: 'a', teamBId: 'b', scoreA: 0, scoreB: 3 },
      { teamAId: 'a', teamBId: 'c', scoreA: 0, scoreB: 1 },
    ]);

    expect(tabla.map((r) => r.teamId)).toEqual(['b', 'c', 'a']);
    expect(tabla.at(-1)?.points).toBe(0);
  });

  it('no inventa filas cuando no hay partidos', () => {
    expect(buildStandings([])).toEqual([]);
  });
});
