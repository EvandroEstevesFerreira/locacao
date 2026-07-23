-- ============================================================================
-- Fase 1 — Fornecedores
-- ============================================================================

create table public.fornecedor (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizacao (id) on delete cascade,
  nome              text not null,
  cnpj              text,
  contato_nome      text,
  contato_telefone  text,
  contato_email     text,
  observacoes       text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_fornecedor_org on public.fornecedor (org_id);

create trigger trg_fornecedor_updated_at
  before update on public.fornecedor
  for each row execute function public.set_updated_at();

alter table public.fornecedor enable row level security;

-- Fornecedor é da organização (não é por obra): todos da org leem;
-- admin/gestor gerenciam.
create policy "fornecedor_select" on public.fornecedor
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "fornecedor_insert" on public.fornecedor
  for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor')
  );

create policy "fornecedor_update" on public.fornecedor
  for update to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'))
  with check (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));

create policy "fornecedor_delete" on public.fornecedor
  for delete to authenticated
  using (org_id = public.current_org_id() and public.current_papel() in ('admin', 'gestor'));
