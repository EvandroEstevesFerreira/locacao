-- ============================================================================
-- Fase C — Envio automático de relatório por e-mail
-- ----------------------------------------------------------------------------
-- Uma configuração por organização: qual relatório enviar, com que frequência
-- (semanal/mensal), em qual dia, e para quem. O cron diário
-- /api/cron/relatorio-email decide, a cada dia, se hoje é dia de enviar.
-- ============================================================================

create table if not exists public.config_relatorio_email (
  org_id        uuid primary key references public.organizacao (id) on delete cascade,
  ativo         boolean not null default false,
  tipo          text not null default 'custo_por_obra',   -- TipoRelatorio
  frequencia    text not null default 'mensal',            -- 'semanal' | 'mensal'
  dia           int not null default 1,                    -- semanal: 1-7 (1=segunda) ; mensal: 1-28
  destinatarios text[] not null default '{}',
  ultimo_envio  date,                                      -- dedup: último dia enviado
  updated_at    timestamptz not null default now()
);

alter table public.config_relatorio_email enable row level security;

-- Leitura: qualquer membro da organização.
create policy "cfg_rel_email_select" on public.config_relatorio_email
  for select to authenticated
  using (org_id = public.current_org_id());

-- Escrita: apenas master (mesma regra de "configurar sistema").
create policy "cfg_rel_email_write" on public.config_relatorio_email
  for all to authenticated
  using (org_id = public.current_org_id() and public.is_master())
  with check (org_id = public.current_org_id() and public.is_master());
