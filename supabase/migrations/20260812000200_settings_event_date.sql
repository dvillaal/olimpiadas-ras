-- ============================================================================
-- Fecha de inicio del evento, para la cuenta regresiva del panel del grupo.
-- ============================================================================

alter table public.settings add column if not exists event_starts_at timestamptz;

comment on column public.settings.event_starts_at is
  'Fecha y hora de inicio del evento. Alimenta la cuenta regresiva del panel de cada grupo. NULL = sin definir todavía.';
