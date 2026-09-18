-- ============================================================================
-- Contratos de servico recorrente de TI e a atribuicao por pessoa
-- (docs/superpowers/specs/2026-09-17-licencas-e-servicos-ti-design.md)
-- ============================================================================
--
-- TABELA PROPRIA, e nao um `tipo` em `contrato_locacao`. La `obra_id` e NOT
-- NULL porque todo contrato de locacao pertence a UMA obra, e essa garantia
-- sustenta o escopo por obra de toda a tela de contratos. Uma licenca nao
-- pertence a um centro de custo: ela e rateada entre varios. Afrouxar aquela
-- coluna para caber esta linha enfraqueceria a garantia de todo o resto.
--
-- Repare que e a decisao OPOSTA a da 0114 -- la o discriminador, aqui a tabela
-- separada -- e pelo MESMO criterio: qual das duas formas deixa a RLS com um
-- caminho so.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'categoria_servico') then
    create type public.categoria_servico as enum
      ('licenca', 'conectividade', 'seguranca', 'outro');
  end if;
end $$;

create table if not exists public.contrato_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  fornecedor_id  uuid not null references public.fornecedor (id) on delete restrict,
  nome           text not null,
  categoria      public.categoria_servico not null default 'licenca',
  quantidade     integer not null check (quantidade > 0),
  -- Centavos em bigint, como a 0105 fez para o valor contratado: `numeric`
  -- vira `number` no JavaScript, e R$ 3.500 / 43 e a divisao que perde centavo.
  valor_unitario_centavos bigint not null check (valor_unitario_centavos >= 0),
  cadencia       public.cadencia_cobranca not null default 'mensal',
  data_inicio    date not null,
  -- Nulo = vigencia indeterminada. Contrato assim NAO gera alerta de
  -- renovacao: nao ha data. O que ele gera e o aviso de conferencia vencida.
  data_fim       date,
  renova_automaticamente boolean not null default true,
  -- O dia em que alguem conferiu a lista contra o provedor. Existe porque a
  -- atribuicao e digitada a mao e VAI divergir do tenant em poucas semanas --
  -- e um numero errado de licencas ociosas e pior que nenhum, porque alguem
  -- cancela assinatura em cima dele.
  conferido_em   date,
  status         public.status_contrato not null default 'ativo',
  observacoes    text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint contrato_servico_periodo check (data_fim is null or data_fim >= data_inicio)
);

create index if not exists idx_contrato_servico_org on public.contrato_servico (org_id);
create index if not exists idx_contrato_servico_fornecedor on public.contrato_servico (fornecedor_id);
create index if not exists idx_contrato_servico_fim
  on public.contrato_servico (data_fim) where data_fim is not null;
create index if not exists idx_contrato_servico_deleted
  on public.contrato_servico (deleted_at);

drop trigger if exists trg_contrato_servico_updated_at on public.contrato_servico;
create trigger trg_contrato_servico_updated_at
  before update on public.contrato_servico
  for each row execute function public.set_updated_at();

create table if not exists public.atribuicao_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  contrato_id    uuid not null references public.contrato_servico (id) on delete cascade,
  funcionario_id uuid not null references public.funcionario (id) on delete restrict,
  atribuido_em   date not null,
  removido_em    date,
  created_at     timestamptz not null default now(),
  constraint atribuicao_servico_periodo check (removido_em is null or removido_em >= atribuido_em)
);

-- A mesma pessoa nao ocupa duas licencas do mesmo contrato ao mesmo tempo.
-- Sem esta trava a contagem de atribuidas passa das contratadas e
-- `ratearPorCabeca` levanta excecao -- barulhento, sim, mas tarde demais: o
-- dado ja estaria gravado e a tela ja estaria quebrada para todo mundo.
--
-- Parcial em `removido_em is null` de proposito: a mesma pessoa PODE receber a
-- licenca de novo depois de devolve-la, e o historico das duas passagens e o
-- que responde "desde quando ela usa isto".
create unique index if not exists idx_atribuicao_servico_aberta
  on public.atribuicao_servico (contrato_id, funcionario_id)
  where removido_em is null;

create index if not exists idx_atribuicao_servico_contrato
  on public.atribuicao_servico (contrato_id) where removido_em is null;
create index if not exists idx_atribuicao_servico_funcionario
  on public.atribuicao_servico (funcionario_id);

alter table public.contrato_servico   enable row level security;
alter table public.atribuicao_servico enable row level security;

-- O ESCOPO E A ORGANIZACAO, NAO A OBRA -- e isto e excecao consciente ao
-- escopo por obra do resto do Loca.
--
-- Um contrato rateado entre seis centros de custo nao pertence a nenhum:
-- filtra-lo por vinculo mostraria metade do contrato para metade das pessoas,
-- e o total nao fecharia para ninguem -- cada um veria um numero diferente do
-- mesmo contrato, sem nada na tela explicando por que. Mesmo desenho de
-- `fornecedor`, pelo mesmo motivo.
create policy "contrato_servico_select" on public.contrato_servico
  for select to authenticated
  using (org_id = public.current_org_id() and deleted_at is null);

create policy "contrato_servico_manage" on public.contrato_servico
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "atribuicao_servico_select" on public.atribuicao_servico
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "atribuicao_servico_manage" on public.atribuicao_servico
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());
