-- ============================================================================
-- Fase 1 — Catálogo de itens + unidades de equipamento
-- ============================================================================

create type public.tipo_item as enum (
  'equipamento',          -- retornável, controlado por unidade (nº série/patrimônio)
  'material_retornavel',  -- retornável, controlado por quantidade/saldo
  'consumivel'            -- não retorna
);

create table public.item_catalogo (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  tipo        public.tipo_item not null,
  descricao   text not null,
  unidade     text,        -- un, m, m², kg, dia... (medida para materiais/consumíveis)
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_item_catalogo_org on public.item_catalogo (org_id);

create trigger trg_item_catalogo_updated_at
  before update on public.item_catalogo
  for each row execute function public.set_updated_at();

create table public.equipamento_unidade (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  item_id        uuid not null references public.item_catalogo (id) on delete cascade,
  identificador  text not null,   -- patrimônio / nº de série
  observacoes    text,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (org_id, identificador)
);

create index idx_equip_unidade_item on public.equipamento_unidade (item_id);
create index idx_equip_unidade_org on public.equipamento_unidade (org_id);

create trigger trg_equip_unidade_updated_at
  before update on public.equipamento_unidade
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS (itens são da organização; todos leem, admin/gestor gerenciam)
-- ============================================================================
alter table public.item_catalogo       enable row level security;
alter table public.equipamento_unidade enable row level security;

create policy "item_select" on public.item_catalogo
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "item_insert" on public.item_catalogo
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );

create policy "item_update" on public.item_catalogo
  for update to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'))
  with check (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));

create policy "item_delete" on public.item_catalogo
  for delete to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));

create policy "equip_unidade_select" on public.equipamento_unidade
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "equip_unidade_insert" on public.equipamento_unidade
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );

create policy "equip_unidade_update" on public.equipamento_unidade
  for update to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'))
  with check (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));

create policy "equip_unidade_delete" on public.equipamento_unidade
  for delete to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));
