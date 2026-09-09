-- ============================================================================
-- Uma peça, um contrato em aberto
-- ============================================================================
--
-- O DEFEITO POSSÍVEL. A migration 0049 criou `item_locado.unidade_id` com
-- índice COMUM (`idx_item_locado_unidade`), não único. Nada impedia a mesma peça
-- de constar em duas linhas em aberto, em contratos diferentes — e o Loca
-- passaria a ter duas respostas para "de quem é este equipamento", as duas
-- plausíveis. Divergência sobre isso aparece como cobrança errada.
--
-- POR QUE AGORA, e não no spec que criou o `fornecedor_provisorio_id`.
--
-- O spec (2026-09-09-dono-da-peca-locada-design.md) deixou este índice de fora
-- de propósito, porque migration que falha ao aplicar é pior que o defeito que
-- previne, e não se sabia se produção já violava a regra. Medido em 2026-09-09,
-- antes de aplicar:
--
--   linhas_amarradas        = 0
--   pecas_em_dois_contratos = 0
--
-- Nenhuma peça está amarrada a contrato ainda. Este é o momento MAIS BARATO que
-- este índice jamais terá: depois do mutirão de amarração das 27 peças locadas,
-- qualquer violação criada no caminho viraria trabalho de limpeza antes de poder
-- aplicá-lo.
--
-- O QUE MUDA NO COMPORTAMENTO. Tentar amarrar uma peça a uma segunda linha em
-- aberto passa a falhar no banco em vez de gravar. `amarrarPecaAoContrato` já
-- solta a linha anterior antes de amarrar a nova, então o caminho normal não
-- encosta nesta trava; quem encosta é o recebimento, e ali a violação de
-- unicidade vira "Já existe um item do contrato com esses dados" via
-- `erroDeEscrita` — mensagem que manda conferir, e não um estado ambíguo calado.
--
-- `donoDaPeca()` mantém o caso `ambiguo` mesmo assim. Ele fica inalcançável por
-- construção, e é isso que se quer: a tela continua sabendo dizer a verdade se
-- o dado aparecer por um caminho que ninguém previu — importação, script, ou
-- este índice sendo removido no futuro.
-- ============================================================================

create unique index if not exists idx_item_locado_uma_peca_em_aberto
  on public.item_locado (unidade_id)
  where unidade_id is not null and status = 'em_aberto';

notify pgrst, 'reload schema';
