-- ============================================================================
-- Correção: recursão de RLS entre obra e obra_usuario
-- obra_select consultava obra_usuario (cuja política chama has_obra_access,
-- que consulta obra) → recursão infinita (erro 500).
-- Solução: checar associação por obra via função SECURITY DEFINER que consulta
-- apenas obra_usuario (ignora RLS, sem re-entrar em nenhuma política).
-- ============================================================================

create or replace function public.is_member_of_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra_usuario ou
    where ou.obra_id = p_obra_id and ou.perfil_id = auth.uid()
  );
$$;

drop policy if exists "obra_select" on public.obra;
create policy "obra_select" on public.obra
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('admin', 'financeiro')
      or public.is_member_of_obra(id)
    )
  );

drop policy if exists "obra_update" on public.obra;
create policy "obra_update" on public.obra
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() = 'admin'
      or (public.current_papel() = 'gestor' and public.is_member_of_obra(id))
    )
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );
