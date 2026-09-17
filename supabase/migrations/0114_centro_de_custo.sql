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
    -- Tres naturezas, e a terceira nasceu de olhar o Mega de verdade:
    -- `38 Sistenge`, `20 Custo Direto Operacional` e `21 Contratos de
    -- Manutencao` nao sao obra nem departamento -- sao os agrupadores sob os
    -- quais os dois vivem. Sem `grupo`, ou eles virariam departamentos falsos
    -- (e o RH apareceria como irmao da Sistenge inteira), ou a arvore do Loca
    -- deixaria de espelhar a do ERP logo no primeiro nivel.
    create type public.tipo_centro_custo as enum ('obra', 'departamento', 'grupo');
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

-- O Mega e a ADP numeram os MESMOS centros de custo de formas diferentes:
-- Administracao e `6` no Mega e `800` na ADP. O `codigo` do Loca segue a ADP,
-- que e o que ja esta na tela e nas 8 obras cadastradas; o do ERP vem aqui, ao
-- lado do `codigo_people` que a 0094 ja criou pelo mesmo motivo.
--
-- Nulo e legitimo e vai acontecer: `803` da ADP cobre Comercial E Orcamentos,
-- que no Mega sao `8` e `9` -- dois codigos para uma linha. Guardar "8,9" aqui
-- seria inventar um formato que nenhum dos dois sistemas usa; melhor o campo
-- vazio e a conciliacao a mao do que uma chave que nao casa com nada.
alter table public.obra
  add column if not exists codigo_mega text;

create unique index if not exists idx_obra_codigo_mega
  on public.obra (org_id, codigo_mega) where codigo_mega is not null;

create index if not exists idx_obra_pai
  on public.obra (pai_id) where pai_id is not null;
create index if not exists idx_obra_tipo
  on public.obra (org_id, tipo);

-- ---------------------------------------------------------------------------
-- 2. As travas que cabem em CHECK
-- ---------------------------------------------------------------------------
-- Grupo nao tem pai -- ele E o topo. Obra e departamento podem ter.
--
-- ISTO JA FOI O CONTRARIO, e o erro vale registro: a primeira versao desta
-- migration proibia obra de ter pai, raciocinando que a hierarquia seria so
-- administrativa. No Mega, obra e filha de `20` (Custo Direto Operacional) ou
-- de `21` (Contratos de Manutencao). A inferencia estava correta sobre a
-- evidencia que havia -- e a evidencia que faltava era toda externa ao
-- sistema: nada no Loca, no codigo ou no banco dizia isso.
alter table public.obra drop constraint if exists obra_pai_so_departamento;
alter table public.obra drop constraint if exists obra_grupo_sem_pai;
alter table public.obra add constraint obra_grupo_sem_pai check (
  tipo <> 'grupo' or pai_id is null
);

-- Departamento nao tem prazo. Um departamento nao "atrasa", e `percentualPrazo`
-- (src/lib/avanco.ts) usa estas datas como denominador.
alter table public.obra drop constraint if exists obra_departamento_sem_prazo;
alter table public.obra add constraint obra_departamento_sem_prazo check (
  tipo = 'obra'
  or (data_inicio is null and data_fim_prevista is null and data_fim_real is null)
);
-- (o CHECK acima ja cobre `grupo` junto com `departamento`: so obra tem prazo)

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

  -- O pai e sempre um GRUPO. Departamento dentro de departamento e obra dentro
  -- de obra seriam uma segunda forma de agrupar custo, concorrendo com a que o
  -- ERP ja define -- e duas arvores de custo divergem na primeira reorganizacao.
  if v_pai.tipo <> 'grupo' then
    raise exception
      'O centro de custo pai tem de ser um grupo (como "38 Sistenge" ou '
      '"20 Custo Direto Operacional"), e "%" nao e.', v_pai.nome;
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
-- 4b. A arvore do Mega: tres grupos de topo
-- ---------------------------------------------------------------------------
-- Estrutura confirmada com o Evandro em 17/09/2026. No Mega o custo se divide
-- em tres, e so depois em projeto:
--
--   38 Sistenge                    -> a sede e os custos dos departamentos
--   20 Custo Direto Operacional    -> as obras
--   21 Contratos de Manutencao     -> os contratos de manutencao continua
--
-- Os grupos usam o codigo do MEGA no `codigo` porque a ADP nao os tem: ela
-- numera departamento, nao agrupador. Onde os dois existem, o `codigo` e o da
-- ADP e o do ERP vai em `codigo_mega`.
insert into public.obra (org_id, codigo, nome, tipo, codigo_mega, status)
select o.org_id, v.codigo, v.nome, 'grupo', v.codigo, 'ativa'
from (select distinct org_id from public.obra) o
cross join (values
  ('38', 'Sistenge'),
  ('20', 'Alocacao de Custo Direto Operacional'),
  ('21', 'Alocacao de Custo Direto com Contratos de Manutencao')
) as v(codigo, nome)
on conflict (org_id, codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 4c. As 11 "frentes" da obra 800 sao departamentos: valida e recolhe
-- ---------------------------------------------------------------------------
-- Descoberto ao rodar esta migration em producao, em 17/09/2026: a obra 800
-- tem 11 frentes de servico chamadas Comercial, Deposito, Diretoria,
-- Engenharia, Financeiro, Orcamentos, Planejamento, Projetos, RH, SMS e
-- Suprimentos. Criadas todas no mesmo dia, nenhuma com avanco lancado.
--
-- Elas nao sao lixo: sao o MESMO workaround que esta onda veio aposentar.
-- Alguem precisava de departamento, so tinha "frente de servico" dentro da
-- obra administrativa, e usou o que havia. O bloco 5 se recusou a apaga-las em
-- silencio -- e estava certo, porque apagar teria destruido a unica lista de
-- departamentos que a empresa tinha.
--
-- ELAS VIRAM 6 LINHAS, NAO 11, porque a ADP AGRUPA: `801` cobre Engenharia,
-- Suprimentos e Projetos; `803` cobre Comercial e Orcamentos. Onze linhas
-- disputariam `codigo` repetido e bateriam em `idx_obra_codigo`, que e
-- `unique (org_id, codigo)` desde a 0001 -- e bateriam no MEIO desta migration,
-- depois de as frentes ja terem sido apagadas.
--
-- POR QUE EM DUAS METADES, EM VOLTA DO BLOCO 5:
--   - os filhos so entram DEPOIS que o 800 vira departamento (o trigger exige
--     pai grupo, e o 800 so entra sob o 38 no bloco 5);
--   - mas o bloco 5 so converte o 800 DEPOIS que as frentes saem, porque
--     frente pendurada e justamente o impedimento que ele checa.
drop table if exists tmp_promocao_800;
create temp table tmp_promocao_800 (
  frente      text primary key,
  codigo_adp  text,
  nome        text,
  codigo_mega text
);

-- Planejamento e SMS ficaram sem centro de custo ate 17/09/2026: a migration
-- abortou nomeando as duas em vez de chuta-las, e o Evandro respondeu 801.
--
-- A trava fica: qualquer frente nova sem codigo aborta a migration do mesmo
-- jeito. Chutar poe custo no departamento errado, e o erro nao aparece na
-- tela -- aparece num rateio, meses depois, como numero que ninguem explica.
insert into tmp_promocao_800 (frente, codigo_adp, nome, codigo_mega) values
  ('Comercial',    '803', 'Comercial / Orcamentos',              null),
  ('Orcamentos',   '803', 'Comercial / Orcamentos',              null),
  ('Engenharia',   '801', 'Engenharia / Suprimentos / Projetos', '7'),
  ('Suprimentos',  '801', 'Engenharia / Suprimentos / Projetos', '7'),
  ('Projetos',     '801', 'Engenharia / Suprimentos / Projetos', '7'),
  ('Diretoria',    '802', 'Diretoria',                           '5'),
  ('Deposito',     '805', 'Deposito',                            null),
  ('Financeiro',   '800', 'Administracao',                       '6'),
  ('RH',           '800', 'Administracao',                       '6'),
  ('Planejamento', '801', 'Engenharia / Suprimentos / Projetos', '7'),
  ('SMS',          '801', 'Engenharia / Suprimentos / Projetos', '7');

create or replace function pg_temp.chave(t text) returns text
language sql immutable as $$
  -- O cadastro tem "Deposito" e "Depósito", "Orcamentos" e "Orçamentos". Casar
  -- so por igualdade exata deixa a frente de fora do mapa -- e o bloco acima
  -- trata isso como erro, com uma mensagem que confundiria quem le.
  select lower(btrim(translate(t,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')))
$$;

do $$
declare
  v_obra800 uuid;
  v_falta   text;
begin
  select id into v_obra800
  from public.obra
  where codigo = '800' and nome ilike 'administra%' and deleted_at is null;

  if v_obra800 is null then
    raise notice 'Sem obra 800; nada a promover.';
    return;
  end if;

  -- Toda frente da 800 tem de ter par no mapa. Uma frente sem par seria
  -- apagada mais adiante sem virar nada: perda silenciosa de cadastro.
  select string_agg(f.nome, ', ' order by f.nome) into v_falta
  from public.frente_obra f
  where f.obra_id = v_obra800
    and not exists (
      select 1 from tmp_promocao_800 t
      where pg_temp.chave(t.frente) = pg_temp.chave(f.nome)
    );

  if v_falta is not null then
    raise exception
      'Estas frentes da obra 800 nao estao no mapa de promocao: %. '
      'Acrescente-as com codigo, ou remova-as a mao.', v_falta;
  end if;

  select string_agg(frente, ', ' order by frente) into v_falta
  from tmp_promocao_800
  where (codigo_adp is null or btrim(codigo_adp) = '')
    and exists (
      select 1 from public.frente_obra f
      where f.obra_id = v_obra800
        and pg_temp.chave(f.nome) = pg_temp.chave(tmp_promocao_800.frente)
    );

  if v_falta is not null then
    raise exception
      'Estas frentes nao tem centro de custo da ADP definido: %. '
      'Chutar coloca custo no departamento errado, e o erro so aparece num '
      'rateio meses depois.', v_falta;
  end if;

  -- Recolhe os DISTINTOS (6 linhas, nao 11) antes de apagar as frentes.
  drop table if exists tmp_filhos_800;
  create temp table tmp_filhos_800 as
  select distinct o.org_id, t.codigo_adp as codigo, t.nome, t.codigo_mega
  from public.frente_obra f
  join tmp_promocao_800 t on pg_temp.chave(t.frente) = pg_temp.chave(f.nome)
  join public.obra o on o.id = v_obra800
  where f.obra_id = v_obra800;

  delete from public.frente_obra where obra_id = v_obra800;

  raise notice '% frente(s) recolhida(s), viram % departamento(s).',
    11, (select count(*) from tmp_filhos_800);
end $$;

-- ---------------------------------------------------------------------------
-- 5. A conversao: o 800 volta a ser o que sempre foi
-- ---------------------------------------------------------------------------
-- `800 - Administracao` e o departamento administrativo, e mante-lo como obra
-- e o que lhe da prazo, frente, orcamento e fechamento mensal que nao
-- significam nada para ele.
--
-- O 686 ESTEVE NESTA LISTA E SAIU. A primeira resposta foi que ele era
-- departamento; a estrutura do Mega mostrou que ele esta no grupo 21,
-- "Alocacao de Custo Direto com Contratos de Manutencao" -- custo DIRETO,
-- irmao das obras e nao dos departamentos. Ele continua obra, com prazo,
-- avanco e fechamento, e so muda de pai.
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
      ('800', 'administra%')    -- Administracao
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

-- ---------------------------------------------------------------------------
-- 5b. A arvore se monta: cada um sob o seu grupo
-- ---------------------------------------------------------------------------
-- Segunda metade do bloco 4c, e roda aqui porque o trigger do bloco 3 exige
-- que o pai ja seja um grupo -- e os grupos so passam a existir depois que o
-- bloco 4b os cria e o bloco 5 converte o 800.
do $$
declare
  v_38      uuid;
  v_20      uuid;
  v_21      uuid;
  v_obra800 uuid;
  v_qtd     int := 0;
begin
  select id into v_38 from public.obra where codigo = '38' and tipo = 'grupo';
  select id into v_20 from public.obra where codigo = '20' and tipo = 'grupo';

  if v_38 is null or v_20 is null then
    raise exception 'Os grupos 38 e 20 deveriam existir (bloco 4b).';
  end if;

  -- 1. Os departamentos que vieram das frentes, sob o 38.
  if to_regclass('pg_temp.tmp_filhos_800') is not null then
    insert into public.obra (org_id, codigo, nome, tipo, pai_id, codigo_mega, status)
    select org_id, codigo, nome, 'departamento', v_38, codigo_mega, 'ativa'
    from tmp_filhos_800
    -- `800 Administracao` ja existe: e a propria linha que o bloco 5 converteu.
    -- Recria-la aqui esbarraria no unique (org_id, codigo) e derrubaria a
    -- migration inteira no ultimo passo.
    on conflict (org_id, codigo) do nothing;
    get diagnostics v_qtd = row_count;
    raise notice '% departamento(s) criado(s) sob o 38.', v_qtd;
  end if;

  -- 2. O 800, que ja era departamento, tambem e filho do 38 -- e ganha o
  --    codigo do Mega, que a ADP nao tem como dar.
  select id into v_obra800
  from public.obra where codigo = '800' and tipo = 'departamento' and deleted_at is null;

  if v_obra800 is not null then
    update public.obra
    set pai_id = v_38, codigo_mega = coalesce(codigo_mega, '6')
    where id = v_obra800;
  end if;

  -- 3. Os contratos de manutencao, sob o 21. A lista e EXPLICITA porque so o
  --    dono do processo sabe quais obras sao contrato de manutencao, e
  --    pendurar no grupo errado poe custo de obra na conta da manutencao --
  --    erro que aparece no relatorio financeiro, nao na tela.
  select id into v_21 from public.obra where codigo = '21' and tipo = 'grupo';

  update public.obra
  set pai_id = v_21,
      codigo_mega = coalesce(codigo_mega, codigo)
  where tipo = 'obra' and pai_id is null and deleted_at is null
    and codigo in ('686');   -- acrescente aqui os proximos (705 e afins)
  get diagnostics v_qtd = row_count;
  raise notice '% contrato(s) de manutencao pendurado(s) no grupo 21.', v_qtd;

  -- 4. Todas as demais obras, sob o 20.
  update public.obra
  set pai_id = v_20,
      codigo_mega = coalesce(codigo_mega, codigo)
  where tipo = 'obra' and pai_id is null and deleted_at is null;
  get diagnostics v_qtd = row_count;
  raise notice '% obra(s) pendurada(s) no grupo 20.', v_qtd;
end $$;

drop table if exists tmp_filhos_800;
drop table if exists tmp_promocao_800;
