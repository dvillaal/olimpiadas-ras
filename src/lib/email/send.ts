import 'server-only';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Envío de correo transaccional.
 *
 * El envío nunca hace fallar la operación de negocio: si Resend está caído, la
 * aprobación del grupo se completa igual y el error queda en `email_log` para
 * que el administrador pueda reenviar la notificación desde el panel.
 */

export type EmailTemplate =
  | 'registro_recibido'
  | 'registro_aprobado'
  | 'registro_rechazado'
  | 'pago_aprobado'
  | 'pago_rechazado'
  | 'pago_correccion'
  | 'admin_nueva_solicitud';

export interface SendEmailInput {
  to: string;
  subject: string;
  template: EmailTemplate;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;

  let status = 'sent';
  let error: string | undefined;

  if (!resend || !from) {
    status = 'skipped';
    error = 'RESEND_API_KEY o EMAIL_FROM sin configurar.';
    // En desarrollo es útil ver el correo en la consola en lugar de perderlo.
    if (process.env.NODE_ENV !== 'production') {
      console.info(`\n📧 [${input.template}] → ${input.to}\n   ${input.subject}\n${input.text}\n`);
    }
  } else {
    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      if (sendError) {
        status = 'failed';
        error = sendError.message;
      }
    } catch (caught) {
      status = 'failed';
      error = caught instanceof Error ? caught.message : 'Error desconocido al enviar el correo.';
    }
  }

  // La bitácora se escribe con clave de servicio: el destinatario puede ser
  // alguien que aún no tiene cuenta.
  try {
    const admin = createAdminClient();
    await admin.from('email_log').insert({
      to_email: input.to,
      template: input.template,
      subject: input.subject,
      status,
      error: error ?? null,
    });
  } catch {
    // Si ni siquiera se puede registrar, no vale la pena tumbar la operación.
  }

  return { ok: status === 'sent', error };
}
