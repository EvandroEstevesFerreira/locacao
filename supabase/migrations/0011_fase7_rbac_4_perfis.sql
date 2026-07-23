-- ============================================================================
-- Fase 7 — RBAC de 4 perfis (master / administrador / gestor / operador)
-- ----------------------------------------------------------------------------
-- Substitui o enum antigo (admin/gestor/financeiro/operacional/visualizador)
-- por 4 perfis com permissões fixas, e reescreve as policies conforme a matriz:
--
--   Recurso                         master  administrador  gestor  operador
--   Ver (tudo)                        ✅        ✅           ✅       ✅
--   Cadastros (obras/forn./itens)     ✅        ✅           —        —
--   Contratos + movimentação          ✅        ✅           —        ✅
--   Vistorias/avarias/fotos           ✅        ✅           —        ✅
--   Financeiro (lançar/baixa)         ✅        ✅           —        —
--   Excluir crítico (obra/contrato)   ✅        —            —        —
--   Configurações do sistema          ✅        —            —        —
--   Gestão de usuários/perfis         ✅        —            —        —
--
-- Escopo por obra: master/administrador = org inteira; gestor/operador = obras
-- atribuídas (obra_usuario). Idempotente o suficiente para reaplicar num banco novo.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1) Derruba o stack de funções que dependem do enum (CASCADE remove as policies
--    role-based que as referenciam). As policies puramente org-scoped sobrevivem.
-- ----------------------------------------------------------------------------
drop function if exists public.has_contrato_access(uuid) cascade;
drop function if exists public.has_obra_access(uuid) cascade;
drop function if exists public.current_papel() cascade;

-- ----------------------------------------------------------------------------
-- 2) Troca o tipo enum: cria novo, converte a coluna com mapeamento, dropa o
--    antigo e renomeia o novo para o mesmo nome (papel_usuario).
-- ----------------------------------------------------------------------------
alter table public.perfil alter column papel drop default;

create type public.papel_usuario_new as enum (
  'master',         -- dono do sistema: acesso total
  'administrador',  -- acesso total, exceto exclusividades do master
  'gestor',         -- só analisa: lê tudo e gera relatórios
  'operador'        -- opera contratos, devoluções e vistorias
);

alter table public.perfil
  alter column papel type public.papel_usuario_new
  using (
    case papel::text
      when 'admin'        then 'master'
      when 'financeiro'   then 'administrador'
      when 'operacional'  then 'operador'
      when 'visualizador' then 'gestor'
      when 'gestor'       then 'gestor'
      else 'gestor'
    end::public.papel_usuario_new
  );

drop type public.papel_usuario;
alter type public.papel_usuario_new rename to papel_usuario;

alter table public.perfil alter column papel set default 'gestor';

-- ----------------------------------------------------------------------------
-- 3) Recria as funções auxiliares (SECURITY DEFINER; search_path travado).
-- ----------------------------------------------------------------------------
create or replace function public.current_papel()
returns public.papel_usuario
language sql stable security definer set search_path = ''
as $$ select papel from public.perfil where id = auth.uid(); $$;

-- master/administrador podem gerir cadastros (obras, fornecedores, itens)
create or replace function public.pode_gerir_cadastros()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_papel() in ('master','administrador'); $$;

-- master/administrador/operador podem operar (contratos, movimentação, vistorias)
create or replace function public.pode_operar()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_papel() in ('master','administrador','operador'); $$;

-- master/administrador podem gerir o financeiro
create or replace function public.pode_financeiro()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_papel() in ('master','administrador'); $$;

-- apenas o master (usuários, configurações, exclusões críticas)
create or replace function public.is_master()
returns boolean
language sql stable security definer set search_path = ''
as $$ select public.current_papel() = 'master'; $$;

-- Acesso à obra: master/administrador (org inteira) OU membro da obra.
create or replace function public.has_obra_access(p_obra_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.obra o
    where o.id = p_obra_id
      and o.org_id = public.current_org_id()
  )
  and (
    public.current_papel() in ('master','administrador')
    or public.is_member_of_obra(p_obra_id)
  );
$$;

-- Acesso ao contrato: mesma regra, pela obra do contrato.
create or replace function public.has_contrato_access(p_contrato_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.contrato_locacao c
    where c.id = p_contrato_id
      and c.org_id = public.current_org_id()
      and (
        public.current_papel() in ('master','administrador')
        or public.is_member_of_obra(c.obra_id)
      )
  );
$$;

-- ============================================================================
-- 4) Recria as policies role-based (as org-scoped puras já sobreviveram).
-- ============================================================================

-- ---- organizacao -----------------------------------------------------------
create policy "org_update_admin" on public.organizacao
  for update to authenticated
  using (id = public.current_org_id() and public.is_master())
  with check (id = public.current_org_id() and public.is_master());

-- ---- perfil (gestão só do master) ------------------------------------------
create policy "perfil_admin_manage" on public.perfil
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_master())
  with check (org_id = public.current_org_id() and public.is_master());

-- ---- obra ------------------------------------------------------------------
create policy "obra_select" on public.obra
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('master','administrador')
      or public.is_member_of_obra(id)
    )
  );

create policy "obra_insert" on public.obra
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "obra_update" on public.obra
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "obra_delete_admin" on public.obra
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_master());

-- ---- obra_usuario (atribuição = gestão de usuários = master) ---------------
create policy "obra_usuario_select" on public.obra_usuario
  for select to authenticated
  using (perfil_id = auth.uid() or public.has_obra_access(obra_id));

create policy "obra_usuario_manage" on public.obra_usuario
  for all to authenticated
  using (
    public.is_master()
    and exists (
      select 1 from public.obra o
      where o.id = obra_id and o.org_id = public.current_org_id()
    )
  )
  with check (
    public.is_master()
    and exists (
      select 1 from public.obra o
      where o.id = obra_id and o.org_id = public.current_org_id()
    )
  );

-- ---- fornecedor ------------------------------------------------------------
create policy "fornecedor_insert" on public.fornecedor
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "fornecedor_update" on public.fornecedor
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "fornecedor_delete" on public.fornecedor
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- ---- item_catalogo ---------------------------------------------------------
create policy "item_insert" on public.item_catalogo
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "item_update" on public.item_catalogo
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "item_delete" on public.item_catalogo
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- ---- equipamento_unidade ---------------------------------------------------
create policy "equip_unidade_insert" on public.equipamento_unidade
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "equip_unidade_update" on public.equipamento_unidade
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "equip_unidade_delete" on public.equipamento_unidade
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- ---- contrato_locacao (criar/editar = operar; excluir = master) ------------
create policy "contrato_select" on public.contrato_locacao
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('master','administrador')
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "contrato_insert" on public.contrato_locacao
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.pode_operar()
    and (public.current_papel() in ('master','administrador') or public.is_member_of_obra(obra_id))
  );

create policy "contrato_update" on public.contrato_locacao
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.pode_operar()
    and (public.current_papel() in ('master','administrador') or public.is_member_of_obra(obra_id))
  )
  with check (org_id = public.current_org_id());

create policy "contrato_delete" on public.contrato_locacao
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_master());

-- ---- item_locado -----------------------------------------------------------
create policy "item_locado_select" on public.item_locado
  for select to authenticated
  using (org_id = public.current_org_id() and public.has_contrato_access(contrato_id));

create policy "item_locado_insert" on public.item_locado
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.pode_operar()
    and public.has_contrato_access(contrato_id)
  );

create policy "item_locado_update" on public.item_locado
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.pode_operar()
    and public.has_contrato_access(contrato_id)
  )
  with check (org_id = public.current_org_id());

create policy "item_locado_delete" on public.item_locado
  for delete to authenticated
  using (
    org_id = public.current_org_id()
    and public.pode_operar()
    and public.has_contrato_access(contrato_id)
  );

-- ---- movimentacao ----------------------------------------------------------
create policy "movimentacao_insert" on public.movimentacao
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_operar());

create policy "movimentacao_delete" on public.movimentacao
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- ---- vistoria / vistoria_foto / avaria (escrita = operar) ------------------
create policy "vistoria_write" on public.vistoria
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

create policy "vistoria_foto_write" on public.vistoria_foto
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

create policy "avaria_write" on public.avaria
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

-- ---- lancamento_financeiro -------------------------------------------------
create policy "lancamento_select" on public.lancamento_financeiro
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.current_papel() in ('master','administrador')
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "lancamento_insert" on public.lancamento_financeiro
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_financeiro());

create policy "lancamento_update" on public.lancamento_financeiro
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_financeiro())
  with check (org_id = public.current_org_id());

create policy "lancamento_delete" on public.lancamento_financeiro
  for delete to authenticated
  using (org_id = public.current_org_id() and public.is_master());

-- ---- config_alerta (só master) ---------------------------------------------
create policy "config_alerta_manage" on public.config_alerta
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_master())
  with check (org_id = public.current_org_id() and public.is_master());

-- ---- notificacao_log (leitura master/administrador) ------------------------
create policy "notificacao_log_select" on public.notificacao_log
  for select to authenticated
  using (org_id = public.current_org_id() and public.pode_financeiro());

commit;
