// Transporte de e-mail (Resend). Nada de montagem de HTML aqui.
//
// O conteúdo mora em `src/lib/emails/`: `templates.ts` (o que se diz),
// `layout.ts` (como se desenha), `contexto.ts` (de quem é). Este arquivo só
// entrega — antes ele fazia as duas coisas, e por isso o assunto de cada e-mail
// ficava escrito no call site, longe do corpo que ele anuncia.

import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { aplicarModoTeste } from "@/lib/emails/modo-teste";
import type { EmailPronto } from "@/lib/emails/templates";

export function emailConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type AnexoEmail = { filename: string; content: string | Buffer };

/**
 * Caixa que recebe as respostas.
 *
 * O remetente é uma caixa de automação que ninguém lê. Sem `Reply-To`, quem
 * responde um aviso de vencimento — e alguém sempre responde — fala com o vazio:
 * a resposta some sem erro e sem ninguém saber que existiu.
 */
function replyTo(): string | undefined {
  return process.env.EMAIL_REPLY_TO || undefined;
}

/**
 * Envia um e-mail via Resend. Lança se não configurado.
 *
 * Recebe o `EmailPronto` inteiro, e não assunto e HTML soltos: os dois vêm do
 * mesmo template e não há como um dizer uma coisa e o outro dizer outra.
 */
export async function enviarEmail(
  destinatarios: string[],
  email: EmailPronto,
  anexos?: AnexoEmail[],
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Resend não configurado (RESEND_API_KEY / EMAIL_FROM).");
  }
  // A trava de teste vem ANTES do Resend: é a última coisa entre o sistema e a
  // caixa de alguém. Se estiver ligada, `destinatarios` já não são os reais.
  const ajustado = aplicarModoTeste(destinatarios, email);
  if (ajustado.desviadoDe) {
    logger.info("email.modo_teste.desviado", {
      de: ajustado.desviadoDe,
      para: ajustado.destinatarios,
      assunto: ajustado.email.assunto,
    });
  }

  const resend = new Resend(apiKey);
  const responder = replyTo();

  return resend.emails.send({
    from,
    to: ajustado.destinatarios,
    subject: ajustado.email.assunto,
    html: ajustado.email.html,
    // A alternativa em texto puro sai sempre. Mensagem só-HTML pontua pior em
    // filtro de spam, e é o que alguns clientes usam na pré-visualização.
    text: ajustado.email.texto,
    ...(responder ? { replyTo: responder } : {}),
    ...(anexos && anexos.length ? { attachments: anexos } : {}),
  });
}
