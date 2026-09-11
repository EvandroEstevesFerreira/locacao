-- ============================================================================
-- v0.111.0 — Contratos do Mega: o quanto de cada contrato já foi executado
-- ============================================================================
--
-- O Loca sabe o que foi contratado (digitado) e projeta o comprometido a partir
-- dos itens. O MEGA SABE O NÚMERO OFICIAL: quanto foi contratado, quanto já foi
-- medido e quanto sobra — o mesmo "contratado × comprometido" da tela do
-- contrato, só que com o dado do ERP.
--
-- Descoberto em 11/09/2026 nas especificações OpenAPI públicas do Mega (63
-- arquivos em storage.googleapis.com/br-com-mega-ecossistema-api): o módulo
-- `AcompanhamentoContratoEngenhariaX` tem 31 rotas, e
-- `Visoes/GetVisoesFornecedor` devolve 958 contratos de 247 fornecedores
-- NUMA CHAMADA — com projeto, código do contrato, medição e saldo.

create table public.mega_contrato (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,

  -- O código do contrato no Mega (`cto_in_codigo`). É a identidade.
  codigo         text not null,
  nome           text,                       -- `cto_st_alternativo`, ex.: "CONT ILUM DATACENTER"
  -- O produto só quando o contrato tem UM item: a resposta do Mega vem item a
  -- item (958 linhas para 664 contratos), e mostrar o primeiro de quinze seria
  -- escolher um por sorteio e chamá-lo de o contrato.
  produto        text,
  itens          integer not null default 1,

  -- O agente, no formato "735 - CCN AUTOMACAO LTDA". Guardamos o código
  -- separado para casar com `fornecedor.codigo_mega` sem interpretar texto.
  codigo_agente  text,
  agente_nome    text,
  fornecedor_id  uuid references public.fornecedor (id) on delete set null,

  -- O projeto vem como "608 - RACIONAL - DANTE": o prefixo é o código da obra,
  -- o mesmo que o Loca usa em `obra.codigo`. Medido: 7 das 8 obras do Loca têm
  -- contrato no Mega.
  codigo_projeto text,
  projeto_nome   text,
  obra_id        uuid references public.obra (id) on delete set null,

  total_contratado numeric(14, 2) not null default 0,
  total_distratado numeric(14, 2) not null default 0,
  medicao          numeric(14, 2) not null default 0,
  saldo            numeric(14, 2) not null default 0,
  nota             numeric(14, 2) not null default 0,
  adiantamento     numeric(14, 2) not null default 0,

  criado_em_mega timestamptz,
  criado_por     text,
  sincronizado_em timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index uq_mega_contrato on public.mega_contrato (org_id, codigo);
create index idx_mega_contrato_fornecedor on public.mega_contrato (fornecedor_id);
create index idx_mega_contrato_obra on public.mega_contrato (obra_id);

create trigger trg_mega_contrato_updated_at
  before update on public.mega_contrato
  for each row execute function public.set_updated_at();

alter table public.mega_contrato enable row level security;

-- LEITURA para quem vê dinheiro. ESCRITA para ninguém: é espelho, e quem
-- escreve é o cron com service role. Editar aqui não mudaria o Mega — só faria
-- o Loca mentir até a próxima rodada.
create policy "mega_contrato_select" on public.mega_contrato
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

comment on table public.mega_contrato is
  'Espelho dos contratos do módulo AcompanhamentoContratoEngenhariaX do Mega: '
  'contratado, medido e saldo por contrato. Uma chamada traz todos.';
