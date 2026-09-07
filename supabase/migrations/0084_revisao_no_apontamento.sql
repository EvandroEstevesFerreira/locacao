-- ============================================================================
-- A revisão marca a leitura em que foi feita
-- ============================================================================
--
-- O DEFEITO. `horasAteRevisao(leituraAtual, intervalo, leituraUltimaRevisao)`
-- foi escrita certa e testada — e os DOIS lugares que a chamam passam **zero**
-- no terceiro argumento, porque não havia de onde tirar o número.
--
-- Com zero, a conta vira `intervalo - leituraAtual`. Um gerador de intervalo
-- 250 h com o horímetro em 1.200 aparece como "revisão vencida em 950 h" — e
-- continua assim depois da revisão, e da seguinte, e da seguinte. A tela grita
-- para sempre, e um alarme que sempre grita é um alarme que ninguém lê.
--
-- Pior: a máquina recém-cadastrada com horímetro usado nasce vencida. Toda
-- PTA e todo gerador que a planilha de coleta trouxer entrariam no sistema já
-- em vermelho.
--
-- A CORREÇÃO NÃO É GUARDAR A LEITURA DA REVISÃO. É contar HORAS.
--
-- Guardar "a revisão foi feita na leitura 1.000" quebra na troca de horímetro:
-- o mostrador novo começa em zero, e 1.000 passa a ser um número de outra
-- escala. A coluna `horas` já existe, já é calculada pelo trigger e já trata a
-- troca (período com `reiniciado` conta zero). Somar `horas` desde a última
-- revisão é exato e sobrevive à troca — sem coluna nova de leitura, sem
-- conversão, sem caso especial.
--
-- Então o que falta é só a MARCA: em qual apontamento a revisão foi feita.
--
-- POR QUE NO APONTAMENTO E NÃO NA ORDEM DE REPARO. Troca de óleo preventiva
-- quase nunca abre OS — é o mecânico da obra, numa manhã. Amarrar a revisão à
-- `reparo_equipamento` faria o sistema só enxergar a manutenção que já deu
-- problema, que é justamente a que a preventiva existe para evitar. E quem faz
-- a revisão já lê o horímetro: marcar uma caixa na leitura que ele ia lançar de
-- qualquer jeito é o menor atrito possível.
--
-- Espelha `reiniciado`, que já vive nesta tabela pelo mesmo motivo: são fatos
-- sobre AQUELA leitura, não sobre a peça.

alter table public.apontamento_uso
  add column if not exists revisao boolean not null default false;

comment on column public.apontamento_uso.revisao is
  'A revisao preventiva foi feita nesta leitura. Zera a contagem: horas ate a proxima = intervalo - soma de `horas` dos apontamentos POSTERIORES a este.';

-- O índice serve à pergunta "qual foi a última revisão desta peça", que a tela
-- da peça e o relatório de uso fazem para cada linha.
create index if not exists idx_apontamento_revisao
  on public.apontamento_uso (unidade_id, data desc)
  where revisao;

notify pgrst, 'reload schema';
