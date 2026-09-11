import { describe, expect, it } from 'vitest';
import { sessionResultSchema, sportSchema } from '@/lib/validation/schemas';

/**
 * Regresión: `z.union([z.coerce.number(), z.literal('')])` no funciona como
 * "número, o si no vacío". `z.coerce.number()` convierte '' en 0 y esa rama
 * gana (Number('') === 0, así que pasa el `.min(0)`), de modo que el literal
 * vacío nunca se llegaba a evaluar. El fix es poner z.literal('') primero en
 * el union. Estas pruebas fijan el comportamiento correcto para los dos
 * campos que tenían este bug: la tarifa propia de un deporte y la marca de un
 * resultado de sesión.
 */

describe('sportSchema: tarifa propia vacía', () => {
  const base = {
    slug: 'ajedrez',
    name: 'Ajedrez',
    type: 'individual' as const,
    teamSize: '1',
    substitutes: '0',
    maxTeamsPerGroup: '1',
    maxSportsPerParticipant: '3',
    maxExternal: '0',
    branchIds: ['scouts'],
  };

  it('deja la tarifa vacía como cadena vacía, no como 0', () => {
    const result = sportSchema.parse({ ...base, fee: '' });
    expect(result.fee).toBe('');
  });

  it('sigue aceptando una tarifa propia real', () => {
    const result = sportSchema.parse({ ...base, fee: '15000' });
    expect(result.fee).toBe(15000);
  });

  it('acepta una tarifa propia de 0 (deporte gratuito) sin confundirla con "vacío"', () => {
    const result = sportSchema.parse({ ...base, fee: '0' });
    expect(result.fee).toBe(0);
  });
});

describe('sessionResultSchema: marca vacía ("sin resultado todavía")', () => {
  const base = { scheduleId: '11111111-1111-4111-8111-111111111111' };
  const participantId = '22222222-2222-4222-8222-222222222222';

  it('deja la marca vacía como cadena vacía, no como 0', () => {
    const result = sessionResultSchema.parse({
      ...base,
      entries: [{ participantId, value: '' }],
    });
    expect(result.entries[0]?.value).toBe('');
  });

  it('sigue aceptando una marca real de 0 (por ejemplo, una descalificación con 0 puntos)', () => {
    const result = sessionResultSchema.parse({
      ...base,
      entries: [{ participantId, value: '0' }],
    });
    expect(result.entries[0]?.value).toBe(0);
  });
});
