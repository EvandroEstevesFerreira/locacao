-- ============================================================================
-- Devolução como documento — fase 2a
-- (docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md)
--
-- O recebimento é documento desde a 0049: cabeçalho, itens, número, romaneio em
-- PDF e aviso ao fornecedor. A ponta oposta não é. Devolver cinco andaimes no
-- mesmo caminhão produz hoje cinco linhas de `movimentacao` e nenhum papel —
-- quem entrega não tem o que assinar, e a empresa não tem o que apresentar
-- quando o fornecedor cobra por item que já voltou.
--
-- Esta migration cria o cabeçalho. `movimentacao` CONTINUA sendo o razão de
-- saldo: é ela que alimenta o saldo em aberto, o custo estimado e o fluxo de
-- caixa, e nenhuma dessas leituras é tocada aqui.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- O número DEV passa a ser do documento
-- ---------------------------------------------------------------------------
-- `movimentacao.numero_registro` existe desde a 0048 e não é exibido em tela
-- nenhuma — os números das listagens de contrato são do contrato. O prefixo DEV
-- fica então livre para quem realmente precisa dele: o documento.
--
-- Os dois não podem coexistir apontando para DEV. `registros.test.ts` tem uma
-- trava explícita contra prefixo repetido ("dois tipos com AVA tornam o número
-- ambíguo"), e ela está certa: com dois tipos em DEV, ler DEV-2026-0007 não diz
-- de qual tabela o registro é.
--
-- Por isso o tipo MIGRA, não coexiste: `movimentacao` sai do mapa e perde o
-- gatilho; `devolucao` entra.
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'      then 'CTR'
    when 'contrato_imovel'       then 'CTI'
    when 'recebimento'           then 'REC'
    when 'devolucao'             then 'DEV'
    when 'vistoria'              then 'VIS'
    when 'vistoria_imovel'       then 'VIM'
    when 'avaria'                then 'AVA'
    when 'reparo_imovel'         then 'REP'
    when 'medida_disciplinar'    then 'MED'
    when 'entrega_ocupante'      then 'ENT'
    when 'checklist_limpeza'     then 'LIM'
    when 'ocorrencia_imovel'     then 'OCO'
    when 'termo_equipamento'     then 'TRM'
    when 'treinamento_conclusao' then 'TRE'
    else 'REG'
  end;
$$;

-- Sem isto, toda `movimentacao` nova cairia no ramo `else` e nasceria numerada
-- REG-2026-NNNN — um prefixo que não quer dizer nada, gasto num contador que
-- ninguém lê.
drop trigger if exists trg_numero_registro on public.movimentacao;

-- ---------------------------------------------------------------------------
-- devolucao — o documento
-- ---------------------------------------------------------------------------
create table if not exists public.devolucao (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  contrato_id      uuid not null references public.contrato_locacao (id) on delete cascade,
  fornecedor_id    uuid not null references public.fornecedor (id) on delete restrict,

  -- Nulo enquanto RASCUNHO, como no recebimento e pela mesma razão: um rascunho
  -- numerado que é excluído deixa exatamente o buraco que o contador gapless da
  -- 0048 existe para impedir.
  numero_registro  text,

  -- CAMPO, e não `now()`. O caminhão sai da obra num dia e a nota chega ao
  -- escritório noutro. Com `now()`, o documento que vai ao fornecedor sairia
  -- com a data da digitação, não a da entrega.
  devolvido_em     date not null,

  -- Quem entregou, do nosso lado. Vai na linha de assinatura do termo.
  responsavel      text,
  -- O número DELES, quando devolvem com contra-nota. Digitado, pode repetir,
  -- pode vir em branco.
  nota_fornecedor  text,
  observacoes      text,

  -- O relatório fotográfico desta devolução. Criado junto com o rascunho, para
  -- que as fotos possam ser anexadas ANTES do fechamento — depois do
  -- fechamento o documento já saiu, e foto que chega depois não prova nada
  -- sobre o estado em que o equipamento foi entregue.
  vistoria_id      uuid references public.vistoria (id) on delete set null,

  status           text not null default 'rascunho'
                   check (status in ('rascunho', 'fechado')),
  fechado_em       timestamptz,
  fechado_por      uuid references auth.users (id),
  -- Nulo com status 'fechado' = fornecedor não avisado. O envio não derruba o
  -- fechamento: equipamento que já voltou fisicamente não deixa de ter voltado
  -- porque o Resend está fora do ar.
  aviso_enviado_em timestamptz,

  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (org_id, numero_registro)
);

create index if not exists idx_devolucao_contrato
  on public.devolucao (contrato_id, devolvido_em desc);
create index if not exists idx_devolucao_org
  on public.devolucao (org_id, devolvido_em desc) where deleted_at is null;

drop trigger if exists trg_devolucao_updated_at on public.devolucao;
create trigger trg_devolucao_updated_at
  before update on public.devolucao
  for each row execute function public.set_updated_at();

-- SEM `trg_numero_registro`, igual ao recebimento: o trigger da 0048 numera no
-- INSERT, e aqui o número tem de sair no FECHAMENTO. A action chama
-- `proximo_numero`.

-- ---------------------------------------------------------------------------
-- devolucao_item — o que se pretende devolver
-- ---------------------------------------------------------------------------
-- Note que estas linhas NÃO movem saldo. Elas são a intenção do rascunho; o
-- razão continua sendo `movimentacao`, criada só no fechamento. Se o saldo
-- baixasse aqui, um rascunho abandonado tiraria do estoque equipamento que
-- nunca voltou ao fornecedor — e o custo de locação pararia de correr sobre
-- coisa que ainda está na obra.
create table if not exists public.devolucao_item (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  devolucao_id    uuid not null references public.devolucao (id) on delete cascade,

  -- NÃO nulável, ao contrário de `recebimento_item.item_locado_id`. A assimetria
  -- é deliberada: no recebimento pode chegar algo fora do contrato, e o
  -- conferente precisa poder registrar isso. Na devolução, só se devolve o que
  -- foi locado — devolver item que não está no contrato não é divergência a
  -- registrar, é erro de digitação a corrigir.
  item_locado_id  uuid not null references public.item_locado (id) on delete cascade,
  unidade_id      uuid references public.equipamento_unidade (id) on delete set null,

  quantidade      numeric(14, 2) not null check (quantidade > 0),
  condicao        text not null default 'ok'
                  check (condicao in ('ok', 'avaria', 'faltante')),
  observacoes     text,
  created_at      timestamptz not null default now(),

  -- Duas linhas do mesmo item no mesmo documento seriam sempre erro de
  -- digitação: quem quer devolver mais aumenta a quantidade. E, sem esta trava,
  -- a conferência de saldo do fechamento teria de somar as duas — que é
  -- justamente o tipo de soma que se esquece de fazer.
  unique (devolucao_id, item_locado_id)
);

create index if not exists idx_devolucao_item_devolucao
  on public.devolucao_item (devolucao_id);

-- ---------------------------------------------------------------------------
-- O vínculo do razão com o documento
-- ---------------------------------------------------------------------------
-- NULÁVEL, e permanentemente. Toda `movimentacao` anterior a esta migration tem
-- `devolucao_id` nulo e continua válida: ela é o histórico real de saldo, e
-- reescrevê-la para inventar documentos que nunca existiram seria fabricar
-- registro. Nulo lê-se "devolução anterior ao documento", não "dado faltando".
alter table public.movimentacao
  add column if not exists devolucao_id uuid
    references public.devolucao (id) on delete set null;

create index if not exists idx_movimentacao_devolucao
  on public.movimentacao (devolucao_id) where devolucao_id is not null;

comment on column public.movimentacao.devolucao_id is
  'O documento que gerou esta linha. Nulo = devolução registrada antes da 0064.';

-- ---------------------------------------------------------------------------
-- Semeadura do contador
-- ---------------------------------------------------------------------------
-- O contador é chaveado por `tipo`. O tipo 'devolucao' é novo, então começaria
-- em 1 — e reemitiria os DEV que `movimentacao` já gastou. O primeiro termo de
-- devolução de cada organização sairia com um número que já está em outro
-- registro.
--
-- Hoje `movimentacao` está vazia em produção e isto é um no-op. Fica assim
-- mesmo: custa uma instrução, roda antes de qualquer documento existir, e é a
-- única janela em que a correção é barata.
insert into public.numero_sequencia (org_id, tipo, ano, ultimo)
select
  m.org_id,
  'devolucao',
  (regexp_match(m.numero_registro, '^DEV-(\d{4})-'))[1]::int,
  max((regexp_match(m.numero_registro, '^DEV-\d{4}-(\d+)$'))[1]::int)
from public.movimentacao m
where m.numero_registro ~ '^DEV-\d{4}-\d+$'
group by m.org_id, (regexp_match(m.numero_registro, '^DEV-(\d{4})-'))[1]::int
on conflict (org_id, tipo, ano) do update
  -- `greatest` e não atribuição direta: se por qualquer motivo o contador de
  -- 'devolucao' já existir com valor maior, rebaixá-lo produziria duplicata.
  set ultimo = greatest(public.numero_sequencia.ultimo, excluded.ultimo);

-- ---------------------------------------------------------------------------
-- RLS — mesmo recorte por obra do contrato, espelhando o recebimento
-- ---------------------------------------------------------------------------
alter table public.devolucao      enable row level security;
alter table public.devolucao_item enable row level security;

drop policy if exists "devolucao_select" on public.devolucao;
drop policy if exists "devolucao_write"  on public.devolucao;

create policy "devolucao_select" on public.devolucao
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and deleted_at is null
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(public.obra_do_contrato(contrato_id))
    )
  );

create policy "devolucao_write" on public.devolucao
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(public.obra_do_contrato(contrato_id))
    )
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

drop policy if exists "devolucao_item_select" on public.devolucao_item;
drop policy if exists "devolucao_item_write"  on public.devolucao_item;

-- O item herda a visibilidade do documento: o `exists` recai sobre a policy de
-- `devolucao`, que já aplica o recorte por obra.
create policy "devolucao_item_select" on public.devolucao_item
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and exists (select 1 from public.devolucao d where d.id = devolucao_id)
  );

create policy "devolucao_item_write" on public.devolucao_item
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
    and exists (select 1 from public.devolucao d where d.id = devolucao_id)
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit on public.devolucao;
create trigger trg_audit after insert or update or delete on public.devolucao
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- soft_delete: ramo da devolução
-- ---------------------------------------------------------------------------
-- Uma devolução FECHADA não se exclui: ela já gerou documento, já baixou saldo
-- e já foi comunicada ao fornecedor. Excluí-la deixaria as `movimentacao`
-- órfãs — o saldo continuaria baixado, sem documento que explicasse por quê.
create or replace function public.soft_delete_devolucao(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid := public.current_org_id();
  v_linhas int;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if not public.pode_operar() then
    raise exception 'Sem permissão para excluir devoluções.' using errcode = '42501';
  end if;

  update public.devolucao set deleted_at = now()
   where id = p_id and org_id = v_org and deleted_at is null
     and status = 'rascunho';

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

notify pgrst, 'reload schema';
