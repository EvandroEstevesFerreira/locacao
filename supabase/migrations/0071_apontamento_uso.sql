-- ============================================================================
-- Apontamento de uso — fase 3a
-- (docs/superpowers/specs/2026-09-05-fase3-uso-do-equipamento-decomposicao.md)
--
-- O QUE ESTA FATIA É, DEPOIS DA RESPOSTA "POR CALENDÁRIO".
--
-- Todos os contratos da Sistenge são por período de calendário. A diária corre
-- trabalhando a máquina ou não, então o apontamento NÃO é dado financeiro —
-- ele não entra em nenhum cálculo de custo. Sobram duas coisas, e as duas
-- valem:
--
--   1. MANUTENÇÃO PREVENTIVA POR USO — óleo a cada 250 h, não a cada três
--      meses. É o intervalo que o fabricante manda seguir, e ninguém tinha como
--      saber quando ele vencia.
--   2. OCIOSIDADE REAL — a betoneira que está na obra há 40 dias e trabalhou 6.
--      O relatório de ociosidade que existe mede CALENDÁRIO (está locado e não
--      foi devolvido) e é cego para isso.
--
-- E a consequência de desenho: sem efeito no custo, o apontamento NÃO precisa
-- ser diário nem exato. A leitura é do HORÍMETRO — um número acumulado que a
-- máquina mostra —, e não "quantas horas trabalhou hoje". Quem lê o mostrador
-- não erra; quem estima horas de memória, sim.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Quais peças têm horímetro
-- ---------------------------------------------------------------------------
-- Default FALSE, e é o ponto: gerador e compressor costumam ter; betoneira e
-- vibrador quase nunca. Ligar para todas encheria a tela de apontamento de
-- peças que não têm o que apontar, e a lista viraria ruído no primeiro dia.
alter table public.equipamento_unidade
  add column if not exists tem_horimetro boolean not null default false;

comment on column public.equipamento_unidade.tem_horimetro is
  'Marca as peças que têm horímetro. Só elas aparecem no apontamento de uso.';

-- ---------------------------------------------------------------------------
-- O intervalo de manutenção, por tipo
-- ---------------------------------------------------------------------------
-- Vive no TIPO e não na peça: o intervalo é do fabricante e vale para toda a
-- família. GERADOR revisa a cada 250 h — todos eles. Repetir por peça faria
-- cada cadastro novo pedir um número que ninguém lembra, e metade ficaria zero.
--
-- NULO = este tipo não tem manutenção por uso. É o caso de NOTEBOOK, e da
-- maioria: só faz sentido onde o fabricante publica o intervalo.
alter table public.tipo_equipamento
  add column if not exists intervalo_manutencao_h int
    check (intervalo_manutencao_h is null or intervalo_manutencao_h > 0);

-- ---------------------------------------------------------------------------
-- apontamento_uso
-- ---------------------------------------------------------------------------
create table if not exists public.apontamento_uso (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  unidade_id  uuid not null references public.equipamento_unidade (id) on delete cascade,

  -- A obra em que a peça estava. Fotografada no lançamento e não derivada
  -- depois: a peça circula, e daqui a três meses `equipamento_unidade.obra_id`
  -- vai apontar para outro lugar — o apontamento diria que a máquina trabalhou
  -- numa obra onde ela nem estava.
  obra_id     uuid references public.obra (id) on delete set null,

  data        date not null,

  -- A LEITURA DO MOSTRADOR, acumulada. Não "horas trabalhadas".
  --
  -- Quem lê o horímetro copia um número; quem estima horas de memória inventa.
  -- E a leitura é auditável: dá para conferir contra a máquina a qualquer
  -- momento, enquanto "trabalhou 6 horas" não dá.
  leitura     numeric(12, 1) not null check (leitura >= 0),

  -- As horas do período, calculadas na gravação a partir da leitura anterior.
  -- Guardadas para o relatório não ter de refazer a conta em janela deslizante
  -- toda vez — e para sobreviverem à exclusão do apontamento anterior.
  horas       numeric(12, 1) not null default 0 check (horas >= 0),

  -- HORÍMETRO TROCADO ZERA. É o caso que quebra a conta: sem esta marca, a
  -- leitura seguinte seria menor que a anterior e o sistema recusaria o
  -- lançamento para sempre — ou, pior, gravaria horas negativas.
  reiniciado  boolean not null default false,

  observacoes text,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),

  -- Duas leituras da mesma peça no mesmo dia são sempre erro de digitação: o
  -- horímetro é acumulado, e a segunda substituiria a primeira sem que ninguém
  -- soubesse qual valia.
  unique (unidade_id, data)
);

create index if not exists idx_apontamento_unidade
  on public.apontamento_uso (unidade_id, data desc);
create index if not exists idx_apontamento_org
  on public.apontamento_uso (org_id, data desc);

-- ---------------------------------------------------------------------------
-- A conta das horas
-- ---------------------------------------------------------------------------
-- POR QUE ISTO É TRIGGER E NÃO CÓDIGO DA ACTION.
--
-- `horas` é a diferença para a leitura anterior DA MESMA PEÇA, e "anterior"
-- depende da data — não da ordem de digitação. Alguém lança a leitura de
-- segunda depois de já ter lançado a de quarta, e a action teria de recalcular
-- as duas. Aqui a regra fica num lugar só, e vale para qualquer caminho de
-- escrita que apareça depois.
--
-- Lançamento FORA DE ORDEM ainda deixa o apontamento seguinte desatualizado —
-- ele foi calculado contra uma leitura que já não é a anterior. O gatilho
-- recalcula o vizinho de cima também, por isso.
create or replace function public.calcular_horas_apontamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_anterior numeric(12, 1);
begin
  select a.leitura into v_anterior
    from public.apontamento_uso a
   where a.unidade_id = new.unidade_id
     and a.data < new.data
   order by a.data desc
   limit 1;

  if new.reiniciado or v_anterior is null then
    -- Primeira leitura da peça, ou horímetro trocado: não há de onde subtrair.
    -- Zero, e não `leitura`, porque a leitura acumulada de um horímetro velho
    -- não é hora trabalhada no período — seria somar de uma vez a vida inteira
    -- da máquina.
    new.horas := 0;
  elsif new.leitura < v_anterior then
    raise exception
      'A leitura % é menor que a anterior (%). Horímetro não anda para trás — se ele foi trocado, marque "horímetro reiniciado".',
      new.leitura, v_anterior
      using errcode = '22023';
  else
    new.horas := new.leitura - v_anterior;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_horas_apontamento on public.apontamento_uso;
create trigger trg_horas_apontamento
  before insert or update of leitura, data, reiniciado on public.apontamento_uso
  for each row execute function public.calcular_horas_apontamento();

-- Recalcula o apontamento SEGUINTE quando um é inserido no meio ou excluído.
-- Sem isto, lançar a leitura de segunda depois da de quarta deixaria a de
-- quarta contando as horas de segunda também — e o total do mês ficaria certo
-- por acaso, mas a distribuição no tempo, errada.
create or replace function public.recalcular_apontamento_seguinte()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_unidade uuid := coalesce(new.unidade_id, old.unidade_id);
  v_data    date := coalesce(new.data, old.data);
  v_prox    uuid;
begin
  select a.id into v_prox
    from public.apontamento_uso a
   where a.unidade_id = v_unidade
     and a.data > v_data
   order by a.data
   limit 1;

  -- O `update` dispara `trg_horas_apontamento`, que refaz a conta. Tocar
  -- `leitura` com o próprio valor é o gatilho mais barato para isso.
  if v_prox is not null then
    update public.apontamento_uso set leitura = leitura where id = v_prox;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_recalcular_seguinte on public.apontamento_uso;
create trigger trg_recalcular_seguinte
  after insert or delete on public.apontamento_uso
  for each row execute function public.recalcular_apontamento_seguinte();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Recorte por ORGANIZAÇÃO, como `reparo_equipamento` (0068) e pela mesma razão:
-- a peça circula entre obras, e um recorte por obra esconderia o histórico de
-- uso da máquina que a obra acabou de receber — que é justamente o que ela
-- precisa saber para não estourar o intervalo de revisão.
alter table public.apontamento_uso enable row level security;

drop policy if exists "apontamento_uso_select" on public.apontamento_uso;
drop policy if exists "apontamento_uso_write"  on public.apontamento_uso;

create policy "apontamento_uso_select" on public.apontamento_uso
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "apontamento_uso_write" on public.apontamento_uso
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
