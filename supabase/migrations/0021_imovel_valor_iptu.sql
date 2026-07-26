-- ============================================================================
-- Módulo Imóveis — valor de IPTU no contrato (soma ao custo mensal)
-- ============================================================================
alter table public.contrato_imovel
  add column if not exists valor_iptu numeric(14, 2) not null default 0;

notify pgrst, 'reload schema';
