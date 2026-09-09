// Qual versão está no ar, agora.
//
// POR QUE ISTO EXISTE. Em 09/09/2026 três investigações se perderam na mesma
// pergunta: "o conserto não funciona" era, nas três vezes, deploy ainda não
// propagado — e a única forma de descobrir era pedir a alguém que olhasse o
// rodapé da tela. Diagnóstico que depende de outra pessoa olhar não é
// diagnóstico.
//
// Atrás do `CRON_SECRET`, como as demais rotas de serviço: a versão não é
// segredo, mas rota pública que anuncia o que está rodando é uma linha a menos
// de trabalho para quem procura versão vulnerável conhecida.

import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/changelog";

export const dynamic = "force-dynamic";

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({
    versao: APP_VERSION,
    // O commit vem da Vercel. Sem ele, "0.99.1" não distingue o build que
    // subiu do que ficou pela metade.
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ambiente: process.env.VERCEL_ENV ?? "local",
  });
}
