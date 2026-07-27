-- ============================================================================
-- Soft-delete em entidades críticas: em vez de apagar, marca deleted_at.
-- A exclusão vira UPDATE; as listagens filtram deleted_at IS NULL no código.
-- Preserva histórico e permite restauração/auditoria.
-- ============================================================================
alter table public.obra                  add column if not exists deleted_at timestamptz;
alter table public.contrato_locacao      add column if not exists deleted_at timestamptz;
alter table public.lancamento_financeiro add column if not exists deleted_at timestamptz;
alter table public.imovel                add column if not exists deleted_at timestamptz;

create index if not exists idx_obra_deleted on public.obra (deleted_at);
create index if not exists idx_contrato_deleted on public.contrato_locacao (deleted_at);
create index if not exists idx_lancamento_deleted on public.lancamento_financeiro (deleted_at);
create index if not exists idx_imovel_deleted on public.imovel (deleted_at);

notify pgrst, 'reload schema';
