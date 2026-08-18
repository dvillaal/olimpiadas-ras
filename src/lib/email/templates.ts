import type { EmailTemplate } from './send';

/**
 * Plantillas de correo.
 *
 * HTML con estilos en línea y tablas: es lo único que renderizan de forma
 * consistente Gmail, Outlook y los clientes móviles. Cada plantilla trae
 * también su versión en texto plano.
 */

const BRAND = {
  green: '#15b680',
  navy: '#184349',
  gray: '#64748b',
  bg: '#f3f7f4',
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
  );
}

/** URL absoluta: los correos no pueden usar rutas relativas como /login/trofeo.png. */
function siteUrl(path = ''): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

function layout(options: { title: string; body: string; eventName: string; cta?: { label: string; url: string } }) {
  const cta = options.cta
    ? `<tr><td style="padding:8px 32px 32px">
         <a href="${options.cta.url}"
            style="display:inline-block;background:${BRAND.green};color:#ffffff;text-decoration:none;
                   padding:14px 26px;border-radius:12px;font-weight:700;font-size:15px">
           ${escapeHtml(options.cta.label)}
         </a>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:24px 12px;background:${BRAND.bg};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;
              box-shadow:0 8px 30px rgba(24,52,79,.08)">
  <tr><td style="background:${BRAND.green};padding:24px 32px;color:#ffffff">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">
      <img src="${siteUrl('/login/trofeo.png')}" alt="" width="14" height="14"
           style="vertical-align:middle;margin-right:4px;display:inline-block">${escapeHtml(options.eventName)}
    </div>
    <div style="font-size:22px;font-weight:800;margin-top:6px">${escapeHtml(options.title)}</div>
  </td></tr>
  <tr><td style="padding:28px 32px 8px;color:${BRAND.navy};font-size:15px;line-height:1.65">
    ${options.body}
  </td></tr>
  ${cta}
  <tr><td style="padding:20px 32px;border-top:1px solid #e7eeea;color:${BRAND.gray};font-size:12px;line-height:1.6">
    Este mensaje se generó automáticamente. Si no esperabas recibirlo, puedes ignorarlo.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  template: EmailTemplate;
}

// ─── Registro recibido ───────────────────────────────────────────────────────

export function registrationReceivedEmail(input: {
  eventName: string;
  groupName: string;
  leaderName: string;
}): RenderedEmail {
  const subject = `Recibimos la solicitud de ${input.groupName}`;
  return {
    template: 'registro_recibido',
    subject,
    html: layout({
      title: 'Solicitud recibida',
      eventName: input.eventName,
      body: `
        <p>Hola ${escapeHtml(input.leaderName)},</p>
        <p>Recibimos la solicitud de registro de <b>${escapeHtml(input.groupName)}</b> para las ${escapeHtml(input.eventName)}.</p>
        <p>La organización la revisará y te escribiremos a este mismo correo con la respuesta.
           Si es aprobada, en ese mensaje encontrarás los datos para ingresar al sistema.</p>
        <p style="color:${BRAND.gray}">No necesitas hacer nada más por ahora.</p>`,
    }),
    text: `Hola ${input.leaderName},

Recibimos la solicitud de registro de ${input.groupName} para las ${input.eventName}.

La organización la revisará y te escribiremos a este mismo correo con la respuesta. Si es aprobada, en ese mensaje encontrarás los datos para ingresar al sistema.

No necesitas hacer nada más por ahora.`,
  };
}

// ─── Registro aprobado ───────────────────────────────────────────────────────

export function registrationApprovedEmail(input: {
  eventName: string;
  groupName: string;
  groupCode: string;
  leaderName: string;
  email: string;
  password: string;
  loginUrl: string;
}): RenderedEmail {
  const subject = `${input.groupName} fue aprobado · datos de acceso`;
  return {
    template: 'registro_aprobado',
    subject,
    html: layout({
      title: '¡Tu grupo fue aprobado!',
      eventName: input.eventName,
      cta: { label: 'Ingresar al sistema', url: input.loginUrl },
      body: `
        <p>Hola ${escapeHtml(input.leaderName)},</p>
        <p><b>${escapeHtml(input.groupName)}</b> quedó registrado con el código
           <b style="font-family:ui-monospace,monospace">${escapeHtml(input.groupCode)}</b>.</p>
        <p>Estos son tus datos de acceso:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="background:${BRAND.bg};border-radius:12px;margin:8px 0 4px">
          <tr><td style="padding:16px 18px">
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Usuario</div>
            <div style="font-weight:700;font-size:16px;margin-bottom:12px">${escapeHtml(input.email)}</div>
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Contraseña temporal</div>
            <div style="font-weight:700;font-size:20px;font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.05em">${escapeHtml(input.password)}</div>
          </td></tr>
        </table>
        <p style="background:#fff4e0;border-left:3px solid #a86508;padding:12px 14px;border-radius:8px;color:#7a4a06">
          <b>Cambia esta contraseña en tu primer ingreso.</b> El sistema te lo pedirá
          automáticamente. No compartas este correo con nadie.
        </p>
        <p>Al entrar podrás escoger el país que representarán, cargar a tus participantes,
           inscribirlos en los deportes y registrar los pagos.</p>`,
    }),
    text: `Hola ${input.leaderName},

${input.groupName} quedó registrado con el código ${input.groupCode}.

Datos de acceso:
  Usuario: ${input.email}
  Contraseña temporal: ${input.password}

IMPORTANTE: cambia esta contraseña en tu primer ingreso. El sistema te lo pedirá automáticamente. No compartas este correo con nadie.

Ingresa en: ${input.loginUrl}

Al entrar podrás escoger el país que representarán, cargar a tus participantes, inscribirlos en los deportes y registrar los pagos.`,
  };
}

// ─── Registro rechazado ──────────────────────────────────────────────────────

export function registrationRejectedEmail(input: {
  eventName: string;
  groupName: string;
  leaderName: string;
  reason: string;
}): RenderedEmail {
  const subject = `Sobre la solicitud de ${input.groupName}`;
  return {
    template: 'registro_rechazado',
    subject,
    html: layout({
      title: 'Solicitud no aprobada',
      eventName: input.eventName,
      body: `
        <p>Hola ${escapeHtml(input.leaderName)},</p>
        <p>La solicitud de <b>${escapeHtml(input.groupName)}</b> no fue aprobada por ahora.</p>
        <p style="background:${BRAND.bg};border-radius:12px;padding:14px 16px">
          <b>Motivo:</b><br>${escapeHtml(input.reason)}
        </p>
        <p>Si crees que se trata de un error o ya corregiste lo indicado, responde a este correo
           y con gusto revisamos la solicitud de nuevo.</p>`,
    }),
    text: `Hola ${input.leaderName},

La solicitud de ${input.groupName} no fue aprobada por ahora.

Motivo: ${input.reason}

Si crees que se trata de un error o ya corregiste lo indicado, responde a este correo y con gusto revisamos la solicitud de nuevo.`,
  };
}

// ─── Aviso al administrador ──────────────────────────────────────────────────

export function newRegistrationAdminEmail(input: {
  eventName: string;
  groupName: string;
  city: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  reviewUrl: string;
}): RenderedEmail {
  const subject = `Nueva solicitud de registro: ${input.groupName}`;
  return {
    template: 'admin_nueva_solicitud',
    subject,
    html: layout({
      title: 'Nueva solicitud de registro',
      eventName: input.eventName,
      cta: { label: 'Revisar solicitud', url: input.reviewUrl },
      body: `
        <p><b>${escapeHtml(input.groupName)}</b> (${escapeHtml(input.city)}) solicitó registrarse.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="background:${BRAND.bg};border-radius:12px">
          <tr><td style="padding:16px 18px;font-size:14px;line-height:1.9">
            <b>Responsable:</b> ${escapeHtml(input.leaderName)}<br>
            <b>Correo:</b> ${escapeHtml(input.leaderEmail)}<br>
            <b>Teléfono:</b> ${escapeHtml(input.leaderPhone)}
          </td></tr>
        </table>`,
    }),
    text: `Nueva solicitud de registro

Grupo: ${input.groupName} (${input.city})
Responsable: ${input.leaderName}
Correo: ${input.leaderEmail}
Teléfono: ${input.leaderPhone}

Revísala en: ${input.reviewUrl}`,
  };
}

// ─── Resultado de un pago ────────────────────────────────────────────────────

export function paymentReviewedEmail(input: {
  eventName: string;
  groupName: string;
  concept: string;
  reference: string;
  status: 'approved' | 'rejected' | 'correction';
  note: string;
  panelUrl: string;
}): RenderedEmail {
  const config = {
    approved: {
      template: 'pago_aprobado' as const,
      title: 'Pago aprobado',
      lead: 'Tu pago fue verificado y la inscripción quedó confirmada.',
    },
    rejected: {
      template: 'pago_rechazado' as const,
      title: 'Pago rechazado',
      lead: 'Revisamos tu comprobante y no fue posible aprobarlo.',
    },
    correction: {
      template: 'pago_correccion' as const,
      title: 'Tu pago requiere corrección',
      lead: 'Falta un ajuste para poder aprobar tu pago.',
    },
  }[input.status];

  const noteBlock = input.note
    ? `<p style="background:${BRAND.bg};border-radius:12px;padding:14px 16px">
         <b>Observación de la organización:</b><br>${escapeHtml(input.note)}
       </p>`
    : '';

  return {
    template: config.template,
    subject: `${config.title} · ${input.concept}`,
    html: layout({
      title: config.title,
      eventName: input.eventName,
      cta: { label: 'Ver mis pagos', url: input.panelUrl },
      body: `
        <p>Hola, equipo de <b>${escapeHtml(input.groupName)}</b>.</p>
        <p>${config.lead}</p>
        <p><b>Concepto:</b> ${escapeHtml(input.concept)}<br>
           <b>Referencia:</b> ${escapeHtml(input.reference)}</p>
        ${noteBlock}`,
    }),
    text: `${config.title}

Grupo: ${input.groupName}
Concepto: ${input.concept}
Referencia: ${input.reference}

${config.lead}
${input.note ? `\nObservación: ${input.note}` : ''}

Consulta el detalle en: ${input.panelUrl}`,
  };
}

// ─── Alta de árbitro ─────────────────────────────────────────────────────────

export function refereeWelcomeEmail(input: {
  eventName: string;
  refereeName: string;
  email: string;
  password: string;
  loginUrl: string;
  sports: string[];
}): RenderedEmail {
  const sportList = input.sports.length ? input.sports.join(', ') : 'por asignar';

  return {
    template: 'arbitro_alta',
    subject: `Acceso de árbitro · ${input.eventName}`,
    html: layout({
      title: 'Bienvenido al equipo de arbitraje',
      eventName: input.eventName,
      cta: { label: 'Ingresar al sistema', url: input.loginUrl },
      body: `
        <p>Hola ${escapeHtml(input.refereeName)},</p>
        <p>La organización te registró como árbitro de <b>${escapeHtml(input.eventName)}</b>.
           Vas a dirigir: <b>${escapeHtml(sportList)}</b>.</p>
        <p>Estos son tus datos de acceso:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="background:${BRAND.bg};border-radius:12px;margin:8px 0 4px">
          <tr><td style="padding:16px 18px">
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Usuario</div>
            <div style="font-weight:700;font-size:16px;margin-bottom:12px">${escapeHtml(input.email)}</div>
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Contraseña temporal</div>
            <div style="font-weight:700;font-size:20px;font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.05em">${escapeHtml(input.password)}</div>
          </td></tr>
        </table>
        <p style="background:#fff4e0;border-left:3px solid #a86508;padding:12px 14px;border-radius:8px;color:#7a4a06">
          <b>Cambia esta contraseña en tu primer ingreso.</b> El sistema te lo pedirá
          automáticamente. No compartas este correo con nadie.
        </p>
        <p>En «Mis competencias» verás únicamente lo que te asignó la organización.
           Ahí registras el marcador, el tiempo o los puntos, y decides si lo guardas
           como borrador o lo publicas. <b>Lo publicado queda visible para todo el
           mundo</b>, así que verifícalo antes.</p>`,
    }),
    text: `Hola ${input.refereeName},

La organización te registró como árbitro de ${input.eventName}.
Deportes asignados: ${sportList}.

Datos de acceso:
  Usuario: ${input.email}
  Contraseña temporal: ${input.password}

IMPORTANTE: cambia esta contraseña en tu primer ingreso. No compartas este correo con nadie.

Ingresa en: ${input.loginUrl}

En "Mis competencias" verás lo que te asignaron. Ahí registras el resultado y decides si lo guardas como borrador o lo publicas. Lo publicado queda visible para todo el mundo, así que verifícalo antes.`,
  };
}

// ─── Alta de administrador ───────────────────────────────────────────────────

export function adminWelcomeEmail(input: {
  eventName: string;
  adminName: string;
  email: string;
  password: string;
  loginUrl: string;
  scope: 'full' | 'limited';
}): RenderedEmail {
  const scopeNote =
    input.scope === 'full'
      ? 'Tienes acceso completo al panel administrativo, incluida la bitácora de actividad.'
      : 'Tienes acceso al panel administrativo, salvo a la bitácora de actividad y al alta de otros administradores.';

  return {
    template: 'admin_alta',
    subject: `Acceso de administrador · ${input.eventName}`,
    html: layout({
      title: 'Bienvenido al equipo administrador',
      eventName: input.eventName,
      cta: { label: 'Ingresar al sistema', url: input.loginUrl },
      body: `
        <p>Hola ${escapeHtml(input.adminName)},</p>
        <p>La organización te registró como administrador de <b>${escapeHtml(input.eventName)}</b>.</p>
        <p>Estos son tus datos de acceso:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="background:${BRAND.bg};border-radius:12px;margin:8px 0 4px">
          <tr><td style="padding:16px 18px">
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Usuario</div>
            <div style="font-weight:700;font-size:16px;margin-bottom:12px">${escapeHtml(input.email)}</div>
            <div style="color:${BRAND.gray};font-size:12px;text-transform:uppercase;letter-spacing:.1em">Contraseña temporal</div>
            <div style="font-weight:700;font-size:20px;font-family:ui-monospace,'SF Mono',Menlo,monospace;letter-spacing:.05em">${escapeHtml(input.password)}</div>
          </td></tr>
        </table>
        <p style="background:#fff4e0;border-left:3px solid #a86508;padding:12px 14px;border-radius:8px;color:#7a4a06">
          <b>Cambia esta contraseña en tu primer ingreso.</b> El sistema te lo pedirá
          automáticamente. No compartas este correo con nadie.
        </p>
        <p>${escapeHtml(scopeNote)}</p>`,
    }),
    text: `Hola ${input.adminName},

La organización te registró como administrador de ${input.eventName}.

Datos de acceso:
  Usuario: ${input.email}
  Contraseña temporal: ${input.password}

IMPORTANTE: cambia esta contraseña en tu primer ingreso. No compartas este correo con nadie.

Ingresa en: ${input.loginUrl}

${scopeNote}`,
  };
}

// ─── Alianza intergrupal revisada ────────────────────────────────────────────

export function intergroupReviewedEmail(input: {
  eventName: string;
  groupName: string;
  teamName: string;
  approved: boolean;
  note: string;
  panelUrl: string;
}): RenderedEmail {
  const title = input.approved ? 'Alianza aprobada' : 'Alianza rechazada';

  return {
    template: 'alianza_revisada',
    subject: `${title} · ${input.teamName}`,
    html: layout({
      title,
      eventName: input.eventName,
      cta: { label: 'Ver mis solicitudes', url: input.panelUrl },
      body: input.approved
        ? `<p>Hola ${escapeHtml(input.groupName)},</p>
           <p>La organización verificó a los participantes de otros grupos que integran
              <b>${escapeHtml(input.teamName)}</b>. El equipo ya puede continuar con el pago.</p>
           ${input.note ? `<p><b>Observación:</b> ${escapeHtml(input.note)}</p>` : ''}`
        : `<p>Hola ${escapeHtml(input.groupName)},</p>
           <p>La organización no aprobó la alianza de <b>${escapeHtml(input.teamName)}</b>.
              Los participantes prestados salieron de la alineación.</p>
           <p style="background:#fdeaea;border-left:3px solid #b42318;padding:12px 14px;border-radius:8px;color:#7a1710">
             <b>Motivo:</b> ${escapeHtml(input.note)}
           </p>
           <p>Puedes volver a solicitar apoyo a otro grupo o completar el equipo con tu propia gente.</p>`,
    }),
    text: input.approved
      ? `Hola ${input.groupName},

La organización verificó a los participantes de otros grupos que integran ${input.teamName}. El equipo ya puede continuar con el pago.
${input.note ? `\nObservación: ${input.note}` : ''}

Consulta el detalle en: ${input.panelUrl}`
      : `Hola ${input.groupName},

La organización no aprobó la alianza de ${input.teamName}. Los participantes prestados salieron de la alineación.

Motivo: ${input.note}

Puedes volver a solicitar apoyo a otro grupo o completar el equipo con tu propia gente.

Consulta el detalle en: ${input.panelUrl}`,
  };
}
