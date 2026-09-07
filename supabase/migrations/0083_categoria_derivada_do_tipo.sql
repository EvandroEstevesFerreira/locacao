-- ============================================================================
-- A categoria do item passa a ser DERIVADA do tipo — e o trilho respeita `ordem`
-- ============================================================================
--
-- O DEFEITO, medido. O modelo "Dell Optiplex 380" tinha `tipo_id` = DESKTOP
-- (que pertence a TI) e `categoria_id` NULO. Na tela de Itens ele aparecia
-- agrupado sob DESKTOP na lista E contado em "Sem categoria" no trilho: o mesmo
-- item em dois lugares que se contradizem, e por isso TI mostrava 26 modelos
-- num catálogo de 27.
--
-- A CAUSA NÃO É DIGITAÇÃO, É ESTRUTURAL. Todo tipo pertence a exatamente uma
-- categoria, então `item_catalogo.categoria_id` é redundante desde que o nível
-- TIPO nasceu (migration 0069) — e o que é redundante diverge. O formulário do
-- item nem pergunta a categoria: ele oferece "TI › DESKTOP" e grava só o tipo.
-- Quem preenchia `categoria_id` era o importador, e o que ele não tocou ficou
-- para trás.
--
-- Com a planilha de coleta chegando e dezenas de cadastros novos, isso divergia
-- mais. Derivar fecha a porta.
--
-- POR QUE A COLUNA NÃO É SIMPLESMENTE APAGADA: `item_catalogo.tipo_id` é
-- NULÁVEL e permanentemente — um modelo pode existir antes de alguém decidir
-- seu tipo, e isso é o cadastro rápido que a obra faz com o caminhão no portão.
-- Esse item precisa de um lugar para guardar a categoria, e é esta coluna.

-- ---------------------------------------------------------------------------
-- 1. Alinhar o que já está gravado
-- ---------------------------------------------------------------------------
update public.item_catalogo i
   set categoria_id = t.categoria_id
  from public.tipo_equipamento t
 where t.id = i.tipo_id
   and i.categoria_id is distinct from t.categoria_id;

-- ---------------------------------------------------------------------------
-- 2. A derivação, no banco
-- ---------------------------------------------------------------------------
-- POR QUE TRIGGER E NÃO CÓDIGO DA ACTION. Escrevem em `item_catalogo` a action
-- do formulário, o importador de inventário e o que vier depois de a planilha
-- de coleta voltar. Se a regra morasse na action, bastaria um caminho novo
-- esquecer a linha para a divergência voltar — que é exatamente como ela
-- nasceu.
--
-- Deriva em silêncio, sem `raise`: não há disputa a resolver. A tela não
-- oferece a categoria, então um valor discordante que chegue aqui veio de
-- script ou de SQL à mão, e o tipo é a fonte mais específica das duas.
--
-- Item SEM tipo mantém a categoria que tiver: o `if` protege o cadastro rápido.
create or replace function public.categoria_do_tipo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo_id is not null then
    select t.categoria_id into new.categoria_id
      from public.tipo_equipamento t
     where t.id = new.tipo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_categoria_do_tipo on public.item_catalogo;
create trigger trg_categoria_do_tipo
  before insert or update of tipo_id, categoria_id on public.item_catalogo
  for each row execute function public.categoria_do_tipo();

-- O outro lado do mesmo acordo: mover um TIPO de categoria (NOTEBOOK saindo de
-- TI para Escritório) deixaria todos os modelos dele apontando para a categoria
-- antiga. O trigger acima só olha a linha do item, e ninguém toca no item nessa
-- operação.
create or replace function public.categoria_dos_itens_do_tipo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.item_catalogo
     set categoria_id = new.categoria_id
   where tipo_id = new.id
     and categoria_id is distinct from new.categoria_id;
  return new;
end;
$$;

drop trigger if exists trg_categoria_dos_itens on public.tipo_equipamento;
create trigger trg_categoria_dos_itens
  after update of categoria_id on public.tipo_equipamento
  for each row
  when (old.categoria_id is distinct from new.categoria_id)
  execute function public.categoria_dos_itens_do_tipo();

-- ---------------------------------------------------------------------------
-- 3. `categoria_resumo` ganha `ordem`
-- ---------------------------------------------------------------------------
-- O trilho da tela de Itens ordenava por NOME, e a view nem expunha `ordem` —
-- então a coluna que existe desde sempre não fazia nada ali. A lista da Frota
-- já ordena por `ordem, nome` (src/lib/data/frota.ts), e as duas telas
-- mostravam as mesmas categorias em ordens diferentes.
--
-- Isso importa porque `ordem` carrega intenção: TI é 80 e fica por último de
-- propósito — é a única categoria que não é de obra. Alfabeticamente ela caía
-- no fim por acaso, e a primeira categoria nova começando com U, V ou Z
-- desfaria o acaso.
--
-- `security_invoker = on` continua obrigatório: sem ele a view roda como DONO,
-- ignora RLS e devolve as linhas de todas as organizações (incidente da
-- 0.49.1). `src/lib/migrations-seguranca.test.ts` reprova quem esquecer.
-- `drop` e não `create or replace`: `ordem` entra ANTES de `modelos`, e o
-- Postgres recusa reordenar coluna de view existente ("cannot change name of
-- view column"). Podia-se acrescentar `ordem` no fim para escapar do drop — mas
-- aí a ordem das colunas contradiria a leitura, e a view é lida por gente.
drop view if exists public.categoria_resumo;
create view public.categoria_resumo
with (security_invoker = on) as
select
  c.id                                            as categoria_id,
  c.org_id,
  c.nome,
  c.ordem,
  count(distinct i.id)                            as modelos,
  count(u.id)                                     as pecas,
  count(*) filter (where u.situacao = 'em_uso')   as em_uso
from public.categoria_equipamento c
left join public.item_catalogo i on i.categoria_id = c.id
left join public.equipamento_unidade u on u.item_id = i.id
group by c.id, c.org_id, c.nome, c.ordem;

comment on view public.categoria_resumo is
  'Totais por categoria para o trilho da tela de Itens. Ordene por (ordem, nome). security_invoker = on: respeita a RLS de quem consulta.';

-- ---------------------------------------------------------------------------
-- 4. A conferência
-- ---------------------------------------------------------------------------
do $$
declare
  v_divergentes int;
begin
  select count(*) into v_divergentes
  from public.item_catalogo i
  join public.tipo_equipamento t on t.id = i.tipo_id
  where i.categoria_id is distinct from t.categoria_id;

  if v_divergentes > 0 then
    raise exception 'Sobraram % item(ns) com categoria diferente da do tipo.', v_divergentes;
  end if;
end $$;

notify pgrst, 'reload schema';
