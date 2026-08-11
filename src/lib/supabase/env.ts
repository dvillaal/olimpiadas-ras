/**
 * Lectura y normalización de las variables de entorno de Supabase.
 *
 * El panel de Supabase muestra varias direcciones parecidas y es muy fácil
 * copiar la equivocada: la *Data API URL* termina en `/rest/v1/`, mientras que
 * el cliente necesita solo el origen. Si se cuela la ruta, cada petición sale
 * como `.../rest/v1/auth/v1/admin/users` y el gateway responde
 * «Invalid path specified in request URL», un mensaje que no dice nada sobre la
 * causa real.
 *
 * En vez de confiar en que el archivo esté perfecto, aquí se limpia el valor y,
 * si falta algo, se lanza un error que explica qué hacer.
 */

/** Quita la barra final y el sufijo de servicio si vienen incluidos. */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^["']|["']$/g, '');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL no es una dirección válida: "${trimmed}". ` +
        'Debe verse como https://xxxxxxxx.supabase.co',
    );
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL debe usar https.');
  }

  // `https://xxx.supabase.co/rest/v1/` → `https://xxx.supabase.co`
  return url.origin;
}

/**
 * `value` se recibe ya leído por el llamador (`process.env.NEXT_PUBLIC_X`
 * escrito literalmente en cada función de abajo), en vez de indexar
 * `process.env[name]` aquí dentro.
 *
 * La diferencia no es cosmética: Next.js reemplaza las variables
 * `NEXT_PUBLIC_*` en el paquete del navegador buscando ese texto exacto en el
 * código fuente durante la compilación — `process` ni siquiera existe en el
 * cliente en tiempo de ejecución. Un acceso dinámico como `process.env[name]`
 * no es algo que el compilador pueda encontrar, así que nunca se sustituye y
 * la variable llega vacía al navegador sin importar qué haya en `.env`.
 */
function required(name: string, value: string | undefined, hint: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Falta la variable ${name} en tu archivo .env.local.\n  ${hint}`);
  }
  return value.trim().replace(/^["']|["']$/g, '');
}

export function supabaseUrl(): string {
  return normalizeSupabaseUrl(
    required(
      'NEXT_PUBLIC_SUPABASE_URL',
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      'Cópiala de Supabase → Project Settings → API → Project URL (solo el dominio).',
    ),
  );
}

export function supabaseAnonKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'Cópiala de Supabase → Project Settings → API → Project API keys → anon public.',
  );
}

export function supabaseServiceKey(): string {
  return required(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Cópiala de Supabase → Project Settings → API → Project API keys → service_role. Nunca la publiques.',
  );
}
