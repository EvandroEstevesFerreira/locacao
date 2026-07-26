-- ============================================================================
-- Módulo Imóveis — Fase 4: ocupantes (base para termo de responsabilidade)
-- ============================================================================

create table if not exists public.ocupante_imovel (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  imovel_id        uuid not null references public.imovel (id) on delete cascade,
  nome             text not null,
  cpf              text,
  contato          text,
  data_entrada     date,
  data_saida       date,
  termo_emitido_em date,
  observacoes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_ocupante_imovel_imovel on public.ocupante_imovel (imovel_id);

create trigger trg_ocupante_imovel_updated_at
  before update on public.ocupante_imovel
  for each row execute function public.set_updated_at();

alter table public.ocupante_imovel enable row level security;
drop policy if exists "ocupante_imovel_select" on public.ocupante_imovel;
drop policy if exists "ocupante_imovel_write" on public.ocupante_imovel;
create policy "ocupante_imovel_select" on public.ocupante_imovel
  for select to authenticated using (org_id = public.current_org_id());
create policy "ocupante_imovel_write" on public.ocupante_imovel
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

notify pgrst, 'reload schema';
