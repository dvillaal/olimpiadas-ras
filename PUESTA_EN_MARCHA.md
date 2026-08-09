# Puesta en marcha · comandos completos

Guía paso a paso, de cero a la aplicación andando. Todos los comandos se ejecutan
desde la carpeta del proyecto:

```powershell
cd C:\Users\USUARIO\Documents\Proyectos\Olimpiadas_Scouts_Local
```

---

## Paso 0 · Comprobar requisitos

```powershell
node --version    # debe decir v20 o superior
npm --version
git --version
```

Si Node es menor que 20, descárgalo de <https://nodejs.org> (versión LTS).

---

## Paso 1 · Instalar dependencias

```powershell
npm install
```

Tarda unos minutos la primera vez. Crea la carpeta `node_modules/`.

---

## Paso 2 · Verificar que todo está sano (sin base de datos)

Estos cuatro comandos funcionan **antes** de configurar Supabase, porque no
necesitan conexión:

```powershell
npm run typecheck
npm run lint
npm run db:validate
npm test
```

Resultado esperado: sin errores y `86 passed` en las pruebas.

---

## Paso 3 · Crear el proyecto en Supabase

Esto es manual, en el navegador:

1. Entra a <https://supabase.com/dashboard> y pulsa **New project**.
2. Nombre: `olimpiadas-scouts`. Región: **South America (São Paulo)**.
3. Guarda la contraseña de la base de datos que te pida: la necesitarás en el paso 5.
4. Espera a que el proyecto termine de aprovisionarse (1–2 minutos).

---

## Paso 4 · Configurar las variables de entorno

```powershell
copy .env.example .env.local
notepad .env.local
```

En el panel de Supabase ve a **Project Settings → API** y copia:

| Variable en `.env.local` | Dónde está en Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → `service_role` (pulsa *Reveal*) |

Deja `NEXT_PUBLIC_SITE_URL=http://localhost:3000` por ahora.

> La clave `service_role` salta todas las reglas de seguridad. Nunca la subas a
> git ni la pegues en el navegador. El archivo `.env.local` ya está en
> `.gitignore`.

Guarda y cierra el Bloc de notas.

---

## Paso 5 · Aplicar el esquema a la base de datos

```powershell
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npm run db:seed
```

- **`TU_PROJECT_REF`** es la cadena que aparece en la URL del panel:
  `https://supabase.com/dashboard/project/`**`abcdefghijklmnop`**
  También la ves en **Project Settings → General → Reference ID**.
- `supabase login` abre el navegador para autorizar la CLI.
- `link` te pedirá la contraseña de la base de datos del paso 3.
- `db:seed` aplica los cinco archivos de `supabase/migrations/` y después
  `supabase/seed.sql` (195 países, 4 ramas, 5 deportes y la configuración inicial).

**Si `supabase link` te da problemas**, puedes hacerlo por el navegador:
abre el **SQL Editor** del panel y pega el contenido de estos archivos, en este orden,
ejecutando uno por uno:

```
supabase/migrations/20260806000100_schema.sql
supabase/migrations/20260806000200_functions.sql
supabase/migrations/20260806000300_rls.sql
supabase/migrations/20260806000400_storage.sql
supabase/migrations/20260806000500_realtime.sql
supabase/seed.sql
```

---

## Paso 6 · Crear tu cuenta de administrador

```powershell
npm run seed:admin davidvillaalzate@gmail.com "TuContrasenaSegura123" "David Villa"
```

La contraseña debe tener al menos 10 caracteres. Las comillas son necesarias si
lleva espacios.

---

## Paso 7 · Arrancar la aplicación

```powershell
npm run dev
```

Abre <http://localhost:3000> e ingresa con el correo y la contraseña del paso 6.

Para detenerlo: `Ctrl` + `C` en la terminal.

---

## Paso 8 · Probar el circuito completo

Con la aplicación corriendo:

1. Abre <http://localhost:3000/registro> en una **ventana de incógnito**.
2. Registra un grupo de prueba con un correo tuyo.
3. Vuelve a la ventana normal, entra como administrador a **Solicitudes** y apruébalo.
4. Mira la terminal donde corre `npm run dev`: como todavía no configuraste Resend,
   el correo con la contraseña temporal se imprime ahí.
5. Ingresa con esas credenciales en la ventana de incógnito y recorre el panel del grupo.

---

## Paso 9 (opcional) · Correos reales con Resend

```powershell
notepad .env.local
```

Añade:

```
RESEND_API_KEY="re_..."
EMAIL_FROM="Olimpiadas Scouts <olimpiadas@tudominio.org>"
EMAIL_ADMIN="davidvillaalzate@gmail.com"
```

Necesitas verificar un dominio en <https://resend.com/domains>. Sin esto la
aplicación funciona igual, solo que los correos se muestran en la consola.

Después de editar `.env.local`, reinicia `npm run dev`.

---

## Paso 10 (opcional) · Publicar en internet

```powershell
git remote add origin https://github.com/TU_USUARIO/olimpiadas-scouts.git
git branch -M main
git push -u origin main
```

Luego en <https://vercel.com>: **Add New → Project → Import** el repositorio.
Copia las cuatro variables de `.env.local` en **Settings → Environment Variables**
y cambia `NEXT_PUBLIC_SITE_URL` por tu dominio de producción.

Por último, en Supabase → **Authentication → URL Configuration**, agrega ese
dominio a *Site URL* y a *Redirect URLs*.

---

## Referencia rápida de comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev` | Arranca en modo desarrollo (localhost:3000) |
| `npm run build` | Compila para producción |
| `npm start` | Sirve la compilación de producción |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run lint` | Revisa el estilo del código |
| `npm test` | Ejecuta las 86 pruebas |
| `npm run test:watch` | Pruebas en modo continuo mientras editas |
| `npm run db:validate` | Valida el SQL sin conectarse a nada |
| `npm run db:link` | Enlaza la carpeta con tu proyecto de Supabase |
| `npm run db:push` | Aplica solo las migraciones |
| `npm run db:seed` | Aplica migraciones **y** los datos iniciales |
| `npm run db:types` | Regenera los tipos desde la base de datos real |
| `npm run seed:admin <correo> <clave> <nombre>` | Crea la cuenta de administrador |

---

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Falta SUPABASE_SERVICE_ROLE_KEY` | `.env.local` incompleto o mal escrito | Revisa el paso 4 y reinicia `npm run dev` |
| `No se pudo leer la configuración del evento` | El seed no se aplicó | Ejecuta `npm run db:seed` |
| `supabase: command not found` | La CLI no está instalada | Usa `npx supabase ...` (ya viene como dependencia) |
| `Cannot find module` tras actualizar | `node_modules` desactualizado | Borra `node_modules` y ejecuta `npm install` |
| El correo de aprobación no llega | Resend sin configurar | Es normal: la contraseña sale en la consola y en el mensaje de confirmación |
| Cambios en `.env.local` sin efecto | El servidor no releyó las variables | Detén con `Ctrl+C` y vuelve a `npm run dev` |
