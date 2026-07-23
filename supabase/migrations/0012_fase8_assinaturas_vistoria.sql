-- ============================================================================
-- Fase 8 — Assinaturas e observações no relatório de vistoria
-- ----------------------------------------------------------------------------
-- Duas assinaturas por vistoria: representante da empresa (Sistenge) e a pessoa
-- que retira/recebe. Cada uma tem NOME (sempre) + imagem desenhada OPCIONAL
-- (data URI PNG, guardada direto na coluna text por ser pequena).
-- `observacoes` já existe na tabela vistoria; aqui só entram as assinaturas.
-- ============================================================================

alter table public.vistoria
  add column if not exists assinatura_empresa_nome    text,
  add column if not exists assinatura_empresa_img     text,
  add column if not exists assinatura_retirante_nome  text,
  add column if not exists assinatura_retirante_img   text;
