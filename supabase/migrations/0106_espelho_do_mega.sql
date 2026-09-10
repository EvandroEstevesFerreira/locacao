-- ============================================================================
-- v0.106.0 — Espelho do contas a pagar do Mega
-- ============================================================================
--
-- O Mega é a FONTE DA VERDADE do que foi pago. Esta tabela não é uma segunda
-- verdade: é um espelho do que o ERP respondeu na última sincronização, para o
-- Loca poder mostrar "essa locação está paga?" sem chamar a API a cada tela.
--
-- POR QUE ESPELHO E NÃO CONSULTA AO VIVO: a conta de API `120.apifin` já foi
-- bloqueada uma vez por autenticação encadeada. Três usuários abrindo a tela do
-- contrato ao mesmo tempo autenticariam em paralelo e derrubariam a conta —
-- então quem fala com o Mega é um cron por dia, e mais ninguém.
--
-- ESTA TABELA NÃO DÁ BAIXA EM NADA. Ela não escreve em
-- `lancamento_financeiro`. Espelhar é seguro mesmo se o casamento com os
-- lançamentos estiver errado; dar baixa não é. A baixa é uma onda posterior.

create table public.mega_titulo (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,

  -- O fornecedor do Loca, quando reconhecido pelo `codigo_mega`. Fica NULO se
  -- o código sumir do cadastro: perder o vínculo não pode apagar o título, ou o
  -- espelho passaria a mentir por omissão.
  fornecedor_id  uuid references public.fornecedor (id) on delete set null,
  codigo_mega    text not null,

  -- O CNPJ e a razão social como o MEGA os tem. Não é redundância com
  -- `fornecedor`: é o que permite conferir se o `codigo_mega` digitado no Loca
  -- aponta mesmo para a empresa certa. Código trocado é erro de digitação
  -- silencioso — o CNPJ ao lado o denuncia.
  agente_cnpj    text,
  agente_nome    text,

  -- Os dez campos que a rota FaturaPagar/Saldo devolve, sem invenção.
  numero_ap        text not null,
  numero_parcela   text not null,
  filial           text,
  -- NOT NULL COM DEFAULT '' PORQUE ESTAS DUAS ENTRAM NA CHAVE. Coluna anulável
  -- em índice único deixaria duas linhas com NULL conviverem (NULL nunca é
  -- igual a NULL no Postgres), e o espelho duplicaria o mesmo título a cada
  -- rodada. Ausente, aqui, é string vazia.
  tipo_documento   text not null default '',
  numero_documento text not null default '',    -- o nº da NF/fatura: a chave de ligação com o Loca
  data_vencimento  date not null,
  data_prorrogado  date,
  valor_parcela    numeric(14, 2) not null,
  saldo_atual      numeric(14, 2) not null,     -- zero = quitado

  -- O MAIS PRÓXIMO DE UMA DATA DE PAGAMENTO QUE EXISTE.
  -- A API do Mega não devolve data de pagamento (medido: a rota tem 10 campos e
  -- nenhum é isso; no projeto Financeiro essa data saía da pasta de
  -- comprovantes no OneDrive). Aqui gravamos o dia em que o Loca VIU o saldo
  -- zerar. Com cron diário, erra no máximo um dia — e o nome diz o que é, para
  -- ninguém confundir com a data em que o dinheiro saiu.
  quitacao_vista_em date,

  sincronizado_em timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- A CHAVE É LARGA PORQUE `AP + parcela` NÃO É ÚNICA no Mega. Um mesmo número de
-- AP reaparece com agente, tipo de documento ou vencimento diferentes —
-- retenções (ISS, INSS, IR) são o caso mais comum. Chavear estreito faria uma
-- linha sobrescrever a outra e o total sairia menor que o real.
-- Só colunas simples, sem expressão: o PostgREST precisa nomeá-las em
-- `onConflict` para o upsert do cron, e não sabe apontar para `coalesce(...)`.
create unique index uq_mega_titulo
  on public.mega_titulo (
    org_id, codigo_mega, numero_ap, numero_parcela,
    tipo_documento, numero_documento, data_vencimento, valor_parcela
  );

create index idx_mega_titulo_org on public.mega_titulo (org_id);
create index idx_mega_titulo_fornecedor on public.mega_titulo (fornecedor_id);
create index idx_mega_titulo_documento on public.mega_titulo (org_id, numero_documento);

create trigger trg_mega_titulo_updated_at
  before update on public.mega_titulo
  for each row execute function public.set_updated_at();

alter table public.mega_titulo enable row level security;

-- LEITURA para quem já vê dinheiro no Loca. ESCRITA para ninguém: quem escreve
-- é o cron, com service role, que não passa por RLS. Sem policy de INSERT,
-- UPDATE ou DELETE, nenhum usuário autenticado consegue editar o espelho — e é
-- exatamente isso que se quer de um espelho. Editar aqui não mudaria o Mega,
-- só faria o Loca mentir até a próxima sincronização.
create policy "mega_titulo_select" on public.mega_titulo
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

-- Quando o cron rodou, por organização. Sem isto, uma tela que mostra "pago"
-- não sabe dizer se o dado é de hoje ou de duas semanas atrás — e dado velho
-- sobre pagamento é pior que dado ausente.
create table public.mega_sync (
  org_id           uuid primary key references public.organizacao (id) on delete cascade,
  ativo            boolean not null default false,   -- FAIL-CLOSED: sem linha ativa, não sincroniza
  ultima_rodada_em timestamptz,
  ultimo_erro      text,
  titulos_vistos   integer not null default 0,
  fornecedores_lidos integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_mega_sync_updated_at
  before update on public.mega_sync
  for each row execute function public.set_updated_at();

alter table public.mega_sync enable row level security;

create policy "mega_sync_select" on public.mega_sync
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );
