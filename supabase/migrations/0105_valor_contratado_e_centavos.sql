-- ============================================================================
-- O valor total do contrato, e as casas decimais que fazem a conta fechar
-- ============================================================================
--
-- MEDIDO NO CONTRATO 1726 (Locacao de Ar Condicionado, 5I Climatizacao), que e
-- um documento real:
--
--   2 x AR CONDICIONADO 12000BTU  @ R$ 156,667  = R$   313,33
--   7 x AR CONDICIONADO 18000BTU  @ R$ 246,457  = R$ 1.725,20
--   Valor mensal ........................ R$ 2.038,53
--   Prazo previsto: 16 meses
--   Valor total previsto ................ R$ 32.616,48
--
-- Duas coisas saem disso.
--
-- 1. O VALOR TOTAL E UM DADO DO DOCUMENTO, nao um derivado do cadastro. Sem ele
--    guardado, nada compara o que foi cadastrado com o que foi contratado:
--    cadastrar seis aparelhos onde o contrato preve sete passa em silencio, e o
--    contrato subfatura ate alguem conferir no papel.
--
-- 2. O VALOR UNITARIO TEM TRES CASAS. A coluna tinha duas, e o cadastro do 1726
--    ficou com 156,67 e 246,46 -- mensal de R$ 2.038,56 contra os R$ 2.038,53
--    do documento. Tres centavos por mes.
--
--    Em dinheiro nao e nada. Para a CONFERENCIA e fatal: com duas casas, todo
--    contrato divergiria por centavos, e um alarme que toca sempre e um alarme
--    que ninguem le. Com quatro casas, 156,667 x 2 + 246,457 x 7 = 2.038,533,
--    que arredonda para os 2.038,53 do documento. A conferencia passa a poder
--    ser exata.
-- ============================================================================

alter table public.contrato_locacao
  add column if not exists valor_total_contratado numeric(14, 2);

comment on column public.contrato_locacao.valor_total_contratado is
  'Valor total previsto NO DOCUMENTO do contrato. Digitado, nao calculado -- e a referencia contra a qual o cadastro e conferido. Nulo = contrato antigo, sem o numero do papel.';

-- Alargar a escala PRESERVA os valores existentes: 156.67 continua 156.67, e
-- passa a caber 156.6670. Nao ha perda nem migracao de dado.
alter table public.item_locado
  alter column valor_unitario_periodo type numeric(14, 4);

comment on column public.item_locado.valor_unitario_periodo is
  'Quatro casas decimais porque contrato de locacao usa tres (R$ 156,667 no 1726). Com duas, o total do cadastro divergia do documento por centavos e a conferencia acusava todo contrato.';

notify pgrst, 'reload schema';
