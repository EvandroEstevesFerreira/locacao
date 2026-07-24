-- ============================================================================
-- Fase 8 (compl.) — Data/hora de cada assinatura da vistoria
-- ============================================================================

alter table public.vistoria
  add column if not exists assinatura_empresa_em   timestamptz,
  add column if not exists assinatura_retirante_em timestamptz;
