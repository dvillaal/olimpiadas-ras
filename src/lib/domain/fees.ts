import type { PayableType, RegistrationStatus, Settings, Sport } from '@/types/database';

/**
 * Reglas de tarifas.
 *
 * Espejo exacto de `public.sport_effective_fee` en la base de datos. La copia
 * existe para poder mostrar totales sin ida y vuelta al servidor; la fuente de
 * verdad para cobrar siempre es Postgres.
 */

export type FeeSettings = Pick<Settings, 'individual_fee' | 'group_team_fee' | 'stand_fee'>;
export type FeeSport = Pick<Sport, 'fee' | 'type'>;

/**
 * Tarifa efectiva de un deporte: la propia si está definida, si no la general
 * del tipo correspondiente.
 *
 * Ojo con `fee: 0`: es un valor legítimo (deporte gratuito) y NO debe caer al
 * valor general. Por eso se compara contra null/undefined y no por veracidad.
 */
export function sportFee(sport: FeeSport, settings: FeeSettings): number {
  if (sport.fee !== null && sport.fee !== undefined) return sport.fee;
  return sport.type === 'individual' ? settings.individual_fee : settings.group_team_fee;
}

/** Valor de una inscripción individual: tarifa × número de participantes. */
export function individualRegistrationAmount(
  sport: FeeSport,
  settings: FeeSettings,
  participantCount: number,
): number {
  return sportFee(sport, settings) * Math.max(0, participantCount);
}

/**
 * ¿Este concepto requiere pago?
 *
 * En el prototipo la tarifa de equipos grupales venía en 0 y la interfaz
 * ofrecía igualmente "Registrar pago" por $0. Aquí un concepto sin costo se
 * salta el flujo de pago por completo.
 */
export function requiresPayment(amount: number): boolean {
  return amount > 0;
}

/** Estados de inscripción que todavía ocupan cupo y bloquean cambios. */
const ACTIVE_STATUSES: readonly RegistrationStatus[] = [
  'draft',
  'payment_pending',
  'correction',
  'confirmed',
];

export function isActiveRegistration(status: RegistrationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Una inscripción solo se edita mientras el pago no esté en revisión ni en firme. */
export function isEditableRegistration(status: RegistrationStatus): boolean {
  return status === 'draft' || status === 'correction' || status === 'rejected';
}

export interface PendingConcept {
  payableType: PayableType;
  payableId: string;
  label: string;
  amount: number;
}

/** Formato de moneda colombiana, sin decimales. */
export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
