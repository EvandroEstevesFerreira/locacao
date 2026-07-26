-- ============================================================================
-- Módulo Imóveis — Fase 2: contas de consumo (mês a mês) + integração financeira
-- ============================================================================

create table if not exists public.conta_consumo (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  imovel_id      uuid not null references public.imovel (id) on delete cascade,
  tipo           text not null default 'outro',   -- agua|luz|gas|internet|iptu|outro
  competencia    date not null,                    -- mês de referência (dia 1)
  valor          numeric(14, 2) not null default 0,
  vencimento     date,
  pago           boolean not null default false,
  anexo_path     text,
  lancamento_id  uuid references public.lancamento_financeiro (id) on delete set null,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_conta_consumo_imovel on public.conta_consumo (imovel_id);

create trigger trg_conta_consumo_updated_at
  before update on public.conta_consumo
  for each row execute function public.set_updated_at();

alter table public.conta_consumo enable row level security;

drop policy if exists "conta_consumo_select" on public.conta_consumo;
drop policy if exists "conta_consumo_write" on public.conta_consumo;
create policy "conta_consumo_select" on public.conta_consumo
  for select to authenticated
  using (org_id = public.current_org_id());
create policy "conta_consumo_write" on public.conta_consumo
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

notify pgrst, 'reload schema';
