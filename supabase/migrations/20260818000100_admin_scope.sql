-- ============================================================================
-- Olimpiadas Scouts · Administradores con permisos reducidos (admin_scope)
-- ============================================================================
-- Hasta ahora "admin" era binario: cualquier perfil con role = 'admin' veía
-- absolutamente todo. Se necesita poder dar de alta administradores de
-- apoyo que NO vean la bitácora de auditoría (audit_log) ni el registro de
-- correos (email_log), y que tampoco puedan crear otros administradores.
--
-- En vez de ampliar el enum `user_role` (que rompería `homeForRole()` y las
-- funciones que asumen exactamente 3 roles: admin/group/referee), se agrega
-- una columna de alcance específica de los perfiles admin, siguiendo el
-- mismo patrón de `is_admin()` / `is_referee()` ya usado en el esquema.
-- ============================================================================

create type public.admin_scope as enum ('full', 'limited');

alter table public.profiles
  add column admin_scope public.admin_scope not null default 'full';

-- Solo tiene sentido en perfiles admin; el resto de roles no usa esta columna.
alter table public.profiles add constraint profiles_admin_scope_consistency check (
  (role = 'admin') or (admin_scope = 'full')
);

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role = 'admin' and admin_scope = 'full' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- La bitácora y el registro de correos quedan reservados a administradores
-- completos: un admin limitado no debe poder leerlos ni siquiera con una
-- consulta directa desde el cliente autenticado.
drop policy if exists audit_log_admin on public.audit_log;
create policy audit_log_admin on public.audit_log
  for select to authenticated using (public.is_full_admin());

drop policy if exists email_log_admin on public.email_log;
create policy email_log_admin on public.email_log
  for select to authenticated using (public.is_full_admin());
