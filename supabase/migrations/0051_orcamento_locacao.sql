-- ============================================================================
-- Orçamento de locação por obra
-- (docs/superpowers/specs/2026-09-01-orcamento-locacao-design.md)
--
-- Fecha o TERCEIRO percentual do pedido da diretoria. A 0050 entregou prazo
-- decorrido e avanço físico; sem o orçamento consumido, dois números não viram
-- diagnóstico.
--
-- Nada aqui altera dado existente: duas tabelas novas e suas policies.
-- ============================================================================

create table if not exists public.orcamento_locacao (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  obra_id      uuid not null references public.obra (id) on delete cascade,
  -- Revisão NUNCA sobrescreve: cria versão nova e aposenta a anterior. Se
  -- sobrescrevesse, o orçamento perseguiria o realizado — nunca haveria
  -- estouro, porque o alvo se move — e o desvio ficaria inexplicável.
  versao       int  not null default 1,
  vigente      boolean not null default true,
  valor_total  numeric(14,2) not null check (valor_total >= 0),
  observacoes  text,
  criado_por   uuid references public.perfil (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (obra_id, versao)
);

-- Um único vigente por obra. Índice PARCIAL, e não constraint, porque é o que
-- permite N versões aposentadas convivendo com uma vigente.
create unique index if not exists idx_orcamento_vigente
  on public.orcamento_locacao (obra_id) where vigente;

create index if not exists idx_orcamento_obra on public.orcamento_locacao (obra_id);
create index if not exists idx_orcamento_org  on public.orcamento_locacao (org_id);

drop trigger if exists trg_orcamento_updated_at on public.orcamento_locacao;
create trigger trg_orcamento_updated_at
  before update on public.orcamento_locacao
  for each row execute function public.set_updated_at();

create table if not exists public.orcamento_item (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  -- `cascade` porque item de orçamento não tem vida própria fora dele.
  orcamento_id   uuid not null references public.orcamento_locacao (id) on delete cascade,
  -- `restrict` porque apagar do catálogo um item que está orçado apagaria
  -- história: o orçamento passado deixaria de fazer sentido.
  item_id        uuid not null references public.item_catalogo (id) on delete restrict,
  quantidade     numeric(14,2),
  valor_previsto numeric(14,2) not null check (valor_previsto >= 0),
  created_at     timestamptz not null default now(),
  unique (orcamento_id, item_id)
);

create index if not exists idx_orcamento_item_orc on public.orcamento_item (orcamento_id);
create index if not exists idx_orcamento_item_org on public.orcamento_item (org_id);

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, no padrão da 0049/0050
-- ---------------------------------------------------------------------------
-- `is_member_of_obra` e não `has_obra_access`: a segunda é da 0001 e foi
-- superada pela 0004 por recursão de RLS.
--
-- A escrita usa `pode_gerir_cadastros()`, a função canônica de
-- master/administrador. Repetir nomes de papel na policy criaria uma segunda
-- verdade que diverge em silêncio — e papel errado em policy não dá erro, só
-- nega tudo.
alter table public.orcamento_locacao enable row level security;
alter table public.orcamento_item    enable row level security;

drop policy if exists "orcamento_select" on public.orcamento_locacao;
create policy "orcamento_select" on public.orcamento_locacao
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.current_papel() in ('master', 'administrador', 'gestor')
      or public.is_member_of_obra(obra_id)
    )
  );

drop policy if exists "orcamento_write" on public.orcamento_locacao;
create policy "orcamento_write" on public.orcamento_locacao
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );

-- `orcamento_item` resolve a obra pelo orçamento PAI, e não por um `obra_id`
-- denormalizado que poderia divergir do pai em silêncio.
drop policy if exists "orcamento_item_select" on public.orcamento_item;
create policy "orcamento_item_select" on public.orcamento_item
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and exists (
      select 1 from public.orcamento_locacao o
      where o.id = orcamento_id
        and (
          public.current_papel() in ('master', 'administrador', 'gestor')
          or public.is_member_of_obra(o.obra_id)
        )
    )
  );

drop policy if exists "orcamento_item_write" on public.orcamento_item;
create policy "orcamento_item_write" on public.orcamento_item
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );
