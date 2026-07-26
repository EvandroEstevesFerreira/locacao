-- ============================================================================
-- Módulo Imóveis — Fase 3: vistorias, reparos e ocorrências
-- ============================================================================

create table if not exists public.vistoria_imovel (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  imovel_id   uuid not null references public.imovel (id) on delete cascade,
  data        date not null,
  responsavel text,
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_vistoria_imovel_imovel on public.vistoria_imovel (imovel_id);
create trigger trg_vistoria_imovel_updated_at
  before update on public.vistoria_imovel
  for each row execute function public.set_updated_at();

create table if not exists public.vistoria_imovel_foto (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  vistoria_id uuid not null references public.vistoria_imovel (id) on delete cascade,
  path        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_vistoria_imovel_foto_vistoria on public.vistoria_imovel_foto (vistoria_id);

create table if not exists public.reparo_imovel (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  imovel_id   uuid not null references public.imovel (id) on delete cascade,
  data        date not null,
  descricao   text not null,
  valor       numeric(14, 2) not null default 0,
  executor    text,
  anexo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_reparo_imovel_imovel on public.reparo_imovel (imovel_id);
create trigger trg_reparo_imovel_updated_at
  before update on public.reparo_imovel
  for each row execute function public.set_updated_at();

create table if not exists public.ocorrencia_imovel (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  imovel_id   uuid not null references public.imovel (id) on delete cascade,
  data        date not null,
  tipo        text not null default 'outro',   -- avaria|reparo|desentendimento|outro
  descricao   text not null,
  anexo_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_ocorrencia_imovel_imovel on public.ocorrencia_imovel (imovel_id);
create trigger trg_ocorrencia_imovel_updated_at
  before update on public.ocorrencia_imovel
  for each row execute function public.set_updated_at();

-- RLS
do $$
declare t text;
begin
  foreach t in array array['vistoria_imovel','vistoria_imovel_foto','reparo_imovel','ocorrencia_imovel']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_select" on public.%I for select to authenticated using (org_id = public.current_org_id())', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (org_id = public.current_org_id() and public.pode_operar()) with check (org_id = public.current_org_id() and public.pode_operar())', t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
