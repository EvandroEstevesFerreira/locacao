-- ============================================================================
-- v0.116.0 — Nenhuma posse de almoxarifado em aberto aponta para um termo
-- ============================================================================
--
-- A 0112 desamarrou a posse de devolução do termo da entrega, e corrigiu o
-- produtor que ela conhecia: `liberarPecas`. Faltou o outro, que é o mais
-- usado — `moverPecasDoTermo(id, 'devolucao')`, chamado por `encerrarTermo` e
-- por `cancelarTermo`. Ele continuou abrindo a posse de almoxarifado com o
-- `termo_id` do documento que acabara de receber `encerrado_em` (ou
-- `cancelado_em`), reproduzindo a anomalia 14L4594 / TRM-2026-0040 a cada
-- encerramento de termo sem devolução parcial registrada antes.
--
-- O código foi corrigido junto desta migration, e a varredura de
-- `src/lib/custodia-invariante.test.ts` passou a cobrar a INVARIANTE em vez de
-- uma função pelo nome: nenhuma chamada de `abrirCustodia` com
-- `tipo: 'almoxarifado'` carrega termo, em arquivo nenhum.
--
-- POR QUE A CONDIÇÃO É AMPLA, E NÃO SÓ "termo encerrado". A 0112 deixou de
-- fora `t.encerrado_em is not null`, e o comentário dela prometia esse recorte.
-- A condição ampla é a que está certa, e é decisão, não descuido: depois desta
-- correção NENHUM caminho cria posse aberta de almoxarifado com termo — nem a
-- devolução parcial, nem o encerramento, nem o cancelamento. Não existe mais a
-- categoria "posse legítima de almoxarifado amarrada a termo" que o recorte
-- preservaria. Só a ENTREGA amarra posse a termo, e entrega é posse de
-- funcionário, que esta condição não toca.
--
-- IDEMPOTENTE, e repete a 0112 de propósito: entre a aplicação daquela e o
-- deploy desta correção, todo termo encerrado criou uma linha nova. Em banco
-- já limpo o UPDATE afeta zero linhas e a migration passa.
--
-- A POSSE NÃO É APAGADA. A peça ESTÁ no almoxarifado, e isso é verdade. O que
-- sai é a amarração falsa.

update public.custodia_peca c
   set termo_id = null
 where c.tipo = 'almoxarifado'
   and c.fim is null
   and c.termo_id is not null;
