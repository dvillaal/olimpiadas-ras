import type {
  GroupStatus,
  IntergroupStatus,
  PaymentStatus,
  RegistrationStatus,
  ScheduleStatus,
} from '@/types/database';

/** Paleta de estados, compartida por insignias y tarjetas. */
export type BadgeTone = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray';

export interface StatusView {
  label: string;
  tone: BadgeTone;
  /** Explicación breve de qué debe hacer el usuario a continuación. */
  hint?: string;
}

const REGISTRATION: Record<RegistrationStatus, StatusView> = {
  draft: { label: 'Borrador', tone: 'yellow', hint: 'Todavía puedes editarla.' },
  payment_pending: {
    label: 'Pago en revisión',
    tone: 'blue',
    hint: 'La organización está verificando el comprobante.',
  },
  correction: {
    label: 'Requiere corrección',
    tone: 'orange',
    hint: 'Revisa la observación y vuelve a enviar el pago.',
  },
  rejected: { label: 'Rechazada', tone: 'red' },
  confirmed: { label: 'Confirmada', tone: 'green' },
  cancelled: { label: 'Anulada', tone: 'gray' },
};

const PAYMENT: Record<PaymentStatus, StatusView> = {
  sent: { label: 'Enviado', tone: 'blue', hint: 'Pendiente de revisión.' },
  correction: { label: 'Requiere corrección', tone: 'orange' },
  rejected: { label: 'Rechazado', tone: 'red' },
  approved: { label: 'Aprobado', tone: 'green' },
};

const GROUP: Record<GroupStatus, StatusView> = {
  pending: {
    label: 'Pendiente de aprobación',
    tone: 'yellow',
    hint: 'La organización revisará tu solicitud.',
  },
  approved: { label: 'Aprobado', tone: 'green' },
  rejected: { label: 'Rechazado', tone: 'red' },
  suspended: { label: 'Suspendido', tone: 'gray' },
};

const INTERGROUP: Record<IntergroupStatus, StatusView> = {
  pending: { label: 'Esperando respuesta', tone: 'yellow' },
  proposed: { label: 'Participantes propuestos', tone: 'blue' },
  accepted: { label: 'Aceptada por el grupo', tone: 'blue' },
  admin_review: {
    label: 'Revisión de la organización',
    tone: 'orange',
    hint: 'El equipo podrá pagar cuando se apruebe la alianza.',
  },
  admin_approved: {
    label: 'Alianza aprobada',
    tone: 'green',
    hint: 'Ya pueden continuar con el pago del equipo.',
  },
  admin_rejected: {
    label: 'Rechazada por la organización',
    tone: 'red',
    hint: 'Los participantes prestados salieron del equipo.',
  },
  rejected: { label: 'Rechazada', tone: 'red' },
  cancelled: { label: 'Cancelada', tone: 'gray' },
};

const SCHEDULE: Record<ScheduleStatus, StatusView> = {
  scheduled: { label: 'Programada', tone: 'blue' },
  in_progress: { label: 'Resultado en borrador', tone: 'yellow' },
  finished: { label: 'Finalizada', tone: 'green' },
  cancelled: { label: 'Cancelada', tone: 'gray' },
};

const FALLBACK: StatusView = { label: 'Sin estado', tone: 'gray' };

export function registrationStatusView(status: RegistrationStatus): StatusView {
  return REGISTRATION[status] ?? FALLBACK;
}

export function paymentStatusView(status: PaymentStatus): StatusView {
  return PAYMENT[status] ?? FALLBACK;
}

export function groupStatusView(status: GroupStatus): StatusView {
  return GROUP[status] ?? FALLBACK;
}

export function intergroupStatusView(status: IntergroupStatus): StatusView {
  return INTERGROUP[status] ?? FALLBACK;
}

export function scheduleStatusView(status: ScheduleStatus): StatusView {
  return SCHEDULE[status] ?? FALLBACK;
}

/**
 * Una alianza sigue viva mientras no la hayan rechazado ni cancelado. Se usa
 * para decidir si el equipo puede seguir contando con los prestados.
 */
export function isIntergroupActive(status: IntergroupStatus): boolean {
  return !['rejected', 'cancelled', 'admin_rejected'].includes(status);
}

/**
 * Estado en el que queda una inscripción tras revisar su pago.
 * Réplica de la cascada de `public.review_payment`.
 */
export function registrationStatusAfterReview(payment: PaymentStatus): RegistrationStatus {
  switch (payment) {
    case 'approved':
      return 'confirmed';
    case 'rejected':
      return 'rejected';
    case 'correction':
      return 'correction';
    default:
      return 'payment_pending';
  }
}

/** Progreso de inscripción de un grupo, para la barra del panel. */
export interface GroupProgress {
  steps: { key: string; label: string; done: boolean }[];
  completed: number;
  total: number;
  percent: number;
}

export function computeGroupProgress(input: {
  hasCountry: boolean;
  hasParticipants: boolean;
  hasRegistrations: boolean;
  allPaymentsSettled: boolean;
}): GroupProgress {
  const steps = [
    { key: 'country', label: 'País escogido', done: input.hasCountry },
    { key: 'participants', label: 'Participantes cargados', done: input.hasParticipants },
    { key: 'registrations', label: 'Inscripciones creadas', done: input.hasRegistrations },
    { key: 'payments', label: 'Pagos al día', done: input.allPaymentsSettled },
  ];
  const completed = steps.filter((s) => s.done).length;
  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
  };
}
