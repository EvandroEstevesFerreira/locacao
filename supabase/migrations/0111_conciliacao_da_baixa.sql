-- ============================================================================
-- v0.113.0 — A fila de conciliação da baixa
-- ============================================================================
--
-- O Mega diz o que foi pago; o Loca diz o que foi contratado. Esta tabela é o
-- lugar onde as duas afirmações se encontram — e onde um humano decide se elas
-- falam do mesmo dinheiro.
--
-- ELA NÃO DÁ BAIXA. Quem escreve em `lancamento_financeiro` é a server action
-- de confirmação, com sessão de usuário. O cron só propõe.
--
-- POR QUE UMA TABELA, E NÃO CÁLCULO NA HORA: para guardar o "não". Fila só
-- funciona se esvaziar. Sem onde registrar a recusa, o título que o financeiro
-- examinou e descartou reaparece amanhã, e depois de amanhã — até ninguém mais
-- abrir a tela. A tabela existe para a recusa; o resto é consequência.

create type public.confianca_conciliacao as enum ('alta', 'media', 'baixa');
create type public.status_conciliacao as enum ('sugerida', 'confirmada', 'recusada');

create table public.mega_conciliacao (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,

  -- `cascade`: sugestão sobre um título que sumiu do espelho não tem sentido.
  mega_titulo_id uuid not null references public.mega_titulo (id) on delete cascade,

  -- NULO É UM ESTADO LEGÍTIMO: "o Mega pagou isto e o Loca não tem lançamento
  -- correspondente". É informação, não ausência de dado — e é justamente o caso
  -- que faz alguém cadastrar o que faltava.
  lancamento_id  uuid references public.lancamento_financeiro (id) on delete cascade,

  confianca      public.confianca_conciliacao not null,

  -- TEXTO PARA HUMANO, não código. Quem confirma precisa saber por que o
  -- sistema propôs aquilo: "documento 42824001 bate com a NF do lançamento;
  -- valor idêntico". Um enum de motivo obrigaria a tela a traduzir, e a
  -- tradução envelhece longe da regra.
  motivo         text not null,

  status         public.status_conciliacao not null default 'sugerida',
  decidido_por   uuid references public.perfil (id) on delete set null,
  decidido_em    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- UM TÍTULO, UMA DECISÃO VIVA. Sem isto o cron acrescentaria uma sugestão nova
-- a cada rodada e a fila cresceria sozinha, com a mesma proposta repetida.
-- É este índice que o `onConflict` do upsert do cron nomeia.
create unique index uq_mega_conciliacao_titulo
  on public.mega_conciliacao (org_id, mega_titulo_id);

-- UM LANÇAMENTO NÃO RECEBE DUAS BAIXAS. Parcial: só vale entre as confirmadas,
-- porque duas sugestões podem legitimamente disputar o mesmo lançamento — quem
-- desempata é o humano, e depois disso a disputa acabou.
create unique index uq_mega_conciliacao_lancamento_confirmado
  on public.mega_conciliacao (org_id, lancamento_id)
  where status = 'confirmada' and lancamento_id is not null;

create index idx_mega_conciliacao_org_status
  on public.mega_conciliacao (org_id, status);

create trigger trg_mega_conciliacao_updated_at
  before update on public.mega_conciliacao
  for each row execute function public.set_updated_at();

alter table public.mega_conciliacao enable row level security;

-- LEITURA para quem vê dinheiro.
create policy "mega_conciliacao_select" on public.mega_conciliacao
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

-- ESCRITA DO USUÁRIO É SÓ UPDATE, e é de propósito: quem CRIA sugestão é o
-- cron, com service role. Sem policy de INSERT, ninguém inventa uma sugestão
-- pela API para depois "confirmá-la" e forjar uma baixa.
create policy "mega_conciliacao_update" on public.mega_conciliacao
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

comment on table public.mega_conciliacao is
  'Fila de conciliação: o casamento proposto entre um título quitado do Mega e '
  'um lançamento do Loca. O cron propõe; o usuário confirma ou recusa. A baixa '
  'em si é escrita pela server action, nunca por aqui.';
