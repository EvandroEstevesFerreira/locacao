-- ============================================================================
-- Contração: as colunas com a unidade no nome saem
-- ============================================================================
--
-- Segunda metade do expande-e-contrai começado na 0087. Aquela acrescentou
-- `intervalo_manutencao` + `unidade_medidor` + `tem_medidor` e instalou dois
-- triggers de ponte, para que a produção no ar — que ainda lia
-- `intervalo_manutencao_h` e `tem_horimetro` — continuasse funcionando até o
-- deploy seguinte.
--
-- O deploy aconteceu. A ponte cumpriu o papel e agora atrapalha: enquanto os
-- triggers existirem, gravar um intervalo em `km` continua zerando uma coluna
-- que ninguém lê mais, e todo INSERT em `equipamento_unidade` paga um trigger
-- para sincronizar um booleano morto.
--
-- ┌─ NÃO RODE ESTA MIGRATION ANTES DO DEPLOY QUE MIGRA O CÓDIGO ─────────────┐
-- │ O `do $$` abaixo não tem como conferir qual versão está no ar, então a    │
-- │ conferência é humana: a v0.81.0 precisa estar publicada e respondendo.    │
-- │ Rodar antes derruba a tela de Configurações e o relatório de uso.         │
-- └──────────────────────────────────────────────────────────────────────────┘

-- ---------------------------------------------------------------------------
-- 1. A última conferência antes de perder o dado
-- ---------------------------------------------------------------------------
-- Depois do `drop column` não há como reconstruir a coluna antiga a não ser
-- pelo backup. Se as duas formas divergirem aqui, é porque a ponte falhou em
-- algum caminho de escrita — e nesse caso é melhor abortar e olhar.
-- O `if` externo é o que faz esta migration poder rodar duas vezes: a
-- conferência lê justamente as colunas que ela derruba logo abaixo, e sem a
-- guarda a SEGUNDA execução quebraria em "column does not exist" — num arquivo
-- cujo trabalho já estava feito.
do $$
declare
  v_intervalo int;
  v_medidor   int;
  v_tem_antigas boolean;
begin
  select count(*) = 2 into v_tem_antigas
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'tipo_equipamento'    and column_name = 'intervalo_manutencao_h')
      or (table_name = 'equipamento_unidade' and column_name = 'tem_horimetro'));

  if not v_tem_antigas then
    raise notice 'Colunas antigas ja removidas; nada a conferir.';
    return;
  end if;

  execute $q$
    select count(*) from public.tipo_equipamento
    where (unidade_medidor = 'h'
           and intervalo_manutencao is distinct from intervalo_manutencao_h)
       or (unidade_medidor = 'km' and intervalo_manutencao_h is not null)
       or (unidade_medidor is null and intervalo_manutencao_h is not null)
  $q$ into v_intervalo;

  execute $q$
    select count(*) from public.equipamento_unidade
    where tem_medidor is distinct from tem_horimetro
  $q$ into v_medidor;

  if v_intervalo > 0 or v_medidor > 0 then
    raise exception
      'A ponte deixou % tipo(s) e % peca(s) em desacordo. Nao contraia com divergencia.',
      v_intervalo, v_medidor;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Os triggers de ponte saem primeiro
-- ---------------------------------------------------------------------------
-- Antes das colunas: um trigger que referencia coluna derrubada aborta todo
-- INSERT na tabela, e o erro apareceria como "não foi possível salvar o tipo"
-- sem dizer por quê.
drop trigger  if exists trg_sincronizar_medidor     on public.tipo_equipamento;
drop trigger  if exists trg_sincronizar_tem_medidor on public.equipamento_unidade;
drop function if exists public.sincronizar_medidor();
drop function if exists public.sincronizar_tem_medidor();

-- ---------------------------------------------------------------------------
-- 3. As colunas com a unidade no nome
-- ---------------------------------------------------------------------------
alter table public.tipo_equipamento   drop column if exists intervalo_manutencao_h;
alter table public.equipamento_unidade drop column if exists tem_horimetro;

-- ---------------------------------------------------------------------------
-- 4. O que restou
-- ---------------------------------------------------------------------------
do $$
declare
  v_sobrou int;
begin
  select count(*) into v_sobrou
  from information_schema.columns
  where table_schema = 'public'
    and ((table_name = 'tipo_equipamento'    and column_name = 'intervalo_manutencao_h')
      or (table_name = 'equipamento_unidade' and column_name = 'tem_horimetro'));

  if v_sobrou > 0 then
    raise exception 'Sobraram % coluna(s) com a unidade no nome.', v_sobrou;
  end if;
end $$;

notify pgrst, 'reload schema';
