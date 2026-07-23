-- ============================================================================
-- Fase 2 — Contratos de locação, itens locados e movimentação
-- ============================================================================

create type public.cadencia_cobranca as enum ('diaria', 'semanal', 'quinzenal', 'mensal');
create type public.status_contrato as enum ('ativo', 'encerrado', 'cancelado');
create type public.status_item_locado as enum ('em_aberto', 'devolvido');

-- ---------------------------------------------------------------------------
-- contrato_locacao
-- ---------------------------------------------------------------------------
create table public.contrato_locacao (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizacao (id) on delete cascade,
  obra_id            uuid not null references public.obra (id) on delete restrict,
  fornecedor_id      uuid not null references public.fornecedor (id) on delete restrict,
  numero             text not null,
  cadencia           public.cadencia_cobranca not null,
  data_inicio        date not null,
  data_fim_prevista  date,
  status             public.status_contrato not null default 'ativo',
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_contrato_org on public.contrato_locacao (org_id);
create index idx_contrato_obra on public.contrato_locacao (obra_id);
create index idx_contrato_fornecedor on public.contrato_locacao (fornecedor_id);

create trigger trg_contrato_updated_at
  before update on public.contrato_locacao
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- item_locado (linha do contrato)
-- ---------------------------------------------------------------------------
create table public.item_locado (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizacao (id) on delete cascade,
  contrato_id             uuid not null references public.contrato_locacao (id) on delete cascade,
  item_id                 uuid not null references public.item_catalogo (id) on delete restrict,
  quantidade              numeric(14, 2) not null default 1,
  valor_unitario_periodo  numeric(14, 2) not null default 0,
  data_retirada           date not null,
  data_devolucao_prevista date,
  data_devolucao          date,
  status                  public.status_item_locado not null default 'em_aberto',
  observacoes             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_item_locado_contrato on public.item_locado (contrato_id);
create index idx_item_locado_org on public.item_locado (org_id);

create trigger trg_item_locado_updated_at
  before update on public.item_locado
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- movimentacao (devoluções — a retirada é a criação do item_locado)
-- ---------------------------------------------------------------------------
create type public.tipo_movimentacao as enum ('retirada', 'devolucao');

create table public.movimentacao (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  item_locado_id  uuid not null references public.item_locado (id) on delete cascade,
  tipo            public.tipo_movimentacao not null default 'devolucao',
  quantidade      numeric(14, 2) not null,
  data            date not null,
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index idx_mov_item_locado on public.movimentacao (item_locado_id);
create index idx_mov_org on public.movimentacao (org_id);

-- ---------------------------------------------------------------------------
-- Acesso a contrato (SECURITY DEFINER; lê contrato + obra_usuario, sem recursão)
-- ---------------------------------------------------------------------------
create or replace function public.has_contrato_access(p_contrato_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contrato_locacao c
    where c.id = p_contrato_id
      and c.org_id = public.current_org_id()
      and (
        public.current_papel() in ('admin', 'financeiro')
        or public.is_member_of_obra(c.obra_id)
      )
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.contrato_locacao enable row level security;
alter table public.item_locado      enable row level security;
alter table public.movimentacao     enable row level security;

-- contrato: leitura por acesso à obra; escrita admin/gestor com acesso.
create policy "contrato_select" on public.contrato_locacao
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "contrato_insert" on public.contrato_locacao
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
    and (public.current_papel() = 'admin' or public.is_member_of_obra(obra_id))
  );

create policy "contrato_update" on public.contrato_locacao
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
    and (public.current_papel() = 'admin' or public.is_member_of_obra(obra_id))
  )
  with check (org_id = public.current_org_id());

create policy "contrato_delete" on public.contrato_locacao
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
    and (public.current_papel() = 'admin' or public.is_member_of_obra(obra_id))
  );

-- item_locado: leitura por acesso ao contrato; escrita admin/gestor.
create policy "item_locado_select" on public.item_locado
  for select to authenticated
  using (org_id = public.current_org_id() and public.has_contrato_access(contrato_id));

create policy "item_locado_insert" on public.item_locado
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
    and public.has_contrato_access(contrato_id)
  );

create policy "item_locado_update" on public.item_locado
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
    and public.has_contrato_access(contrato_id)
  )
  with check (org_id = public.current_org_id());

create policy "item_locado_delete" on public.item_locado
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
    and public.has_contrato_access(contrato_id)
  );

-- movimentacao: leitura org; escrita admin/gestor/operacional.
create policy "movimentacao_select" on public.movimentacao
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "movimentacao_insert" on public.movimentacao
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  );

create policy "movimentacao_delete" on public.movimentacao
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );
