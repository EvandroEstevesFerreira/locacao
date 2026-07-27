-- ============================================================================
-- Biblioteca de documentos do alojamento (nível organização): normativos,
-- formulários e placas padronizadas. Arquivos no bucket "imoveis" sob o
-- prefixo {org_id}/biblioteca/. Todos da org leem; master/admin gerenciam.
-- ============================================================================
create table if not exists public.biblioteca_documento (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  categoria   text not null default 'outro',  -- normativo | formulario | placa | comunicacao | outro
  titulo      text not null,
  descricao   text,
  path        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_biblioteca_org on public.biblioteca_documento (org_id, categoria);

alter table public.biblioteca_documento enable row level security;
drop policy if exists "biblioteca_select" on public.biblioteca_documento;
drop policy if exists "biblioteca_write" on public.biblioteca_documento;
create policy "biblioteca_select" on public.biblioteca_documento
  for select to authenticated
  using (org_id = public.current_org_id());
create policy "biblioteca_write" on public.biblioteca_documento
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- Auditoria.
drop trigger if exists trg_audit on public.biblioteca_documento;
create trigger trg_audit after insert or update or delete on public.biblioteca_documento
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
