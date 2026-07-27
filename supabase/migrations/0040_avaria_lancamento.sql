-- ============================================================================
-- v0.16.0 — Avaria "cobrada" gera lançamento financeiro (vínculo 1:1)
-- ============================================================================

alter table public.avaria
  add column if not exists lancamento_id uuid
    references public.lancamento_financeiro (id) on delete set null;
