-- ============================================================================
-- Integridade de dados: versiona coluna aplicada fora de banda + índices de FK.
-- ============================================================================

-- Migration drift: o código lê/grava config_alerta.dias_alerta (array), mas a
-- coluna nunca foi versionada. Registra aqui (idempotente).
alter table public.config_alerta
  add column if not exists dias_alerta int[];

-- Índices em FKs muito consultadas (joins do cron, relatórios e sincronização).
create index if not exists idx_item_locado_item on public.item_locado (item_id);
create index if not exists idx_lancamento_contrato on public.lancamento_financeiro (contrato_id);
create index if not exists idx_obra_usuario_perfil on public.obra_usuario (perfil_id);

notify pgrst, 'reload schema';
