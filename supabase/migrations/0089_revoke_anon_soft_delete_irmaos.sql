-- ============================================================================
-- `anon` perde as três irmãs do `soft_delete` — e por que só elas
-- ============================================================================
--
-- Veio de uma auditoria de segurança rodada depois das migrations 0080–0088.
-- O linter do Supabase aponta **22 funções `security definer` no schema
-- `public` que o papel `anon` pode executar** via `/rest/v1/rpc/...`.
--
-- Três delas são irmãs do `soft_delete` e repetem exatamente o caso que a
-- migration 0042 já resolveu para ele:
--
--   soft_delete_devolucao(uuid)
--   soft_delete_recebimento(uuid)
--   soft_delete_reparo_equipamento(uuid)
--
-- NÃO É VULNERABILIDADE. As três exigem `current_org_id()`, recusam com
-- "Sessão inválida" sem JWT e conferem o papel antes de tocar em qualquer
-- linha — conferido no corpo de cada uma. Uma chamada anônima não faz nada.
--
-- Mas uma função `security definer` não deve estar EXPOSTA a quem não está
-- autenticado, e foi essa a palavra da 0042. Elas nasceram depois e não
-- receberam o mesmo tratamento.
--
-- ┌─ POR QUE AS OUTRAS 19 FICAM COMO ESTÃO ───────────────────────────────────┐
-- │                                                                           │
-- │ O linter vai continuar apontando as 19, e a tentação de "resolver o       │
-- │ aviso" é forte. NÃO RESOLVA. Medido nas policies desta base:              │
-- │                                                                           │
-- │   current_org_id ......... usada em 136 policies                          │
-- │   pode_operar ............ 43                                             │
-- │   is_member_of_obra ...... 25                                             │
-- │   pode_gerir_cadastros ... 24                                             │
-- │   current_papel .......... 23                                             │
-- │   has_imovel_access ...... 16                                             │
-- │   ... e mais seis, de 1 a 10                                              │
-- │                                                                           │
-- │ Policy roda com os privilégios de QUEM CONSULTA. Tirar o EXECUTE do       │
-- │ `anon` faria toda policy que chama `current_org_id()` estourar em         │
-- │ requisição anônima — e há uma página pública neste sistema: `/assinar/    │
-- │ [token]`, onde o funcionário assina o termo pelo celular, com a chave     │
-- │ anônima. O aviso do linter custaria a assinatura à distância inteira.     │
-- │                                                                           │
-- │ As seis restantes são funções de TRIGGER (`registrar_auditoria`,          │
-- │ `atribuir_numero_registro`, `handle_new_user`, `marcar_senha_trocada`,    │
-- │ `guard_perfil_self_update`, `sincronizar_situacao_peca`). O PostgREST não │
-- │ as expõe — devolvem `trigger`, e não há como chamá-las por RPC. Revogar   │
-- │ seria mexer sem ganho.                                                    │
-- │                                                                           │
-- │ E `termo_do_link`, `conferir_cpf_do_link` e `assinar_termo_por_link`      │
-- │ ficam ACESSÍVEIS AO `anon` DE PROPÓSITO: são a página de assinatura.      │
-- └───────────────────────────────────────────────────────────────────────────┘

-- `from public, anon` e nao so `from anon`: o Postgres concede EXECUTE de toda
-- funcao ao papel PUBLIC por padrao, e o `anon` herda dali. Revogar so do
-- `anon` nao tira nada -- foi por isso que a 0041 e a 0042 precisaram ser DUAS
-- migrations, e foi o que a conferência no fim deste arquivo pegou na primeira
-- tentativa desta aqui.
revoke execute on function public.soft_delete_devolucao(uuid)          from public, anon;
revoke execute on function public.soft_delete_recebimento(uuid)        from public, anon;
revoke execute on function public.soft_delete_reparo_equipamento(uuid) from public, anon;

-- `authenticated` continua, porque é quem opera o sistema.
grant execute on function public.soft_delete_devolucao(uuid)          to authenticated;
grant execute on function public.soft_delete_recebimento(uuid)        to authenticated;
grant execute on function public.soft_delete_reparo_equipamento(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
-- Aborta se alguma das três seguir aberta ao anônimo, ou se alguma tiver
-- perdido o acesso de quem opera — o segundo erro seria pior que o primeiro:
-- ninguém mais conseguiria excluir uma devolução, e o motivo não apareceria.
do $$
declare
  v_abertas  int;
  v_fechadas int;
begin
  select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')),
         count(*) filter (where not has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    into v_abertas, v_fechadas
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('soft_delete_devolucao',
                      'soft_delete_recebimento',
                      'soft_delete_reparo_equipamento');

  if v_abertas > 0 then
    raise exception '% funcao(oes) continuam executaveis pelo anon.', v_abertas;
  end if;
  if v_fechadas > 0 then
    raise exception '% funcao(oes) ficaram inacessiveis a quem opera.', v_fechadas;
  end if;
end $$;

notify pgrst, 'reload schema';
