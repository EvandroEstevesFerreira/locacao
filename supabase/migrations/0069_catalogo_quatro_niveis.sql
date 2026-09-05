-- ============================================================================
-- Catálogo em quatro níveis — fase A
-- (docs/superpowers/specs/2026-09-05-catalogo-quatro-niveis-design.md)
--
-- A hierarquia JÁ EXISTIA, escrita como prosa dentro de um campo de texto:
-- "Notebook Dell Latitude 3490" é tipo + modelo num string só. O sistema não
-- sabia que eram duas coisas, e o preço apareceu no banco — o mesmo modelo
-- cadastrado duas vezes por um erro de digitação (Latitude / Latitute), com
-- seis máquinas divididas entre os dois cadastros.
--
-- Esta migration dá estrutura ao que era texto:
--
--   categoria_equipamento  TI                  (já existia, 8 delas)
--     └── tipo_equipamento  NOTEBOOK           (NOVO)
--           └── item_catalogo  Dell Latitude 3490   (é o de hoje)
--                 └── equipamento_unidade  NB-0231  (já existia)
--
-- O MOMENTO É ESTE: o catálogo está vazio, a pedido do usuário e com backup.
-- Não há dado legado para migrar, o que elimina a parte mais arriscada — não é
-- preciso adivinhar o tipo de "Notebook Dell Latitute 3490" por análise de
-- texto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A colisão de nomes: `tipo` vira `natureza`
-- ---------------------------------------------------------------------------
-- `item_catalogo.tipo` significa NATUREZA — equipamento, material retornável,
-- consumível — e a tela chamava isso de "Tipo". No desenho novo, TIPO é a
-- FAMÍLIA: NOTEBOOK, ANDAIME, BETONEIRA. Dois campos "Tipo" na mesma tela seria
-- um desastre, e renomear a coluna é o que impede a confusão de nascer no
-- código antes de nascer na tela.
alter table public.item_catalogo rename column tipo to natureza;

comment on column public.item_catalogo.natureza is
  'Como o item se comporta: equipamento (retorna, por peça), material_retornavel (retorna, por quantidade) ou consumivel (não retorna). NÃO confundir com tipo_id, que é a família.';

-- ---------------------------------------------------------------------------
-- `controle` passa a ser derivado da natureza
-- ---------------------------------------------------------------------------
-- O DEFEITO QUE ISTO CONSERTA: o estado PADRÃO de um item novo era
-- `tipo = 'equipamento'` — cuja ajuda na tela diz "controlado por unidade" —
-- com `controle = 'quantidade'`. O formulário nascia se contradizendo, e os
-- dois campos diziam a mesma coisa por caminhos diferentes.
--
-- A coluna CONTINUA existindo: dezenas de consultas já a selecionam, e derivá-la
-- em tempo de leitura exigiria tocar todas. Ela só deixa de ser escolhida à mão.
-- Recebe `text` e quem chama converte. `natureza` é do ENUM `tipo_item`, e uma
-- função tipada nele quebraria no dia em que o enum ganhasse um valor — enquanto
-- a versão em texto só passa a devolver 'quantidade' para o valor novo, que é o
-- padrão seguro.
create or replace function public.controle_da_natureza(p_natureza text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_natureza = 'equipamento' then 'peca' else 'quantidade' end;
$$;

create or replace function public.aplicar_controle_do_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.controle := public.controle_da_natureza(new.natureza::text);
  return new;
end;
$$;

drop trigger if exists trg_controle_item on public.item_catalogo;
create trigger trg_controle_item
  before insert or update of natureza on public.item_catalogo
  for each row execute function public.aplicar_controle_do_item();

-- Alinha o que já existe. Hoje a tabela está vazia e isto é um no-op; fica
-- porque é a única janela em que a correção é barata.
update public.item_catalogo
   set controle = public.controle_da_natureza(natureza::text)
 where controle is distinct from public.controle_da_natureza(natureza::text);

-- ---------------------------------------------------------------------------
-- tipo_equipamento — a família
-- ---------------------------------------------------------------------------
create table if not exists public.tipo_equipamento (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,

  -- O tipo pertence a UMA categoria. NOTEBOOK é de TI e não de Concretagem, e
  -- permitir várias transformaria a árvore num grafo — que a tela de menu e
  -- submenu não sabe desenhar.
  categoria_id  uuid not null references public.categoria_equipamento (id) on delete cascade,

  nome          text not null,

  -- Sugere a natureza de um modelo novo deste tipo: NOTEBOOK sugere
  -- 'equipamento'; PRANCHA sugere 'material_retornavel'. É SUGESTÃO e não
  -- imposição — o mesmo tipo pode ter um modelo que a obra trate por lote.
  natureza_padrao text not null default 'equipamento'
                  check (natureza_padrao in ('equipamento', 'material_retornavel', 'consumivel')),

  -- Os campos que as PEÇAS deste tipo têm. Fase B usa; a coluna nasce aqui para
  -- que a fase B não precise mexer na tabela de novo.
  --
  -- POR QUE JSONB E NÃO COLUNAS: `memória` e `disco` não existem num andaime.
  -- Colunas em `equipamento_unidade` encheriam de nulo toda betoneira e escora
  -- do sistema, e cada tipo novo pediria uma migration.
  campos_ficha  jsonb not null default '[]'::jsonb,

  -- Tipo em desuso some do seletor sem sumir do histórico dos itens que já o
  -- referenciam.
  ativo         boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Dois NOTEBOOK na mesma categoria seriam sempre erro de digitação — e é
  -- exatamente o erro que este projeto inteiro existe para impedir (o
  -- Latitude/Latitute). A unicidade é por categoria, não global: "SUPORTE" pode
  -- existir em Acesso e altura e em TI querendo dizer coisas diferentes.
  unique (org_id, categoria_id, nome)
);

create index if not exists idx_tipo_equip_categoria
  on public.tipo_equipamento (categoria_id, nome);

drop trigger if exists trg_tipo_equip_updated_at on public.tipo_equipamento;
create trigger trg_tipo_equip_updated_at
  before update on public.tipo_equipamento
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- O vínculo do modelo com o tipo
-- ---------------------------------------------------------------------------
-- NULÁVEL, e permanentemente. Um modelo pode existir antes de alguém decidir
-- seu tipo, e tornar obrigatório travaria o cadastro rápido que a obra faz com
-- o caminhão parado no portão.
--
-- `on delete set null` e não cascade: apagar o tipo NOTEBOOK não pode apagar os
-- modelos de notebook. Eles perdem a classificação, não a existência.
alter table public.item_catalogo
  add column if not exists tipo_id uuid
    references public.tipo_equipamento (id) on delete set null;

create index if not exists idx_item_catalogo_tipo
  on public.item_catalogo (tipo_id) where tipo_id is not null;

-- ---------------------------------------------------------------------------
-- unidade_medida — lista fechada
-- ---------------------------------------------------------------------------
-- Hoje `item_catalogo.unidade` é campo livre com sugestões. Campo livre de
-- unidade sempre vira "un", "UN", "unid" e "unidade" convivendo na mesma
-- tabela — e aí nenhum relatório soma direito.
--
-- A coluna `unidade` CONTINUA sendo texto: ela guarda o símbolo, e trocá-la por
-- uma FK obrigaria a migrar dado que ainda vai nascer. A tabela alimenta o
-- seletor; a integridade vem de a tela só oferecer o que está aqui.
create table if not exists public.unidade_medida (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  simbolo    text not null,
  nome       text not null,
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, simbolo)
);

drop trigger if exists trg_unidade_medida_updated_at on public.unidade_medida;
create trigger trg_unidade_medida_updated_at
  before update on public.unidade_medida
  for each row execute function public.set_updated_at();

-- Semeia com as sugestões que já viviam cravadas em `src/lib/itens.ts`, uma vez
-- por organização. `on conflict do nothing` faz a migration poder rodar de novo
-- sem duplicar.
insert into public.unidade_medida (org_id, simbolo, nome, ordem)
select o.id, u.simbolo, u.nome, u.ordem
from public.organizacao o
cross join (values
  ('un',  'unidade',        10),
  ('m',   'metro',          20),
  ('m²',  'metro quadrado', 30),
  ('m³',  'metro cúbico',   40),
  ('kg',  'quilograma',     50),
  ('L',   'litro',          60),
  ('par', 'par',            70),
  ('cj',  'conjunto',       80)
) as u(simbolo, nome, ordem)
on conflict (org_id, simbolo) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Cadastro de organização, como `categoria_equipamento`: leitura para quem está
-- dentro, escrita para quem pode operar. Não há recorte por obra — o catálogo é
-- da empresa, e uma obra que não enxergasse um tipo não conseguiria cadastrar o
-- item que acabou de receber.
alter table public.tipo_equipamento enable row level security;
alter table public.unidade_medida   enable row level security;

drop policy if exists "tipo_equipamento_select" on public.tipo_equipamento;
drop policy if exists "tipo_equipamento_write"  on public.tipo_equipamento;

create policy "tipo_equipamento_select" on public.tipo_equipamento
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "tipo_equipamento_write" on public.tipo_equipamento
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

drop policy if exists "unidade_medida_select" on public.unidade_medida;
drop policy if exists "unidade_medida_write"  on public.unidade_medida;

create policy "unidade_medida_select" on public.unidade_medida
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "unidade_medida_write" on public.unidade_medida
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

notify pgrst, 'reload schema';
