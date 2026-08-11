# Plan de pruebas manuales

Checklist para recorrer toda la aplicación función por función. Está organizado
en el mismo orden en que un grupo real la usaría: entrar, escoger país, inscribir
gente, pagar. Marca cada casilla mientras pruebas; donde algo falle, anota la
ruta, el usuario con el que estabas y qué esperabas ver.

Necesitas al menos:

- Tu cuenta de administrador.
- Dos grupos de prueba aprobados (para probar préstamos entre grupos y que dos
  personas trabajen a la vez). Los registras tú mismo en `/registro`.
- Un árbitro de prueba, creado desde `/admin/arbitros`.
- Dos navegadores o una ventana normal + una de incógnito, para tener sesiones
  distintas abiertas al mismo tiempo.

---

## 0 · Antes de empezar

- [ ] `npm run dev` corriendo (o la URL de Vercel, si pruebas producción).
- [ ] Puedes entrar como administrador (ver más abajo si no).
- [ ] Sabes en qué terminal mirar los correos si no configuraste Resend (se
      imprimen en la consola de `npm run dev`).

---

## 1 · Autenticación y control de acceso

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1.1 | Abre `/registro` en incógnito y llena el formulario de un grupo de prueba | Redirige a `/registro/enviado`; el correo de confirmación llega (o se imprime en consola) |
| 1.2 | Entra como admin a `/admin/solicitudes` | Ves la solicitud nueva en estado pendiente, con notificación asociada |
| 1.3 | Repite el registro con el mismo correo de responsable | Debe rechazarlo: "Ya existe una solicitud con este correo" |
| 1.4 | Aprueba la solicitud desde `/admin/solicitudes` | Se asigna código `GS-00X`; se crea la cuenta; la contraseña generada aparece en el mensaje de confirmación y se envía por correo |
| 1.5 | Registra otra solicitud y recházala, con motivo | El responsable recibe el motivo por correo; el estado queda como rechazado |
| 1.6 | Con las credenciales del paso 1.4, entra en `/ingresar` | Te obliga a cambiar la contraseña antes de dejarte avanzar (`/cambiar-clave`) |
| 1.7 | Intenta repetir la misma contraseña temporal como "nueva" | Debe rechazarla: tiene que ser distinta |
| 1.8 | Cambia la contraseña con una válida | Redirige al panel del grupo (`/panel`) |
| 1.9 | Cierra sesión y entra de nuevo con la contraseña nueva | Funciona sin pedir cambio de clave otra vez |
| 1.10 | Estando **sin sesión**, intenta entrar directo a `/panel` y a `/admin` por URL | Ambas te mandan a `/ingresar` |
| 1.11 | Logueado como **grupo**, intenta entrar a `/admin` por URL | Debe bloquear el acceso (no es admin) |
| 1.12 | Logueado como **admin**, intenta entrar a `/panel` por URL | Igual: cada rol ve solo lo suyo |
| 1.13 | Cierra sesión desde el botón de logout | Vuelve a `/ingresar` y ya no puedes navegar hacia atrás al panel |

---

## 2 · Panel de administrador

Entra con tu cuenta de admin para todo este bloque.

### 2.1 Inicio (`/admin`)
- [ ] El resumen muestra cifras que cuadran con lo que hay cargado (grupos, solicitudes pendientes, pagos pendientes).

### 2.2 Solicitudes (`/admin/solicitudes`)
- [ ] Ya cubierto arriba (1.1–1.5). Revisa también que una solicitud aprobada no se pueda volver a aprobar ni rechazar.

### 2.3 Grupos (`/admin/grupos`)
- [ ] Lista todos los grupos aprobados con su código `GS-00X`.
- [ ] Puedes ver el detalle de un grupo: sus participantes, país, pagos y stand desde ahí.
- [ ] Si el grupo se puede editar/inactivar desde aquí, pruébalo y confirma que el cambio se refleje en el panel del grupo.

### 2.4 Países (`/admin/paises`)
- [ ] La lista trae los 195 países del seed.
- [ ] Marca un país como no disponible (o el mecanismo que use) y confirma que un grupo ya no pueda escogerlo desde `/panel/pais`.
- [ ] Intenta que **dos grupos** escojan el mismo país casi al mismo tiempo (ver prueba 4.2): solo uno debe quedárselo.

### 2.5 Ramas (`/admin/ramas`)
- [ ] Revisa las cuatro ramas scouts precargadas.
- [ ] Si editas una rama y la deshabilitas, un participante de esa rama no debería poder inscribirse en deportes que la requieran (ver 3.3).

### 2.6 Deportes (`/admin/deportes`)
- [ ] Crea un deporte de prueba: define tipo (individual/equipo), tamaño de equipo, suplentes, ramas habilitadas, `max_sports_per_participant`, si permite integrantes de otros grupos (`allow_intergroup`) y cuántos como máximo (`max_external`), tarifa y fecha límite.
- [ ] Crea un deporte con **tarifa $0** explícita y confirma que en el panel del grupo no pida pago (ver la corrección del prototipo: `0` no debe tratarse como "sin tarifa" y cobrar la general).
- [ ] Edita un deporte existente y cambia su fecha límite a una fecha pasada; confirma que deja de estar disponible en `/panel/deportes`.
- [ ] Intenta desactivarlo y confirma que desaparece de las opciones del grupo pero no borra las inscripciones ya hechas.

### 2.7 Participantes (`/admin/participantes`)
- [ ] Busca participantes por nombre/documento; confirma que el buscador filtra bien (nota: filtra en el cliente, hasta 300 filas — con pocos participantes de prueba no vas a notar el límite, pero es bueno saber que existe).
- [ ] Verifica que puedas ver a qué grupo, deportes y equipos pertenece cada uno.

### 2.8 Equipos (`/admin/equipos`)
- [ ] Lista todos los equipos armados por todos los grupos, con su estado de alineación (completo/incompleto).

### 2.9 Solicitudes intergrupales (`/admin/intergrupales`)
- [ ] Ve una solicitud de préstamo de participante entre grupos (créala primero desde el panel de un grupo, ver 3.6) y confirma que el admin pueda verla/gestionarla si el flujo lo requiere.

### 2.10 Pagos (`/admin/pagos`)
- [ ] Ve un pago con comprobante subido (créalo primero desde 3.7) en estado pendiente de revisión.
- [ ] Abre el comprobante: debe cargar por una URL firmada (revisa que la URL tenga una expiración corta, no un link público permanente).
- [ ] Aprueba el pago: el estado de la inscripción asociada debe pasar a confirmado.
- [ ] En otro pago, recházalo con motivo: el grupo debe poder ver el motivo y volver a subir un comprobante.
- [ ] Intenta borrar o reemplazar el comprobante de un pago ya **aprobado**: no debería dejarte (invariante mencionada en el README).

### 2.11 Stands (`/admin/stands`)
- [ ] Confirma el cupo total de stands configurado.
- [ ] Con varios grupos solicitando stand (ver 3.8), verifica que al llegar al cupo ya no se puedan crear más solicitudes — **incluyendo** las que están en pago pendiente, no solo las aprobadas (esa es justamente la corrección sobre el prototipo).

### 2.12 Reportes (`/admin/reportes`)
- [ ] Exporta a CSV y ábrelo: los datos deben coincidir con lo cargado, sin columnas corridas por comas dentro de un campo.
- [ ] Exporta a Excel (.xlsx) y confirma que tenga una hoja por sección.

### 2.13 Configuración (`/admin/configuracion`)
- [ ] Cambia el nombre del evento y confirma que se refleje en el encabezado de toda la app (barra lateral) y en los correos.
- [ ] Cambia las tarifas generales (`individual_fee`, `group_team_fee`, `stand_fee`) y confirma que los deportes **sin tarifa propia** las hereden.
- [ ] Prueba el interruptor de "inscripciones abiertas/cerradas": con inscripciones cerradas, `/registro` debe rechazar nuevas solicitudes (revisa el mensaje: "Las inscripciones están cerradas por ahora").

---

## 3 · Panel del grupo scout

Usa una de las cuentas de grupo que aprobaste en el bloque 1.

### 3.1 Inicio (`/panel/resumen`)
- [ ] El resumen refleja el estado real: país escogido o no, participantes cargados, pagos pendientes, cupo de stand.

### 3.2 Escoger país (`/panel/pais`)
- [ ] Si el grupo aún no tiene país, puede escogerlo de la lista de disponibles.
- [ ] Una vez escogido, no debería poder tomar otro sin liberar el actual (o el flujo que definiste).
- [ ] El país que ya tomó otro grupo no debe aparecer como disponible.

### 3.3 Mis participantes (`/panel/participantes`)
- [ ] Agrega un participante manualmente con todos los campos (documento, rama, fecha de nacimiento).
- [ ] Intenta crear dos participantes con el mismo tipo y número de documento **en grupos distintos**: no debería colisionar (a diferencia del prototipo, la clave es única por documento, no global — confírmalo con dos grupos de prueba).
- [ ] Intenta repetir el mismo documento **dentro del mismo grupo**: sí debe rechazarlo.
- [ ] Edita un participante y guarda: los cambios deben persistir.
- [ ] Inactiva/elimina un participante que ya está en un equipo o inscrito en un deporte: revisa qué pasa con esas inscripciones.
- [ ] **Importar CSV**: prepara un archivo con al menos una observación que tenga una coma dentro del campo (ej. `"Alergia a polen, penicilina"`) y confirma que la fila no se corrompa (esto rompía el prototipo con `split(';')`).
- [ ] **Importar CSV** con una fila con datos inválidos (fecha mal escrita, documento vacío): confirma que te muestre el error fila por fila, sin tumbar la importación completa.
- [ ] **Importar XLSX**: prueba la plantilla con las listas desplegables (rama, tipo de documento) y confirma que solo acepte los valores válidos.
- [ ] Importa un archivo con un documento duplicado dentro del mismo lote: debe señalarlo.

### 3.4 Deportes (`/panel/deportes`)
- [ ] Inscribe un participante en un deporte individual; confirma el cálculo del monto a pagar (tarifa × personas).
- [ ] Intenta inscribir a alguien en más deportes de los que permite `max_sports_per_participant`: debe bloquear con el mensaje correspondiente.
- [ ] Intenta inscribir a un participante de una rama no habilitada para ese deporte: debe rechazarlo.
- [ ] Intenta inscribirlo después de la fecha límite del deporte (o con el deporte inactivo): no debe dejar.

### 3.5 Mis equipos (`/panel/equipos`)
- [ ] Arma un equipo para un deporte grupal: agrega titulares hasta el `team_size` exacto y confirma que no te deje pasar de ese número.
- [ ] Agrega suplentes hasta el límite configurado y confirma que tampoco te deje pasarte.
- [ ] Marca un capitán que **no** esté entre los titulares: debe rechazarlo ("El capitán debe estar entre los titulares").
- [ ] Repite el mismo participante dos veces en la misma alineación: debe marcarlo como duplicado.
- [ ] Deja el equipo incompleto (menos titulares de los requeridos) e intenta pasarlo a pago: no debería dejarte hasta completarlo.
- [ ] Intenta crear más equipos de los que permite `max_teams_per_group` para ese deporte: debe bloquear al llegar al máximo.

### 3.6 Solicitudes intergrupales — préstamos (`/panel/solicitudes`)
- [ ] Desde el Grupo A, arma un equipo en un deporte con `allow_intergroup` activado y suma un integrante del Grupo B (necesitas las dos cuentas de prueba).
- [ ] Si el deporte no permite integrantes externos, confirma que lo rechace ("no permite integrantes de otros grupos").
- [ ] Pasa el número de externos por encima de `max_external`: debe bloquear.
- [ ] Con la cuenta del Grupo B, revisa que le llegue la solicitud/notificación del préstamo y pueda aceptarlo o rechazarlo.
- [ ] Si el Grupo B rechaza el préstamo, confirma que el equipo del Grupo A quede marcado como incompleto otra vez.

### 3.7 Pagos (`/panel/pagos`)
- [ ] Con un concepto que sí tiene costo, sube un comprobante (imagen o PDF) y envíalo a revisión.
- [ ] Con un concepto de **tarifa $0**, confirma que ni siquiera te pida comprobante (se salta el flujo de pago, como se corrigió del prototipo).
- [ ] Mientras el pago está "en revisión", intenta editar la inscripción asociada: no debería dejarte (`isEditableRegistration` la bloquea).
- [ ] Si el admin lo rechaza (2.10), vuelve a subir un comprobante nuevo y reenvíalo.
- [ ] Una vez aprobado, confirma que el estado pase a confirmado y ya no se pueda modificar ni borrar el comprobante.

### 3.8 Mi stand (`/panel/stand`)
- [ ] Solicita un stand con sus datos (producto, responsable, etc.).
- [ ] Edita la solicitud **antes** de que el admin la revise: confirma que se actualice en el mismo registro y no cree uno duplicado (bug del prototipo: `editStand()` borraba antes de confirmar).
- [ ] Cancela la solicitud a medio llenar: no debe perderse el cupo de otro grupo ni dejar datos huérfanos.
- [ ] Con el cupo de stands ya lleno (2.11), confirma que un grupo nuevo no pueda solicitar uno.

---

## 4 · Multi-dispositivo y tiempo real

Necesitas dos ventanas abiertas a la vez (una por sesión).

- [ ] 4.1 Con el admin en `/admin/solicitudes` en una ventana, aprueba una solicitud desde **otra** ventana/dispositivo: la primera debe actualizarse sola, sin recargar.
- [ ] 4.2 Con dos grupos en `/panel/pais` al mismo tiempo, haz que ambos intenten escoger el **mismo país** casi simultáneamente: solo uno debe ganarlo, y el otro debe ver un mensaje claro (no un error críptico ni que se quede colgado).
- [ ] 4.3 Con un grupo en `/panel/resumen` y el admin aprobando un pago suyo desde otra ventana, confirma que el estado se actualice en vivo del lado del grupo.
- [ ] 4.4 Cierra una de las dos ventanas y confirma que la otra no quede en un estado raro (reconexión del canal de tiempo real).

---

## 5 · Seguridad (con cuidado, pero vale la pena probarlo)

- [ ] 5.1 Logueado como Grupo A, intenta adivinar la URL de un recurso del Grupo B (por ejemplo, cambiar un id en la URL de un participante o pago ajeno). RLS debe bloquear el acceso a nivel de base de datos, no solo esconder el botón en la interfaz.
- [ ] 5.2 Prueba `/ingresar?siguiente=//sitio-cualquiera.com` y confirma que **no** te saque del sitio tras iniciar sesión (la corrección de redirección abierta que hicimos).
- [ ] 5.3 Copia el link de un comprobante de pago (URL firmada) y ábrelo de nuevo pasados unos minutos: debe haber expirado.
- [ ] 5.4 Intenta abrir la consola del navegador y llamar directamente a Supabase con la clave `anon` para leer datos de otro grupo: RLS debe negarlo (a diferencia del prototipo, donde bastaba escribir `session = {role: 'admin'}`).
- [ ] 5.5 Sin sesión, intenta leer las tablas `participants` o `payments` desde la consola con la clave `anon`: debe negarlo. Solo las tres vistas públicas deben responder.

---

## 6 · Árbitros (`/admin/arbitros`)

- [ ] 6.1 Registra un árbitro con un correo tuyo y asígnale dos deportes. Debe llegarle (o imprimirse en la consola) el correo con la contraseña temporal.
- [ ] 6.2 Intenta registrar otro con el mismo correo: debe rechazarlo.
- [ ] 6.3 Ingresa con esas credenciales: el sistema debe obligarte a cambiar la contraseña y luego llevarte a `/arbitraje`, no a `/panel` ni a `/admin`.
- [ ] 6.4 Logueado como árbitro, intenta entrar a `/admin` y a `/panel` por URL: debe rebotarte a `/arbitraje`.
- [ ] 6.5 Edita el árbitro y quítale un deporte: al programar ese deporte ya no debe aparecer como opción.
- [ ] 6.6 Desactívalo y confirma que deja de ver sus competencias, pero que los resultados que ya publicó siguen visibles en `/resultados`.

---

## 7 · Programación (`/admin/programacion`)

### Deportes grupales
- [ ] 7.1 Con **un solo** equipo completo, intenta generar: debe avisar que hacen falta al menos dos.
- [ ] 7.2 Con tres equipos completos, genera y confirma que salgan exactamente **3 partidos** (todos contra todos), no 6 ni 9.
- [ ] 7.3 Verifica que ningún equipo se enfrente a sí mismo y que las horas avancen según el intervalo que pusiste.
- [ ] 7.4 Cambia el intervalo a menos de 5 minutos: debe rechazarlo.

### Deportes individuales
- [ ] 7.5 Con `session_capacity` en 2 y cinco inscritos, genera y confirma que salgan **3 sesiones** (2 + 2 + 1) y que nadie quede fuera.
- [ ] 7.6 Sin inscritos, intenta generar: debe avisar en lugar de crear una sesión vacía.

### Regenerar
- [ ] 7.7 Publica el resultado de un partido, vuelve a generar esa misma categoría y confirma que **ese partido se conserva** y solo se rehacen los demás.
- [ ] 7.8 Marca «incluir inscripciones no confirmadas» y confirma que entren equipos cuyo pago aún está en revisión.
- [ ] 7.9 Genera sin asignar árbitro: debe quedar marcado «Sin árbitro» y el contador del panel debe reflejarlo.
- [ ] 7.10 Elimina una competencia sin publicar: debe desaparecer. Intenta eliminar una publicada: el botón debe ser «Retirar del portal público», no «Eliminar».

---

## 8 · Resultados

### Partidos
- [ ] 8.1 Como árbitro, registra un marcador y guarda **borrador**. Abre `/resultados` sin sesión: **no** debe aparecer.
- [ ] 8.2 Publícalo y vuelve a `/resultados`: ahora sí debe verse, marcado como oficial.
- [ ] 8.3 Edita un resultado ya publicado y confirma que el portal se actualiza.
- [ ] 8.4 Como admin, «Retirar del portal público» y confirma que desaparece de `/resultados`.

### Sesiones individuales
- [ ] 8.5 Registra marcas y confirma que el puesto se calcule solo, en el sentido correcto: en atletismo (tiempo) gana el **más bajo**; en ajedrez (puntos) gana el **más alto**.
- [ ] 8.6 Marca a alguien como **descalificado** aunque tenga la mejor marca: debe quedar sin puesto, no primero.
- [ ] 8.7 Deja a alguien **sin marca** (casilla vacía): debe quedar sin puesto, y no contarse como cero.
- [ ] 8.8 Publica y revisa la clasificación general: debe tomar la **mejor marca** de cada persona entre todas sus sesiones, no la última.

### Permisos
- [ ] 8.9 Con la sesión de un árbitro, intenta abrir una competencia asignada a **otro** árbitro (cambiando el id en la URL si hace falta): debe negarlo.
- [ ] 8.10 Como administrador, registra un resultado directamente: debe permitirlo (es el respaldo cuando el árbitro no puede).

---

## 9 · Portal público (`/resultados`)

- [ ] 9.1 Ábrelo en una ventana **sin sesión**: debe cargar sin pedir credenciales.
- [ ] 9.2 Confirma que **no** aparezca nada de: documentos, correos, teléfonos, pagos ni resultados en borrador.
- [ ] 9.3 Prueba los filtros por deporte y por rama en las tres pestañas.
- [ ] 9.4 **Tabla de posiciones:** con dos equipos y un 3–1, el ganador debe tener 3 puntos y +2 de diferencia; el perdedor 0 y −2. Con un empate, 1 punto cada uno.
- [ ] 9.5 Juega un tercer partido y verifica que el desempate sea por diferencia de gol antes que por goles a favor.
- [ ] 9.6 **Clasificación individual:** confirma el orden y que los descalificados no aparezcan.

---

## 10 · Ramas y edad

- [ ] 10.1 Confirma que existan las **siete** ramas con su rango en `/admin/ramas`.
- [ ] 10.2 Intenta crear un participante de 9 años en Rovers (18–20): debe rechazarlo con un mensaje claro.
- [ ] 10.3 Crea uno de 13 años en Scouts: debe aceptarlo.
- [ ] 10.4 Edita a alguien y cámbiale la rama a una que no corresponda a su edad: debe rechazarlo también al editar, no solo al crear.
- [ ] 10.5 Alguien de 11 años debe poder estar tanto en Webelos (10–11) como en Scouts (11–14): los rangos se solapan a propósito.
- [ ] 10.6 Importa un CSV con una fecha de nacimiento que no corresponda a la rama: debe señalar esa fila sin tumbar el resto.

---

## 11 · Aprobación de alianzas (`/admin/intergrupales`)

- [ ] 11.1 Completa el circuito hasta que el Grupo A acepte la propuesta del Grupo B. La solicitud debe quedar en **«Revisión de la organización»**, no en «Aceptada».
- [ ] 11.2 Con esa alianza pendiente, el Grupo A **no** debe poder pagar el equipo, aunque se vea completo. Debe explicarle por qué.
- [ ] 11.3 Como admin, intenta **rechazar sin motivo**: debe exigirlo.
- [ ] 11.4 Rechaza con motivo: los prestados deben **salir de la alineación**, el equipo volver a quedar incompleto, y ambos grupos recibir el motivo por correo.
- [ ] 11.5 Repite y esta vez **aprueba**: el equipo debe poder pagar de inmediato.
- [ ] 11.6 Verifica que el contador de «Intergrupales» en el menú del admin muestre las que esperan revisión.

---

## 12 · Reportes nuevos

- [ ] 12.1 Exporta **CSV programación** y confirma fecha, hora, lugar, árbitro y estado de cada competencia.
- [ ] 12.2 Exporta **CSV resultados** y confirma que traiga una fila por partido y una por cada marca de sesión, con puesto y descalificaciones.
- [ ] 12.3 Exporta el **Excel completo** y confirma que tenga las hojas nuevas: Programación y Resultados.

---

## Cómo reportar lo que encuentres

Para cada falla, anota:

1. **Ruta** exacta (`/panel/deportes`, etc.).
2. **Usuario** con el que estabas (admin, o qué grupo).
3. **Pasos** para reproducirlo.
4. **Qué esperabas** vs. **qué pasó**.
5. Si hay error en pantalla o en la consola del navegador (F12 → Console), cópialo tal cual.

Con eso puedo ir corrigiendo uno por uno, igual que hicimos con el login y las variables de entorno.
