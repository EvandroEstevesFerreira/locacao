-- ============================================================================
-- Endurece o acesso à função de exclusão criada em 0041.
--
-- O `revoke all ... from public` de 0041 não alcança os grants por papel que o
-- Supabase concede por default (anon/authenticated/service_role). Resultado:
-- uma chamada com a chave anônima chegava a executar a função — sem efeito,
-- porque sem JWT a própria função recusa ("Sessão inválida"), mas uma função
-- SECURITY DEFINER não deve ser exposta a quem não está autenticado.
-- ============================================================================

revoke execute on function public.soft_delete(text, uuid) from anon;

notify pgrst, 'reload schema';
