-- ============================================================================
-- Fechamento da devolução, atômico — fase 2a
-- (docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md)
--
-- POR QUE ISTO NÃO MORA NA ACTION.
--
-- Fechar uma devolução são quatro escritas dependentes: conferir o saldo,
-- lançar as `movimentacao`, marcar os `item_locado` que zeraram, e numerar e
-- fechar o documento. Encadeadas na action, cada emenda entre elas é uma
-- janela: um erro no meio deixa documento FECHADO dizendo que o equipamento
-- voltou, com o saldo NÃO baixado — e é sobre o saldo que corre o custo de
-- locação. O contrato seguiria cobrando diária de betoneira que está no pátio
-- do fornecedor, e nada na tela acusaria.
--
-- E a conferência de saldo em duas etapas (ler na action, gravar depois) é uma
-- corrida clássica: entre a leitura e a escrita, outra pessoa fecha a devolução
-- do mesmo item e as duas passam.
--
-- Aqui as quatro são uma transação. Ou tudo, ou nada.
-- ============================================================================

-- `security invoker` (o padrão) DE PROPÓSITO: a função tem de continuar sujeita
-- à RLS. Marcá-la `security definer` a faria enxergar e escrever devolução de
-- qualquer organização — o mesmo furo do `createAdminClient()` em tabela de
-- aplicação, por outra porta.
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
  -- `vistoria_id` vem do documento: é o mesmo relatório fotográfico, e repeti-lo
  -- em cada linha é o que permite abrir as fotos a partir de qualquer uma.
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

  return jsonb_build_object('ok', true, 'numero', v_numero);
end;
$$;

comment on function public.fechar_devolucao(uuid) is
  'Confere saldo, lança o razão, marca os itens devolvidos e numera — em uma transação.';

notify pgrst, 'reload schema';
