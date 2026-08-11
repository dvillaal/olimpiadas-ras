# Puesta en marcha · comandos completos

Guía paso a paso, de cero a la aplicación andando. Todos los comandos se ejecutan
desde la carpeta del proyecto:

```powershell
cd C:\Users\USUARIO\Documents\Proyectos\Olimpiadas_Scouts_Local
```

---

## Paso 0 · Comprobar requisitos

```powershell
node --version    # debe decir v22 o superior
npm --version
git --version
```

Si Node es menor que 22, actualízalo desde <https://nodejs.org> (versión LTS).
`@supabase/supabase-js` exige Node 22; con versiones anteriores verás avisos
`EBADENGINE` durante la instalación.

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

Resultado esperado: sin errores y `149 passed` en las pruebas.

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
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** — solo el dominio |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API keys → `service_role` (pulsa *Reveal*) |

Deja `NEXT_PUBLIC_SITE_URL=http://localhost:3000` por ahora.

> **Cuidado con la URL.** Debe ser solo el dominio:
>
> ```
> ✅ NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"
> ❌ NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmnop.supabase.co/rest/v1/"
> ```
>
> La segunda es la *Data API URL*, que aparece muy cerca en el panel. Si la
> copias, verás el error `Invalid path specified in request URL`.

El archivo puede llamarse `.env` o `.env.local`; los dos funcionan y ambos están
excluidos de git.

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
  `supabase/seed.sql` (195 países, 7 ramas con su rango de edad, 5 deportes y la
  configuración inicial).

**Si `supabase link` te da problemas**, puedes hacerlo por el navegador:
abre el **SQL Editor** del panel y pega el contenido de estos archivos, en este orden,
ejecutando uno por uno:

```
supabase/migrations/20260806000100_schema.sql
supabase/migrations/20260806000200_functions.sql
supabase/migrations/20260806000300_rls.sql
supabase/migrations/20260806000400_storage.sql
supabase/migrations/20260806000500_realtime.sql
supabase/migrations/20260811000600_competitions.sql
supabase/migrations/20260811000700_competitions_functions.sql
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

## Paso 8b · Probar competencias y arbitraje

1. Como administrador, entra a **Árbitros** y registra uno con un correo tuyo.
   Asígnale al menos un deporte. La contraseña sale en la consola de `npm run dev`.
2. Carga participantes en el grupo de prueba e inscríbelos en un deporte.
3. Entra a **Programación**, escoge deporte y rama, pon fecha y hora, marca
   «Incluir inscripciones que aún no están confirmadas» y genera.
4. Ingresa con la cuenta del árbitro en otra ventana. En **Mis competencias**
   registra un resultado: primero como borrador, luego publícalo.
5. Abre <http://localhost:3000/resultados> **sin sesión** (otra ventana de
   incógnito) y comprueba que aparezca solo lo publicado.

Para ver la tabla de posiciones necesitas al menos dos equipos completos en el
mismo deporte y rama, y un partido entre ellos con resultado publicado.

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
| `npm test` | Ejecuta las 149 pruebas |
| `npm run test:watch` | Pruebas en modo continuo mientras editas |
| `npm run db:validate` | Valida el SQL sin conectarse a nada |
| `npm run db:link` | Enlaza la carpeta con tu proyecto de Supabase |
| `npm run db:push` | Aplica solo las migraciones |
| `npm run db:seed` | Aplica migraciones **y** los datos iniciales |
| `npm run db:types` | Regenera los tipos desde la base de datos real |
| `npm run seed:admin <correo> <clave> <nombre>` | Crea la cuenta de administrador |

Los árbitros no se crean por consola: se registran desde **Árbitros** en el panel
de administración y reciben su contraseña por correo.

---

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Falta SUPABASE_SERVICE_ROLE_KEY` | `.env.local` incompleto o mal escrito | Revisa el paso 4 y reinicia `npm run dev` |
| `Invalid path specified in request URL` | La URL trae `/rest/v1/` u otra ruta | Déjala solo con el dominio (paso 4) |
| `No se pudo leer la configuración del evento` | El seed no se aplicó | Ejecuta `npm run db:seed` |
| `supabase: command not found` | La CLI no está instalada | Usa `npx supabase ...` (ya viene como dependencia) |
| `Cannot find module` tras actualizar | `node_modules` desactualizado | Borra `node_modules` y ejecuta `npm install` |
| `npm ci` falla con `EUSAGE ... not in sync` | Cambió `package.json` sin regenerar el lockfile | Ejecuta `npm install` y sube el `package-lock.json` actualizado |
| Avisos `EBADENGINE` al instalar | Node menor que 22 | Actualiza Node (paso 0) |
| El correo de aprobación no llega | Resend sin configurar | Es normal: la contraseña sale en la consola y en el mensaje de confirmación |
| Cambios en `.env.local` sin efecto | El servidor no releyó las variables | Detén con `Ctrl+C` y vuelve a `npm run dev` |
| `La rama X admite de N a M años` | La edad no corresponde a la rama | Corrige la fecha de nacimiento o cambia de rama (paso 8b) |
| `Hacen falta al menos dos equipos completos` | Solo hay un equipo con la alineación llena | Completa otro equipo o marca «incluir no confirmadas» |
| `Administración debe aprobar a los participantes de otros grupos` | El equipo tiene prestados sin visto bueno | Apruébalos en **Intergrupales** antes de pagar |
| `/resultados` aparece vacío | Ningún árbitro ha publicado todavía | Publica un resultado desde el panel de arbitraje |
