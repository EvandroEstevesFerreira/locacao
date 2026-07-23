-- ============================================================================
-- Fase 3 — Vistorias, fotos e avarias
-- ============================================================================

create type public.tipo_vistoria as enum ('entrada', 'devolucao');
create type public.status_avaria as enum ('aberta', 'cobrada', 'resolvida');

create table public.vistoria (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  contrato_id  uuid not null references public.contrato_locacao (id) on delete cascade,
  tipo         public.tipo_vistoria not null,
  data         date not null,
  responsavel  text,
  observacoes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_vistoria_org on public.vistoria (org_id);
create index idx_vistoria_contrato on public.vistoria (contrato_id);

create trigger trg_vistoria_updated_at
  before update on public.vistoria
  for each row execute function public.set_updated_at();

create table public.vistoria_foto (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  vistoria_id  uuid not null references public.vistoria (id) on delete cascade,
  path         text not null,
  created_at   timestamptz not null default now()
);

create index idx_vistoria_foto_vistoria on public.vistoria_foto (vistoria_id);

create table public.avaria (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  vistoria_id    uuid not null references public.vistoria (id) on delete cascade,
  descricao      text not null,
  custo_estimado numeric(14, 2) not null default 0,
  status         public.status_avaria not null default 'aberta',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_avaria_vistoria on public.avaria (vistoria_id);
create index idx_avaria_org on public.avaria (org_id);

create trigger trg_avaria_updated_at
  before update on public.avaria
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.vistoria      enable row level security;
alter table public.vistoria_foto enable row level security;
alter table public.avaria        enable row level security;

-- vistoria: leitura org; escrita admin/gestor/operacional.
create policy "vistoria_select" on public.vistoria
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "vistoria_write" on public.vistoria
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  );

create policy "vistoria_foto_select" on public.vistoria_foto
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "vistoria_foto_write" on public.vistoria_foto
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  );

create policy "avaria_select" on public.avaria
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "avaria_write" on public.avaria
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'gestor', 'operacional')
  );

-- ============================================================================
-- Storage: bucket privado "vistorias" + políticas por organização
-- Convenção de caminho: {org_id}/{vistoria_id}/{arquivo}
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('vistorias', 'vistorias', false)
on conflict (id) do nothing;

create policy "vistorias_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vistorias'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "vistorias_obj_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vistorias'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "vistorias_obj_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vistorias'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "vistorias_obj_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vistorias'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
