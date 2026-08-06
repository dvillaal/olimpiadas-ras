-- ============================================================================
-- Olimpiadas Scouts · Almacenamiento de comprobantes
-- ============================================================================
-- Los comprobantes de pago son documentos sensibles: van a un bucket PRIVADO.
-- Se acceden únicamente por URL firmada de corta duración generada en el
-- servidor. Convención de rutas: comprobantes/<group_id>/<uuid>.<ext>
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes',
  'comprobantes',
  false,
  8388608, -- 8 MB; debe ir alineado con settings.max_proof_mb
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El primer segmento de la ruta es el id del grupo dueño del archivo.
create policy "comprobantes: el grupo sube los suyos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = public.current_group_id()::text
  );

create policy "comprobantes: el grupo lee los suyos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.current_group_id()::text
    )
  );

create policy "comprobantes: el grupo reemplaza los suyos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'comprobantes'
    and (storage.foldername(name))[1] = public.current_group_id()::text
  );

-- Un comprobante ligado a un pago aprobado no se borra: es soporte contable.
create policy "comprobantes: borrado restringido"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] = public.current_group_id()::text
        and not exists (
          select 1 from public.payments p
          where p.proof_path = storage.objects.name and p.status = 'approved'
        )
      )
    )
  );
