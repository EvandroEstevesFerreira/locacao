-- ============================================================================
-- v0.108.1 — Excluir imóvel encerra os contratos dele
-- ============================================================================
--
-- O DEFEITO: `soft_delete('imovel', …)` marcava só o imóvel. O
-- `contrato_imovel` seguia `vigente = true`, apontando para um imóvel que a
-- policy de SELECT esconde — e toda soma de `contrato_imovel where vigente`
-- herdava o erro, que cresce a cada exclusão.
--
-- ESTE ARQUIVO PARTE DO CÓDIGO QUE ESTÁ EM PRODUÇÃO, não da migration 0041.
-- A função ganhou cinco ramos depois dela (medida_disciplinar, entrega_ocupante,
-- tarefa_limpeza, checklist_limpeza, certificado_equipamento); reescrevê-la de
-- memória teria apagado os cinco em silêncio, quebrando exclusões pelo app
-- inteiro sem erro nenhum na tela.

create or replace function public.soft_delete(p_entidade text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid := public.current_org_id();
  v_admin  boolean := public.pode_gerir_cadastros();
  v_linhas int;
  -- O contador do IMÓVEL, separado. Sem ele, o `get diagnostics` do fim contaria
  -- as linhas do UPDATE de contrato: um imóvel sem contrato voltaria `false` e a
  -- tela diria "não foi possível excluir" logo após excluir.
  v_imovel int := null;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  case p_entidade
    when 'imovel' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir imóveis.' using errcode = '42501';
      end if;
      update public.imovel set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null
          and (v_admin or public.is_member_of_obra(obra_id));

      -- O CONTRATO CAI JUNTO. Contrato vigente de imóvel excluído não é um
      -- estado que exista no mundo: não há imóvel para alugar. Descoberto em
      -- 10/09/2026 ao conciliar aluguel com o Mega -- a soma dos vigentes dava
      -- R$ 66.575/mês contra R$ 58.075 reais: R$ 8.500 de aluguel fantasma em
      -- 3 contratos de imóveis já excluídos.
      --
      -- SÓ SE O IMÓVEL FOI MESMO EXCLUÍDO: sem esta condição, uma tentativa
      -- barrada por permissão encerraria os contratos assim mesmo -- a exclusão
      -- falharia e o estrago ficaria.
      get diagnostics v_imovel = row_count;
      if v_imovel > 0 then
        update public.contrato_imovel set vigente = false
          where imovel_id = p_id and org_id = v_org and vigente;
      end if;

    when 'obra' then
      if not v_admin then
        raise exception 'Sem permissão para excluir obras.' using errcode = '42501';
      end if;
      update public.obra set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'contrato_locacao' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir contratos.' using errcode = '42501';
      end if;
      update public.contrato_locacao set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'lancamento_financeiro' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir lançamentos.' using errcode = '42501';
      end if;
      update public.lancamento_financeiro set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'medida_disciplinar' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir medidas disciplinares.' using errcode = '42501';
      end if;
      update public.medida_disciplinar set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'entrega_ocupante' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir entregas.' using errcode = '42501';
      end if;
      update public.entrega_ocupante set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    -- Catálogo de tarefas: cadastro, vale para toda a organização.
    when 'tarefa_limpeza' then
      if not v_admin then
        raise exception 'Sem permissão para excluir tarefas de limpeza.' using errcode = '42501';
      end if;
      update public.tarefa_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'checklist_limpeza' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir checklists.' using errcode = '42501';
      end if;
      update public.checklist_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'certificado_equipamento' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir certificados.' using errcode = '42501';
      end if;
      update public.certificado_equipamento set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    else
      raise exception 'Entidade inválida: %', p_entidade using errcode = '22023';
  end case;

  get diagnostics v_linhas = row_count;
  -- Para imóvel vale o contador do imóvel; para o resto, o da última instrução.
  return coalesce(v_imovel, v_linhas) > 0;
end;
$$;

comment on function public.soft_delete(text, uuid) is
  'Exclusão lógica com verificação de permissão por entidade. Excluir imóvel '
  'encerra os contratos dele (migration 0108): contrato vigente de imóvel '
  'excluído inflava a soma de aluguel em R$ 8.500/mês quando o defeito foi '
  'descoberto, em 10/09/2026.';

revoke all on function public.soft_delete(text, uuid) from public;
grant execute on function public.soft_delete(text, uuid) to authenticated;
