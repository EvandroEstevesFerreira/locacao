-- ============================================================================
-- O dono PROVISÓRIO da peça locada
-- ============================================================================
--
-- A relação peça↔contrato já existe desde a 0049: `item_locado.unidade_id`
-- aponta para a peça física, e `contrato_locacao.fornecedor_id` para a empresa
-- locadora. A empresa dona, portanto, é DERIVADA — e não há campo de fornecedor
-- na peça que possa divergir do contrato.
--
-- O QUE ESTA COLUNA RESOLVE. As peças que entraram pela planilha de coleta não
-- têm contrato no Loca: a tela mostra "Locada de terceiro" e o dono real vive em
-- texto livre nas observações ("ALUGADA — ainda sem contrato de locação no Loca
-- · Com: Leonardo Apolinario (conforme planilha)"). Derivar do contrato não
-- resolve o presente enquanto o contrato não existir.
--
-- POR QUE O NOME É `fornecedor_provisorio_id` E NÃO `fornecedor_id`.
--
-- Quem ler este schema em seis meses precisa saber, PELO NOME, que aquilo não é
-- a verdade sobre o dono do equipamento — é o que alguém digitou enquanto a
-- verdade não existia. `fornecedor_id` convidaria a tratá-lo como autoritativo
-- e a construir relatório de custo em cima dele, ao lado do contrato, com os
-- dois divergindo em silêncio. A precedência é do contrato, sempre, e está em
-- `donoDaPeca()` (src/lib/frota.ts) com teste.
--
-- Ao amarrar a peça a um contrato, a aplicação LIMPA esta coluna e diz na
-- mensagem se ela divergia. Deixá-la viva ao lado do contrato recriaria as duas
-- fontes; limpá-la em silêncio seria decidir por quem cadastrou.
--
-- NÃO ENTRA AQUI, de propósito: o índice único parcial
-- `unique (unidade_id) where status = 'em_aberto'` em `item_locado`. Ele
-- impediria a mesma peça de constar em dois contratos em aberto — situação que
-- o banco hoje permite, porque a 0049 criou índice comum e não único. Fica fora
-- porque não se sabe se os dados de produção já a violam, e migration que falha
-- ao aplicar é pior que o defeito que previne. Enquanto isso, `donoDaPeca()`
-- devolve `ambiguo` e a tela mostra os dois contratos em vez de escolher um.
-- ============================================================================

alter table public.equipamento_unidade
  add column if not exists fornecedor_provisorio_id uuid
    references public.fornecedor (id) on delete set null;

comment on column public.equipamento_unidade.fornecedor_provisorio_id is
  'Dono informado A MAO, valido so enquanto a peca nao esta amarrada a um contrato. O contrato manda: ver donoDaPeca() em src/lib/frota.ts. Nao usar em relatorio de custo.';

create index if not exists idx_unidade_fornecedor_provisorio
  on public.equipamento_unidade (fornecedor_provisorio_id)
  where fornecedor_provisorio_id is not null;

notify pgrst, 'reload schema';
