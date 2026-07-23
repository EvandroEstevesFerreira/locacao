-- ============================================================================
-- Fase 4 — Financeiro (contas a pagar das locações)
-- ============================================================================

create type public.status_lancamento as enum ('pendente', 'pago');

create table public.lancamento_financeiro (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  obra_id         uuid not null references public.obra (id) on delete restrict,
  contrato_id     uuid references public.contrato_locacao (id) on delete set null,
  descricao       text not null,
  competencia     date not null,               -- mês de referência (usar dia 1)
  valor           numeric(14, 2) not null,
  vencimento      date not null,
  status          public.status_lancamento not null default 'pendente',
  data_pagamento  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_lancamento_org on public.lancamento_financeiro (org_id);
create index idx_lancamento_obra on public.lancamento_financeiro (obra_id);
create index idx_lancamento_venc on public.lancamento_financeiro (vencimento);
create index idx_lancamento_status on public.lancamento_financeiro (status);

create trigger trg_lancamento_updated_at
  before update on public.lancamento_financeiro
  for each row execute function public.set_updated_at();

alter table public.lancamento_financeiro enable row level security;

create policy "lancamento_select" on public.lancamento_financeiro
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "lancamento_insert" on public.lancamento_financeiro
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or (public.current_papel() = 'gestor' and public.is_member_of_obra(obra_id))
    )
  );

create policy "lancamento_update" on public.lancamento_financeiro
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or (public.current_papel() = 'gestor' and public.is_member_of_obra(obra_id))
    )
  )
  with check (org_id = public.current_org_id());

create policy "lancamento_delete" on public.lancamento_financeiro
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'financeiro')
  );
