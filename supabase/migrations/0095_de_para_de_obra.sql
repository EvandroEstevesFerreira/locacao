-- ============================================================================
-- O de-para entre o centro de resultado do People e a obra do Loca
--
-- Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
--
-- Medido contra a API real em 07/09/2026, com as 483 pessoas em mãos: OS
-- CÓDIGOS SÃO OS MESMOS. O People manda o código do centro de resultado
-- ("605", "691") e a obra do Loca já usa exatamente esse número, com o mesmo
-- nome nas sete.
--
--   CR do People              obra do Loca                          pessoas
--   605 Unimed Maceió         605 Unimed Maceió                        133
--   608 Racional Dante        608 Racional Dante                        83
--   659 Unimed Contagem       659 Unimed Contagem                       91
--   680 Equinix SP4           680 Equinix SP4 - Anel Enterrado          50
--   686 CPQ03                 686 CPQ03 - Manutenção                    13
--   691 Racional Garoa        691 Racional Garoa                        35
--   800 Administração         800 Administração                         17
--                                                             total    422
--
-- ┌─ O 800 TEM CORRESPONDENTE, ao contrário do que o People supôs ───────────┐
-- │ O documento deles lista o 800 entre os "centros administrativos que não  │
-- │ têm obra correspondente e devem ficar com obra_id nulo". Têm sim: a obra │
-- │ 800 "Administração" existe no Loca e é onde estão os notebooks da sede.  │
-- │ Sem esta linha, 17 pessoas iriam para o nulo à toa.                      │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- FICAM DE FORA, com `obra_id` nulo, 61 pessoas: Elea (685, 697), Equinix SP6
-- (702), os administrativos 801 a 807, e 5 sem centro de resultado nenhum.
-- Nulo é o comportamento desenhado — chutar por semelhança de nome colocaria
-- equipamento na obra errada, e o erro só apareceria numa cobrança.
--
-- A obra 695 do Loca (Equinix SP4 - Substituição de Tanques) não tem CR no
-- People e continua sem código: ninguém vem de lá.
-- ============================================================================

-- `= codigo` e não sete literais: a igualdade é o fato medido, e escrever o
-- número duas vezes é como um deles fica para trás numa correção futura.
-- `is null` para não pisar em de-para que alguém já tenha ajustado à mão.
update public.obra
   set codigo_people = codigo,
       updated_at    = now()
 where codigo in ('605', '608', '659', '680', '686', '691', '800')
   and codigo_people is null;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
do $$
declare
  v_mapeadas int;
begin
  select count(*) into v_mapeadas
  from public.obra
  where codigo_people is not null;

  if v_mapeadas < 7 then
    raise exception
      'Esperava ao menos 7 obras com codigo_people; encontrei %.', v_mapeadas;
  end if;

  raise notice '% obra(s) com de-para do People.', v_mapeadas;
end $$;

notify pgrst, 'reload schema';
