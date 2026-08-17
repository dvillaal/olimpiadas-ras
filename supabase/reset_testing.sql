-- ============================================================================
-- Olimpiadas Scouts · Reinicio para pruebas
-- ============================================================================
-- Borra TODO lo transaccional (grupos, participantes, equipos, pagos,
-- inscripciones, stands, solicitudes intergrupales, notificaciones,
-- programación/resultados) y también deportes y ramas, para volver a
-- configurarlos desde cero.
--
-- SE CONSERVA:
--   · public.settings                      (configuración del evento)
--   · public.countries                     (catálogo de países)
--   · public.profiles con role = 'admin'   (cuentas de administrador)
--   · public.referees / referee_sports*    (cuentas de árbitro)
--   · auth.users correspondientes a admin y árbitros
--
-- * referee_sports se borra porque depende de sports (cascade), pero la fila
--   de referees en sí y su cuenta de auth.users NO se tocan.
--
-- Los perfiles y cuentas de auth.users de los jefes de grupo SÍ se borran,
-- pero solo pueden eliminarse desde `auth.users` con permisos de servicio
-- (Supabase Admin API o el dashboard) — este script deja `public.profiles`
-- y `public.groups` limpios; el paso de borrar las cuentas de Auth va aparte
-- (ver reset_testing_auth.mjs en esta misma carpeta).
--
-- ⚠️  IRREVERSIBLE. Ejecuta esto solo contra la base de pruebas / antes de
--     lanzar el evento real. Revisa los conteos del paso 0 antes de seguir.
-- ============================================================================

begin;

-- ─── 0. Diagnóstico previo: cuántas filas hay antes de borrar ────────────────
-- (Solo informativo — revisa el resultado antes de hacer COMMIT al final.)
select
  (select count(*) from public.groups)                    as groups,
  (select count(*) from public.profiles where role = 'group') as group_profiles,
  (select count(*) from public.participants)               as participants,
  (select count(*) from public.teams)                      as teams,
  (select count(*) from public.payments)                   as payments,
  (select count(*) from public.stands)                     as stands,
  (select count(*) from public.individual_registrations)   as individual_registrations,
  (select count(*) from public.intergroup_requests)        as intergroup_requests,
  (select count(*) from public.schedules)                  as schedules,
  (select count(*) from public.sports)                     as sports,
  (select count(*) from public.branches)                   as branches,
  (select count(*) from public.notifications)               as notifications;

-- ─── 1. Grupos ────────────────────────────────────────────────────────────────
-- El cascade de `groups` arrastra automáticamente:
--   profiles (role='group'), participants, teams, team_members,
--   individual_registrations, individual_registration_participants,
--   intergroup_requests, intergroup_proposals, stands, payments, notifications
delete from public.groups;

-- ─── 2. Deportes ────────────────────────────────────────────────────────────
-- El cascade de `sports` arrastra: sport_branches, teams (por si quedara
-- alguno huérfano), individual_registrations, referee_sports, schedules,
-- schedule_participants.
delete from public.sports;

-- ─── 3. Ramas ───────────────────────────────────────────────────────────────
-- Ya sin deportes ni participantes que las referencien, se pueden borrar.
delete from public.branches;

-- ─── 4. Bitácora y correos (opcional) ────────────────────────────────────────
-- Descomenta si también quieres limpiar el historial de auditoría y de envíos.
-- delete from public.audit_log;
-- delete from public.email_log;

-- ─── 5. Verificación posterior ────────────────────────────────────────────────
select
  (select count(*) from public.groups)   as groups_restantes,
  (select count(*) from public.profiles) as profiles_restantes,
  (select count(*) from public.profiles where role = 'admin') as admins_restantes,
  (select count(*) from public.referees) as referees_restantes,
  (select count(*) from public.sports)   as sports_restantes,
  (select count(*) from public.branches) as branches_restantes,
  (select count(*) from public.settings) as settings_restantes,
  (select count(*) from public.countries) as countries_restantes;

-- Revisa que:
--   · groups_restantes = 0
--   · profiles_restantes = admins_restantes + referees_restantes
--   · sports_restantes = 0, branches_restantes = 0
--   · settings_restantes = 1, countries_restantes = (sin cambios)
--
-- Si todo cuadra:
commit;
-- Si algo no cuadra, ejecuta ROLLBACK; en su lugar, ANTES del commit.
