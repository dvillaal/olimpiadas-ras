/**
 * Crea la cuenta del administrador general.
 *
 * Uso:
 *   node scripts/seed-admin.mjs correo@ejemplo.com "Contraseña segura" "Nombre Apellido"
 *
 * Necesita SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL en .env.local.
 * Es idempotente: si la cuenta ya existe, solo actualiza su perfil.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const content = await readFile(join(process.cwd(), file), 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^["']|["']$/g, '');
      }
    } catch {
      // El archivo puede no existir; las variables pueden venir del entorno.
    }
  }
}

await loadEnv();

const [email, password, ...nameParts] = process.argv.slice(2);
// `npm run` reparte los argumentos por espacios, así que "David Villa" llega
// como dos. Se vuelven a unir en lugar de quedarse solo con el primero.
const fullName = nameParts.join(' ').trim() || 'Administrador General';

if (!email || !password) {
  console.error('Uso: node scripts/seed-admin.mjs <correo> <contraseña> [nombre]');
  process.exit(1);
}

if (password.length < 10) {
  console.error('La contraseña debe tener al menos 10 caracteres.');
  process.exit(1);
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !key) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en tu .env.local.\n' +
      'Están en Supabase → Project Settings → API.',
  );
  process.exit(1);
}

/**
 * El panel de Supabase muestra varias direcciones parecidas. La *Data API URL*
 * termina en `/rest/v1/`, pero el cliente necesita solo el origen; si se cuela
 * la ruta, el gateway responde «Invalid path specified in request URL».
 */
let url;
try {
  const parsed = new URL(rawUrl.trim().replace(/^["']|["']$/g, ''));
  url = parsed.origin;
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    console.warn(
      `Aviso: NEXT_PUBLIC_SUPABASE_URL incluía la ruta "${parsed.pathname}". ` +
        `Se usará solo ${url}.\n` +
        'Corrígela en .env.local para evitar problemas en la aplicación.',
    );
  }
} catch {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL no es una dirección válida: "${rawUrl}".\n` +
      'Debe verse como https://xxxxxxxx.supabase.co',
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId;

const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (error) {
  if (!error.message.toLowerCase().includes('already')) {
    console.error(`No se pudo crear la cuenta: ${error.message}`);
    if (error.message.toLowerCase().includes('invalid path')) {
      console.error(
        '\nCausa habitual: NEXT_PUBLIC_SUPABASE_URL trae una ruta extra.\n' +
          `Debe ser solo el dominio, por ejemplo ${url}`,
      );
    }
    process.exit(1);
  }
  // Ya existía: se busca su id para actualizar la contraseña y el perfil.
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  userId = list?.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error('La cuenta existe pero no fue posible localizarla.');
    process.exit(1);
  }

  // Sin esto, volver a correr el script con una contraseña nueva no cambiaba
  // nada: la cuenta se quedaba con la clave de la primera corrida, y el
  // administrador terminaba con "Correo o contraseña incorrectos" sin saber
  // por qué, porque la contraseña que cree tener nunca se guardó.
  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (updateError) {
    console.error(`No se pudo actualizar la contraseña: ${updateError.message}`);
    process.exit(1);
  }
  console.log('La cuenta ya existía; se actualizó su contraseña y su perfil.');
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabase.from('profiles').upsert({
  id: userId,
  role: 'admin',
  group_id: null,
  full_name: fullName,
  email,
  must_change_password: false,
});

if (profileError) {
  console.error(`No se pudo crear el perfil: ${profileError.message}`);
  process.exit(1);
}

console.log(`\n✔ Administrador listo\n  Correo: ${email}\n  Ingresa en /ingresar\n`);
