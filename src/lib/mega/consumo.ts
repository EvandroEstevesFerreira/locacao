import type { TituloMega } from "./contrato";

/**
 * Conta de consumo do Mega → imóvel, pela instalação.
 *
 * POR QUE NÃO POR VALOR E DATA, que seria mais fácil: foi medido em 11/09/2026
 * sobre os 803 títulos CONTA e não funciona.
 *
 *  * o Mega registra a data do LOTE de pagamento, não o vencimento do boleto —
 *    contas de água de três imóveis diferentes caem todas em 24/08;
 *  * contas de água colidem por natureza: R$ 74,83 / R$ 74,86 / R$ 75,44 no
 *    mesmo mês. Uma conta do Loca casou com TRÊS títulos ao mesmo tempo;
 *  * 157 dos 803 títulos (20%) colidem em agente + mês + valor, e a colisão
 *    piora conforme entram mais imóveis.
 *
 * A instalação (CPFL) ou o RGI (SABESP) está impresso em toda conta, não muda e
 * é único por ponto. É a única chave honesta.
 */

export type PontoConsumo = {
  imovelId: string;
  /** `codigo_mega` da concessionária. */
  concessionaria: string | null;
  identificador: string;
};

/** Só os dígitos: o Mega guarda o documento como texto digitado à mão. */
function digitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * A identidade de um ponto.
 *
 * O PAR, E NÃO SÓ O NÚMERO. Nada impede duas concessionárias de usarem a mesma
 * numeração de instalação — sem o agente na chave, a conta de água de um imóvel
 * apareceria como luz de outro.
 */
export function chaveDoPonto(concessionaria: string | null, identificador: string): string {
  return `${(concessionaria ?? "").trim()}|${digitos(identificador)}`;
}

/**
 * O imóvel de uma conta, ou `null`.
 *
 * NULO É RESULTADO, NÃO FALHA. Conta cuja instalação não está cadastrada é
 * exatamente o que se quer ver: ou falta cadastro, ou é conta de imóvel já
 * entregue que a empresa segue pagando. Chutar um imóvel aqui esconderia o
 * vazamento que este casamento existe para achar.
 */
export function imovelDaConta(titulo: TituloMega, pontos: PontoConsumo[]): string | null {
  const doc = digitos(titulo.numeroDocumento ?? "");
  if (!doc) return null;

  const alvo = chaveDoPonto(titulo.codigoAgente, doc);
  return pontos.find((p) => chaveDoPonto(p.concessionaria, p.identificador) === alvo)?.imovelId ?? null;
}
