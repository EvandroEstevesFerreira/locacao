-- ============================================================================
-- A passagem de higiene que a 0.45.x deixou marcada
-- ============================================================================
--
-- O changelog da 0.45.x (01/09/2026) fecha assim:
--
--   "As outras quatro funções de trigger do projeto têm o mesmo apontamento,
--    de antes desta fatia, e ficam para uma passagem própria de higiene."
--
-- É esta. Hoje são CINCO — `sincronizar_situacao_peca` nasceu depois.
--
-- O QUE SÃO. Funções que devolvem `trigger`, e portanto não podem ser chamadas
-- por RPC: quem tentar recebe "trigger functions can only be called as
-- triggers". Não há brecha aqui, e nunca houve.
--
-- POR QUE MEXER, ENTÃO. Função de trigger não tem motivo nenhum para estar
-- exposta no PostgREST, e enquanto estiver o linter vai apontá-la. Um relatório
-- de segurança com cinco apontamentos permanentes e inócuos é um relatório que
-- ninguém lê — e o dia em que aparecer um apontamento de verdade, ele vai estar
-- no meio dos cinco.
--
-- O PADRÃO JÁ FOI PROVADO NESTA BASE. Três funções de trigger já estão fechadas
-- ao `anon` (`guard_custodia_peca`, `guard_fechamento_imutavel`,
-- `guard_movimento_estoque_imutavel`) e os triggers delas seguem ativos e
-- funcionando. O Postgres confere o privilégio de EXECUTE ao CRIAR o trigger,
-- não a cada disparo.
--
-- `from public, anon, authenticated`, e não só dos dois papéis: o EXECUTE de
-- toda função é concedido a PUBLIC por padrão, e os dois herdam dali. Revogar
-- só dos papéis não tira nada — foi o tropeço registrado na 0.45.x, e o mesmo
-- que eu repeti na 0089 de ontem à noite antes de a conferência pegar.

revoke execute on function public.atribuir_numero_registro()   from public, anon, authenticated;
revoke execute on function public.guard_perfil_self_update()   from public, anon, authenticated;
revoke execute on function public.handle_new_user()            from public, anon, authenticated;
revoke execute on function public.registrar_auditoria()        from public, anon, authenticated;
revoke execute on function public.sincronizar_situacao_peca()  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A conferência: fechadas E ainda disparando
-- ---------------------------------------------------------------------------
-- As duas metades importam. Fechar sem conferir os triggers seria trocar um
-- apontamento de linter por uma numeração de documento que parou de acontecer —
-- e ninguém descobriria até o próximo recebimento nascer sem número.
do $$
declare
  v_abertas   int;
  v_orfas     int;
  v_triggers  int;
begin
  select count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')
                            or has_function_privilege('authenticated', p.oid, 'EXECUTE')),
         count(*) filter (where (select count(*) from pg_trigger t
                                  where t.tgfoid = p.oid and not t.tgisinternal) = 0),
         coalesce(sum((select count(*) from pg_trigger t
                        where t.tgfoid = p.oid and not t.tgisinternal)), 0)
    into v_abertas, v_orfas, v_triggers
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('atribuir_numero_registro', 'guard_perfil_self_update',
                      'handle_new_user', 'registrar_auditoria',
                      'sincronizar_situacao_peca');

  if v_abertas > 0 then
    raise exception '% funcao(oes) de trigger continuam expostas no PostgREST.', v_abertas;
  end if;
  if v_orfas > 0 then
    raise exception '% funcao(oes) ficaram sem trigger nenhum.', v_orfas;
  end if;

  -- 37 no momento em que isto foi escrito: 11 de numeração, 23 de auditoria,
  -- e uma de cada guarda. O número é informativo, não um teto — o `raise
  -- notice` existe para que uma queda brusca apareça na saída da migration.
  raise notice 'ok: 5 funcoes fechadas, % trigger(s) ativos.', v_triggers;
end $$;

notify pgrst, 'reload schema';
