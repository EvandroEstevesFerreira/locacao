-- ============================================================================
-- Revoga EXECUTE do guard de fechamento
--
-- `get_advisors` apontou `guard_fechamento_imutavel` como função SECURITY
-- DEFINER chamável por `anon` e `authenticated` via /rest/v1/rpc. Na prática
-- chamá-la direto falha ("trigger functions can only be called as triggers"),
-- mas função de trigger não tem motivo NENHUM para estar no PostgREST.
--
-- Revogar é seguro: o Postgres verifica EXECUTE na CRIAÇÃO do trigger, não a
-- cada disparo. Verificado depois de aplicar: o trigger continua ativo e
-- continua recusando alteração de mês fechado.
--
-- REVOGAR DE `public` É O QUE IMPORTA. A primeira tentativa revogou só de
-- `anon, authenticated` e não surtiu efeito nenhum: o EXECUTE de função é
-- concedido a PUBLIC por padrão, e os dois papéis herdam dali.
-- `has_function_privilege` continuava devolvendo true, e foi ele que pegou o
-- engano — sem a verificação, a migration teria "passado" sem fazer nada.
--
-- ATENÇÃO ao replicar: NÃO revogue de `current_org_id`, `current_papel`,
-- `is_member_of_obra`, `pode_*`. Essas são chamadas DENTRO de policies, que
-- avaliam com o privilégio de quem consulta — revogar quebraria a RLS inteira.
--
-- As outras quatro funções de trigger do projeto (`set_updated_at`,
-- `registrar_auditoria`, `guard_perfil_self_update`,
-- `atribuir_numero_registro`) têm o mesmo apontamento, de antes desta fatia, e
-- ficam para uma passagem própria de higiene de segurança.
-- ============================================================================

revoke execute on function public.guard_fechamento_imutavel() from public;
revoke execute on function public.guard_fechamento_imutavel() from anon, authenticated;
