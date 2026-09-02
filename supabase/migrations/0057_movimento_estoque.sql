-- ============================================================================
-- Módulo Estoque: o livro-razão de saldo por quantidade
--
-- Boa parte de um módulo de estoque JÁ existia: recebimento é entrada,
-- item_locado e termo são saída, `equipamento_unidade.situacao` é baixa e
-- `obra_id` é localização. O que NÃO existia é SALDO POR QUANTIDADE — para
-- cimento, escora, EPI e consumível, ninguém sabia quanto tem.
--
-- Esta migration não cria um controle paralelo de equipamento por peça, de
-- propósito: isso daria ao sistema duas verdades sobre onde a betoneira está,
-- "em uso" na frota e "disponível" no estoque, e ninguém saberia em qual
-- acreditar. Peça continua sendo assunto de `equipamento_unidade`.
--
-- NÃO HÁ COLUNA DE SALDO. O saldo é somado do razão, sempre. Coluna de saldo é
-- a fonte clássica de divergência: qualquer caminho de escrita que esqueça de
-- atualizá-la faz o número mentir para sempre, e ninguém descobre até o
-- inventário.
-- ============================================================================

create table if not exists public.movimento_estoque (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  -- `restrict`: apagar do catálogo um item com movimento apagaria o histórico
  -- de saldo dele.
  item_id     uuid not null references public.item_catalogo (id) on delete restrict,
  -- NULO = almoxarifado central. Mesma convenção da peça em `equipamento_unidade`:
  -- não é dado faltando, é um local legítimo.
  obra_id     uuid references public.obra (id) on delete set null,

  tipo        text not null check (tipo in
                ('entrada','saida','ajuste_positivo','ajuste_negativo','baixa')),
  -- SEMPRE POSITIVA. O tipo é que dá o sinal, e a regra vive em
  -- `sinalDoTipo()` de src/lib/estoque.ts. Guardar quantidade negativa
  -- obrigaria toda consulta a lembrar da convenção, e a primeira que
  -- esquecesse somaria saída como entrada.
  quantidade  numeric(14,3) not null check (quantidade > 0),
  data        date not null,

  -- De onde o movimento veio. `manual` é o lançamento na tela; os outros são
  -- eventos que o sistema já registra e que passarão a alimentar o razão.
  origem      text not null default 'manual' check (origem in
                ('manual','recebimento','termo','contrato','inventario')),
  recebimento_id uuid references public.recebimento (id) on delete set null,
  termo_id       uuid references public.termo_equipamento (id) on delete set null,

  documento   text,
  observacoes text,

  -- Estorno: movimento errado NÃO é apagado, é estornado por um movimento
  -- contrário que aponta para ele. É o que torna o razão auditável — apagar
  -- faria o saldo bater sem que ninguém pudesse explicar a diferença.
  estorna_id  uuid references public.movimento_estoque (id) on delete restrict,

  registrado_por uuid references public.perfil (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_mov_estoque_item on public.movimento_estoque (item_id, data desc);
create index if not exists idx_mov_estoque_org  on public.movimento_estoque (org_id);
create index if not exists idx_mov_estoque_obra on public.movimento_estoque (obra_id) where obra_id is not null;
-- Um movimento só pode ser estornado uma vez.
create unique index if not exists idx_mov_estoque_estorno
  on public.movimento_estoque (estorna_id) where estorna_id is not null;

comment on table public.movimento_estoque is
  'Razão append-only de saldo por quantidade. Saldo é SOMADO daqui, nunca gravado.';

-- ---------------------------------------------------------------------------
-- Ponto de pedido no catálogo
-- ---------------------------------------------------------------------------
-- Nulo = não configurado, e aí o item não entra na lista de ruptura. Apontar
-- todo item sem parâmetro como problema faria a lista nascer inútil.
alter table public.item_catalogo
  add column if not exists estoque_minimo numeric(14,3);

alter table public.item_catalogo drop constraint if exists item_estoque_minimo_check;
alter table public.item_catalogo
  add constraint item_estoque_minimo_check
  check (estoque_minimo is null or estoque_minimo >= 0);

-- ---------------------------------------------------------------------------
-- Imutabilidade do razão
-- ---------------------------------------------------------------------------
-- Razão que aceita UPDATE não é razão. Sem esta trava, corrigir um lançamento
-- errado mudaria o saldo do passado em silêncio, e o inventário do mês passado
-- deixaria de bater com o sistema sem que nada explicasse a diferença.
--
-- A correção é o ESTORNO, que deixa as duas linhas visíveis.
create or replace function public.guard_movimento_estoque_imutavel()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  raise exception
    'Movimento de estoque não pode ser alterado nem apagado. Registre um estorno.';
end;
$$;

revoke execute on function public.guard_movimento_estoque_imutavel() from public;
revoke execute on function public.guard_movimento_estoque_imutavel() from anon, authenticated;

drop trigger if exists trg_movimento_estoque_imutavel on public.movimento_estoque;
create trigger trg_movimento_estoque_imutavel
  before update or delete on public.movimento_estoque
  for each row execute function public.guard_movimento_estoque_imutavel();

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, no padrão do resto
-- ---------------------------------------------------------------------------
-- Leitura: quem tem acesso à obra vê o movimento dela; o almoxarifado central
-- (obra nula) é visível a toda a organização, porque é de todos.
alter table public.movimento_estoque enable row level security;

drop policy if exists "mov_estoque_select" on public.movimento_estoque;
create policy "mov_estoque_select" on public.movimento_estoque
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      obra_id is null
      or public.current_papel() in ('master', 'administrador', 'gestor')
      or public.is_member_of_obra(obra_id)
    )
  );

-- Escrita: `pode_operar()` — almoxarife lança movimento, e ele é operador.
-- Só INSERT: update e delete são barrados pelo trigger de qualquer forma.
drop policy if exists "mov_estoque_insert" on public.movimento_estoque;
create policy "mov_estoque_insert" on public.movimento_estoque
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

notify pgrst, 'reload schema';
