// A regra do aviso de renovação de serviço — pura, para poder ser testada sem
// cron, sem banco e sem e-mail.
//
// Ela existe separada por um motivo específico: o que o aviso DIZ muda conforme
// o contrato renove sozinho ou não, e as duas frases pedem ações opostas.
// Errar isso não estoura em lugar nenhum — só faz a pessoa não agir.

export type ServicoParaAviso = {
  id: string;
  nome: string;
  data_fim: string | null;
  renova_automaticamente: boolean;
};

/**
 * O que o aviso diz.
 *
 * Vencimento cobra que alguém RENOVE antes que acabe. Renovação automática
 * cobra que alguém DECIDA CANCELAR antes que renove sozinha. Trocar as duas
 * frases empurra a pessoa para o lado errado: ela lê "vence em 30 dias", não
 * faz nada por achar que perder o serviço é aceitável, e a assinatura se
 * renova por mais um ano.
 */
export function fraseDoAviso(s: {
  nome: string;
  renovaAutomaticamente: boolean;
}): string {
  return s.renovaAutomaticamente
    ? `${s.nome} renova automaticamente`
    : `${s.nome} vence`;
}

/**
 * Quais serviços entram na rodada de avisos.
 *
 * Contrato de vigência indeterminada (`data_fim` nulo) **não entra**: não há
 * data para avisar, e inventar uma faria o aviso disparar para sempre. O que
 * cobre esse caso é o aviso de conferência vencida, que é outra coisa.
 *
 * As datas são comparadas como string `'yyyy-mm-dd'` — o formato é ordenável
 * lexicograficamente, então não há conversão nem fuso no meio.
 */
export function servicosParaAvisar<T extends ServicoParaAviso>(
  servicos: T[],
  hojeISO: string,
  limiteISO: string,
): T[] {
  return servicos.filter(
    (s) => s.data_fim !== null && s.data_fim >= hojeISO && s.data_fim <= limiteISO,
  );
}
