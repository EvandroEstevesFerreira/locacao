-- ============================================================================
-- Frente de serviço — fase 3b, a última do módulo de equipamento
-- (docs/superpowers/specs/2026-09-05-fase3-uso-do-equipamento-decomposicao.md)
--
-- O QUE DESTRAVOU ESTA FATIA.
--
-- A pergunta que a segurava era "a frente já existe em algum lugar — orçamento,
-- cronograma, avanço — ou seria cadastro novo?". Criar um cadastro que duplica
-- um conceito existente é o defeito que custou caro várias vezes neste sistema:
-- as obras do fornecedor mantidas à mão ao lado dos contratos, o `STATUS_AVARIA`
-- em dois arquivos, a família do equipamento escrita dentro da descrição.
--
-- A resposta veio do banco, não de suposição:
--
--   avanco_obra        percentual da OBRA INTEIRA por semana. Sem etapa.
--   orcamento_locacao  itens locados. Sem frente.
--   etapa_obra         não existe.
--
-- A frente não vive em lugar nenhum do Loca. Não há o que duplicar aqui dentro.
--
-- E O DESENHO SOBREVIVE À OUTRA PERGUNTA — se as frentes da obra são estáveis ou
-- informais. O cadastro é POR OBRA e criado na hora de usar: frentes estáveis
-- são cadastradas uma vez e reusadas; informais, cada obra cria o que precisa,
-- quando precisa. Nenhum dos dois casos produz cadastro vazio.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- frente_obra
-- ---------------------------------------------------------------------------
create table if not exists public.frente_obra (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,

  -- POR OBRA, e não da organização. "Fundação" na obra A e "Fundação" na obra B
  -- são frentes diferentes: têm equipe, prazo e custo próprios. Uma lista
  -- global obrigaria a inventar nomes únicos ("Fundação — Unimed Maceió") e o
  -- seletor de cada obra ofereceria as frentes de todas as outras.
  obra_id    uuid not null references public.obra (id) on delete cascade,

  nome       text not null,

  -- Frente encerrada some do seletor sem sumir do histórico do que ela
  -- consumiu. É o caso normal: a fundação termina, a obra continua.
  ativo      boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Duas "Fundação" na mesma obra seriam sempre erro de digitação — e a
  -- duplicata é justamente o que separa um relatório por frente de uma
  -- lista de nomes parecidos.
  unique (obra_id, nome)
);

create index if not exists idx_frente_obra
  on public.frente_obra (obra_id, nome) where ativo;

drop trigger if exists trg_frente_obra_updated_at on public.frente_obra;
create trigger trg_frente_obra_updated_at
  before update on public.frente_obra
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Onde a frente é usada
-- ---------------------------------------------------------------------------
-- `item_locado.frente_id` é o que FAZ O CUSTO DESCER. Hoje o custo de locação
-- morre na obra: sabe-se que a obra gastou, não em quê. Com a frente, ele desce
-- ao serviço — fundação, estrutura, acabamento.
--
-- `on delete set null`: apagar a frente não pode apagar o item do contrato. Ele
-- perde a alocação, não a existência — e o custo volta a ser da obra, que é o
-- comportamento anterior e continua correto.
alter table public.item_locado
  add column if not exists frente_id uuid
    references public.frente_obra (id) on delete set null;

create index if not exists idx_item_locado_frente
  on public.item_locado (frente_id) where frente_id is not null;

-- `apontamento_uso.frente_id` é a outra ponta: a hora trabalhada também desce
-- ao serviço. Uma peça pode ser alocada à fundação no contrato e, numa semana,
-- ter trabalhado na estrutura — as duas informações são diferentes e as duas
-- valem.
alter table public.apontamento_uso
  add column if not exists frente_id uuid
    references public.frente_obra (id) on delete set null;

create index if not exists idx_apontamento_frente
  on public.apontamento_uso (frente_id) where frente_id is not null;

-- ---------------------------------------------------------------------------
-- A frente tem de ser DA OBRA certa
-- ---------------------------------------------------------------------------
-- Sem esta trava, o item de um contrato da obra A poderia apontar para uma
-- frente da obra B — e o relatório de custo por frente somaria despesa de uma
-- obra dentro de outra, em silêncio. A tela oferece só as certas, mas a tela
-- pode ser contornada.
--
-- É trigger e não FK composta porque a obra do `item_locado` vem pelo CONTRATO:
-- não há coluna `obra_id` nele para uma chave composta apontar.
create or replace function public.conferir_frente_do_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_obra_item   uuid;
  v_obra_frente uuid;
begin
  if new.frente_id is null then return new; end if;

  select obra_id into v_obra_item
    from public.contrato_locacao where id = new.contrato_id;
  select obra_id into v_obra_frente
    from public.frente_obra where id = new.frente_id;

  if v_obra_item is distinct from v_obra_frente then
    raise exception 'A frente escolhida é de outra obra.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_frente_do_item on public.item_locado;
create trigger trg_frente_do_item
  before insert or update of frente_id, contrato_id on public.item_locado
  for each row execute function public.conferir_frente_do_item();

-- A mesma conferência para o apontamento, que guarda `obra_id` direto.
create or replace function public.conferir_frente_do_apontamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_obra_frente uuid;
begin
  if new.frente_id is null then return new; end if;

  select obra_id into v_obra_frente
    from public.frente_obra where id = new.frente_id;

  -- Apontamento SEM obra com frente informada também é recusado: a frente
  -- pertence a uma obra, então informá-la sem dizer a obra é uma contradição
  -- que produziria linha impossível de somar em qualquer relatório.
  if new.obra_id is distinct from v_obra_frente then
    raise exception 'A frente escolhida é de outra obra.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_frente_do_apontamento on public.apontamento_uso;
create trigger trg_frente_do_apontamento
  before insert or update of frente_id, obra_id on public.apontamento_uso
  for each row execute function public.conferir_frente_do_apontamento();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- A frente é DA OBRA, então o recorte é o da obra — ao contrário de
-- `tipo_equipamento` e `reparo_equipamento`, que são da organização. Quem não
-- enxerga a obra não tem o que fazer com as frentes dela.
alter table public.frente_obra enable row level security;

drop policy if exists "frente_obra_select" on public.frente_obra;
drop policy if exists "frente_obra_write"  on public.frente_obra;

create policy "frente_obra_select" on public.frente_obra
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(obra_id)
    )
  );

create policy "frente_obra_write" on public.frente_obra
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
    and (
      public.current_papel() in ('master', 'administrador')
      or public.is_member_of_obra(obra_id)
    )
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

notify pgrst, 'reload schema';
