-- ============================================================================
-- Escopo por obra nos IMÓVEIS (corrige vazamento entre obras).
-- Antes: todas as tabelas de imóvel eram visíveis para toda a organização.
-- Agora: master/administrador veem tudo; gestor/operador veem apenas imóveis
-- das obras a que têm acesso (obra_usuario). Espelha o modelo de contratos.
-- ============================================================================

-- Acesso a um imóvel: master/admin, ou membro da obra do imóvel.
create or replace function public.has_imovel_access(imv uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
    or exists (
      select 1 from public.imovel i
      where i.id = imv and public.is_member_of_obra(i.obra_id)
    );
$$;

-- ---- imovel: SELECT (obra + não deletado) e write separado (sem re-conceder
--      SELECT sem o filtro de deletado, evitando o "trap" do FOR ALL). --------
drop policy if exists "imovel_select" on public.imovel;
drop policy if exists "imovel_write" on public.imovel;

create policy "imovel_select" on public.imovel
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
      or public.is_member_of_obra(obra_id)
    )
    and deleted_at is null
  );

create policy "imovel_insert" on public.imovel
  for insert to authenticated
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and (
      public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "imovel_update" on public.imovel
  for update to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and (
      public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
      or public.is_member_of_obra(obra_id)
    )
  )
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and (
      public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "imovel_delete" on public.imovel
  for delete to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and (
      public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
      or public.is_member_of_obra(obra_id)
    )
  );

-- ---- Tabelas-filhas (sem soft-delete): escopo via has_imovel_access(imovel_id).
do $$
declare t text;
begin
  foreach t in array array[
    'contrato_imovel','conta_consumo','reparo_imovel','ocorrencia_imovel',
    'vistoria_imovel','ocupante_imovel'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (org_id = public.current_org_id() and public.has_imovel_access(imovel_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (org_id = public.current_org_id() and public.pode_operar() and public.has_imovel_access(imovel_id)) with check (org_id = public.current_org_id() and public.pode_operar() and public.has_imovel_access(imovel_id))',
      t || '_write', t
    );
  end loop;
end;
$$;

-- ---- Fotos de vistoria: escopo via a vistoria (que tem imovel_id). ----------
drop policy if exists "vistoria_imovel_foto_select" on public.vistoria_imovel_foto;
drop policy if exists "vistoria_imovel_foto_write" on public.vistoria_imovel_foto;
create policy "vistoria_imovel_foto_select" on public.vistoria_imovel_foto
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.vistoria_imovel v
      where v.id = vistoria_id and public.has_imovel_access(v.imovel_id)
    )
  );
create policy "vistoria_imovel_foto_write" on public.vistoria_imovel_foto
  for all to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and exists (
      select 1 from public.vistoria_imovel v
      where v.id = vistoria_id and public.has_imovel_access(v.imovel_id)
    )
  )
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and exists (
      select 1 from public.vistoria_imovel v
      where v.id = vistoria_id and public.has_imovel_access(v.imovel_id)
    )
  );

notify pgrst, 'reload schema';
