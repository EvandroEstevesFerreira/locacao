-- ============================================================================
-- A ficha da peça, definida pelo tipo — fase B
-- (docs/superpowers/specs/2026-09-05-catalogo-quatro-niveis-design.md)
--
-- O pedido era configuração em CAMPOS ESTRUTURADOS, para poder perguntar "quais
-- notebooks têm menos de 8 GB para trocar este ano". Mas `memória` e `disco`
-- NÃO EXISTEM num andaime: colunas em `equipamento_unidade` encheriam de nulo
-- toda betoneira e escora do sistema, e cada tipo novo pediria uma migration.
--
-- Por isso o TIPO define quais campos suas peças têm (`campos_ficha`, criada na
-- 0069) e a peça guarda os valores aqui. Filtrar continua funcionando — o
-- Postgres indexa e consulta jsonb.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ficha
-- ---------------------------------------------------------------------------
-- Objeto chato: { "memoria": 8, "disco": 256, "disco_tipo": "SSD" }. As chaves
-- vêm de `tipo_equipamento.campos_ficha`; os valores, do formulário da peça.
--
-- `not null default '{}'` e não nulável: `ficha->>'memoria'` sobre NULL devolve
-- NULL em vez de erro, então uma peça sem ficha se comportaria como uma peça
-- com ficha vazia em toda consulta — e a diferença entre "não preenchi" e "não
-- se aplica" precisa vir do TIPO, não da ausência da linha.
alter table public.equipamento_unidade
  add column if not exists ficha jsonb not null default '{}'::jsonb;

comment on column public.equipamento_unidade.ficha is
  'Valores dos campos definidos em tipo_equipamento.campos_ficha do tipo do item. Objeto chato, chave = campo.chave.';

-- Índice GIN para as consultas por conteúdo — "quais peças têm disco_tipo HDD".
-- `jsonb_path_ops` em vez do padrão: metade do tamanho e mais rápido para o
-- operador `@>`, que é o único que estas buscas usam. Ele não serve para
-- existência de chave (`?`), e é uma troca consciente: ninguém pergunta "quais
-- peças TÊM o campo memória" — pergunta-se pelo valor.
create index if not exists idx_equip_unidade_ficha
  on public.equipamento_unidade using gin (ficha jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- A forma de `campos_ficha`
-- ---------------------------------------------------------------------------
-- Um array de objetos:
--
--   [{ "chave": "memoria", "rotulo": "Memória", "tipo": "numero",
--      "unidade": "GB", "opcoes": [] }]
--
-- A validação de FORMA fica no zod (`src/lib/catalogo.ts`), que é onde a
-- mensagem de erro pode ser escrita para quem preenche. O check aqui garante só
-- o que o zod não alcança: que ninguém grave um objeto ou um número no lugar do
-- array, por SQL ou por uma action futura que esqueça de validar.
alter table public.tipo_equipamento
  drop constraint if exists tipo_campos_ficha_e_array;
alter table public.tipo_equipamento
  add constraint tipo_campos_ficha_e_array
  check (jsonb_typeof(campos_ficha) = 'array');

notify pgrst, 'reload schema';
