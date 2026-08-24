-- ============================================================================
-- Numeração única de registros — fase 0 do módulo de equipamento.
--
-- Todo registro do sistema passa a ter um número legível: CTR-2026-0007,
-- REC-2026-0014, AVA-2026-0009. Sem ele, não há como alguém dizer "confere o
-- REC-2026-0014" — só existe o UUID, que identifica para a máquina e para mais
-- ninguém.
--
-- DOIS NÚMEROS, SEMPRE. `contrato_locacao.numero` é o número DO FORNECEDOR:
-- digitado, pode repetir, pode vir em branco. Ele NÃO é tocado aqui. O número
-- do registro no Loca é `numero_registro`, e vive ao lado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- O contador
-- ---------------------------------------------------------------------------
create table if not exists public.numero_sequencia (
  org_id uuid not null references public.organizacao (id) on delete cascade,
  tipo   text not null,
  ano    int  not null,
  ultimo int  not null default 0,
  primary key (org_id, tipo, ano)
);

alter table public.numero_sequencia enable row level security;
-- Ninguém lê nem escreve pela API: quem mexe é o trigger, que roda como
-- `security definer`. Sem policy, a tabela fica invisível para `authenticated`
-- — que é o correto para um contador interno.

comment on table public.numero_sequencia is
  'Contador por organização/tipo/ano. Sem buracos, por decisão: ver 0048.';

-- ---------------------------------------------------------------------------
-- Prefixos
-- ---------------------------------------------------------------------------
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'   then 'CTR'
    when 'contrato_imovel'    then 'CTI'
    when 'recebimento'        then 'REC'   -- criado na fase 1
    when 'movimentacao'       then 'DEV'
    when 'vistoria'           then 'VIS'
    when 'vistoria_imovel'    then 'VIM'
    when 'avaria'             then 'AVA'
    when 'reparo_imovel'      then 'REP'
    when 'medida_disciplinar' then 'MED'
    when 'entrega_ocupante'   then 'ENT'
    when 'checklist_limpeza'  then 'LIM'
    when 'ocorrencia_imovel'  then 'OCO'
    else 'REG'
  end;
$$;

-- ---------------------------------------------------------------------------
-- proximo_numero — SEM BURACOS, por decisão
-- ---------------------------------------------------------------------------
-- Uma `sequence` do Postgres seria mais rápida e é a escolha óbvia. E está
-- errada aqui: transação abortada queima o número, e o livro fica sem o
-- REC-2026-0008 sem que ninguém saiba por quê. Continuidade é o motivo de a
-- numeração existir; num sistema de alguns registros por dia, o custo de
-- serializar o contador é imperceptível.
--
-- `on conflict do update` faz o lock de linha sozinho — não há `select ... for
-- update` separado e, portanto, não há janela entre ler e escrever.
create or replace function public.proximo_numero(
  p_org uuid,
  p_tipo text,
  p_ano int
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ultimo int;
begin
  insert into public.numero_sequencia (org_id, tipo, ano, ultimo)
  values (p_org, p_tipo, p_ano, 1)
  on conflict (org_id, tipo, ano)
    do update set ultimo = public.numero_sequencia.ultimo + 1
  returning ultimo into v_ultimo;

  return format(
    '%s-%s-%s',
    public.prefixo_registro(p_tipo),
    p_ano,
    lpad(v_ultimo::text, 4, '0')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- O trigger que atribui
-- ---------------------------------------------------------------------------
-- Um TRIGGER, e não uma chamada em cada action. São onze tabelas escritas por
-- dezenas de actions, e bastaria uma esquecida para nascer registro sem número
-- — que é o defeito que a numeração existe para impedir. No banco, não há como
-- escapar.
--
-- O ANO É O DE SÃO PAULO. `extract(year from now())` daria o ano em UTC, e das
-- 21h à meia-noite de 31 de dezembro o banco viraria o ano antes da Sistenge: o
-- primeiro recebimento de 2027 sairia numerado no dia 31/12/2026. A conversão
-- explícita de fuso é a mesma regra do `hojeISOSaoPaulo()` da aplicação.
create or replace function public.atribuir_numero_registro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.numero_registro is null then
    new.numero_registro := public.proximo_numero(
      new.org_id,
      tg_argv[0],
      extract(year from (now() at time zone 'America/Sao_Paulo'))::int
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Coluna, retroatividade, unicidade e trigger — nas onze tabelas
-- ---------------------------------------------------------------------------
-- A RETROATIVIDADE é migration de DADOS, não de esquema. Roda uma vez e é
-- difícil de desfazer. A ordem é `created_at`, e o ano é o de criação: um livro
-- que começa no meio obriga a explicar para sempre por que metade dos registros
-- não tem número.
--
-- `lancamento_financeiro` e `item_locado` ficam DE FORA de propósito:
--   - lançamento é linha de conta a pagar, não documento que circula;
--   - a retirada ganha número na fase 1, como `recebimento` — numerar
--     `item_locado` agora daria dois números ao mesmo evento.
do $$
declare
  t record;
  v_sql text;
begin
  for t in
    select * from (values
      ('contrato_locacao'),
      ('contrato_imovel'),
      ('movimentacao'),
      ('vistoria'),
      ('vistoria_imovel'),
      ('avaria'),
      ('reparo_imovel'),
      ('medida_disciplinar'),
      ('entrega_ocupante'),
      ('checklist_limpeza'),
      ('ocorrencia_imovel')
    ) as x(tabela)
  loop
    -- 1) a coluna
    execute format(
      'alter table public.%I add column if not exists numero_registro text',
      t.tabela
    );

    -- 2) retroatividade: numera o que já existe, na ordem de criação, dentro do
    --    ano de criação. Idempotente pelo `where numero_registro is null`.
    v_sql := format($f$
      with ordenados as (
        select
          id,
          org_id,
          extract(year from (created_at at time zone 'America/Sao_Paulo'))::int as ano,
          row_number() over (
            partition by org_id,
              extract(year from (created_at at time zone 'America/Sao_Paulo'))::int
            order by created_at, id
          ) as seq
          from public.%I
         where numero_registro is null
      ),
      gravados as (
        update public.%I alvo
           set numero_registro = format(
                 '%%s-%%s-%%s',
                 public.prefixo_registro(%L),
                 o.ano,
                 lpad(o.seq::text, 4, '0')
               )
          from ordenados o
         where alvo.id = o.id
        returning o.org_id, o.ano, o.seq
      )
      insert into public.numero_sequencia (org_id, tipo, ano, ultimo)
      select org_id, %L, ano, max(seq) from gravados group by org_id, ano
      on conflict (org_id, tipo, ano)
        do update set ultimo = greatest(
             public.numero_sequencia.ultimo, excluded.ultimo
           );
    $f$, t.tabela, t.tabela, t.tabela, t.tabela);
    execute v_sql;

    -- 3) unicidade por organização. O número é do livro da organização: dois
    --    registros com o mesmo número derrotam o propósito inteiro.
    execute format(
      'create unique index if not exists %I on public.%I (org_id, numero_registro)',
      'idx_' || t.tabela || '_numero_registro',
      t.tabela
    );

    -- 4) o trigger
    execute format(
      'drop trigger if exists trg_numero_registro on public.%I',
      t.tabela
    );
    execute format(
      'create trigger trg_numero_registro before insert on public.%I '
      'for each row execute function public.atribuir_numero_registro(%L)',
      t.tabela, t.tabela
    );

    raise notice 'numeracao aplicada -> %', t.tabela;
  end loop;
end $$;

notify pgrst, 'reload schema';
