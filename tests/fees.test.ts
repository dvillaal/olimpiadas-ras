import { describe, expect, it } from 'vitest';
import {
  formatCOP,
  individualRegistrationAmount,
  isEditableRegistration,
  requiresPayment,
  sportFee,
  type FeeSettings,
} from '@/lib/domain/fees';

const settings: FeeSettings = {
  individual_fee: 5000,
  group_team_fee: 30000,
  stand_fee: 50000,
};

describe('sportFee', () => {
  it('usa la tarifa general del tipo cuando el deporte no tiene una propia', () => {
    expect(sportFee({ fee: null, type: 'individual' }, settings)).toBe(5000);
    expect(sportFee({ fee: null, type: 'group' }, settings)).toBe(30000);
  });

  it('prefiere la tarifa propia del deporte', () => {
    expect(sportFee({ fee: 12000, type: 'individual' }, settings)).toBe(12000);
  });

  /**
   * Este es el error que traía el prototipo: `s.fee || general` trataba el 0
   * como ausencia de valor y cobraba la tarifa general en un deporte gratuito.
   */
  it('respeta una tarifa propia de 0 en lugar de caer a la general', () => {
    expect(sportFee({ fee: 0, type: 'individual' }, settings)).toBe(0);
    expect(sportFee({ fee: 0, type: 'group' }, settings)).toBe(0);
  });

  it('trata undefined igual que null', () => {
    expect(sportFee({ fee: undefined as unknown as null, type: 'group' }, settings)).toBe(30000);
  });
});

describe('individualRegistrationAmount', () => {
  it('multiplica la tarifa por el número de participantes', () => {
    expect(individualRegistrationAmount({ fee: null, type: 'individual' }, settings, 4)).toBe(20000);
  });

  it('devuelve 0 sin participantes', () => {
    expect(individualRegistrationAmount({ fee: null, type: 'individual' }, settings, 0)).toBe(0);
  });

  it('nunca devuelve un valor negativo', () => {
    expect(individualRegistrationAmount({ fee: null, type: 'individual' }, settings, -3)).toBe(0);
  });
});

describe('requiresPayment', () => {
  it('un concepto sin costo no pasa por el flujo de pago', () => {
    expect(requiresPayment(0)).toBe(false);
    expect(requiresPayment(-1)).toBe(false);
    expect(requiresPayment(1)).toBe(true);
  });
});

describe('isEditableRegistration', () => {
  it('permite editar borradores y devoluciones', () => {
    expect(isEditableRegistration('draft')).toBe(true);
    expect(isEditableRegistration('correction')).toBe(true);
    expect(isEditableRegistration('rejected')).toBe(true);
  });

  it('bloquea lo que ya está en revisión o en firme', () => {
    expect(isEditableRegistration('payment_pending')).toBe(false);
    expect(isEditableRegistration('confirmed')).toBe(false);
    expect(isEditableRegistration('cancelled')).toBe(false);
  });
});

describe('formatCOP', () => {
  it('formatea sin decimales', () => {
    // El separador puede ser un espacio normal o uno duro según la plataforma.
    expect(formatCOP(50000).replace(/\s/g, ' ')).toMatch(/^\$\s?50\.000$/);
  });

  it('tolera valores no finitos', () => {
    expect(formatCOP(Number.NaN)).toContain('0');
    expect(formatCOP(Number.POSITIVE_INFINITY)).toContain('0');
  });
});
