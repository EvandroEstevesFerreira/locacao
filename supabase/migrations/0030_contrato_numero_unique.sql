-- ============================================================================
-- Unicidade do número de contrato por organização (evita duplicatas).
-- Índice parcial: ignora números nulos. Se houver duplicatas pré-existentes,
-- esta migration falha — resolva os duplicados antes de aplicar.
-- ============================================================================
create unique index if not exists uq_contrato_numero_org
  on public.contrato_locacao (org_id, numero)
  where numero is not null;

notify pgrst, 'reload schema';
