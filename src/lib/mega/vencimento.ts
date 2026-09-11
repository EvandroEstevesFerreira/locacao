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

/**
 * A data que vale para pagar: a PRORROGADA, sempre.
 *
 * Confirmado com o dono do processo em 11/09/2026: no Mega, a prorrogação É a
 * data de pagamento. `DataVencimento` é o vencimento contratado do documento;
 * quando o financeiro renegocia, quem manda é `DataProrrogado`.
 *
 * Medido no espelho no mesmo dia, sobre as 450 parcelas já copiadas: NENHUMA
 * vem sem prorrogação e NENHUMA prorroga para trás. O `null` e o `<` abaixo
 * são rede para dado estranho, não caminho normal.
 */
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

/**
 * O dia em que o título foi pago, ou `null` se ele ainda não foi.
 *
 * SÓ FAZ SENTIDO COM SALDO ZERADO, e é por isso que o saldo entra aqui. Num
 * título em aberto a prorrogação é previsão — devolver essa data como "pago em"
 * marcaria como quitado o que ainda vai vencer, e conta paga por engano ninguém
 * percebe olhando a tela.
 *
 * É esta função, e não `quitacao_vista_em`, que responde QUANDO se pagou.
 * `quitacao_vista_em` é o dia em que o cron VIU o saldo zerar — auditoria da
 * sincronização, não fato do ERP.
 */
export function dataDePagamento({
  saldoAtual,
  dataVencimento,
  dataProrrogado,
}: {
  saldoAtual: number;
  dataVencimento: string;
  dataProrrogado: string | null;
}): string | null {
  if (saldoAtual !== 0) return null;
  return vencimentoEfetivo({ dataVencimento, dataProrrogado });
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
