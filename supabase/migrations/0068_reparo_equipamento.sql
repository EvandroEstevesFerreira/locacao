-- ============================================================================
-- Ordem de reparo de equipamento — fase 2c
-- (docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md)
--
-- `reparo_imovel` existe desde a 0019 e é do IMÓVEL. Equipamento que sai para
-- conserto some do sistema: não está na obra, não voltou ao fornecedor, e
-- ninguém sabe quando volta. A peça fica marcada como 'manutencao' — um estado
-- sem prazo, sem custo e sem quem está com ela.
--
-- O que esta tabela responde: ONDE a peça está, DESDE QUANDO, QUANTO vai custar,
-- QUEM paga e QUANDO volta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Prefixo novo
-- ---------------------------------------------------------------------------
-- REP já é de `reparo_imovel`. `registros.test.ts` tem trava contra prefixo
-- repetido, e ela está certa: com dois tipos em REP, ler REP-2026-0007 não diz
-- se o registro é de um apartamento ou de uma betoneira.
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
    when 'reparo_equipamento'    then 'RPE'
    when 'medida_disciplinar'    then 'MED'
    when 'entrega_ocupante'      then 'ENT'
    when 'checklist_limpeza'     then 'LIM'
    when 'ocorrencia_imovel'     then 'OCO'
    when 'termo_equipamento'     then 'TRM'
    when 'treinamento_conclusao' then 'TRE'
    else 'REG'
  end;
$$;

-- ---------------------------------------------------------------------------
-- reparo_equipamento
-- ---------------------------------------------------------------------------
create table if not exists public.reparo_equipamento (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,

  -- A PEÇA é obrigatória. Um reparo é sempre de alguma coisa identificável —
  -- material de lote (andaime, escora) não vai para conserto, é substituído.
  -- Sem isto, a ordem seria um recibo de despesa sem objeto.
  unidade_id      uuid not null references public.equipamento_unidade (id) on delete cascade,

  -- A avaria que originou. NULO de propósito: manutenção preventiva não vem de
  -- dano nenhum, e exigir uma avaria obrigaria a inventar um problema para
  -- poder registrar a revisão de rotina.
  avaria_id       uuid references public.avaria (id) on delete set null,

  numero_registro text,

  -- 'aberto' é a ordem emitida e ainda não despachada; 'em_execucao' é a peça
  -- FORA da obra, na oficina. A separação existe porque é entre esses dois
  -- estados que a peça deixa de estar disponível, e a data de saída é o que
  -- inicia a contagem de indisponibilidade.
  status          text not null default 'aberto'
                  check (status in ('aberto', 'em_execucao', 'concluido', 'cancelado')),

  descricao       text not null,
  -- Quem executa. Texto e não FK para `fornecedor`: oficina de conserto quase
  -- nunca é o mesmo cadastro de quem aluga o equipamento, e criar fornecedor
  -- para cada oficina encheria a lista de quem escolhe fornecedor num contrato.
  executor        text,

  -- Datas do ciclo. `enviado_em` nulo = ordem aberta, peça ainda na obra.
  aberto_em       date not null,
  enviado_em      date,
  previsto_para   date,
  concluido_em    date,

  valor           numeric(14, 2) not null default 0,
  -- Quem paga. Espelha `avaria.responsabilidade` de propósito: quando o reparo
  -- vem de uma avaria, a resposta é a mesma, e dois vocabulários diferentes
  -- para a mesma pergunta produziriam relatórios que não batem.
  responsabilidade text not null default 'indefinida'
                   check (responsabilidade in ('indefinida', 'fornecedor', 'obra', 'funcionario')),
  -- Garantia do serviço, em dias. Nulo = sem garantia declarada.
  garantia_dias   int check (garantia_dias is null or garantia_dias >= 0),

  observacoes     text,

  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (org_id, numero_registro),

  -- Conclusão sem data de conclusão seria uma ordem encerrada sem dizer
  -- quando — e é a data que fecha a contagem de indisponibilidade da peça.
  constraint reparo_concluido_tem_data
    check (status <> 'concluido' or concluido_em is not null)
);

create index if not exists idx_reparo_equip_unidade
  on public.reparo_equipamento (unidade_id, aberto_em desc);
create index if not exists idx_reparo_equip_org
  on public.reparo_equipamento (org_id, aberto_em desc) where deleted_at is null;
create index if not exists idx_reparo_equip_avaria
  on public.reparo_equipamento (avaria_id) where avaria_id is not null;

drop trigger if exists trg_reparo_equip_updated_at on public.reparo_equipamento;
create trigger trg_reparo_equip_updated_at
  before update on public.reparo_equipamento
  for each row execute function public.set_updated_at();

-- COM `trg_numero_registro`, ao contrário do recebimento e da devolução. A
-- ordem de reparo não tem rascunho: ela nasce como documento, porque é ela que
-- autoriza a peça a sair da obra. Numerar no INSERT é o correto aqui.
drop trigger if exists trg_numero_registro on public.reparo_equipamento;
create trigger trg_numero_registro
  before insert on public.reparo_equipamento
  for each row execute function public.atribuir_numero_registro('reparo_equipamento');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- O recorte é o da ORGANIZAÇÃO, não o da obra. `equipamento_unidade` é da
-- organização inteira (uma peça circula entre obras), e um recorte por obra
-- esconderia da obra B o reparo da betoneira que ela vai receber na semana que
-- vem — que é justamente o que ela precisa saber.
alter table public.reparo_equipamento enable row level security;

drop policy if exists "reparo_equipamento_select" on public.reparo_equipamento;
drop policy if exists "reparo_equipamento_write"  on public.reparo_equipamento;

create policy "reparo_equipamento_select" on public.reparo_equipamento
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and deleted_at is null
  );

create policy "reparo_equipamento_write" on public.reparo_equipamento
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit on public.reparo_equipamento;
create trigger trg_audit after insert or update or delete on public.reparo_equipamento
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- A situação da peça segue o reparo
-- ---------------------------------------------------------------------------
-- POR QUE ISTO É TRIGGER E NÃO CÓDIGO DA ACTION.
--
-- A peça em conserto tem de aparecer como 'manutencao' em TODA tela que a
-- mostra — frota, estoque, seleção de peça num termo. Se a atualização
-- morasse na action, bastaria um caminho novo de escrita esquecer a linha para
-- a peça ficar 'disponivel' com a máquina na oficina — e alguém a entregaria a
-- um funcionário que iria procurá-la e não achar.
--
-- Só mexe em quem SAIU e em quem VOLTOU:
--   - vira 'em_execucao'  → a peça vai para 'manutencao'
--   - sai de 'em_execucao' → a peça volta para 'disponivel', mas SÓ se ainda
--     estiver em 'manutencao'. Se alguém já a moveu (baixada, perdida), a
--     decisão daquela pessoa vale mais do que a inferência daqui.
create or replace function public.sincronizar_situacao_peca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'em_execucao' then
      update public.equipamento_unidade set situacao = 'manutencao'
       where id = new.unidade_id and situacao <> 'manutencao';
    end if;
    return new;
  end if;

  if new.status = 'em_execucao' and old.status <> 'em_execucao' then
    update public.equipamento_unidade set situacao = 'manutencao'
     where id = new.unidade_id and situacao <> 'manutencao';
  elsif old.status = 'em_execucao' and new.status <> 'em_execucao' then
    update public.equipamento_unidade set situacao = 'disponivel'
     where id = new.unidade_id and situacao = 'manutencao';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_situacao_peca on public.reparo_equipamento;
create trigger trg_situacao_peca
  after insert or update of status on public.reparo_equipamento
  for each row execute function public.sincronizar_situacao_peca();

-- ---------------------------------------------------------------------------
-- soft_delete
-- ---------------------------------------------------------------------------
-- Ordem CONCLUÍDA não se exclui: ela registra um custo que já foi pago e um
-- serviço que já foi feito. Para desfazer, cancele — o que devolve a peça e
-- deixa o rastro.
create or replace function public.soft_delete_reparo_equipamento(p_id uuid)
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
    raise exception 'Sem permissão para excluir ordens de reparo.' using errcode = '42501';
  end if;

  update public.reparo_equipamento set deleted_at = now()
   where id = p_id and org_id = v_org and deleted_at is null
     and status <> 'concluido';

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

notify pgrst, 'reload schema';
