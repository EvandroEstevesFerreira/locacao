-- ============================================================================
-- As chaves de uma letra que a tela gravou
--
-- `ficha-editor.tsx` derivava a chave do rótulo só enquanto `campo.chave === ""`.
-- Na PRIMEIRA tecla a chave virava "m" e deixava de ser vazia, então as letras
-- seguintes não realimentavam mais. Toda chave criada pela tela ficou sendo a
-- primeira letra do rótulo.
--
-- Não é cosmético: dois rótulos com a mesma inicial produzem a mesma chave, e
-- `camposFichaSchema` recusa o salvamento com "Há dois campos com a mesma
-- chave" — uma chave que o usuário nunca digitou.
--
-- O tipo DESKTOP é o único afetado hoje: `m`, `p`, `a`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Antes de mexer: nenhuma peça pode ter ficha preenchida sob essas chaves
-- ---------------------------------------------------------------------------
-- Renomear a chave no TIPO sem renomear dentro das FICHAS já preenchidas
-- orfanaria os valores: `ficha->>'memoria_ram'` devolveria nulo em toda peça
-- antiga, sem erro nenhum. Este roteiro não faz essa segunda parte, então
-- prefere abortar a fazer metade.
do $$
declare
  v_pecas int;
begin
  select count(*) into v_pecas
  from public.equipamento_unidade u
  join public.item_catalogo i on i.id = u.item_id
  join public.tipo_equipamento t on t.id = i.tipo_id
  where u.ficha <> '{}'::jsonb
    and exists (
      select 1 from jsonb_array_elements(t.campos_ficha) c
      where length(c->>'chave') = 1
    );

  if v_pecas > 0 then
    raise exception
      'Ha % peca(s) com ficha preenchida sob chave de uma letra. Renomeie as chaves DENTRO das fichas na mesma transacao antes de rodar isto.',
      v_pecas;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A reescrita
-- ---------------------------------------------------------------------------
-- Casada em (chave, rótulo) e não no nome do tipo: o par é o que identifica o
-- defeito sem depender de como alguém batizou o tipo.
--
-- `with ordinality` preserva a ORDEM dos campos. Sem ele, `jsonb_agg` sobre
-- `jsonb_array_elements` não garante ordem, e a ficha voltaria embaralhada —
-- o que a tela mostra como campos fora de lugar, sem erro.
update public.tipo_equipamento t
set campos_ficha = (
  select coalesce(
    jsonb_agg(
      case
        when c->>'chave' = 'm' and c->>'rotulo' = 'Memória RAM'
          then jsonb_set(c, '{chave}', '"memoria_ram"')
        when c->>'chave' = 'p' and c->>'rotulo' = 'Processador'
          then jsonb_set(c, '{chave}', '"processador"')
        when c->>'chave' = 'a' and c->>'rotulo' = 'Armazenamento'
          then jsonb_set(c, '{chave}', '"armazenamento"')
        else c
      end
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(t.campos_ficha) with ordinality as e(c, ord)
)
where exists (
  select 1 from jsonb_array_elements(t.campos_ficha) c
  where c->>'chave' in ('m', 'p', 'a')
);

-- ---------------------------------------------------------------------------
-- Depois de mexer: não pode sobrar chave de uma letra
-- ---------------------------------------------------------------------------
-- Se sobrou, é um par (chave, rótulo) que eu não conhecia — e adivinhar o nome
-- certo dele aqui seria pior que parar.
do $$
declare
  v_sobrou text;
begin
  select string_agg(distinct t.nome || ': ' || (c->>'rotulo'), ', ') into v_sobrou
  from public.tipo_equipamento t,
       lateral jsonb_array_elements(t.campos_ficha) c
  where length(c->>'chave') = 1;

  if v_sobrou is not null then
    raise exception 'Sobraram chaves de uma letra: %', v_sobrou;
  end if;
end $$;

notify pgrst, 'reload schema';
