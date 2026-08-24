// Trava de teste interno: enquanto ligada, nenhum e-mail do Loca chega a um
// destinatário real.
//
// Fica no transporte, e não em cada call site, porque é o único ponto por onde
// TODO envio passa — cron de vencimentos, cron de relatório, criação de usuário,
// redefinição de senha e o que vier depois. Uma trava por call site significaria
// que o próximo call site nasce sem ela.

import type { EmailPronto } from "./templates";

/**
 * Os três estados possíveis.
 *
 * `bloqueado` existe de propósito: se alguém ligar o modo de teste e errar (ou
 * esquecer) a lista de destino, a alternativa "manda para os reais" seria
 * exatamente o acidente que a trava deveria impedir. Configuração incompleta
 * recusa o envio — em voz alta.
 */
export type EstadoEnvio =
  | { modo: "normal" }
  | { modo: "teste"; destino: string[] }
  | { modo: "bloqueado"; motivo: string };

function ligado(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "sim" || s === "on";
}

/** Quebra a lista como o usuário digita: linha, vírgula ou ponto e vírgula. */
export function lerDestinoTeste(bruto: string | undefined): string[] {
  return [
    ...new Set(
      (bruto ?? "")
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.includes("@")),
    ),
  ];
}

export function estadoEnvio(env: NodeJS.ProcessEnv = process.env): EstadoEnvio {
  if (!ligado(env.EMAIL_MODO_TESTE)) return { modo: "normal" };

  const destino = lerDestinoTeste(env.EMAIL_TESTE_DESTINO);
  if (destino.length === 0) {
    return {
      modo: "bloqueado",
      motivo:
        "EMAIL_MODO_TESTE está ligado, mas EMAIL_TESTE_DESTINO não tem nenhum endereço válido. Nenhum e-mail foi enviado.",
    };
  }
  return { modo: "teste", destino };
}

/** Resume os destinatários originais para caber no assunto. */
function resumirOriginais(destinatarios: string[]): string {
  if (destinatarios.length === 0) return "ninguém";
  const primeiros = destinatarios.slice(0, 2).join(", ");
  const resto = destinatarios.length - 2;
  return resto > 0 ? `${primeiros} +${resto}` : primeiros;
}

export type EnvioAjustado = {
  destinatarios: string[];
  email: EmailPronto;
  /** Quem teria recebido, quando houve desvio. Para log. */
  desviadoDe?: string[];
};

/**
 * Aplica a trava a um envio.
 *
 * O CORPO não é alterado — é ele que está sendo avaliado, e um aviso enxertado
 * no HTML mudaria justamente o que se quer conferir. O ASSUNTO sim: precisa ser
 * impossível confundir um teste com um envio real na caixa de entrada, e é ali
 * que fica registrado quem teria recebido.
 */
export function aplicarModoTeste(
  destinatarios: string[],
  email: EmailPronto,
  estado: EstadoEnvio = estadoEnvio(),
): EnvioAjustado {
  if (estado.modo === "bloqueado") throw new Error(estado.motivo);
  if (estado.modo === "normal") return { destinatarios, email };

  return {
    destinatarios: estado.destino,
    email: {
      ...email,
      assunto: `[TESTE → ${resumirOriginais(destinatarios)}] ${email.assunto}`,
    },
    desviadoDe: destinatarios,
  };
}

/**
 * `true` quando a trava está ligada.
 *
 * O cron de vencimentos consulta isto para NÃO gravar em `notificacao_log`: a
 * gravação é o que impede o reenvio, e em teste ela marcaria o aviso real como
 * já enviado. O destinatário de verdade nunca receberia aquele aviso — o teste
 * não encheria a caixa de ninguém, esvaziaria.
 */
export function emTeste(estado: EstadoEnvio = estadoEnvio()): boolean {
  return estado.modo !== "normal";
}
