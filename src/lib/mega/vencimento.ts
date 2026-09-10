/**
 * Quando o título deve ser pago, segundo o Mega.
 *
 * A DATA DE PAGAR É A PRORROGADA. O `DataVencimento` é a data original do
 * documento; quando o financeiro renegocia, o ERP grava a nova data em
 * `DataProrrogado` e é ela que vale.
 *
 * Medido em 10/09/2026 sobre 5.372 parcelas reais: 866 (16,1%) têm prorrogação,
 * e ela é SEMPRE para depois — nem uma única vez para antes. Às vezes por meses
 * (vencimento 03/12/2024, prorrogado para 31/03/2025).
 *
 * Ler o vencimento original nesses 16% faria a tela acusar atraso em título que
 * está em dia, e mandar alguém cobrar uma renegociação que a própria casa fez.
 */

export type SituacaoTitulo = "pago" | "a_vencer" | "vence_hoje" | "atrasado";

/** A data que vale para pagar: a prorrogada, quando ela adia de fato. */
export function vencimentoEfetivo({
  dataVencimento,
  dataProrrogado,
}: {
  dataVencimento: string;
  dataProrrogado: string | null;
}): string {
  if (!dataProrrogado) return dataVencimento;
  // SÓ ADIA, NUNCA ANTECIPA. Em 5.372 parcelas nunca vimos prorrogação para
  // trás; se aparecer, é dado estranho, e antecipar por conta própria a data de
  // pagar é o pior dos dois erros possíveis aqui.
  return dataProrrogado > dataVencimento ? dataProrrogado : dataVencimento;
}

/** Houve renegociação de fato? (o Mega repete a data quando não houve) */
export function foiProrrogado(t: {
  dataVencimento: string;
  dataProrrogado: string | null;
}): boolean {
  return vencimentoEfetivo(t) !== t.dataVencimento;
}

export function situacaoDoTitulo({
  saldoAtual,
  dataVencimento,
  dataProrrogado,
  hojeISO,
}: {
  saldoAtual: number;
  dataVencimento: string;
  dataProrrogado: string | null;
  /** Sempre `hojeISOSaoPaulo()`: a Vercel roda em UTC. */
  hojeISO: string;
}): SituacaoTitulo {
  // Saldo zerado é pago, e pago não tem atraso — mesmo que a data já tenha
  // passado há meses. Quem já foi pago saiu da conversa.
  if (saldoAtual === 0) return "pago";

  const vence = vencimentoEfetivo({ dataVencimento, dataProrrogado });
  if (vence > hojeISO) return "a_vencer";
  if (vence === hojeISO) return "vence_hoje";
  return "atrasado";
}

export const SITUACAO_TITULO_INFO: Record<
  SituacaoTitulo,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pago: { label: "Pago", variant: "secondary" },
  a_vencer: { label: "A vencer", variant: "outline" },
  vence_hoje: { label: "Vence hoje", variant: "default" },
  atrasado: { label: "Atrasado", variant: "destructive" },
};
