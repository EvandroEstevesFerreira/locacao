-- ============================================================================
-- Recebimento de equipamento — fase 1a da spec
-- (docs/superpowers/specs/2026-08-23-recebimento-equipamento-design.md)
--
-- O Loca controla equipamento locado de terceiros, mas o recebimento não existe
-- como EVENTO em lugar nenhum: `movimentacao` só grava devolução, e a retirada
-- é implícita em `item_locado.data_retirada`. Esta migration cria o evento, o
-- vínculo com a peça de patrimônio, e a distinção entre item controlado por
-- peça e por quantidade.
--
-- Esta fase entrega o RASCUNHO. O fechamento, o romaneio em PDF e o e-mail ao
-- fornecedor vêm na 1b.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Granularidade mista
-- ---------------------------------------------------------------------------
-- Equipamento de valor (betoneira, gerador) é rastreado por patrimônio; material
-- de repetição (andaime, escora) por quantidade. A flag decide qual campo o
-- formulário de recebimento mostra.
--
-- Default `quantidade` porque é o comportamento atual de todo item já
-- cadastrado: nada muda até alguém marcar um item como controlado por peça.
alter table public.item_catalogo
  add column if not exists controle text not null default 'quantidade'
    check (controle in ('peca', 'quantidade'));

comment on column public.item_catalogo.controle is
  'peca = rastreado por patrimônio (equipamento_unidade); quantidade = por lote.';

-- ---------------------------------------------------------------------------
-- A peça locada
-- ---------------------------------------------------------------------------
-- `equipamento_unidade` existe desde a migration 0005 e estava ÓRFÃ: única por
-- organização, e nenhuma tabela a referenciava. Este é o vínculo que faltava.
--
-- NULO = controlado por quantidade. É o estado de todo `item_locado` existente,
-- então nenhum dado migra e o cadastro de contrato atual continua funcionando.
-- Por isso a coluna NÃO é obrigatória nem para item com `controle = 'peca'`:
-- torná-la obrigatória quebraria os contratos já cadastrados. A exigência fica
-- na validação do formulário de recebimento.
alter table public.item_locado
  add column if not exists unidade_id uuid
    references public.equipamento_unidade (id) on delete set null;

create index if not exists idx_item_locado_unidade
  on public.item_locado (unidade_id) where unidade_id is not null;

-- ---------------------------------------------------------------------------
-- recebimento
-- ---------------------------------------------------------------------------
create table if not exists public.recebimento (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  contrato_id      uuid not null references public.contrato_locacao (id) on delete cascade,
  fornecedor_id    uuid not null references public.fornecedor (id) on delete restrict,

  -- Nulo enquanto RASCUNHO. O número sai no fechamento, não na criação: um
  -- rascunho numerado que é excluído deixa exatamente o buraco que o contador
  -- gapless da migration 0048 existe para evitar.
  numero_registro  text,

  -- CAMPO, e não `now()`. Obra grande lança com o caminhão parado; obra pequena
  -- manda a nota para o escritório e alguém digita três dias depois. Com
  -- `now()`, o segundo caso produziria um documento com a data errada — e é o
  -- documento que vai ao fornecedor.
  recebido_em      date not null,

  conferente       text,
  -- O número DELES: nota de remessa, romaneio. Digitado, pode repetir, pode vir
  -- em branco. Não confundir com `numero_registro`, que é o nosso.
  nota_fornecedor  text,
  observacoes      text,

  status           text not null default 'rascunho'
                   check (status in ('rascunho', 'fechado')),
  fechado_em       timestamptz,
  fechado_por      uuid references auth.users (id),
  -- Nulo com status 'fechado' = fornecedor não avisado. O envio não pode
  -- derrubar o fechamento: uma entrega física que já aconteceu não deixa de ter
  -- acontecido porque o Resend está fora do ar.
  aviso_enviado_em timestamptz,
  documento_path   text,

  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (org_id, numero_registro)
);

create index if not exists idx_recebimento_contrato
  on public.recebimento (contrato_id, recebido_em desc);
create index if not exists idx_recebimento_org
  on public.recebimento (org_id, recebido_em desc) where deleted_at is null;

create trigger trg_recebimento_updated_at
  before update on public.recebimento
  for each row execute function public.set_updated_at();

-- SEM `trg_numero_registro` de propósito. O trigger da 0048 numera no INSERT, e
-- aqui o número tem de sair no FECHAMENTO. A action chama `proximo_numero`.

-- ---------------------------------------------------------------------------
-- recebimento_item
-- ---------------------------------------------------------------------------
create table if not exists public.recebimento_item (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  recebimento_id  uuid not null references public.recebimento (id) on delete cascade,

  -- NULÁVEL DE PROPÓSITO: nulo significa que chegou algo que não estava no
  -- contrato. Sem isso o conferente teria de mentir no documento para conseguir
  -- salvar — e mentira em documento de conferência é pior do que divergência
  -- registrada.
  item_locado_id  uuid references public.item_locado (id) on delete set null,

  item_id         uuid not null references public.item_catalogo (id) on delete restrict,
  -- Preenchido quando `item_catalogo.controle = 'peca'`.
  unidade_id      uuid references public.equipamento_unidade (id) on delete set null,

  quantidade      numeric(14, 2) not null check (quantidade > 0),
  condicao        text not null default 'ok'
                  check (condicao in ('ok', 'avaria', 'divergencia')),
  observacoes     text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_recebimento_item_recebimento
  on public.recebimento_item (recebimento_id);

-- ---------------------------------------------------------------------------
-- RLS — mesmo recorte por obra do contrato a que o recebimento pertence
-- ---------------------------------------------------------------------------
alter table public.recebimento enable row level security;
alter table public.recebimento_item enable row level security;

-- Helper: a obra do contrato do recebimento. `security definer` porque a policy
-- precisa enxergar o contrato mesmo antes de decidir se o usuário pode vê-lo —
-- caso contrário a checagem seria circular.
create or replace function public.obra_do_contrato(p_contrato_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select obra_id from public.contrato_locacao where id = p_contrato_id;
$$;

drop policy if exists "recebimento_select" on public.recebimento;
drop policy if exists "recebimento_write" on public.recebimento;
drop policy if exists "recebimento_delete" on public.recebimento;

create policy "recebimento_select" on public.recebimento
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and deleted_at is null
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(public.obra_do_contrato(contrato_id))
    )
  );

create policy "recebimento_write" on public.recebimento
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(public.obra_do_contrato(contrato_id))
    )
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

drop policy if exists "recebimento_item_select" on public.recebimento_item;
drop policy if exists "recebimento_item_write" on public.recebimento_item;

-- O item herda a visibilidade do recebimento: um `exists` sobre a própria
-- policy de `recebimento`, que já aplica o recorte por obra.
create policy "recebimento_item_select" on public.recebimento_item
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and exists (select 1 from public.recebimento r where r.id = recebimento_id)
  );

create policy "recebimento_item_write" on public.recebimento_item
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
    and exists (select 1 from public.recebimento r where r.id = recebimento_id)
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
drop trigger if exists trg_audit on public.recebimento;
create trigger trg_audit after insert or update or delete on public.recebimento
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- soft_delete: ramo do recebimento
-- ---------------------------------------------------------------------------
-- Um recebimento FECHADO não se exclui: ele já gerou documento e já foi
-- comunicado ao fornecedor. O caminho para desfazer é reabrir (só master, na
-- fase 1b) e, aí sim, excluir enquanto rascunho.
create or replace function public.soft_delete_recebimento(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid := public.current_org_id();
  v_linhas int;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;
  if not public.pode_operar() then
    raise exception 'Sem permissão para excluir recebimentos.' using errcode = '42501';
  end if;

  update public.recebimento set deleted_at = now()
   where id = p_id and org_id = v_org and deleted_at is null
     and status = 'rascunho';

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

notify pgrst, 'reload schema';
