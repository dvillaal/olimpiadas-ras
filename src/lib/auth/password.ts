import 'server-only';
import { randomInt } from 'node:crypto';

/**
 * Generación de la contraseña temporal que se envía por correo al aprobar un
 * grupo.
 *
 * Decisiones deliberadas:
 *  · `randomInt` de node:crypto, no `Math.random()`: la contraseña viaja por
 *    correo y debe ser impredecible.
 *  · Sin caracteres ambiguos (0/O, 1/l/I): se transcribe a mano desde el correo
 *    y una confusión significa un ticket de soporte.
 *  · Agrupada en bloques de cuatro: mucho más fácil de leer y escribir.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function pick(source: string): string {
  return source[randomInt(source.length)] as string;
}

/** Devuelve algo como "KTRM-7F2P-XBQ9". */
export function generateTemporaryPassword(blocks = 3): string {
  const parts: string[] = [];

  for (let block = 0; block < blocks; block += 1) {
    let chunk = '';
    for (let index = 0; index < 4; index += 1) {
      // Mezcla letras y números para que ningún bloque quede solo de un tipo.
      chunk += index % 2 === 0 ? pick(ALPHABET) : pick(DIGITS);
    }
    parts.push(chunk);
  }

  return parts.join('-');
}
