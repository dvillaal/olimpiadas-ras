-- ============================================================================
-- Corrige que eliminar un equipo/inscripción/stand no borrara nada
-- ============================================================================
-- `tg_protect_confirmed()` está declarado `before update or delete` sobre
-- teams, individual_registrations y stands. El cuerpo siempre hacía
-- `return new`, pero en un DELETE no existe fila NEW (es NULL). Un trigger
-- BEFORE que retorna NULL le dice a Postgres "cancela la operación en esta
-- fila" — sin lanzar ningún error. Resultado: `delete from teams where ...`
-- se ejecutaba sin fallar, pero no borraba nada, y el usuario no veía ningún
-- mensaje que explicara por qué.
--
-- La regla de negocio (nadie salvo el administrador toca algo ya confirmado)
-- sigue siendo válida; el arreglo es devolver `old` cuando la operación es un
-- DELETE, que es lo que hace que Postgres continúe y borre la fila.
-- ============================================================================

create or replace function public.tg_protect_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'confirmed' and not public.is_admin() then
    raise exception 'Una inscripción confirmada solo puede modificarla el administrador.'
      using errcode = 'insufficient_privilege';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;
