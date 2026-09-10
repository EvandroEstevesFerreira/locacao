-- ============================================================================
-- O código do fornecedor no Mega
--
-- O Mega é o ERP onde o contas a pagar vive, e cada fornecedor tem lá um código
-- numérico — `5I SERVICOS DE MANUTENCAO LTDA` é o 2630. Quem concilia uma nota
-- do Loca com o título no Mega hoje faz isso pelo nome, e nome de empresa é o
-- pior identificador que existe: muda de razão social, vem abreviado, vem com
-- acento em um lado e sem no outro.
--
-- `codigo_mega` E NÃO `codigo`, pelo mesmo motivo de `obra.codigo_people`
-- (migration 0094): quem ler este schema daqui a um ano precisa saber, PELO
-- NOME, de onde o número veio e quem manda nele. O Loca não gera este código —
-- ele é lido de outro sistema, e um dia pode divergir de lá.
--
-- TEXTO E NÃO INTEIRO. Ninguém soma código de fornecedor, e um dia o Mega pode
-- passar a emitir código com prefixo ou zero à esquerda. Guardar como número
-- transformaria "0042" em "42" no primeiro salvamento, em silêncio.
-- ============================================================================

alter table public.fornecedor
  add column if not exists codigo_mega text;

-- ---------------------------------------------------------------------------
-- Único por organização
-- ---------------------------------------------------------------------------
-- CÓDIGO QUE SE REPETE NÃO IDENTIFICA NADA, e este existe para identificar. É
-- diferente do CNPJ, que na 0043 apenas AVISA e deixa salvar: ali o duplicado
-- era decisão de quem cadastra, e havia caso real de precisar seguir.
--
-- Aqui não há caso: duas linhas apontando para o mesmo agente do Mega são a
-- mesma empresa cadastrada duas vezes, e a conciliação passaria a somar dois
-- fornecedores num só título.
--
-- O índice já nasce apontando um: `ARMASA COMERCIO E SERVICOS PARA PERFURACAO
-- LTDA` está duas vezes no Loca, com o mesmo CNPJ, e as duas casam com o código
-- 4114. A segunda fica sem código até alguém decidir qual linha vale — que é
-- exatamente o trabalho que este índice existe para provocar.
--
-- Parcial: fornecedor sem código é o caso normal enquanto o preenchimento não
-- termina, e nem todo fornecedor do Loca existe no Mega (medido em 10/09/2026:
-- 36 dos 38 existem; dois não têm cadastro lá).
create unique index if not exists idx_fornecedor_codigo_mega
  on public.fornecedor (org_id, codigo_mega)
  where codigo_mega is not null;

notify pgrst, 'reload schema';
