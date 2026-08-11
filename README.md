# Olimpiadas Scouts

Sistema de inscripción y competencia para las Olimpiadas Scouts: registro de grupos,
participantes, selección de países, deportes individuales y por equipos, préstamos de
participantes entre grupos, pagos con comprobante, stands de ventas, programación de
competencias, arbitraje y un portal público de resultados.

Reemplaza al prototipo local de un solo archivo (conservado en `_mock/`) por una
aplicación web multiusuario con base de datos central, control de acceso real y
sincronización en tiempo real entre dispositivos.

---

## Stack

| Capa | Tecnología |
|---|---|
| Interfaz | Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS 4 |
| Datos | Supabase — PostgreSQL 17, Auth, Storage, Realtime, Row Level Security |
| Correo | Resend con plantillas HTML propias |
| Validación | Zod, compartido entre navegador y servidor |
| Archivos | Papa Parse (CSV) y ExcelJS (XLSX) |
| Pruebas | Vitest, incluyendo pruebas contra un Postgres real vía PGlite |

---

## Puesta en marcha

### 1. Requisitos

- Node.js **22 o superior** (lo exige `@supabase/supabase-js`)
- Una cuenta de [Supabase](https://supabase.com) (el plan gratuito basta para empezar)
- Una cuenta de [Resend](https://resend.com) para los correos (opcional en desarrollo)

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en el panel de Supabase.
2. Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

Las llaves están en **Project Settings → API**:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **nunca la publiques** |

### 4. Aplicar el esquema

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npm run db:seed               # aplica migrations/ y luego seed.sql
```

O, si prefieres el panel web: abre el **SQL Editor** y ejecuta en orden los cinco
archivos de `supabase/migrations/` y luego `supabase/seed.sql`.

El seed carga 195 países, las cuatro ramas scouts, cinco deportes de ejemplo y la
configuración inicial del evento. Es idempotente: puedes volver a ejecutarlo sin
duplicar nada.

### 5. Crear la cuenta de administrador

```bash
npm run seed:admin correo@tudominio.org "UnaContraseñaSegura123" "Nombre Apellido"
```

### 6. Configurar el correo (Resend)

1. Verifica tu dominio en Resend.
2. Añade `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_ADMIN` a `.env.local`.

Sin estas variables la aplicación funciona igual: los correos se imprimen en la
consola en desarrollo y quedan registrados con estado `skipped` en la tabla
`email_log`. Cuando un envío falla, la operación de negocio **no** se revierte —
la aprobación de un grupo incluye la contraseña generada en el mensaje de
resultado para que el administrador pueda entregarla por otro medio.

### 7. Arrancar

```bash
npm run dev
```

Abre <http://localhost:3000>.

---

## Flujo de registro

El acceso ya no usa credenciales compartidas. El circuito es:

1. El responsable de un grupo llena el formulario público en `/registro`.
2. La solicitud queda en estado **pendiente** y se notifica al administrador.
3. El administrador la revisa en `/admin/solicitudes`.
4. **Al aprobar**: el sistema asigna el código `GS-00X`, crea la cuenta en Supabase
   Auth con una contraseña generada con `node:crypto` y la envía por correo.
5. En el primer ingreso, la aplicación obliga a cambiar esa contraseña temporal.
6. **Al rechazar**: se exige un motivo, que se envía al responsable.

Si algo falla a mitad de la aprobación (por ejemplo, la cuenta se crea pero el perfil
no), el proceso revierte lo ya hecho para no dejar grupos aprobados sin acceso.

### Préstamos entre grupos

1. El grupo crea un equipo incompleto y pide apoyo desde **Mis equipos**.
2. El grupo aliado propone participantes, o rechaza indicando un motivo.
3. El grupo solicitante acepta la propuesta.
4. **La organización revisa y aprueba a los participantes externos.** Hasta ese
   momento el equipo no puede pagar: sin este paso, dos grupos podían acordar un
   préstamo entre ellos e inscribirlo sin que la organización se enterara.
5. Si la organización rechaza, los prestados salen de la alineación y el equipo
   vuelve a quedar incompleto, en lugar de aparecer completo pero bloqueado.

---

## Competencias, arbitraje y resultados

Tres roles, no dos. El árbitro entra con su propia cuenta y solo ve lo que le
asignaron.

1. La organización registra a los árbitros en `/admin/arbitros` y les asigna los
   deportes que pueden dirigir. El sistema crea la cuenta y envía la contraseña
   por correo, igual que al aprobar un grupo.
2. En `/admin/programacion` se genera el calendario:
   - **Deportes grupales:** todos contra todos, un partido por cada pareja de
     equipos completos.
   - **Deportes individuales:** tandas del tamaño de `session_capacity`.
   También se crean competencias a mano para finales y desempates.
3. El árbitro registra el resultado desde `/arbitraje/competencias`. Cada deporte
   define cómo se mide (`result_label`: goles, tiempo, puntos) y si gana el valor
   más alto o más bajo (`result_order`), de modo que el podio de atletismo no
   salga al revés que el de fútbol.
4. Un resultado se guarda como **borrador** o se **publica**. Solo lo publicado
   llega al portal público.
5. `/resultados` es la única pantalla sin sesión: programación, tabla de
   posiciones y clasificación general.

Los grupos ven su propio calendario en `/panel/programacion`.

### Por qué los resultados públicos son vistas y no tablas

El portal lo consulta cualquiera, sin cuenta. En vez de abrir las tablas al rol
anónimo y confiar en filtros, se exponen tres vistas (`public_schedule`,
`public_standings`, `public_individual_ranking`) que solo contienen competencias
con resultado publicado y nombres que ya son públicos. Ni documentos, ni correos,
ni pagos, ni borradores: no están en la vista, así que no hay filtro que se pueda
olvidar.

---

## Ramas y edad

Las siete ramas reales del movimiento, cada una con su rango:

| Rama | Edad |
|---|---|
| Cachorros | 5 a 6 |
| Lobatos | 7 a 10 |
| Webelos | 10 a 11 |
| Scouts | 11 a 14 |
| Nómadas Scout | 15 a 17 |
| Rovers | 18 a 20 |
| Consejeros y Dirigentes | 21 en adelante |

La edad se valida al guardar cada participante, con un disparador en Postgres.
Los rangos se solapan a propósito (Webelos 10–11 y Scouts 11–14): a los once años
un chico puede estar en cualquiera de las dos, y eso lo decide su grupo.

---

## Arquitectura de seguridad

En el prototipo la autorización vivía en el navegador: bastaba abrir la consola y
escribir `session = { role: 'admin' }`. Aquí las reglas viven en Postgres.

- **Row Level Security en todas las tablas.** Un grupo solo lee y escribe lo suyo;
  el administrador ve todo. Las políticas se apoyan en funciones `security definer`
  (`is_admin()`, `current_group_id()`) que leen el perfil del usuario autenticado.
- **Invariantes como disparadores.** Tamaño de equipo, suplentes, tope de
  integrantes externos, ramas habilitadas, límite de deportes por persona y cupos de
  stands se validan en la base de datos. La capa TypeScript repite las mismas
  comprobaciones solo para dar mensajes tempranos.
- **Operaciones atómicas.** Escoger país, registrar un pago y revisar un pago son
  funciones de Postgres: bloquean la fila y aplican la cascada completa en una
  transacción.
- **Comprobantes en un bucket privado.** Se acceden por URL firmada de cinco
  minutos generada en el servidor; un comprobante ligado a un pago aprobado no puede
  borrarse.
- **La clave de servicio nunca llega al navegador.** Solo se usa en Server Actions
  para crear cuentas y en el registro público.

---

## Estructura

```
src/
├── app/
│   ├── (auth)/          Ingreso, registro público, cambio de contraseña
│   ├── admin/           Panel de la organización
│   ├── panel/           Panel de cada grupo scout
│   ├── arbitraje/       Panel del árbitro
│   ├── resultados/      Portal público, sin sesión
│   └── layout.tsx
├── components/          Interfaz compartida, avisos, importador, tiempo real
├── lib/
│   ├── auth/            Sesión del servidor y contraseñas temporales
│   ├── competitions/    Lectura de la programación
│   ├── domain/          Reglas puras: tarifas, elegibilidad, estados, competencias
│   ├── email/           Resend y plantillas
│   ├── import/          Analizadores de CSV y XLSX
│   ├── supabase/        Clientes de navegador, servidor y servicio
│   └── validation/      Esquemas Zod
├── types/database.ts    Tipos del esquema
└── proxy.ts             Refresco de sesión y protección de rutas

supabase/
├── migrations/          Esquema, funciones, RLS, storage y realtime
└── seed.sql             Países, ramas, deportes y configuración

tests/                   Vitest: dominio, importación y base de datos
scripts/                 Validación de SQL y creación del administrador
_mock/                   Prototipo original, como referencia
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run typecheck` | Verificación de tipos |
| `npm run lint` | ESLint |
| `npm test` | Todas las pruebas |
| `npm run db:validate` | Valida las migraciones contra un Postgres en WebAssembly |
| `npm run db:link` | Enlaza la carpeta con tu proyecto de Supabase |
| `npm run db:push` | Aplica las migraciones al proyecto enlazado |
| `npm run db:seed` | Aplica migraciones y carga los datos iniciales |
| `npm run db:types` | Regenera `src/types/database.ts` desde el proyecto enlazado |
| `npm run seed:admin` | Crea la cuenta de administrador |

---

## Pruebas

149 pruebas en siete archivos:

- `tests/fees.test.ts` — tarifas y estados de inscripción.
- `tests/eligibility.test.ts` — elegibilidad, alineaciones y cupos.
- `tests/import.test.ts` — analizador de CSV, fechas y validación fila por fila.
- `tests/env.test.ts` — normalización de la URL de Supabase.
- `tests/routes.test.ts` — rutas internas y prevención de redirección abierta.
- `tests/competitions.test.ts` — edad por rama, todos contra todos, ranking con
  descalificados y tabla de posiciones.
- `tests/database.test.ts` — **el esquema real**: las migraciones se aplican sobre
  PGlite (PostgreSQL compilado a WebAssembly) y se comprueba que los disparadores y
  restricciones rechacen lo que deben. No requiere base de datos remota.

```bash
npm test
```

---

## Qué cambió frente al prototipo

Además de la arquitectura, se corrigieron errores concretos del `index.html` original:

| Problema en el prototipo | Solución |
|---|---|
| `split(';')` al importar: una observación con coma o punto y coma corrompía la fila | Papa Parse con soporte de comillas, y ExcelJS para `.xlsx` |
| Documento único de forma global: una TI y una CC con el mismo número colisionaban | Clave única por `(tipo, número)` |
| `editStand()` borraba el stand antes de confirmar; si el usuario cancelaba, se perdía | `upsert` sobre un stand único por grupo |
| El cupo de stands solo contaba los aprobados: se podían crear solicitudes sin límite | El disparador cuenta también los pagos en curso |
| `s.fee \|\| general` trataba una tarifa de $0 como ausente y cobraba la general | Se distingue `0` de `null` (con prueba que lo fija) |
| Comprobantes huérfanos en IndexedDB tras restablecer o restaurar | Storage con políticas y limpieza al fallar un pago |
| Contraseñas en texto plano en `localStorage` y autorización en el cliente | Supabase Auth con hash, y RLS en el servidor |
| Un solo dispositivo: dos grupos no podían trabajar a la vez | Base central con Realtime y selección de país atómica |

---

## Despliegue

Pensado para Vercel:

1. Sube el repositorio a GitHub.
2. Importa el proyecto en Vercel.
3. Copia las variables de `.env.example` en **Settings → Environment Variables**.
4. Ajusta `NEXT_PUBLIC_SITE_URL` a tu dominio de producción (lo usan los enlaces
   de los correos).
5. En Supabase, añade ese dominio en **Authentication → URL Configuration**.

---

## Pendiente y notas

- El módulo de reportes exporta a CSV y a un libro de Excel con una hoja por
  sección. Si el evento crece mucho, conviene mover esas consultas a vistas
  materializadas.
- La búsqueda de participantes filtra en el cliente y muestra hasta 300 filas. Con
  varios miles de participantes convendría paginar del lado de Postgres.
- `exceljs` está fijado en `4.3.0` de forma deliberada: la versión `4.4.0` declara
  tipos en su `package.json` pero no publica el `index.d.ts`.
