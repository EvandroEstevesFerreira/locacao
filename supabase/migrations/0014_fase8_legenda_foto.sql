-- ============================================================================
-- Fase 8 (compl.) — Legenda por foto de vistoria
-- ============================================================================

alter table public.vistoria_foto
  add column if not exists legenda text;
