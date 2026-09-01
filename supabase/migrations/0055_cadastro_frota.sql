-- ============================================================================
-- Cadastro de frota: dois níveis e rastreio da peça
-- (docs/superpowers/specs/2026-08-31-cadastro-frota-design.md)
--
-- O catálogo diz O QUE a coisa é. A peça (`equipamento_unidade`) diz QUAL
-- coisa — e tinha dois campos úteis, identificador e observações. É lá que
-- faltava tudo para responder "onde está minha betoneira".
--
-- Esta fatia entrega "onde está e com quem". Valor, nota fiscal e especificação
-- técnica são a fatia 2; capacitação e inspeção periódica, a 3.
--
-- Nada aqui altera dado existente: uma tabela nova, colunas com default que
-- descrevem com honestidade o que já está cadastrado, e a semeadura das
-- categorias.
-- ============================================================================

-- O enum foi declarado na spec do termo (2026-08-25), que ainda não foi
-- implementada. Esta fatia chega antes, então ele nasce aqui e a fatia do termo
-- passa a só USAR.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_equipamento') then
    create type public.estado_equipamento as enum ('novo','bom','regular','com_avaria');
  end if;
end $$;

create table if not exists public.categoria_equipamento (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  nome       text not null,
  -- Ordem de obra, não alfabética: Concretagem antes de TI porque é o que o
  -- almoxarife procura primeiro. Sem isso a lista sai em ordem de cadastro.
  ordem      smallint not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create index if not exists idx_categoria_equip_org on public.categoria_equipamento (org_id);

drop trigger if exists trg_categoria_equip_updated_at on public.categoria_equipamento;
create trigger trg_categoria_equip_updated_at
  before update on public.categoria_equipamento
  for each row execute function public.set_updated_at();

-- `on delete set null`: apagar uma categoria não pode apagar o item. Item sem
-- categoria é um estado válido — é o de todos os itens já cadastrados.
alter table public.item_catalogo
  add column if not exists categoria_id uuid
    references public.categoria_equipamento (id) on delete set null;

create index if not exists idx_item_catalogo_categoria
  on public.item_catalogo (categoria_id) where categoria_id is not null;

-- Os defaults descrevem com honestidade tudo que já está cadastrado: o Loca só
-- teve equipamento de terceiro até aqui, e nenhuma peça está registrada como
-- entregue a ninguém. Nada migra, nada muda de comportamento.
alter table public.equipamento_unidade
  add column if not exists propriedade text not null default 'locada',
  add column if not exists situacao text not null default 'disponivel',
  -- NULO = almoxarifado central. Não é dado faltando: é um estado legítimo, e é
  -- o de toda peça já cadastrada.
  add column if not exists obra_id uuid references public.obra (id) on delete set null,
  add column if not exists numero_serie text,
  add column if not exists ano smallint,
  add column if not exists estado public.estado_equipamento;

-- `text` + `check`, como a 0049 fez com `controle`: acrescentar um valor a enum
-- do Postgres é migration própria e não roda em transação com DDL antes da 12.
alter table public.equipamento_unidade drop constraint if exists equip_unidade_propriedade_check;
alter table public.equipamento_unidade
  add constraint equip_unidade_propriedade_check
  check (propriedade in ('locada','propria'));

alter table public.equipamento_unidade drop constraint if exists equip_unidade_situacao_check;
alter table public.equipamento_unidade
  add constraint equip_unidade_situacao_check
  check (situacao in ('disponivel','em_uso','manutencao','baixada','perdida'));

alter table public.equipamento_unidade drop constraint if exists equip_unidade_ano_check;
alter table public.equipamento_unidade
  add constraint equip_unidade_ano_check
  check (ano is null or (ano between 1950 and 2100));

create index if not exists idx_equip_unidade_situacao
  on public.equipamento_unidade (org_id, situacao);
create index if not exists idx_equip_unidade_obra
  on public.equipamento_unidade (obra_id) where obra_id is not null;

comment on column public.equipamento_unidade.situacao is
  'Matriz de transição em src/lib/frota.ts. em_uso só muda por evento (termo).';
comment on column public.equipamento_unidade.obra_id is
  'NULO = almoxarifado central, e é um estado legítimo.';

-- ---------------------------------------------------------------------------
-- Semeadura das categorias
-- ---------------------------------------------------------------------------
-- Organização nova precisa ser semeada à mão. Deliberado: a organização já
-- nasce à mão hoje — a 0001 traz o `insert` comentado — e automatizar a
-- semeadura de um caminho que não existe é inventar manutenção.
insert into public.categoria_equipamento (org_id, nome, ordem)
select o.id, c.nome, c.ordem
from public.organizacao o
cross join (values
  ('Concretagem', 10), ('Ferramenta manual', 20), ('Ferramenta elétrica', 30),
  ('Acesso e altura', 40), ('Movimentação de carga', 50), ('Energia', 60),
  ('Medição e ensaio', 70), ('TI', 80)
) as c(nome, ordem)
on conflict (org_id, nome) do nothing;

-- ---------------------------------------------------------------------------
-- RLS de categoria_equipamento — as mesmas quatro do catálogo
-- ---------------------------------------------------------------------------
alter table public.categoria_equipamento enable row level security;

drop policy if exists "categoria_equip_select" on public.categoria_equipamento;
create policy "categoria_equip_select" on public.categoria_equipamento
  for select to authenticated
  using (org_id = (select public.current_org_id()));

drop policy if exists "categoria_equip_write" on public.categoria_equipamento;
create policy "categoria_equip_write" on public.categoria_equipamento
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );

-- `equipamento_unidade` CONTINUA com leitura livre na organização, mesmo tendo
-- agora `obra_id`. É exceção consciente ao escopo por obra do resto do Loca, e a
-- justificativa é o objetivo da fatia: um gestor precisa ver que a betoneira
-- está na Obra B justamente para ir buscá-la. Escopo por obra na leitura
-- tornaria a pergunta que a tela existe para responder impossível de responder.
