-- ============================================================================
-- A exclusão suave voltava a aparecer para quem opera
-- ============================================================================
--
-- DEFEITO CONFIRMADO COM PROVA, em 07/09/2026, contra a produção.
--
-- Oito tabelas com exclusão suave têm DUAS policies permissivas: uma
-- `..._select`, que esconde `deleted_at`, e uma `..._write` declarada
-- `for all` — e `for all` INCLUI SELECT.
--
-- Policies permissivas são OR'd. Como o `using` da `_write` não menciona
-- `deleted_at`, todo usuário que passa por `pode_operar()` lê pela segunda
-- porta e ENXERGA O QUE FOI EXCLUÍDO.
--
-- O teste que provou, em `certificado_equipamento`: duas linhas, uma com
-- `deleted_at` preenchido; sob a sessão de um usuário que opera, a consulta
-- devolveu AS DUAS — "ZZ_EXCLUIDO, ZZ_VIVO".
--
-- Isso contradiz o que o AGENTS.md afirma ("a policy de SELECT esconde linhas
-- com deleted_at") e o que a tela promete a quem clica em excluir. Numa dessas
-- tabelas o registro é medida disciplinar; noutra, entrega ao ocupante.
--
-- ┌─ SÓ NO `using`, NUNCA NO `with check` ────────────────────────────────────┐
-- │ Pôr `deleted_at is null` também no `with check` recriaria o incidente da  │
-- │ 0.19.4 (migration 0041): o Postgres aplica o `with check` à linha NOVA de │
-- │ um UPDATE, e a linha nova de uma exclusão suave tem `deleted_at`          │
-- │ preenchido — o próprio comando de excluir abortaria.                     │
-- │                                                                           │
-- │ `using` decide QUAIS LINHAS o comando enxerga; `with check`, como a linha │
-- │ pode FICAR. Aqui só a primeira pergunta está errada.                     │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- Não há caminho de "restaurar" em nenhuma das oito — conferido no código
-- antes: `restaurarTemplate` é de template de documento, e o "Restaurar" da
-- peça mexe em `situacao`. Então impedir UPDATE e DELETE sobre linha já
-- excluída não tira função nenhuma; devolve a garantia.

do $$
declare
  r          record;
  v_qual     text;
  v_mexidas  int := 0;
begin
  for r in
    select p.tablename, p.policyname
    from pg_policies p
    where p.schemaname = 'public'
      and p.cmd = 'ALL'
      and p.qual is not null
      and p.qual not like '%deleted_at%'
      and exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = p.tablename
          and c.column_name = 'deleted_at'
      )
  loop
    -- Reaproveita a condição que já existe em vez de reescrevê-la: são oito
    -- policies com `using` diferentes, e transcrever cada uma à mão é como se
    -- perde um `is_member_of_obra` no caminho.
    select qual into v_qual
      from pg_policies
     where schemaname = 'public'
       and tablename = r.tablename
       and policyname = r.policyname;

    execute format(
      'alter policy %I on public.%I using ((%s) and deleted_at is null)',
      r.policyname, r.tablename, v_qual
    );
    v_mexidas := v_mexidas + 1;
    raise notice 'corrigida: %.%', r.tablename, r.policyname;
  end loop;

  raise notice '% policy(ies) de escrita passaram a esconder o excluido.', v_mexidas;
end $$;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
do $$
declare
  v_faltando int;
begin
  select count(*) into v_faltando
  from pg_policies p
  where p.schemaname = 'public'
    and p.cmd = 'ALL'
    and p.qual is not null
    and p.qual not like '%deleted_at%'
    and exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = p.tablename
        and c.column_name = 'deleted_at'
    );

  if v_faltando > 0 then
    raise exception
      'Sobraram % policy(ies) `for all` que nao escondem o excluido.', v_faltando;
  end if;
end $$;

notify pgrst, 'reload schema';
