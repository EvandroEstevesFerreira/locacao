-- ============================================================================
-- Obra e departamento na mesma lista: o centro de custo
-- (docs/superpowers/specs/2026-09-17-centros-de-custo-design.md)
-- ============================================================================
--
-- O `800 - Administracao` e um departamento vestido de obra para conseguir
-- existir no sistema. O disfarce lhe da prazo, avanco fisico semanal, frente
-- de servico, orcamento de locacao e fechamento mensal -- e um fechamento
-- mensal do administrativo e um numero plausivel dentro de um relatorio
-- financeiro entregue a um cliente.
--
-- A escolha foi o DISCRIMINADOR na propria `obra`, e nao uma tabela
-- `departamento` separada. Uma tabela separada tornaria polimorfica toda FK
-- que hoje aponta para `obra`, e duplicaria a regra de escopo em TODA policy
-- do sistema. RLS com dois caminhos e como um tenant comeca a ver o que nao e
-- dele -- o mesmo tipo de furo silencioso da 0.49.1.
--
-- NENHUMA POLICY MUDA NESTA MIGRATION, e isso e verificado, nao esperado:
-- `obra_select` filtra por `org_id = current_org_id()` e por
-- `is_member_of_obra(id)`, e os dois sao indiferentes ao tipo da linha.
-- Departamento entra no mesmo regime de vinculo que a obra, que e a decisao
-- de "mesma regra, sem excecao" -- inclusive SEM heranca pelo pai: vincular
-- alguem ao Administrativo nao da acesso ao RH. Com heranca, pendurar um
-- setor no pai errado vazaria uma area inteira em silencio.

-- ---------------------------------------------------------------------------
-- 1. O tipo e as duas colunas
-- ---------------------------------------------------------------------------
-- `default 'obra'` e o que mantem o resto do sistema funcionando sem tocar em
-- nada: toda linha existente e toda linha nova continuam sendo obra ate que
-- alguem diga o contrario. E e o que faz a busca global continuar devolvendo
-- todo centro de custo -- nao ha conjunto de resultados a mudar, so o rotulo
-- em `src/lib/data/busca.ts`.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_centro_custo') then
    create type public.tipo_centro_custo as enum ('obra', 'departamento');
  end if;
end $$;

alter table public.obra
  add column if not exists tipo public.tipo_centro_custo not null default 'obra';

-- `on delete restrict`: excluir o Administrativo que tem quatro setores
-- pendurados tem de falhar com mensagem, nao arrastar os quatro.
alter table public.obra
  add column if not exists pai_id uuid references public.obra (id) on delete restrict;

comment on column public.obra.tipo is
  'Obra de engenharia ou departamento administrativo. Imutavel apos a criacao '
  '(ver trigger trg_obra_centro_custo): converter um centro de custo que ja tem '
  'custodia, lancamento e termo emitido e migracao de dados, nao troca de campo.';

comment on column public.obra.pai_id is
  'Departamento pai. Profundidade maxima 2 -- o pai tem de ter pai_id nulo. '
  'O limite elimina ciclo por construcao: sem ele, a trava exigiria WITH '
  'RECURSIVE e toda soma de custo por area seria consulta recursiva.';

create index if not exists idx_obra_pai
  on public.obra (pai_id) where pai_id is not null;
create index if not exists idx_obra_tipo
  on public.obra (org_id, tipo);

-- ---------------------------------------------------------------------------
-- 2. As travas que cabem em CHECK
-- ---------------------------------------------------------------------------
-- Obra nao tem pai. A hierarquia e administrativa; obra filha de obra seria
-- uma segunda forma de agrupar custo, concorrendo com `frente_obra`.
alter table public.obra drop constraint if exists obra_pai_so_departamento;
alter table public.obra add constraint obra_pai_so_departamento check (
  tipo = 'departamento' or pai_id is null
);

-- Departamento nao tem prazo. Um departamento nao "atrasa", e `percentualPrazo`
-- (src/lib/avanco.ts) usa estas datas como denominador.
alter table public.obra drop constraint if exists obra_departamento_sem_prazo;
alter table public.obra add constraint obra_departamento_sem_prazo check (
  tipo = 'obra'
  or (data_inicio is null and data_fim_prevista is null and data_fim_real is null)
);

-- Departamento nao pausa: existe ou foi extinto. "Pausada" descreve obra cujo
-- contrato parou. O enum nao muda -- mexer em enum em uso e migration cara, e
-- o CHECK diz a mesma coisa.
alter table public.obra drop constraint if exists obra_departamento_sem_pausa;
alter table public.obra add constraint obra_departamento_sem_pausa check (
  tipo = 'obra' or status <> 'pausada'
);

-- ---------------------------------------------------------------------------
-- 3. As travas que precisam olhar OUTRA linha
-- ---------------------------------------------------------------------------
-- Tres regras, uma leitura so da linha do pai. Nao cabem em CHECK porque um
-- CHECK nao pode consultar outra linha da mesma tabela de forma confiavel.
create or replace function public.obra_centro_custo_valido()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_pai record;
begin
  -- `tipo` e imutavel. A unica conversao que este sistema faz e a do bloco 6,
  -- uma vez, com o banco conferindo o que converte.
  if tg_op = 'UPDATE' and new.tipo is distinct from old.tipo then
    raise exception
      'O tipo de um centro de custo nao pode ser alterado (de % para %). '
      'Crie o centro de custo novo e transfira os vinculos.',
      old.tipo, new.tipo;
  end if;

  if new.pai_id is null then
    return new;
  end if;

  if new.pai_id = new.id then
    raise exception 'Um centro de custo nao pode ser pai de si mesmo.';
  end if;

  select id, nome, org_id, tipo, pai_id into v_pai
  from public.obra where id = new.pai_id;

  if not found then
    raise exception 'O centro de custo pai nao existe.';
  end if;

  -- Pai de outra organizacao seria vazamento entre tenants pela porta da
  -- hierarquia -- a mesma classe de furo que a RLS existe para fechar.
  if v_pai.org_id <> new.org_id then
    raise exception 'O centro de custo pai pertence a outra organizacao.';
  end if;

  if v_pai.tipo <> 'departamento' then
    raise exception 'Somente um departamento pode ser pai de outro centro de custo.';
  end if;

  -- Dois niveis. Barrar o neto e o que torna o ciclo impossivel: para haver
  -- ciclo seria preciso um pai que ja tem pai.
  if v_pai.pai_id is not null then
    raise exception
      'A hierarquia tem no maximo dois niveis: "%" ja e um setor de outro departamento.',
      v_pai.nome;
  end if;

  return new;
end $$;

drop trigger if exists trg_obra_centro_custo on public.obra;
create trigger trg_obra_centro_custo
  before insert or update on public.obra
  for each row execute function public.obra_centro_custo_valido();

-- ---------------------------------------------------------------------------
-- 4. O que departamento nao recebe
-- ---------------------------------------------------------------------------
-- Frente de servico, avanco fisico, orcamento de locacao e fechamento mensal
-- sao de obra. Esconder o bloco no React nao basta: a server action continua
-- alcancavel, e nenhuma das quatro linhas parece errada depois de gravada --
-- um fechamento mensal do RH entra no relatorio financeiro com cara de
-- legitimo. A regra vive aqui, onde a action nao passa por cima.
--
-- UMA funcao e quatro gatilhos, nao quatro copias: copia e como as quatro
-- divergem na primeira vez que alguem mexer em uma delas.
create or replace function public.exige_centro_custo_obra()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_tipo public.tipo_centro_custo;
  v_nome text;
begin
  select tipo, nome into v_tipo, v_nome
  from public.obra where id = new.obra_id;

  if v_tipo = 'departamento' then
    raise exception
      '"%" e um departamento: nao recebe frente de servico, avanco, orcamento '
      'de locacao nem fechamento mensal.', v_nome;
  end if;

  return new;
end $$;

drop trigger if exists trg_frente_exige_obra on public.frente_obra;
create trigger trg_frente_exige_obra
  before insert or update of obra_id on public.frente_obra
  for each row execute function public.exige_centro_custo_obra();

drop trigger if exists trg_avanco_exige_obra on public.avanco_obra;
create trigger trg_avanco_exige_obra
  before insert or update of obra_id on public.avanco_obra
  for each row execute function public.exige_centro_custo_obra();

drop trigger if exists trg_orcamento_exige_obra on public.orcamento_locacao;
create trigger trg_orcamento_exige_obra
  before insert or update of obra_id on public.orcamento_locacao
  for each row execute function public.exige_centro_custo_obra();

drop trigger if exists trg_fechamento_exige_obra on public.fechamento_mensal;
create trigger trg_fechamento_exige_obra
  before insert or update of obra_id on public.fechamento_mensal
  for each row execute function public.exige_centro_custo_obra();

-- ---------------------------------------------------------------------------
-- 5. As duas conversoes: o 800 e o 686 voltam a ser o que sempre foram
-- ---------------------------------------------------------------------------
-- `800 - Administracao` e o departamento administrativo. `686 - CPQ03
-- Manutencao` e manutencao continua, e nao obra com prazo -- confirmado com o
-- Evandro em 17/09/2026. Os dois sao centros de custo sem avanco fisico, e
-- mante-los como obra e o que lhes da prazo, frente, orcamento e fechamento
-- mensal que nao significam nada para eles.
--
-- A lista e explicita, e nao um padrao ("todo codigo 8xx"): a regra por padrao
-- converteria sozinha a proxima obra que nascesse com codigo parecido, e o
-- erro so apareceria num relatorio faltando linha.
--
-- E ela NAO cria Engenharia, Comercial, RH e os demais. Cada centro de custo
-- tem um `codigo` que precisa bater com o Mega e com o People, e esse codigo e
-- dado de negocio que o banco nao tem como saber. Inventar '810' para o RH
-- criaria uma segunda verdade, e a divergencia apareceria num rateio, meses
-- depois. Os departamentos sao cadastrados na tela por quem sabe os codigos --
-- que e a funcionalidade que este trabalho entrega.
--
-- Defensiva de proposito, e ABORTA em vez de adivinhar: converter a obra errada
-- a tiraria do avanco fisico e do fechamento, e o sintoma apareceria semanas
-- depois como relatorio faltando linha.
do $$
declare
  v_alvo record;
  v_qtd  int;
  v_id   uuid;
  v_impedimento text;
  v_convertidos int := 0;
begin
  for v_alvo in
    select * from (values
      ('800', 'administra%'),   -- Administracao
      ('686', 'cpq03%')         -- CPQ03 - Manutencao
    ) as t(codigo, nome_like)
  loop
    select count(*) into v_qtd
    from public.obra
    where codigo = v_alvo.codigo and nome ilike v_alvo.nome_like and deleted_at is null;

    if v_qtd = 0 then
      raise notice 'Nenhuma obra %/% encontrada; nada a converter.',
        v_alvo.codigo, v_alvo.nome_like;
      continue;
    end if;

    if v_qtd > 1 then
      raise exception
        'Ha % linhas com codigo % e nome "%"; converta a mao.',
        v_qtd, v_alvo.codigo, v_alvo.nome_like;
    end if;

    select id into v_id
    from public.obra
    where codigo = v_alvo.codigo and nome ilike v_alvo.nome_like and deleted_at is null;

    -- Se ja tem frente, avanco, orcamento ou fechamento gravado, a conversao
    -- tornaria esses registros invalidos pela regra do bloco 4 -- orfanando
    -- dado que ja existe. Melhor abortar e decidir a mao.
    --
    -- O 686 e o caso em que isto pode disparar de verdade: ele e obra hoje, e
    -- se alguem ja lancou avanco nele, a migration para e avisa em vez de
    -- apagar historico por conta propria.
    -- `count(*)` por tipo, e nao uma linha por registro: com `union all` cru, 11
    -- frentes viravam "frente de servico, frente de servico, ..." onze vezes na
    -- mensagem. Quem le precisa saber QUANTAS sao -- foi o que aconteceu ao
    -- rodar em producao, e a mensagem atrapalhou em vez de ajudar.
    select string_agg(format('%s %s', n, t), ', ' order by t) into v_impedimento
    from (
      select 'frente(s) de servico' t, count(*) n from public.frente_obra      where obra_id = v_id
      union all
      select 'avanco(s)',             count(*)   from public.avanco_obra       where obra_id = v_id
      union all
      select 'orcamento(s)',          count(*)   from public.orcamento_locacao where obra_id = v_id
      union all
      select 'fechamento(s) mensal',  count(*)   from public.fechamento_mensal where obra_id = v_id
    ) x where n > 0;

    if v_impedimento is not null then
      raise exception
        'A obra % ja tem % gravado(s). Remova-os antes de converte-la em departamento.',
        v_alvo.codigo, v_impedimento;
    end if;

    -- Sem o `alter ... disable`, o trigger do bloco 3 recusaria esta propria
    -- conversao -- ele existe justamente para impedi-la em runtime.
    alter table public.obra disable trigger trg_obra_centro_custo;

    update public.obra
    set tipo              = 'departamento',
        status            = case when status = 'pausada' then 'ativa' else status end,
        data_inicio       = null,
        data_fim_prevista = null,
        data_fim_real     = null
    where id = v_id;

    alter table public.obra enable trigger trg_obra_centro_custo;

    v_convertidos := v_convertidos + 1;
  end loop;

  raise notice '% centro(s) de custo convertido(s) em departamento.', v_convertidos;
end $$;
