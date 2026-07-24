-- ============================================================================
-- Módulo Imóveis — Fase 1: cadastro de imóveis + histórico de contratos + anexos
-- ============================================================================

do $$ begin
  create type public.tipo_imovel as enum
    ('kitnet', 'apartamento', 'casa', 'galpao', 'escritorio', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_imovel as enum ('ativo', 'desocupacao', 'encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_caucao as enum ('em_aberto', 'devolvida', 'retida');
exception when duplicate_object then null; end $$;

create table if not exists public.imovel (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizacao (id) on delete cascade,
  tipo                  public.tipo_imovel not null default 'outro',
  apelido               text not null,
  endereco              text,
  cidade                text,
  uf                    text,
  capacidade_pessoas    int,
  area_m2               numeric(10, 2),
  obra_id               uuid references public.obra (id) on delete set null,
  status                public.status_imovel not null default 'ativo',
  proprietario_nome     text,
  proprietario_telefone text,
  proprietario_email    text,
  imobiliaria_nome      text,
  imobiliaria_telefone  text,
  imobiliaria_email     text,
  observacoes           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_imovel_org on public.imovel (org_id);
create index if not exists idx_imovel_obra on public.imovel (obra_id);

create trigger trg_imovel_updated_at
  before update on public.imovel
  for each row execute function public.set_updated_at();

create table if not exists public.contrato_imovel (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizacao (id) on delete cascade,
  imovel_id                uuid not null references public.imovel (id) on delete cascade,
  data_inicio              date,
  data_fim                 date,
  valor_aluguel            numeric(14, 2) not null default 0,
  valor_condominio         numeric(14, 2) not null default 0,
  dia_vencimento           int,
  indice_reajuste          text,
  data_reajuste            date,
  caucao_valor             numeric(14, 2),
  caucao_status            public.status_caucao,
  caucao_comprovante_path  text,
  anexo_contrato_path      text,
  vigente                  boolean not null default true,
  observacoes              text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_contrato_imovel_imovel on public.contrato_imovel (imovel_id);

create trigger trg_contrato_imovel_updated_at
  before update on public.contrato_imovel
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.imovel enable row level security;
alter table public.contrato_imovel enable row level security;

drop policy if exists "imovel_select" on public.imovel;
drop policy if exists "imovel_write" on public.imovel;
create policy "imovel_select" on public.imovel
  for select to authenticated
  using (org_id = public.current_org_id());
create policy "imovel_write" on public.imovel
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

drop policy if exists "contrato_imovel_select" on public.contrato_imovel;
drop policy if exists "contrato_imovel_write" on public.contrato_imovel;
create policy "contrato_imovel_select" on public.contrato_imovel
  for select to authenticated
  using (org_id = public.current_org_id());
create policy "contrato_imovel_write" on public.contrato_imovel
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

-- ============================================================================
-- Storage: bucket privado "imoveis" (contrato do proprietário, comprovante caução)
-- Convenção: {org_id}/{imovel_id}/{arquivo}
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('imoveis', 'imoveis', false)
on conflict (id) do nothing;

drop policy if exists "imoveis_obj_select" on storage.objects;
drop policy if exists "imoveis_obj_insert" on storage.objects;
drop policy if exists "imoveis_obj_update" on storage.objects;
drop policy if exists "imoveis_obj_delete" on storage.objects;

create policy "imoveis_obj_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'imoveis' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "imoveis_obj_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imoveis' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "imoveis_obj_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'imoveis' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy "imoveis_obj_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imoveis' and (storage.foldername(name))[1] = public.current_org_id()::text);

notify pgrst, 'reload schema';
