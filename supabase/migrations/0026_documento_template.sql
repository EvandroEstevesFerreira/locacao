-- ============================================================================
-- Templates de documentos (contratos, termos) editáveis com variáveis {{...}}.
-- Um template por (org, tipo). Sem linha => usa o padrão do código.
-- ============================================================================
create table if not exists public.documento_template (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  corpo       text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, tipo)
);

create trigger trg_documento_template_updated_at
  before update on public.documento_template
  for each row execute function public.set_updated_at();

alter table public.documento_template enable row level security;
drop policy if exists "documento_template_select" on public.documento_template;
drop policy if exists "documento_template_write" on public.documento_template;
create policy "documento_template_select" on public.documento_template
  for select to authenticated using (org_id = public.current_org_id());
create policy "documento_template_write" on public.documento_template
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_master())
  with check (org_id = public.current_org_id() and public.is_master());

notify pgrst, 'reload schema';
