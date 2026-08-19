import { z } from 'zod';

/**
 * Esquemas de validación compartidos entre formularios de cliente y Server
 * Actions. Un único origen para las reglas evita que el navegador acepte algo
 * que el servidor luego rechace.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} debe tener al menos ${min} caracteres.`)
    .max(max, `${label} no puede superar ${max} caracteres.`);

const optionalText = (max: number) => z.string().trim().max(max).optional().default('');

/** Teléfono colombiano: 7 dígitos (fijo) o 10 (celular), con separadores libres. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\s-]{7,20}$/, 'Escribe un teléfono válido.')
  .transform((v) => v.replace(/\s+/g, ' '));

export const documentSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9.-]{3,20}$/, 'El documento solo admite letras, números, puntos y guiones.');

export const documentTypeSchema = z.enum(['RC', 'TI', 'CC', 'CE', 'PA', 'PEP']);
export const genderSchema = z.enum(['F', 'M', 'O']);

// ─── Registro y acceso ───────────────────────────────────────────────────────

export const registerGroupSchema = z.object({
  name: trimmed(3, 120, 'El nombre del grupo'),
  city: trimmed(2, 80, 'La ciudad'),
  department: optionalText(80),
  leaderName: trimmed(3, 120, 'El nombre del responsable'),
  leaderDocument: documentSchema,
  leaderEmail: z.email('Escribe un correo válido.').toLowerCase(),
  leaderPhone: phoneSchema,
  notes: optionalText(500),
  // Casilla de tratamiento de datos: obligatoria por habeas data (Ley 1581).
  acceptsTerms: z.literal(true, {
    error: 'Debes autorizar el tratamiento de datos para continuar.',
  }),
});

export type RegisterGroupInput = z.infer<typeof registerGroupSchema>;

/**
 * Alta de un grupo hecha por el administrador, sin pasar por el formulario
 * público. Mismos datos que el registro público, pero sin la casilla de
 * tratamiento de datos: quien la acepta es el responsable del grupo al
 * registrarse él mismo, no el administrador en su nombre.
 */
export const createGroupSchema = z.object({
  name: trimmed(3, 120, 'El nombre del grupo'),
  city: trimmed(2, 80, 'La ciudad'),
  department: optionalText(80),
  leaderName: trimmed(3, 120, 'El nombre del responsable'),
  leaderDocument: documentSchema,
  leaderEmail: z.email('Escribe un correo válido.').toLowerCase(),
  leaderPhone: phoneSchema,
  notes: optionalText(500),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const loginSchema = z.object({
  email: z.email('Escribe un correo válido.').toLowerCase(),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

/**
 * Contraseña nueva. El mínimo de 10 caracteres con variedad es deliberado: la
 * contraseña generada llega por correo y debe reemplazarse por una robusta.
 */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Usa al menos 10 caracteres.')
      .max(72, 'Máximo 72 caracteres.')
      .regex(/[a-z]/, 'Incluye al menos una letra minúscula.')
      .regex(/[A-Z]/, 'Incluye al menos una letra mayúscula.')
      .regex(/[0-9]/, 'Incluye al menos un número.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirm'],
  });

export const reviewGroupSchema = z.object({
  groupId: z.uuid(),
  decision: z.enum(['approve', 'reject']),
  reason: optionalText(500),
}).refine((v) => v.decision === 'approve' || v.reason.trim().length >= 5, {
  message: 'Explica al responsable por qué se rechaza la solicitud.',
  path: ['reason'],
});

// ─── Participantes ───────────────────────────────────────────────────────────

export const participantSchema = z.object({
  id: z.uuid().optional(),
  groupId: z.uuid(),
  docType: documentTypeSchema,
  document: documentSchema,
  firstNames: trimmed(2, 80, 'Los nombres'),
  lastNames: trimmed(2, 80, 'Los apellidos'),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
    .refine((v) => {
      const d = new Date(`${v}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d < new Date() && d > new Date('1950-01-01');
    }, 'La fecha de nacimiento no es válida.'),
  branchId: z.string().min(1, 'Selecciona una rama.'),
  gender: genderSchema.optional(),
  active: z.boolean().default(true),
  notes: optionalText(300),
});

export type ParticipantInput = z.infer<typeof participantSchema>;

// ─── Deportes ────────────────────────────────────────────────────────────────

export const sportSchema = z
  .object({
    id: z.uuid().optional(),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Usa solo minúsculas, números y guiones.')
      .min(2)
      .max(60),
    name: trimmed(2, 80, 'El nombre'),
    icon: z.string().trim().min(1).max(8).default('🏅'),
    type: z.enum(['individual', 'group']),
    description: optionalText(500),
    category: z.string().trim().max(40).default('Mixta'),
    teamSize: z.coerce.number().int().min(1).max(50),
    substitutes: z.coerce.number().int().min(0).max(20),
    maxTeamsPerGroup: z.coerce.number().int().min(1).max(20),
    maxSportsPerParticipant: z.coerce.number().int().min(1).max(20),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    // Vacío = hereda la tarifa general del tipo de deporte.
    fee: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
    allowIntergroup: z.boolean().default(true),
    maxExternal: z.coerce.number().int().min(0).max(50),
    branchIds: z.array(z.string()).min(1, 'Selecciona al menos una rama.'),
    active: z.boolean().default(true),
  })
  .refine((v) => v.type === 'group' || v.teamSize === 1, {
    message: 'Un deporte individual debe tener tamaño de equipo 1.',
    path: ['teamSize'],
  })
  .refine((v) => v.type === 'group' || v.substitutes === 0, {
    message: 'Un deporte individual no admite suplentes.',
    path: ['substitutes'],
  })
  .refine((v) => v.maxExternal <= v.teamSize, {
    message: 'Los integrantes externos no pueden superar el tamaño del equipo.',
    path: ['maxExternal'],
  });

export type SportInput = z.infer<typeof sportSchema>;

// ─── Equipos ─────────────────────────────────────────────────────────────────

export const teamSchema = z.object({
  id: z.uuid().optional(),
  sportId: z.uuid(),
  name: trimmed(3, 80, 'El nombre del equipo'),
  starters: z.array(z.uuid()).min(1, 'Selecciona al menos un titular.'),
  substitutes: z.array(z.uuid()).default([]),
  captainId: z.union([z.uuid(), z.literal('')]).optional(),
});

export type TeamInput = z.infer<typeof teamSchema>;

export const intergroupRequestSchema = z.object({
  teamId: z.uuid(),
  targetGroupId: z.uuid(),
  slots: z.coerce.number().int().min(1).max(20),
  message: optionalText(500),
});

export const intergroupProposalSchema = z.object({
  requestId: z.uuid(),
  participantIds: z.array(z.uuid()).min(1, 'Selecciona al menos un participante.'),
  note: optionalText(500),
});

// ─── Stands ──────────────────────────────────────────────────────────────────

export const standSchema = z.object({
  id: z.uuid().optional(),
  name: trimmed(3, 80, 'El nombre del stand'),
  responsible: trimmed(3, 120, 'El responsable'),
  document: z.union([documentSchema, z.literal('')]).optional().default(''),
  phone: phoneSchema,
  email: z.union([z.email('Correo inválido.').toLowerCase(), z.literal('')]).optional().default(''),
  products: trimmed(3, 500, 'Los productos'),
  description: optionalText(1000),
  needsPower: z.boolean().default(false),
  needsFurniture: z.boolean().default(false),
  notes: optionalText(500),
});

export type StandInput = z.infer<typeof standSchema>;

// ─── Pagos ───────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  payableType: z.enum(['team', 'individual', 'stand']),
  payableId: z.uuid(),
  concept: z.string().trim().min(3).max(200),
  expectedAmount: z.coerce.number().min(0),
  reportedAmount: z.coerce.number().min(1, 'Escribe el valor consignado.'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
    .refine((v) => new Date(`${v}T00:00:00`) <= new Date(), 'La fecha no puede ser futura.'),
  payerName: trimmed(3, 120, 'El nombre de quien pagó'),
  payerDocument: z.union([documentSchema, z.literal('')]).optional().default(''),
  originBank: optionalText(80),
  reference: z
    .string()
    .trim()
    .min(4, 'La referencia debe tener al menos 4 caracteres.')
    .max(60),
  notes: optionalText(500),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/** Un solo comprobante/referencia que cubre varios conceptos a la vez. */
export const bulkPaymentSchema = z.object({
  items: z
    .array(
      z.object({
        payableType: z.enum(['team', 'individual', 'stand']),
        payableId: z.uuid(),
        concept: z.string().trim().min(3).max(200),
        expectedAmount: z.coerce.number().min(0),
      }),
    )
    .min(2, 'Selecciona al menos dos conceptos para pagarlos juntos.'),
  reportedAmount: z.coerce.number().min(1, 'Escribe el valor consignado.'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD.')
    .refine((v) => new Date(`${v}T00:00:00`) <= new Date(), 'La fecha no puede ser futura.'),
  payerName: trimmed(3, 120, 'El nombre de quien pagó'),
  payerDocument: z.union([documentSchema, z.literal('')]).optional().default(''),
  originBank: optionalText(80),
  reference: z
    .string()
    .trim()
    .min(4, 'La referencia debe tener al menos 4 caracteres.')
    .max(60),
  notes: optionalText(500),
});

export type BulkPaymentInput = z.infer<typeof bulkPaymentSchema>;

export const reviewPaymentSchema = z
  .object({
    paymentId: z.uuid(),
    status: z.enum(['approved', 'rejected', 'correction']),
    note: optionalText(1000),
  })
  .refine((v) => v.status === 'approved' || v.note.trim().length >= 5, {
    message: 'Indica el motivo con al menos 5 caracteres.',
    path: ['note'],
  });

// ─── Configuración ───────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  eventName: trimmed(3, 120, 'El nombre del evento'),
  eventStartsAt: z
    .string()
    .optional()
    .transform((value) => (value && value.trim() ? value.trim() : null)),
  individualFee: z.coerce.number().min(0),
  groupTeamFee: z.coerce.number().min(0),
  standFee: z.coerce.number().min(0),
  standLimit: z.coerce.number().int().min(0).max(1000),
  maxProofMb: z.coerce.number().int().min(1).max(50),
  registrationOpen: z.boolean(),
  bankLabel: trimmed(2, 80, 'El nombre de la cuenta'),
  bankName: trimmed(2, 80, 'La entidad'),
  bankAccountType: trimmed(2, 40, 'El tipo de cuenta'),
  bankAccountNumber: trimmed(4, 40, 'El número de cuenta'),
  bankNit: trimmed(4, 30, 'El NIT'),
  bankHolder: trimmed(3, 120, 'El titular'),
});

export const branchSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]+$/, 'Usa solo minúsculas, números, guiones y guiones bajos.')
    .min(2)
    .max(40),
  name: trimmed(2, 60, 'El nombre'),
  active: z.boolean().default(true),
});

// ─── Árbitros ────────────────────────────────────────────────────────────────

export const refereeSchema = z.object({
  // Vacío al crear; presente al editar uno existente.
  id: z.uuid().optional(),
  fullName: trimmed(3, 120, 'El nombre'),
  email: z.email('Escribe un correo válido.'),
  phone: optionalText(30),
  notes: optionalText(500),
  sportIds: z.array(z.uuid()).min(1, 'Asigna al menos un deporte.'),
  active: z.boolean().default(true),
});

export type RefereeInput = z.infer<typeof refereeSchema>;

// ─── Administradores ─────────────────────────────────────────────────────────

export const adminUserSchema = z.object({
  fullName: trimmed(3, 120, 'El nombre'),
  email: z.email('Escribe un correo válido.'),
  scope: z.enum(['full', 'limited']),
});

export type AdminUserInput = z.infer<typeof adminUserSchema>;

// ─── Programación ────────────────────────────────────────────────────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const generateScheduleSchema = z.object({
  sportId: z.uuid(),
  branchId: z.string().trim().min(2),
  date: z.string().regex(DATE, 'Escoge una fecha válida.'),
  time: z.string().regex(TIME, 'Escoge una hora válida.'),
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(5, 'Deja al menos cinco minutos entre competencias.')
    .max(600),
  venue: optionalText(120),
  refereeId: z.union([z.uuid(), z.literal('')]).optional(),
  // Permite armar el calendario sin esperar a que todos los pagos estén revisados.
  includePending: z.boolean().default(false),
});

export const manualScheduleSchema = z
  .object({
    id: z.uuid().optional(),
    sportId: z.uuid(),
    branchId: z.string().trim().min(2),
    label: trimmed(2, 80, 'El nombre de la competencia'),
    date: z.string().regex(DATE, 'Escoge una fecha válida.'),
    time: z.string().regex(TIME, 'Escoge una hora válida.'),
    venue: optionalText(120),
    refereeId: z.union([z.uuid(), z.literal('')]).optional(),
    type: z.enum(['match', 'session']),
    teamAId: z.union([z.uuid(), z.literal('')]).optional(),
    teamBId: z.union([z.uuid(), z.literal('')]).optional(),
    participantIds: z.array(z.uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'match') {
      if (!value.teamAId || !value.teamBId) {
        ctx.addIssue({ code: 'custom', path: ['teamAId'], message: 'Escoge los dos equipos.' });
      } else if (value.teamAId === value.teamBId) {
        ctx.addIssue({
          code: 'custom',
          path: ['teamBId'],
          message: 'Un equipo no puede enfrentarse a sí mismo.',
        });
      }
    } else if (!value.participantIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['participantIds'],
        message: 'Escoge al menos un participante.',
      });
    }
  });

// ─── Resultados ──────────────────────────────────────────────────────────────

export const matchResultSchema = z.object({
  scheduleId: z.uuid(),
  scoreA: z.coerce.number().int().min(0).max(999),
  scoreB: z.coerce.number().int().min(0).max(999),
  notes: optionalText(500),
  publish: z.boolean().default(false),
});

export const sessionResultSchema = z.object({
  scheduleId: z.uuid(),
  entries: z
    .array(
      z.object({
        participantId: z.uuid(),
        // Vacío = sin marca todavía. No es lo mismo que un cero.
        value: z.union([z.coerce.number(), z.literal('')]).optional(),
        disqualified: z.boolean().default(false),
      }),
    )
    .default([]),
  notes: optionalText(500),
  publish: z.boolean().default(false),
});

// ─── Revisión de alianzas ────────────────────────────────────────────────────

export const reviewIntergroupSchema = z
  .object({
    requestId: z.uuid(),
    decision: z.enum(['approve', 'reject']),
    note: optionalText(500),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'reject' && !value.note.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Explica por qué se rechaza: el motivo se envía a los dos grupos.',
      });
    }
  });

/** Extrae el primer mensaje de error de cada campo, listo para el formulario. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
