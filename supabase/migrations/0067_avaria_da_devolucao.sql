-- ============================================================================
-- A ressalva de avaria vira avaria rastreada — fase 2b
-- (docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md)
--
-- Na 2a, marcar um item como "com avaria" na devolução produzia texto: uma
-- linha na tabela do termo e um parágrafo na seção de ressalvas. Bonito no
-- papel, e nada mais — ninguém conseguia responder "quantas avarias estão
-- abertas" nem "quanto elas somam", porque não existia registro, só prosa.
--
-- Esta migration redefine `fechar_devolucao` para criar uma `avaria` por item
-- ressalvado, DENTRO da mesma transação. Ou o documento fecha com as avarias
-- registradas, ou não fecha.
--
-- Por que na transação e não numa etapa seguinte da action: se a criação
-- falhasse depois do fechamento, o termo já teria saído ao fornecedor com as
-- ressalvas impressas e o sistema não teria nenhuma delas. O papel diria uma
-- coisa e o banco, outra.
-- ============================================================================

create or replace function public.fechar_devolucao(p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_dev      record;
  v_item     record;
  v_saldo    numeric;
  v_ano      int;
  v_numero   text;
  v_faltam   text[] := '{}';
  v_avarias  int := 0;
begin
  -- `for update` segura a linha até o fim da transação. É a trava contra o
  -- duplo clique: o segundo fechamento espera aqui e, quando entra, já não
  -- acha status 'rascunho'.
  select d.* into v_dev
    from public.devolucao d
   where d.id = p_id and d.deleted_at is null
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'Devolução não encontrada.');
  end if;
  if v_dev.status <> 'rascunho' then
    return jsonb_build_object('ok', false, 'motivo', 'Esta devolução já foi fechada.');
  end if;
  if not exists (select 1 from public.devolucao_item where devolucao_id = p_id) then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'Lance ao menos um item antes de fechar a devolução.'
    );
  end if;

  -- ── Conferência de saldo, item a item ────────────────────────────────────
  -- Acumula TODOS os que não cabem antes de decidir. Recusar no primeiro faria
  -- o usuário corrigir um item, tentar de novo, e descobrir o seguinte — uma
  -- tentativa por item errado.
  for v_item in
    select di.id,
           di.item_locado_id,
           di.quantidade,
           il.quantidade as contratado,
           coalesce(ic.descricao, 'Item') as descricao
      from public.devolucao_item di
      join public.item_locado il on il.id = di.item_locado_id
      left join public.item_catalogo ic on ic.id = il.item_id
     where di.devolucao_id = p_id
  loop
    select v_item.contratado - coalesce(sum(m.quantidade), 0)
      into v_saldo
      from public.movimentacao m
     where m.item_locado_id = v_item.item_locado_id
       and m.tipo = 'devolucao';

    if v_item.quantidade > v_saldo then
      v_faltam := v_faltam || format(
        '%s: devolvendo %s, saldo em aberto %s',
        v_item.descricao,
        trim(to_char(v_item.quantidade, 'FM999999990.99')),
        trim(to_char(v_saldo,          'FM999999990.99'))
      );
    end if;
  end loop;

  -- Recusa INTEIRA. Gravar as linhas que cabem e descartar as que não cabem
  -- produziria uma devolução parcial que ninguém pediu, num documento que já
  -- teria saído com a lista completa.
  if array_length(v_faltam, 1) > 0 then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'A quantidade devolvida passa do saldo em aberto — '
                || array_to_string(v_faltam, '; ') || '.'
    );
  end if;

  -- ── Numeração ────────────────────────────────────────────────────────────
  -- O ano é o de São Paulo, não o do servidor: às 23h de 31 de dezembro o
  -- Vercel em UTC já virou o ano, e a primeira devolução de janeiro sairia
  -- numerada no ano errado.
  v_ano := extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
  v_numero := public.proximo_numero(v_dev.org_id, 'devolucao', v_ano);

  -- ── O razão de saldo ─────────────────────────────────────────────────────
  insert into public.movimentacao
    (org_id, item_locado_id, tipo, quantidade, data, observacoes, vistoria_id, devolucao_id)
  select
    v_dev.org_id,
    di.item_locado_id,
    'devolucao',
    di.quantidade,
    v_dev.devolvido_em,
    di.observacoes,
    v_dev.vistoria_id,
    v_dev.id
  from public.devolucao_item di
  where di.devolucao_id = p_id;

  -- ── As avarias ───────────────────────────────────────────────────────────
  -- Uma `avaria` por item ressalvado como 'avaria'. Ela nasce numerada (o
  -- gatilho da 0048), aberta, e com responsabilidade 'indefinida' — que é o
  -- estado honesto: acabou de ser constatada, e o laudo existe para apurar.
  --
  -- 'faltante' NÃO vira avaria. Item que não voltou não tem dano a periciar: é
  -- reposição a negociar, e tratá-lo como avaria encheria a lista de laudos de
  -- casos que nunca terão perícia.
  --
  -- Depende de `vistoria_id`: sem o relatório fotográfico, a avaria não tem
  -- onde pendurar. O rascunho cria a vistoria justamente por isso; se ela
  -- faltar (rascunho antigo, criação falhou), o fechamento segue sem as
  -- avarias em vez de abortar — o documento e o saldo importam mais.
  if v_dev.vistoria_id is not null then
    insert into public.avaria
      (org_id, vistoria_id, devolucao_id, unidade_id, descricao, data,
       responsabilidade, status, custo_estimado)
    select
      v_dev.org_id,
      v_dev.vistoria_id,
      v_dev.id,
      di.unidade_id,
      -- `descricao` é a linha curta (300 chars) que aparece na lista da
      -- vistoria e no lançamento financeiro. A observação do item é o que a
      -- pessoa escreveu ao conferir; truncar é melhor do que recusar o
      -- fechamento por causa de um texto comprido.
      left(
        coalesce(nullif(trim(di.observacoes), ''), 'Avaria constatada na devolução ' || v_numero),
        300
      ),
      v_dev.devolvido_em,
      'indefinida',
      'aberta',
      0
    from public.devolucao_item di
    where di.devolucao_id = p_id
      and di.condicao = 'avaria';

    get diagnostics v_avarias = row_count;
  end if;

  -- ── Os itens que zeraram ─────────────────────────────────────────────────
  -- Sem isto o item fica eternamente "em uso" com saldo zero, e é o custo
  -- estimado dele que continua correndo.
  update public.item_locado il
     set status = 'devolvido',
         data_devolucao = v_dev.devolvido_em
   where il.id in (
           select di.item_locado_id from public.devolucao_item di
            where di.devolucao_id = p_id
         )
     and il.status <> 'devolvido'
     and il.quantidade <= (
           select coalesce(sum(m.quantidade), 0)
             from public.movimentacao m
            where m.item_locado_id = il.id and m.tipo = 'devolucao'
         );

  -- ── O documento ──────────────────────────────────────────────────────────
  update public.devolucao
     set numero_registro = v_numero,
         status          = 'fechado',
         fechado_em      = now(),
         fechado_por     = auth.uid()
   where id = p_id;

  return jsonb_build_object('ok', true, 'numero', v_numero, 'avarias', v_avarias);
end;
$$;

comment on function public.fechar_devolucao(uuid) is
  'Confere saldo, lança o razão, abre as avarias ressalvadas, marca os itens devolvidos e numera — em uma transação.';

notify pgrst, 'reload schema';
