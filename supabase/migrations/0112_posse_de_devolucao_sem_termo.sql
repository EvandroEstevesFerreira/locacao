-- ============================================================================
-- v0.114.0 — A posse de devolução deixa de apontar para o termo da entrega
-- ============================================================================
--
-- `liberarPecas` abria a posse de almoxarifado carregando o `termo_id` do termo
-- que estava sendo ENCERRADO no mesmo instante. A posse nascia apontando para o
-- documento que diz o contrário dela.
--
-- Medido em 16/09/2026 sobre as 144 posses do banco: UMA posse de almoxarifado
-- com termo, e ela é a única anomalia existente — termo `encerrado` com posse
-- ainda aberta (peça 14L4594, TRM-2026-0040). O código foi corrigido junto
-- desta migration; aqui limpa-se o que ele já produziu.
--
-- A POSSE NÃO É APAGADA. A peça ESTÁ no almoxarifado, e isso é verdade. O que
-- sai é a amarração falsa.
--
-- POR CONDIÇÃO, NÃO POR ID LITERAL: id de linha não sobrevive a um restore, e a
-- condição descreve a anomalia em vez de apontar para uma linha específica. Se
-- não houver nenhuma, o UPDATE afeta zero linhas e a migration passa — que é o
-- comportamento certo para um banco já limpo.

update public.custodia_peca c
   set termo_id = null
  from public.termo_equipamento t
 where t.id = c.termo_id
   and c.tipo = 'almoxarifado'
   and c.fim is null;
