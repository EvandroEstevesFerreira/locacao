-- ============================================================================
-- Loca — Controle de Locações (Sistenge)
-- Fase 0 — Fundação: organização, perfil (RBAC), obra, acesso por obra + RLS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.papel_usuario as enum (
  'admin',        -- acesso total na organização
  'gestor',       -- gerencia as obras às quais tem acesso
  'financeiro',   -- financeiro e relatórios de toda a organização
  'operacional',  -- movimentação e vistoria nas obras às quais tem acesso
  'visualizador'  -- somente leitura
);

create type public.status_obra as enum ('ativa', 'pausada', 'encerrada');

-- ---------------------------------------------------------------------------
-- Utilitário: atualização automática de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizacao (tenant)
-- ---------------------------------------------------------------------------
create table public.organizacao (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cnpj        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_organizacao_updated_at
  before update on public.organizacao
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- perfil (espelho de auth.users + org + papel)
-- ---------------------------------------------------------------------------
create table public.perfil (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid references public.organizacao (id) on delete set null,
  nome        text,
  email       text,
  papel       public.papel_usuario not null default 'visualizador',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_perfil_org on public.perfil (org_id);

create trigger trg_perfil_updated_at
  before update on public.perfil
  for each row execute function public.set_updated_at();

-- Cria automaticamente um perfil quando um usuário se registra no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfil (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Funções auxiliares de autorização (usadas nas políticas RLS)
-- SECURITY DEFINER + search_path travado; leem apenas dados do próprio usuário.
-- ---------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.perfil where id = auth.uid();
$$;

create or replace function public.current_papel()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select papel from public.perfil where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- obra
-- ---------------------------------------------------------------------------
create table public.obra (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  codigo          text not null,
  nome            text not null,
  endereco        text,
  responsavel     text,
  centro_custo    text,
  status          public.status_obra not null default 'ativa',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, codigo)
);

create index idx_obra_org on public.obra (org_id);

create trigger trg_obra_updated_at
  before update on public.obra
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- obra_usuario (quais usuários acessam quais obras)
-- ---------------------------------------------------------------------------
create table public.obra_usuario (
  obra_id     uuid not null references public.obra (id) on delete cascade,
  perfil_id   uuid not null references public.perfil (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (obra_id, perfil_id)
);

-- admin/financeiro enxergam toda a organização; demais dependem de vínculo.
create or replace function public.has_obra_access(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.obra o
      where o.id = p_obra_id
        and o.org_id = public.current_org_id()
    )
    and (
      public.current_papel() in ('admin', 'financeiro')
      or exists (
        select 1 from public.obra_usuario ou
        where ou.obra_id = p_obra_id
          and ou.perfil_id = auth.uid()
      )
    );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.organizacao  enable row level security;
alter table public.perfil       enable row level security;
alter table public.obra         enable row level security;
alter table public.obra_usuario enable row level security;

-- organizacao: cada usuário enxerga apenas a própria organização.
create policy "org_select_own" on public.organizacao
  for select to authenticated
  using (id = public.current_org_id());

create policy "org_update_admin" on public.organizacao
  for update to authenticated
  using (id = public.current_org_id() and public.current_papel() = 'admin')
  with check (id = public.current_org_id() and public.current_papel() = 'admin');

-- perfil: lê o próprio + os da mesma organização; atualiza o próprio;
-- admin gerencia os perfis da organização.
create policy "perfil_select_same_org" on public.perfil
  for select to authenticated
  using (id = auth.uid() or org_id = public.current_org_id());

create policy "perfil_update_self" on public.perfil
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "perfil_admin_manage" on public.perfil
  for all to authenticated
  using (org_id = public.current_org_id() and public.current_papel() = 'admin')
  with check (org_id = public.current_org_id() and public.current_papel() = 'admin');

-- obra: leitura conforme acesso; escrita para admin/gestor.
create policy "obra_select" on public.obra
  for select to authenticated
  using (public.has_obra_access(id));

create policy "obra_insert" on public.obra
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );

create policy "obra_update" on public.obra
  for update to authenticated
  using (public.has_obra_access(id) and public.current_papel() in ('admin', 'gestor'))
  with check (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));

create policy "obra_delete_admin" on public.obra
  for delete to authenticated
  using (org_id = public.current_org_id() and public.current_papel() = 'admin');

-- obra_usuario: admin/gestor gerenciam; usuário vê os próprios vínculos.
create policy "obra_usuario_select" on public.obra_usuario
  for select to authenticated
  using (perfil_id = auth.uid() or public.has_obra_access(obra_id));

create policy "obra_usuario_manage" on public.obra_usuario
  for all to authenticated
  using (
    public.current_papel() in ('admin', 'gestor')
    and exists (
      select 1 from public.obra o
      where o.id = obra_id and o.org_id = public.current_org_id()
    )
  )
  with check (
    public.current_papel() in ('admin', 'gestor')
    and exists (
      select 1 from public.obra o
      where o.id = obra_id and o.org_id = public.current_org_id()
    )
  );

-- ============================================================================
-- SEED (executar manualmente após o primeiro cadastro no Auth)
-- ============================================================================
-- 1) Cadastre-se pela tela de login do app (ou pelo painel Auth do Supabase).
-- 2) Rode o bloco abaixo trocando o e-mail para promover o primeiro admin
--    e criar a organização Sistenge:
--
-- do $$
-- declare v_uid uuid; v_org uuid;
-- begin
--   select id into v_uid from auth.users where email = 'evandro.ferreira@sistenge.com';
--   insert into public.organizacao (nome, cnpj) values ('Sistenge Engenharia', null)
--     returning id into v_org;
--   update public.perfil set org_id = v_org, papel = 'admin' where id = v_uid;
-- end $$;
