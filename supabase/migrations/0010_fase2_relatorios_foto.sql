-- ============================================================================
-- Rodada 2 — Relatórios fotográficos de retirada e devolução
-- Liga o fluxo do contrato às vistorias (fotos) já existentes.
-- ============================================================================

-- Relatório fotográfico de retirada do contrato (um por contrato).
alter table public.contrato_locacao
  add column vistoria_retirada_id uuid
    references public.vistoria (id) on delete set null;

-- Relatório fotográfico daquela devolução (movimentação).
alter table public.movimentacao
  add column vistoria_id uuid
    references public.vistoria (id) on delete set null;
