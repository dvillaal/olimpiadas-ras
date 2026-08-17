-- ============================================================================
-- Quita teléfono y correo del participante
-- ============================================================================
-- La organización decidió no recolectar estos datos: no se piden en la
-- plantilla de importación ni en el alta manual, y no se usan en ningún
-- flujo de negocio (a diferencia de `active`, que sí decide si alguien puede
-- inscribirse y se conserva).
--
-- Nada más en el esquema depende de estas columnas: no hay índices,
-- constraints ni funciones que las referencien (solo `full_name` está
-- indexado para búsqueda). Es seguro eliminarlas directamente.
-- ============================================================================

alter table public.participants
  drop column if exists phone,
  drop column if exists email;
