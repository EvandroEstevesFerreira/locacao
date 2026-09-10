/**
 * As janelas de data que a rota de contas a pagar do Mega aceita.
 *
 * O ERP RECUSA CONSULTA COM MAIS DE 2 ANOS ENTRE AS DATAS, com esta mensagem:
 *
 *   "O intervalo máximo permitido entre as datas é 2 ano. Informado a data
 *    inicial 01/01/2025 e data final 31/12/2027"
 *
 * Medido em 10/09/2026, contra produção — as 37 consultas da primeira rodada
 * voltaram todas recusadas, e a mensagem só apareceu quando o erro passou a
 * carregar o corpo da resposta em vez de "o Mega recusou".
 *
 * Nada disso está na documentação do ERP.
 */

/** O que o Mega aceita entre data inicial e final. */
export const LIMITE_ANOS_MEGA = 2;

export type Janela = { inicio: string; fim: string };

/**
 * Do 1º de janeiro do ano passado ao 31 de dezembro do ano que vem, partido em
 * janelas que o Mega aceite.
 *
 * O HORIZONTE É LARGO PORQUE LOCAÇÃO É PLURIANUAL — o contrato 1726 tem
 * parcelas vencendo em 2027. Estreitar não economizaria chamada nenhuma; só
 * abriria buraco no espelho.
 *
 * São duas janelas, e portanto duas chamadas por fornecedor: 74 na rodada
 * inteira. Alargar o horizonte custa mais uma chamada por fornecedor por ano
 * acrescentado — contra uma conta de API que já foi bloqueada uma vez.
 */
export function janelasDeConsulta(hojeISO: string): Janela[] {
  const ano = Number(hojeISO.slice(0, 4));
  return [
    // Dois anos cheios: o passado e o corrente.
    { inicio: `${ano - 1}-01-01`, fim: `${ano}-12-31` },
    // O que ainda vai vencer. Emenda no dia seguinte, sem pular data.
    { inicio: `${ano + 1}-01-01`, fim: `${ano + 1}-12-31` },
  ];
}
