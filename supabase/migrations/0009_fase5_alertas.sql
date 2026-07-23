-- ============================================================================
-- Fase 5 — Configuração de alertas + log de notificações
-- ============================================================================

create table public.config_alerta (
  org_id            uuid primary key references public.organizacao (id) on delete cascade,
  ativo             boolean not null default true,
  dias_antecedencia integer not null default 3,
  destinatarios     text[] not null default '{}',
  updated_at        timestamptz not null default now()
);

alter table public.config_alerta enable row level security;

create policy "config_alerta_select" on public.config_alerta
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "config_alerta_manage" on public.config_alerta
  for all to authenticated
  using (org_id = public.current_org_id() and public.current_papel() = 'admin')
  with check (org_id = public.current_org_id() and public.current_papel() = 'admin');

-- Log de notificações enviadas (dedup por referência + data).
create table public.notificacao_log (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  tipo             text not null,   -- 'devolucao' | 'contrato_fim' | 'pagamento'
  referencia_id    uuid not null,
  data_referencia  date not null,
  destinatarios    text[] not null default '{}',
  enviado_em       timestamptz not null default now(),
  unique (org_id, tipo, referencia_id, data_referencia)
);

create index idx_notif_org on public.notificacao_log (org_id);

alter table public.notificacao_log enable row level security;

-- Leitura para admin/financeiro; inserção é feita pelo cron (service_role,
-- que ignora RLS). Sem policy de insert para usuários comuns.
create policy "notificacao_log_select" on public.notificacao_log
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('admin', 'financeiro')
  );
