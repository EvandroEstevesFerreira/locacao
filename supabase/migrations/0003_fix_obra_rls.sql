-- ============================================================================
-- Correção de RLS da tabela obra
-- Problema: as políticas usavam has_obra_access(id), que re-consulta a própria
-- tabela obra. Em INSERT ... RETURNING (return=representation) a linha nova
-- ainda não é visível para a subconsulta, causando 403 na leitura de retorno.
-- Solução: referenciar diretamente a coluna org_id da linha e checar acesso
-- por obra apenas via obra_usuario (tabela distinta), sem auto-referência.
-- ============================================================================

drop policy if exists "obra_select" on public.obra;
create policy "obra_select" on public.obra
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or exists (
        select 1 from public.obra_usuario ou
        where ou.obra_id = obra.id and ou.perfil_id = auth.uid()
      )
    )
  );

drop policy if exists "obra_update" on public.obra;
create policy "obra_update" on public.obra
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() = 'admin'
      or (
        public.current_papel() = 'gestor'
        and exists (
          select 1 from public.obra_usuario ou
          where ou.obra_id = obra.id and ou.perfil_id = auth.uid()
        )
      )
    )
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );
