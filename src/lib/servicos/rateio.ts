// Rateio de serviço recorrente por cabeça atribuída — função pura.
//
// O rateio é CALCULADO, nunca gravado. Uma tabela de rateio congelado
// divergiria da atribuição no primeiro desligamento, e um custo mensal que
// diverge da lista de pessoas aparece como número que ninguém consegue
// explicar — nem quem o gerou.
//
// Por que por cabeça e não por percentual fixo: o percentual esconde a licença
// ociosa, distribuindo-a entre todos. Quando as 7 assinaturas que ninguém usa
// estão diluídas em seis centros de custo, elas não aparecem em lugar nenhum e
// ninguém jamais cancela assinatura. Aqui elas ficam numa linha própria, sem
// dono, que é o número em cima do qual alguém decide.

export type Atribuicao = {
  funcionarioId: string;
  /** `funcionario.obra_id` — nulável, porque nem todo funcionário tem lotação. */
  centroCustoId: string | null;
};

export type FatiaRateio = {
  centroCustoId: string | null;
  pessoas: number;
  centavos: number;
};

export type Rateio = {
  porCentroCusto: FatiaRateio[];
  ociosas: { quantidade: number; centavos: number };
  totalCentavos: number;
};

/**
 * Divide o custo do período entre os centros de custo das pessoas que ocupam
 * as licenças, e separa o que está ocioso.
 *
 * @param totalCentavos custo do contrato no período (quantidade x unitário)
 * @param quantidade licenças CONTRATADAS
 * @param atribuicoes as licenças em uso, uma linha por pessoa
 */
export function ratearPorCabeca(
  totalCentavos: number,
  quantidade: number,
  atribuicoes: Atribuicao[],
): Rateio {
  if (atribuicoes.length > quantidade) {
    // Erro de cadastro, não arredondamento — e lançar aqui é o que impede a
    // tela de mostrar um rateio que soma mais que o contrato.
    throw new Error(
      `Há ${atribuicoes.length} atribuições para ${quantidade} licenças contratadas.`,
    );
  }

  const ociosasQtd = quantidade - atribuicoes.length;

  // A unidade do rateio é o valor de UMA licença, e não o total dividido pelas
  // atribuídas: dividir pelas atribuídas faria a licença ociosa desaparecer
  // dentro do custo de quem usa, que é exatamente o que este desenho recusa.
  const porLicenca = Math.floor(totalCentavos / quantidade);

  const contagem = new Map<string | null, number>();
  for (const a of atribuicoes) {
    contagem.set(a.centroCustoId, (contagem.get(a.centroCustoId) ?? 0) + 1);
  }

  const fatias: FatiaRateio[] = [...contagem.entries()]
    .map(([centroCustoId, pessoas]) => ({
      centroCustoId,
      pessoas,
      centavos: pessoas * porLicenca,
    }))
    // Maior primeiro. O empate desempata pelo id para o resultado ser estável
    // entre renders — uma tabela que troca de ordem sozinha parece defeito.
    .sort(
      (a, b) =>
        b.pessoas - a.pessoas ||
        String(a.centroCustoId).localeCompare(String(b.centroCustoId)),
    );

  const ociosas = { quantidade: ociosasQtd, centavos: ociosasQtd * porLicenca };

  // O que a divisão inteira deixou para trás vai para a MAIOR fatia — ou para
  // as ociosas, quando não há fatia nenhuma. A soma das partes tem de bater com
  // o total ao centavo: um centavo por mês é o erro que não aparece na tela e
  // só é descoberto conferindo o Loca contra o Mega, meses depois.
  const distribuido =
    fatias.reduce((a, f) => a + f.centavos, 0) + ociosas.centavos;
  const resto = totalCentavos - distribuido;
  if (resto !== 0) {
    if (fatias.length > 0) fatias[0].centavos += resto;
    else ociosas.centavos += resto;
  }

  return { porCentroCusto: fatias, ociosas, totalCentavos };
}
