-- ============================================================================
-- Corrige a exclusão (soft-delete), que nunca chegou a funcionar.
--
-- Causa raiz: as policies de SELECT criadas em 0033/0034 exigem
-- "deleted_at is null". No Postgres, um UPDATE que referencia colunas da tabela
-- também é validado pelas policies de SELECT aplicadas à NOVA linha; ao gravar
-- deleted_at a linha deixaria de ser visível e o banco aborta o comando com
--   "new row violates row-level security policy" (SQLSTATE 42501).
-- Ou seja: o próprio UPDATE que marca a exclusão era recusado — em obra,
-- contrato_locacao, lancamento_financeiro e imovel. Como as actions ignoravam
-- o erro, a tela apenas recarregava com o registro intacto.
--
-- Correção: a exclusão passa a ser feita por função SECURITY DEFINER, que não
-- depende de RLS e valida explicitamente organização, papel e escopo de obra
-- (espelhando os helpers de permissão do app). As policies de SELECT seguem
-- escondendo os registros excluídos.
-- ============================================================================

create or replace function public.soft_delete(p_entidade text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid := public.current_org_id();
  v_admin  boolean := public.pode_gerir_cadastros();  -- master/administrador
  v_linhas int;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  case p_entidade
    -- Imóveis: operacional; quem não é master/administrador só exclui imóveis
    -- das obras a que tem acesso (espelha a policy imovel_update).
    when 'imovel' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir imóveis.' using errcode = '42501';
      end if;
      update public.imovel set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null
          and (v_admin or public.is_member_of_obra(obra_id));

    -- Obras: cadastro (master/administrador).
    when 'obra' then
      if not v_admin then
        raise exception 'Sem permissão para excluir obras.' using errcode = '42501';
      end if;
      update public.obra set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    -- Contratos e lançamentos: exclusão crítica (somente master).
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

    else
      raise exception 'Entidade inválida: %', p_entidade using errcode = '22023';
  end case;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

comment on function public.soft_delete(text, uuid) is
  'Marca deleted_at (soft-delete) validando org/papel/obra. SECURITY DEFINER '
  'porque a policy de SELECT esconde linhas com deleted_at, o que faria o RLS '
  'recusar o próprio UPDATE de exclusão.';

revoke all on function public.soft_delete(text, uuid) from public;
grant execute on function public.soft_delete(text, uuid) to authenticated;

notify pgrst, 'reload schema';
