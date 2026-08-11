import type { Route } from 'next';

/**
 * Rutas que provienen de datos, no de literales del código.
 *
 * Con `typedRoutes` activado, Next verifica en tiempo de compilación que cada
 * `href` corresponda a una ruta real. Eso funciona con literales, pero no con
 * valores que llegan de la base de datos (`notifications.link`) o de la URL
 * (`?siguiente=`). Para esos casos hace falta una conversión explícita, y ese
 * es justo el lugar donde conviene validar.
 *
 * La validación no es cosmética: sin ella, `?siguiente=` es un vector de
 * redirección abierta. Un enlace como
 *
 *   /ingresar?siguiente=//sitio-malicioso.com
 *
 * pasa un `value.startsWith('/')` ingenuo, pero el navegador interpreta `//`
 * como una URL relativa al protocolo y lleva al usuario fuera del sitio —
 * después de que escribió su contraseña. Por eso se exige una barra inicial
 * *que no vaya seguida de otra*.
 */

/** Rutas internas absolutas: `/panel`, `/admin/pagos`. Nunca `//` ni `http://`. */
const INTERNAL_PATH = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/;

export function isInternalRoute(value: string | null | undefined): boolean {
  if (!value) return false;
  // `\` se normaliza a `/` en algunos navegadores: `/\evil.com` escaparía.
  if (value.includes('\\')) return false;
  return INTERNAL_PATH.test(value);
}

/**
 * Convierte un valor externo en una ruta utilizable, o devuelve el respaldo si
 * no es una ruta interna válida.
 */
export function internalRoute(value: string | null | undefined, fallback: Route = '/'): Route {
  return isInternalRoute(value) ? (value as Route) : fallback;
}
