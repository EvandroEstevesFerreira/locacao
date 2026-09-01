-- ============================================================================
-- Período da obra e avanço físico semanal
-- (docs/superpowers/specs/2026-08-31-avanco-obra-design.md)
--
-- Primeira fatia do controle orçamentário pedido pela diretoria. Entrega dois
-- dos três percentuais — prazo decorrido e avanço físico — sem tocar em
-- dinheiro. O terceiro (orçamento consumido) vem nas fatias B, C e D.
--
-- Nada aqui altera ou apaga dado existente: são três colunas nulas em `obra`,
-- uma tabela nova e suas policies. Nenhuma linha migra.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Período da obra
-- ---------------------------------------------------------------------------
-- Nulo é legítimo: nenhuma obra cadastrada tem período hoje, e obra sem
-- `data_fim_prevista` simplesmente não tem "% de prazo decorrido". Tornar
-- obrigatório quebraria todas as obras existentes.
alter table public.obra
  add column if not exists data_inicio       date,
  add column if not exists data_fim_prevista date,
  add column if not exists data_fim_real     date;

alter table public.obra
  drop constraint if exists obra_periodo_coerente;
alter table public.obra
  add constraint obra_periodo_coerente check (
    data_inicio is null or data_fim_prevista is null
    or data_fim_prevista >= data_inicio
  );

comment on column public.obra.data_fim_real is
  'Preenchida no encerramento. Enquanto nula, a obra corre contra data_fim_prevista.';

-- ---------------------------------------------------------------------------
-- Avanço físico
-- ---------------------------------------------------------------------------
create table if not exists public.avanco_obra (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  obra_id       uuid not null references public.obra (id) on delete cascade,
  -- SEMPRE a segunda-feira da semana, canonizada por `segundaDaSemana()` em
  -- src/lib/avanco.ts. É o que faz o unique abaixo significar "um lançamento
  -- por semana", e o que torna relançar um upsert em vez de duplicata.
  semana        date not null,
  -- Acumulado, de 0 a 100 ("estamos em 34% da obra"). Acumulado e não
  -- incremental porque se autocorrige: semana esquecida não corrompe o total,
  -- e semana esquecida é certeza num processo semanal, não hipótese.
  percentual    numeric(5,2) not null check (percentual between 0 and 100),
  observacoes   text,
  -- Quem DIGITOU, que é o administrativo — não é o responsável pela obra.
  -- A distinção importa no dia em que o número for contestado.
  informado_por uuid references public.perfil (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (obra_id, semana)
);

create index if not exists idx_avanco_obra on public.avanco_obra (obra_id, semana desc);
create index if not exists idx_avanco_org  on public.avanco_obra (org_id);

drop trigger if exists trg_avanco_obra_updated_at on public.avanco_obra;
create trigger trg_avanco_obra_updated_at
  before update on public.avanco_obra
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, no padrão da 0049
-- ---------------------------------------------------------------------------
-- Diferente da exceção que a fatia de frota abre para `equipamento_unidade`:
-- lá existe a justificativa de "preciso ver onde está a betoneira da outra
-- obra". Aqui não existe — avanço de obra alheia não serve a ninguém.
--
-- `is_member_of_obra` e não `has_obra_access`: a segunda é da 0001 e foi
-- superada pela 0004 por recursão de RLS. Toda migration desde então usa a
-- primeira.
--
-- A escrita usa `pode_gerir_cadastros()` — a função canônica de
-- master/administrador, espelho exato de `podeEditarCadastros` no TypeScript.
-- Repetir os nomes de papel aqui criaria uma segunda verdade que diverge em
-- silêncio, e papel errado em policy não dá erro: só nega tudo.
alter table public.avanco_obra enable row level security;

drop policy if exists "avanco_select" on public.avanco_obra;
create policy "avanco_select" on public.avanco_obra
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.current_papel() in ('master', 'administrador', 'gestor')
      or public.is_member_of_obra(obra_id)
    )
  );

drop policy if exists "avanco_write" on public.avanco_obra;
create policy "avanco_write" on public.avanco_obra
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );
