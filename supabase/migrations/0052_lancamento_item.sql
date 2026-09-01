-- ============================================================================
-- Custo por item: o elo que faltava entre a nota e o equipamento
-- (subprojeto C do controle orçamentário)
--
-- `lancamento_financeiro` se liga ao CONTRATO, não ao item. Um contrato de
-- R$ 40.000 com betoneira, gerador e 200 escoras era uma linha só no
-- financeiro, e não havia como dizer quanto a betoneira custou — que é
-- exatamente o "acompanhamento das contas de cada item" que a diretoria pediu.
--
-- NÃO existe regra oculta de rateio. O valor por item é GRAVADO aqui,
-- explicitamente. O rateio proporcional é só um botão que pré-preenche o
-- formulário: rateio automático invisível produz um número que ninguém explica
-- quando o diretor pergunta "por que a betoneira deu isso?".
--
-- Nada aqui altera dado existente: uma tabela nova e suas policies.
-- ============================================================================

create table if not exists public.lancamento_item (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  -- `cascade`: parcela de rateio não tem vida própria fora do lançamento.
  lancamento_id  uuid not null references public.lancamento_financeiro (id) on delete cascade,
  -- `restrict`: apagar a linha do contrato apagaria a explicação do custo já
  -- atribuído a ela.
  item_locado_id uuid not null references public.item_locado (id) on delete restrict,
  valor          numeric(14,2) not null check (valor >= 0),
  created_at     timestamptz not null default now(),
  unique (lancamento_id, item_locado_id)
);

create index if not exists idx_lanc_item_lanc on public.lancamento_item (lancamento_id);
create index if not exists idx_lanc_item_item on public.lancamento_item (item_locado_id);
create index if not exists idx_lanc_item_org  on public.lancamento_item (org_id);

-- A soma das parcelas NÃO é obrigada a fechar com o valor do lançamento, e não
-- há trigger para isso. Atribuição parcial é permitida, e a tela mostra o que
-- falta — mesma escolha do orçamento por item: forçar o fechamento na vírgula
-- obriga a detalhar tudo ou nada, e o resultado prático é não detalhar.

-- ---------------------------------------------------------------------------
-- RLS — o escopo vem do lançamento pai
-- ---------------------------------------------------------------------------
-- Quem pode ver o lançamento pode ver o rateio dele; quem pode gerir o
-- financeiro pode escrever. `pode_financeiro()` é a função canônica dessa
-- regra, espelho de `podeGerenciarFinanceiro` no TypeScript — repetir nomes de
-- papel aqui criaria uma segunda verdade que diverge em silêncio.
alter table public.lancamento_item enable row level security;

drop policy if exists "lancamento_item_select" on public.lancamento_item;
create policy "lancamento_item_select" on public.lancamento_item
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and exists (
      select 1 from public.lancamento_financeiro l
      where l.id = lancamento_id
        and l.deleted_at is null
        and (
          public.current_papel() in ('master', 'administrador', 'gestor')
          or public.is_member_of_obra(l.obra_id)
        )
    )
  );

drop policy if exists "lancamento_item_write" on public.lancamento_item;
create policy "lancamento_item_write" on public.lancamento_item
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_financeiro())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_financeiro())
  );
