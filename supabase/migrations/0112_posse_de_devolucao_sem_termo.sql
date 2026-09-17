-- ============================================================================
-- v0.115.0 — A posse de devolução deixa de apontar para o termo da entrega
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
--
-- NOTA DA 0113: o `where` abaixo é mais amplo do que este cabeçalho prometia —
-- ele não exige `t.encerrado_em is not null`, e portanto desamarra TODA posse
-- de almoxarifado em aberto que tenha termo. A amplitude está certa, e a 0113
-- explica por quê: depois da correção de `moverPecasDoTermo`, nenhum caminho
-- cria essa amarração, então não há caso legítimo a preservar. Este arquivo não
-- foi reescrito porque migration aplicada não se edita; só este parágrafo foi
-- acrescentado.
--
-- CORREÇÃO DE 16/09/2026, NO MESMO DIA E ANTES DE QUALQUER DEPLOY: o UPDATE
-- abaixo ganhou o par disable/enable da trigger `trg_custodia_imutavel`, sem o
-- qual ele ABORTA em todo banco que tenha a anomalia — e abortar aqui derruba o
-- deploy antes de a 0113 chegar. O comentário do bloco, logo abaixo, explica
-- por que é seguro. Esta é a única alteração de SQL feita neste arquivo, e ela
-- foi feita porque a alternativa era um deploy que quebra de forma garantida.

-- ---------------------------------------------------------------------------
-- A TRIGGER DE IMUTABILIDADE PRECISA SAIR DA FRENTE, e só deste UPDATE
-- ---------------------------------------------------------------------------
-- `trg_custodia_imutavel` (0059) chama `guard_custodia_peca()`, que levanta
-- exceção em todo UPDATE cuja linha tenha `fim is null`:
--
--   if new.fim is null then
--     raise exception 'Nada a alterar: só o encerramento da posse pode ser
--     gravado.';
--
-- É exatamente o recorte desta limpeza — posse ABERTA — então sem isto a
-- migration ABORTA justamente no banco que tem a anomalia, e o deploy inteiro
-- falha. Em banco já limpo ela passaria por não casar nenhuma linha, o que faz
-- a falha aparecer só em produção.
--
-- POR QUE É SEGURO. O `disable` vale para esta transação e volta na linha
-- seguinte: se o UPDATE falhar, a transação da migration inteira desfaz, e a
-- trigger nunca fica desligada num banco vivo. O que a trigger protege é a
-- escrita da APLICAÇÃO, e a aplicação não passa por aqui — este arquivo roda
-- uma vez, com o papel dono do schema. A trigger de auditoria continua LIGADA:
-- a limpeza fica registrada como qualquer outra alteração.
--
-- E NÃO ABRE O LIVRO PARA EDIÇÃO COMUM. Nenhuma policy muda, `custodia_peca`
-- continua sem DELETE, e o único caminho de escrita da aplicação continua
-- sendo `src/lib/custodia-servidor.ts`.

alter table public.custodia_peca disable trigger trg_custodia_imutavel;

update public.custodia_peca c
   set termo_id = null
  from public.termo_equipamento t
 where t.id = c.termo_id
   and c.tipo = 'almoxarifado'
   and c.fim is null;

alter table public.custodia_peca enable trigger trg_custodia_imutavel;
