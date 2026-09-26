-- ============================================================================
-- Reinicio del playground (con datos confirmados de por medio)
-- ============================================================================
-- ⚠️  SOLO para el proyecto de Supabase de pruebas. Esto desactiva TODOS los
--     disparadores mientras corre — jamás lo pegues en el proyecto real.
--
-- `supabase/reset_testing.sql` por sí solo no alcanza aquí: borra grupos con
-- un DELETE en cascada, y `tg_protect_confirmed` bloquea borrar una
-- inscripción o un equipo ya 'confirmed' si quien lo hace no es
-- administrador — y en el Editor SQL no hay una sesión de administrador
-- autenticada, así que ese bloqueo salta siempre. `playground_seed.sql` deja
-- todo en 'confirmed' a propósito (para que se pueda generar el calendario
-- sin más pasos), así que el playground necesita este empujón extra.
--
-- `session_replication_role = replica` apaga los disparadores de usuario
-- durante la transacción (Postgres los trata como si esto fuera una réplica
-- aplicando cambios ya validados en el origen) y se restaura solo al
-- terminar. Con eso, el mismo `reset_testing.sql` corre limpio.
-- ============================================================================

begin;

set local session_replication_role = replica;

delete from public.groups;
delete from public.sports;
delete from public.branches;

commit;

-- Vuelve a dejar países, ramas y deportes (branches/sports se borraron
-- arriba, igual que en reset_testing.sql). Corre supabase/seed.sql después de
-- este script si quieres reconfigurar desde cero, o supabase/playground_seed.sql
-- directamente si seed.sql ya está aplicado y solo quieres los datos de
-- prueba de vuelta.

select
  (select count(*) from public.groups)   as grupos_restantes,
  (select count(*) from public.sports)   as deportes_restantes,
  (select count(*) from public.branches) as ramas_restantes,
  (select count(*) from public.profiles where role = 'admin') as admins_restantes,
  (select count(*) from public.referees) as arbitros_restantes;
