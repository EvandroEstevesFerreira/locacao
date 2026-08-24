// Disparo de teste dos e-mails do Loca.
//
// Existe porque os crons cobrem 3 dos 10 cenários, e só quando há vencimento no
// dia. Sem esta rota não há como ver "Avarias em vistoria" chegando no Outlook —
// e o Outlook é justamente o cliente que quebra layout de e-mail.
//
// Manda os dados de EXEMPLO, não os do banco: nenhuma leitura, nenhuma escrita,
// nenhum `notificacao_log`. O que se testa aqui é o desenho e a entrega.
//
// Três travas, e as três têm de passar:
//  1. `CRON_SECRET` no Authorization — a rota é pública, o segredo não é;
//  2. `EMAIL_MODO_TESTE` ligado — sem isso a rota se recusa a existir, para que
//     ela nunca possa mandar nada a um destinatário real;
//  3. `enviarEmail` reaplica a trava e desvia os destinatários de todo modo.

import { NextResponse } from "next/server";
import { logger, erroMeta } from "@/lib/logger";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { CATALOGO } from "@/lib/emails/catalogo";
import { CONTEXTO } from "@/lib/emails/exemplos";
import { appUrl } from "@/lib/emails/contexto";
import { estadoEnvio } from "@/lib/emails/modo-teste";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const estado = estadoEnvio();
  if (estado.modo === "normal") {
    // Recusa deliberada. Uma rota de disparo em massa que funciona fora do modo
    // de teste é um acidente esperando a hora certa.
    return NextResponse.json(
      {
        error:
          "Disponível apenas com EMAIL_MODO_TESTE ligado. Ligue a variável para disparar os e-mails de teste.",
      },
      { status: 409 },
    );
  }
  if (estado.modo === "bloqueado") {
    return NextResponse.json({ error: estado.motivo }, { status: 409 });
  }

  if (!emailConfigurado()) {
    return NextResponse.json(
      { error: "Resend não configurado (RESEND_API_KEY / EMAIL_FROM)." },
      { status: 503 },
    );
  }

  // `?somente=avaria` reenvia um cenário só — para reconferir depois de um
  // ajuste, sem reenviar os dez e sem poluir a caixa.
  const somente = new URL(request.url).searchParams.get("somente");
  const alvos = somente
    ? CATALOGO.filter((i) => i.id === somente)
    : CATALOGO;

  if (alvos.length === 0) {
    return NextResponse.json(
      {
        error: `Cenário "${somente}" não existe.`,
        disponiveis: CATALOGO.map((i) => i.id),
      },
      { status: 404 },
    );
  }

  // O logotipo sai do site publicado, não do disco: é o `src` que o destinatário
  // vai carregar de verdade. Se a URL estiver errada, o teste tem de mostrar.
  const ctx = { ...CONTEXTO, appUrl: appUrl(), assetsUrl: undefined };

  const enviados: string[] = [];
  const falhas: { cenario: string; erro: string }[] = [];

  for (const item of alvos) {
    try {
      const email = item.render(ctx);
      await enviarEmail(estado.destino, email);
      enviados.push(item.id);
    } catch (e) {
      // Uma falha não derruba as outras: o valor do teste é ver quais chegaram.
      logger.error("dev.emails.falha", { cenario: item.id, ...erroMeta(e) });
      falhas.push({
        cenario: item.id,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logger.info("dev.emails.disparo", {
    destino: estado.destino,
    enviados: enviados.length,
    falhas: falhas.length,
  });

  return NextResponse.json({
    destino: estado.destino,
    enviados,
    falhas,
    total: alvos.length,
  });
}

/** GET lista os cenários sem mandar nada — para conferir os ids do `?somente=`. */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const estado = estadoEnvio();
  return NextResponse.json({
    modo: estado.modo,
    destino: estado.modo === "teste" ? estado.destino : [],
    cenarios: CATALOGO.map((i) => ({
      id: i.id,
      titulo: i.titulo,
      gatilho: i.gatilho,
      aguardandoGatilho: Boolean(i.aguardandoGatilho),
    })),
  });
}
