-- ============================================================================
-- Esconde linhas soft-deletadas na leitura (RLS), para obra/contrato/lançamento.
-- Recria as policies de SELECT com o predicado atual + "deleted_at is null".
-- (imovel tem policy ALL que também concede SELECT; lá o filtro é no código.)
-- ============================================================================
drop policy if exists "obra_select" on public.obra;
create policy "obra_select" on public.obra
  for select to authenticated
  using (
    (org_id = public.current_org_id())
    and (
      (public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario]))
      or public.is_member_of_obra(id)
    )
    and deleted_at is null
  );

drop policy if exists "contrato_select" on public.contrato_locacao;
create policy "contrato_select" on public.contrato_locacao
  for select to authenticated
  using (
    (org_id = public.current_org_id())
    and (
      (public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario]))
      or public.is_member_of_obra(obra_id)
    )
    and deleted_at is null
  );

drop policy if exists "lancamento_select" on public.lancamento_financeiro;
create policy "lancamento_select" on public.lancamento_financeiro
  for select to authenticated
  using (
    (org_id = public.current_org_id())
    and (
      (public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario]))
      or public.is_member_of_obra(obra_id)
    )
    and deleted_at is null
  );

notify pgrst, 'reload schema';
