-- ============================================================================
-- custodia_peca.detentor_rotulo — o nome de quem ficou, congelado na posse
--
-- O QUE ESTAVA ERRADO
-- ----------------------------------------------------------------------------
-- O rótulo do detentor vinha de um embed (`obra:obra_id(codigo, nome)`) em
-- `src/lib/data/custodia.ts`, e embed do PostgREST RESPEITA A RLS DA TABELA
-- EMBUTIDA. A policy `obra_select` libera tudo só para master/administrador;
-- os demais papéis veem apenas as obras de que são membros, e NUNCA obra com
-- `deleted_at`.
--
-- Dois efeitos, os dois silenciosos:
--
-- 1) para um gestor ou operador que não é membro da obra, o nome voltava
--    `null` e a tela imprimia "Obra não identificada" — texto que o teste
--    documenta como significando "vínculo apagado". O usuário concluía que a
--    obra foi excluída;
--
-- 2) `soft_delete` de uma obra apagava o nome dela de TODO o histórico, para
--    TODO MUNDO. Num livro somente-inclusão isso derrota o propósito: a linha
--    sobrevive, a informação não.
--
-- POR QUE UMA COLUNA, E NÃO UMA LEITURA MAIS ESPERTA
-- ----------------------------------------------------------------------------
-- O rótulo é dado DO MOMENTO DA POSSE, não do vínculo atual. "A betoneira
-- ficou dois meses na 412 — Residencial Aurora" continua verdade depois de a
-- obra ser encerrada, renomeada ou excluída. Ler o nome do vínculo vivo é
-- perguntar o presente para responder o passado.
--
-- As três FK continuam existindo e continuam `on delete set null`: elas são o
-- vínculo, para quem pode navegá-lo. A coluna é a memória, para quem só quer
-- ler o livro.
--
-- ANULÁVEL, E AS POSSES EXISTENTES FICAM SEM ELA
-- ----------------------------------------------------------------------------
-- Sem `not null` e sem backfill: hoje há ZERO posses em produção, então não há
-- o que preencher, e o rótulo é conveniência — a posse é o fato. A leitura
-- prefere o snapshot e cai no vínculo vivo quando ele é nulo
-- (`descreverDetentor` em `src/lib/custodia.ts`), então linha antiga continua
-- legível. Para `tipo = 'almoxarifado'` a coluna é nula DE PROPÓSITO: o rótulo
-- é constante e mora na aplicação.
--
-- A guarda de imutabilidade NÃO muda: ela compara
-- `to_jsonb(new) - 'fim' - 'updated_at'`, sem listar colunas, então a coluna
-- nova nasce protegida. Foi escrita assim para isto.
-- ============================================================================

alter table public.custodia_peca
  add column if not exists detentor_rotulo text;

comment on column public.custodia_peca.detentor_rotulo is
  'Nome do detentor no momento da posse (obra: "CODIGO — Nome"; funcionário/fornecedor: nome; almoxarifado: nulo). Escrito só por abrirCustodia em src/lib/custodia-servidor.ts. Existe porque embed respeita a RLS da tabela embutida e soft_delete apagaria o nome de todo o histórico.';
