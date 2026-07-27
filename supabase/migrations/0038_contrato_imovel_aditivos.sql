-- ============================================================================
-- v0.11.0 — Contratos de imóvel: aditivos/reajuste com efeito + encerramento
--           + histórico versionado (timeline).
-- ============================================================================

alter table public.contrato_imovel
  add column if not exists data_encerramento  date,
  add column if not exists motivo_encerramento text;

-- Histórico de eventos do contrato (aditivo, reajuste, encerramento, renovação).
create table if not exists public.contrato_imovel_historico (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  imovel_id     uuid not null references public.imovel (id) on delete cascade,
  contrato_id   uuid not null references public.contrato_imovel (id) on delete cascade,
  tipo          text not null,               -- aditivo | reajuste | encerramento | renovacao
  descricao     text not null,
  data_efeito   date not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_contrato_imovel_hist_contrato
  on public.contrato_imovel_historico (contrato_id);

alter table public.contrato_imovel_historico enable row level security;

drop policy if exists "contrato_imovel_hist_select" on public.contrato_imovel_historico;
drop policy if exists "contrato_imovel_hist_write" on public.contrato_imovel_historico;

create policy "contrato_imovel_hist_select" on public.contrato_imovel_historico
  for select to authenticated
  using (org_id = public.current_org_id() and public.has_imovel_access(imovel_id));

create policy "contrato_imovel_hist_write" on public.contrato_imovel_historico
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar() and public.has_imovel_access(imovel_id))
  with check (org_id = public.current_org_id() and public.pode_operar() and public.has_imovel_access(imovel_id));
