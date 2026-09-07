-- ============================================================================
-- As três policies que ainda reavaliavam a sessão linha a linha
-- ============================================================================
--
-- Advisor de desempenho, `auth_rls_initplan`. Chamada a `auth.uid()` ou
-- `current_org_id()` escrita solta numa policy é reavaliada **para cada linha**
-- examinada. Envolvida em `(select ...)`, o Postgres a resolve UMA vez, como
-- InitPlan, e compara o resultado contra a tabela inteira.
--
-- O projeto já escreve assim desde as policies mais novas — as da 0081, por
-- exemplo, usam `(select public.current_org_id())`. Estas três são as
-- sobreviventes das primeiras migrations, e ficaram para trás quando o padrão
-- mudou.
--
-- É reescrita mecânica e sem mudança de sentido: a função devolve o mesmo valor
-- para todas as linhas do mesmo comando — é essa propriedade que torna o
-- InitPlan válido, e é por isso que o Postgres não faz sozinho (ele não pode
-- provar que a função é estável dentro do comando).
--
-- GANHO REAL HOJE É PEQUENO: `perfil` tem sete linhas e `obra_usuario` algumas
-- dezenas. Mas `perfil_select_same_org` é avaliada em toda consulta que junta
-- perfil — e são muitas, porque o nome de quem fez alguma coisa aparece em
-- quase toda tela.

alter policy perfil_select_same_org on public.perfil
  using (
    (id = (select auth.uid()))
    or (org_id = (select public.current_org_id()))
  );

alter policy perfil_update_self on public.perfil
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy obra_usuario_select on public.obra_usuario
  using (
    (perfil_id = (select auth.uid()))
    or (select public.has_obra_access(obra_id))
  );

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
-- Aborta se alguma das três seguir com a chamada solta. A busca é pelo texto
-- SEM o `(select`, que é exatamente o que o advisor aponta.
do $$
declare
  v_soltas int;
begin
  select count(*) into v_soltas
  from pg_policies
  where schemaname = 'public'
    and policyname in ('perfil_select_same_org', 'perfil_update_self',
                       'obra_usuario_select')
    and (
      coalesce(qual, '') like '%= auth.uid()%'
      or coalesce(qual, '') like '%= current_org_id()%'
      or coalesce(qual, '') like '%or has_obra_access%'
      or coalesce(with_check, '') like '%= auth.uid()%'
    );

  if v_soltas > 0 then
    raise exception
      '% policy(ies) ainda reavaliam a sessao linha a linha.', v_soltas;
  end if;
end $$;

notify pgrst, 'reload schema';
