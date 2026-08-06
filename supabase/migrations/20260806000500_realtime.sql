-- ============================================================================
-- Olimpiadas Scouts · Replicación en tiempo real
-- ============================================================================
-- Publica los cambios de las tablas que la interfaz observa. Realtime respeta
-- RLS, así que cada grupo solo recibe eventos de las filas que ya podría leer.
--
-- Se publican solo las tablas donde un cambio ajeno afecta lo que ves en
-- pantalla: la lista completa encarecería la replicación sin beneficio.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'groups',              -- aprobación del grupo y liberación de países
    'countries',           -- reservas hechas por el administrador
    'payments',            -- resultado de la revisión de un pago
    'teams',               -- confirmación de equipos
    'intergroup_requests', -- ida y vuelta entre grupos
    'stands',              -- cupos de stands
    'notifications',       -- bandeja de avisos
    'participants'         -- importaciones masivas
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
exception
  -- En un Postgres sin la publicación de Supabase (por ejemplo, la validación
  -- local con PGlite) esto no aplica y no debe romper la migración.
  when undefined_object then
    raise notice 'La publicación supabase_realtime no existe; se omite.';
end;
$$;

-- Para que Realtime entregue también los valores anteriores en UPDATE y DELETE
-- (necesario para filtrar por group_id cuando la fila cambia de dueño).
alter table public.payments            replica identity full;
alter table public.intergroup_requests replica identity full;
alter table public.notifications       replica identity full;
