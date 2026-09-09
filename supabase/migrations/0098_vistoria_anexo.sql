-- ============================================================================
-- Protocolo / OS anexado à vistoria
-- ============================================================================
--
-- O QUE FALTAVA. Na devolução, quem vem buscar o equipamento traz o próprio
-- documento — protocolo de retirada, ordem de serviço. Hoje esse papel não tem
-- lugar no Loca: a vistoria guarda FOTOS (`vistoria_foto`) e nada mais, então o
-- protocolo termina numa pasta de e-mail, e a vistoria — que é a prova do
-- estado na entrega — fica sem o documento da contraparte.
--
-- POR QUE TABELA, E NÃO UMA COLUNA `protocolo_path` NA VISTORIA. Protocolo e OS
-- são dois papéis distintos e chegam separados; com uma coluna, o segundo
-- substituiria o primeiro em silêncio. Espelha `contrato_anexo` (migration
-- 0035), que resolveu o mesmo problema para o contrato.
--
-- POR QUE NÃO REAPROVEITAR `vistoria_foto`. O relatório em PDF desenha TODA
-- linha de `vistoria_foto` como imagem. Um PDF de protocolo ali quebraria a
-- renderização do documento, e a falha apareceria só na hora de gerar o
-- relatório de uma vistoria específica.
-- ============================================================================

create table if not exists public.vistoria_anexo (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  vistoria_id uuid not null references public.vistoria (id) on delete cascade,
  -- `text` + `check`, e não enum: acrescentar valor a enum do Postgres é
  -- migration própria. Mesma escolha da 0049 para `item_catalogo.controle`.
  tipo        text not null default 'protocolo'
    check (tipo in ('protocolo', 'os', 'outro')),
  descricao   text,
  path        text not null,
  data        date,
  created_at  timestamptz not null default now()
);

comment on table public.vistoria_anexo is
  'Documentos da contraparte anexados a uma vistoria: protocolo de retirada, ordem de servico. Nao e foto -- o PDF do relatorio desenha vistoria_foto como imagem.';

create index if not exists idx_vistoria_anexo_vistoria
  on public.vistoria_anexo (vistoria_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Espelha o IRMÃO `vistoria_foto` na forma ATUAL, que é a da migration 0011 --
-- e não a da 0007, onde o mesmo par de policies foi escrito com
-- `current_papel() in ('admin','gestor','operacional')`. Aqueles nomes de papel
-- não existem mais desde a 0011, que os trocou por `pode_operar()`: copiar a
-- 0007 daria uma policy referenciando valor de enum extinto.
alter table public.vistoria_anexo enable row level security;

drop policy if exists "vistoria_anexo_select" on public.vistoria_anexo;
create policy "vistoria_anexo_select" on public.vistoria_anexo
  for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists "vistoria_anexo_write" on public.vistoria_anexo;
create policy "vistoria_anexo_write" on public.vistoria_anexo
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());

notify pgrst, 'reload schema';
