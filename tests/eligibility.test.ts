import { describe, expect, it } from 'vitest';
import {
  ageAt,
  isRosterComplete,
  isSportOpen,
  participantEligibility,
  remainingStandSlots,
  remainingTeamSlots,
  teamDisplayName,
  validateRoster,
  type EligibilityParticipant,
  type EligibilitySport,
  type RosterEntry,
} from '@/lib/domain/eligibility';

const sport: EligibilitySport = {
  id: 's1',
  name: 'Fútbol',
  type: 'group',
  team_size: 5,
  substitutes: 2,
  max_teams_per_group: 2,
  max_sports_per_participant: 3,
  allow_intergroup: true,
  max_external: 2,
  active: true,
  deadline: '2026-12-01',
};

function participant(id: string, groupId = 'g1', branch = 'tropa'): EligibilityParticipant {
  return {
    id,
    group_id: groupId,
    branch_id: branch,
    active: true,
    full_name: `Participante ${id}`,
    birthdate: '2010-05-20',
  };
}

function roster(ids: string[], role: 'starter' | 'substitute' = 'starter', groupId = 'g1'): RosterEntry[] {
  return ids.map((id) => ({ participant: participant(id, groupId), role }));
}

describe('ageAt', () => {
  it('calcula la edad cumplida', () => {
    expect(ageAt('2010-05-20', new Date('2026-05-20T12:00:00'))).toBe(16);
  });

  it('no cuenta el año si aún no llega el cumpleaños', () => {
    expect(ageAt('2010-05-21', new Date('2026-05-20T12:00:00'))).toBe(15);
  });

  it('devuelve 0 ante una fecha inválida', () => {
    expect(ageAt('no-es-fecha')).toBe(0);
  });
});

describe('isSportOpen', () => {
  it('cierra un deporte inactivo aunque no tenga fecha límite', () => {
    expect(isSportOpen({ active: false, deadline: null })).toBe(false);
  });

  it('deja abierto un deporte sin fecha límite', () => {
    expect(isSportOpen({ active: true, deadline: null })).toBe(true);
  });

  it('cierra el deporte pasada la fecha', () => {
    expect(isSportOpen({ active: true, deadline: '2026-01-01' }, new Date('2026-08-06'))).toBe(false);
  });

  it('el último día todavía cuenta como abierto', () => {
    expect(
      isSportOpen({ active: true, deadline: '2026-08-06' }, new Date('2026-08-06T10:00:00')),
    ).toBe(true);
  });
});

describe('participantEligibility', () => {
  it('acepta a quien cumple todo', () => {
    expect(participantEligibility(participant('p1'), sport, ['tropa'], 0)).toBeNull();
  });

  it('rechaza a quien está inactivo', () => {
    const inactive = { ...participant('p1'), active: false };
    expect(participantEligibility(inactive, sport, ['tropa'], 0)).toContain('inactivo');
  });

  it('rechaza una rama no habilitada', () => {
    expect(participantEligibility(participant('p1'), sport, ['rovers'], 0)).toContain('rama');
  });

  it('rechaza a quien ya alcanzó el tope de deportes', () => {
    expect(participantEligibility(participant('p1'), sport, ['tropa'], 3)).toContain('máximo');
  });
});

describe('validateRoster', () => {
  it('acepta una alineación válida', () => {
    expect(validateRoster(roster(['1', '2', '3', '4', '5']), sport, 'g1', null)).toEqual([]);
  });

  it('detecta exceso de titulares', () => {
    const problems = validateRoster(roster(['1', '2', '3', '4', '5', '6']), sport, 'g1', null);
    expect(problems.map((p) => p.code)).toContain('too_many_starters');
  });

  it('detecta exceso de suplentes', () => {
    const entries = [...roster(['1', '2', '3', '4', '5']), ...roster(['6', '7', '8'], 'substitute')];
    const problems = validateRoster(entries, sport, 'g1', null);
    expect(problems.map((p) => p.code)).toContain('too_many_substitutes');
  });

  it('detecta a la misma persona repetida', () => {
    const entries = [...roster(['1', '2', '3']), ...roster(['1'], 'substitute')];
    const problems = validateRoster(entries, sport, 'g1', null);
    expect(problems.map((p) => p.code)).toContain('duplicate');
  });

  it('detecta exceso de integrantes externos', () => {
    const entries = [...roster(['1', '2']), ...roster(['3', '4', '5'], 'starter', 'g2')];
    const problems = validateRoster(entries, sport, 'g1', null);
    expect(problems.map((p) => p.code)).toContain('too_many_external');
  });

  it('rechaza externos cuando el deporte no los permite', () => {
    const closed = { ...sport, allow_intergroup: false, max_external: 0 };
    const entries = [...roster(['1', '2']), ...roster(['3'], 'starter', 'g2')];
    const problems = validateRoster(entries, closed, 'g1', null);
    expect(problems.map((p) => p.code)).toContain('external_not_allowed');
  });

  it('exige que el capitán sea titular', () => {
    const entries = [...roster(['1', '2', '3', '4', '5']), ...roster(['9'], 'substitute')];
    const problems = validateRoster(entries, sport, 'g1', '9');
    expect(problems.map((p) => p.code)).toContain('captain_not_starter');
  });

  it('devuelve todos los problemas a la vez, no solo el primero', () => {
    const entries = [
      ...roster(['1', '2', '3', '4', '5', '6']),
      ...roster(['7', '8', '9'], 'substitute'),
    ];
    const problems = validateRoster(entries, sport, 'g1', null);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});

describe('isRosterComplete', () => {
  it('exige exactamente el número de titulares', () => {
    expect(isRosterComplete(roster(['1', '2', '3', '4']), sport)).toBe(false);
    expect(isRosterComplete(roster(['1', '2', '3', '4', '5']), sport)).toBe(true);
  });

  it('los suplentes no cuentan para completar el equipo', () => {
    const entries = [...roster(['1', '2', '3', '4']), ...roster(['5'], 'substitute')];
    expect(isRosterComplete(entries, sport)).toBe(false);
  });
});

describe('cupos', () => {
  it('descuenta los equipos ya creados', () => {
    expect(remainingTeamSlots(sport, 0)).toBe(2);
    expect(remainingTeamSlots(sport, 2)).toBe(0);
    expect(remainingTeamSlots(sport, 5)).toBe(0);
  });

  it('nunca reporta cupos de stand negativos', () => {
    expect(remainingStandSlots(30, 10)).toBe(20);
    expect(remainingStandSlots(30, 35)).toBe(0);
  });
});

describe('teamDisplayName', () => {
  it('combina grupo, país y rama', () => {
    expect(teamDisplayName('Grupo Scout 12', 'Colombia', 'Scouts')).toBe(
      'Grupo Scout 12 · Colombia · Scouts',
    );
  });

  it('omite el país cuando el grupo todavía no lo escogió', () => {
    expect(teamDisplayName('Grupo Scout 12', null, 'Scouts')).toBe('Grupo Scout 12 · Scouts');
  });

  it('agrega un número a partir del segundo equipo en el mismo deporte', () => {
    expect(teamDisplayName('Grupo Scout 12', 'Colombia', 'Scouts', 0)).toBe(
      'Grupo Scout 12 · Colombia · Scouts',
    );
    expect(teamDisplayName('Grupo Scout 12', 'Colombia', 'Scouts', 1)).toBe(
      'Grupo Scout 12 · Colombia · Scouts 2',
    );
    expect(teamDisplayName('Grupo Scout 12', 'Colombia', 'Scouts', 2)).toBe(
      'Grupo Scout 12 · Colombia · Scouts 3',
    );
  });
});
