-- ============================================================================
-- Módulo Imóveis — seguro fiança no contrato.
-- Valor com flag que decide se entra (ou não) no total/parcela mensal.
-- ============================================================================
alter table public.contrato_imovel
  add column if not exists seguro_fianca        numeric(14, 2) not null default 0,
  add column if not exists seguro_fianca_mensal boolean        not null default true;

notify pgrst, 'reload schema';
