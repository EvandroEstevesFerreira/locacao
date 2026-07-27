-- ============================================================================
-- Vínculo fornecedor ↔ obra (N:N). Um fornecedor pode atender várias obras;
-- uma obra tem vários fornecedores. Usado para organizar/filtrar por obra/local.
-- Não restringe contratos — é apenas classificação/atalho de cadastro.
-- ============================================================================
create table if not exists public.fornecedor_obra (
  fornecedor_id uuid not null references public.fornecedor (id) on delete cascade,
  obra_id       uuid not null references public.obra (id) on delete cascade,
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (fornecedor_id, obra_id)
);
create index if not exists idx_fornecedor_obra_obra on public.fornecedor_obra (obra_id);
create index if not exists idx_fornecedor_obra_forn on public.fornecedor_obra (fornecedor_id);

alter table public.fornecedor_obra enable row level security;
drop policy if exists "fornecedor_obra_select" on public.fornecedor_obra;
drop policy if exists "fornecedor_obra_write" on public.fornecedor_obra;
create policy "fornecedor_obra_select" on public.fornecedor_obra
  for select to authenticated using (org_id = public.current_org_id());
create policy "fornecedor_obra_write" on public.fornecedor_obra
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

notify pgrst, 'reload schema';
