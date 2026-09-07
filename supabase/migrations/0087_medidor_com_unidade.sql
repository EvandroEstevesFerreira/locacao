-- ============================================================================
-- O medidor ganha unidade: horas OU quilômetros
-- ============================================================================
--
-- O PROBLEMA. `tipo_equipamento.intervalo_manutencao_h` tem a unidade no NOME —
-- e a frota de veículos revisa por quilometragem. Gravar 10.000 ali seria o
-- sistema afirmando "dez mil horas", e a conta de revisão sairia errada por um
-- fator de cem. `equipamento_unidade.tem_horimetro` tem o mesmo defeito: carro
-- não tem horímetro, tem hodômetro.
--
-- `apontamento_uso.leitura` já é genérica de propósito — "o número do
-- mostrador". Ela serve os dois sem mudar. O que falta é dizer QUAL mostrador.
--
-- POR QUE UMA COLUNA COM UNIDADE, E NÃO DUAS COLUNAS (`_h` e `_km`). Nenhum
-- equipamento tem os dois: gerador conta horas, carro conta quilômetros, e
-- nenhum conta ambos. Duas colunas nulas em alternância convidam a preencher as
-- duas, e aí a conta teria de escolher uma — em silêncio.
--
-- ┌─ ESTA MIGRATION É A FASE DE EXPANSÃO ─────────────────────────────────────┐
-- │ As colunas antigas FICAM. A produção no ar hoje (0.80.0) lê               │
-- │ `intervalo_manutencao_h` e `tem_horimetro` em 11 arquivos — derrubá-las   │
-- │ agora quebraria a tela de Configurações até o deploy seguinte.           │
-- │                                                                           │
-- │ Os triggers abaixo mantêm as duas formas em acordo enquanto as duas       │
-- │ versões do código convivem. A migration de CONTRAÇÃO, depois do deploy,   │
-- │ derruba triggers e colunas antigas.                                       │
-- └───────────────────────────────────────────────────────────────────────────┘

-- ---------------------------------------------------------------------------
-- 1. As colunas novas
-- ---------------------------------------------------------------------------
alter table public.tipo_equipamento
  add column if not exists intervalo_manutencao int,
  add column if not exists unidade_medidor      text;

alter table public.tipo_equipamento
  drop constraint if exists tipo_unidade_medidor_check;
alter table public.tipo_equipamento
  add constraint tipo_unidade_medidor_check
  check (unidade_medidor is null or unidade_medidor in ('h', 'km'));

-- Intervalo sem unidade é um número que ninguém sabe ler, e unidade sem
-- intervalo não manda em nada. Andam juntos ou não existem.
alter table public.tipo_equipamento
  drop constraint if exists tipo_intervalo_com_unidade;
alter table public.tipo_equipamento
  add constraint tipo_intervalo_com_unidade
  check (
    (intervalo_manutencao is null and unidade_medidor is null)
    or (intervalo_manutencao is not null and unidade_medidor is not null)
  );

alter table public.equipamento_unidade
  add column if not exists tem_medidor boolean not null default false;

comment on column public.tipo_equipamento.unidade_medidor is
  'h = horimetro (gerador, PTA), km = hodometro (veiculo). Diz como ler `apontamento_uso.leitura` e `intervalo_manutencao`.';

-- ---------------------------------------------------------------------------
-- 2. O que já está gravado
-- ---------------------------------------------------------------------------
-- Tudo que existe hoje é medido em horas: eram os únicos tipos com intervalo,
-- e todos são equipamento de canteiro.
update public.tipo_equipamento
   set intervalo_manutencao = intervalo_manutencao_h,
       unidade_medidor      = 'h'
 where intervalo_manutencao_h is not null
   and intervalo_manutencao is null;

update public.equipamento_unidade
   set tem_medidor = tem_horimetro
 where tem_medidor is distinct from tem_horimetro;

-- ---------------------------------------------------------------------------
-- 3. A ponte entre as duas formas, enquanto as duas versões convivem
-- ---------------------------------------------------------------------------
-- QUEM MUDOU VENCE. O código velho escreve `intervalo_manutencao_h`; o novo
-- escreve `intervalo_manutencao` + `unidade_medidor`. O trigger olha qual dos
-- dois lados mudou nesta linha e copia para o outro.
--
-- O CASO QUE IMPORTA: quando a unidade é `km`, `intervalo_manutencao_h` fica
-- NULO. Copiar 10.000 para uma coluna que diz horas faria o código velho
-- anunciar "revisão vencida" em toda a frota. Nulo é honesto — o código velho
-- mostra "sem intervalo definido", que é o que ele de fato sabe.
create or replace function public.sincronizar_medidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.intervalo_manutencao is null and new.intervalo_manutencao_h is not null then
      new.intervalo_manutencao := new.intervalo_manutencao_h;
      new.unidade_medidor      := 'h';
    elsif new.intervalo_manutencao is not null then
      new.intervalo_manutencao_h :=
        case when new.unidade_medidor = 'h' then new.intervalo_manutencao end;
    end if;
    return new;
  end if;

  if new.intervalo_manutencao_h is distinct from old.intervalo_manutencao_h then
    new.intervalo_manutencao := new.intervalo_manutencao_h;
    new.unidade_medidor      :=
      case when new.intervalo_manutencao_h is null then null else 'h' end;
  elsif new.intervalo_manutencao is distinct from old.intervalo_manutencao
     or new.unidade_medidor      is distinct from old.unidade_medidor then
    new.intervalo_manutencao_h :=
      case when new.unidade_medidor = 'h' then new.intervalo_manutencao end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_medidor on public.tipo_equipamento;
create trigger trg_sincronizar_medidor
  before insert or update on public.tipo_equipamento
  for each row execute function public.sincronizar_medidor();

create or replace function public.sincronizar_tem_medidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.tem_medidor is not true and new.tem_horimetro then
      new.tem_medidor := true;
    elsif new.tem_medidor and not new.tem_horimetro then
      new.tem_horimetro := true;
    end if;
    return new;
  end if;
  if new.tem_horimetro is distinct from old.tem_horimetro then
    new.tem_medidor := new.tem_horimetro;
  elsif new.tem_medidor is distinct from old.tem_medidor then
    new.tem_horimetro := new.tem_medidor;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sincronizar_tem_medidor on public.equipamento_unidade;
create trigger trg_sincronizar_tem_medidor
  before insert or update on public.equipamento_unidade
  for each row execute function public.sincronizar_tem_medidor();

-- ---------------------------------------------------------------------------
-- 4. Os tipos de veículo ganham o intervalo que a 0085 não pôde dar
-- ---------------------------------------------------------------------------
-- 10.000 km é o intervalo que os manuais de carro de passeio publicam. Se a
-- Sistenge pratica outro, é um campo na tela de Configurações.
--
-- Caminhão fica de fora: intervalo de pesado varia demais com o motor e o uso,
-- e chutar aqui produziria alarme errado em todos eles.
update public.tipo_equipamento t
   set intervalo_manutencao = 10000,
       unidade_medidor      = 'km'
  from public.categoria_equipamento c
 where c.id = t.categoria_id
   and c.nome = 'Veículos'
   and t.nome in ('CARRO', 'CAMINHONETE')
   and t.intervalo_manutencao is null;

-- ---------------------------------------------------------------------------
-- 5. A conferência
-- ---------------------------------------------------------------------------
do $$
declare
  v_divergentes int;
begin
  select count(*) into v_divergentes
  from public.tipo_equipamento
  where (unidade_medidor = 'h'
         and intervalo_manutencao is distinct from intervalo_manutencao_h)
     or (unidade_medidor = 'km' and intervalo_manutencao_h is not null)
     or (unidade_medidor is null and intervalo_manutencao_h is not null);

  if v_divergentes > 0 then
    raise exception 'Sobraram % tipo(s) com as duas formas em desacordo.', v_divergentes;
  end if;
end $$;

notify pgrst, 'reload schema';
