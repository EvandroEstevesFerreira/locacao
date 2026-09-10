import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import { configMega, megaConfigurado, SessaoMega } from "@/lib/mega/cliente";
import { sincronizarOrg, registrarRodada } from "@/lib/mega/servidor";

/**
 * O espelho diário do contas a pagar do Mega.
 *
 * `createAdminClient()` aqui é o caso permitido pelo AGENTS.md: o cron roda sem
 * sessão de usuário, então não há RLS de organização a respeitar — o recorte
 * por `org_id` é feito à mão, a partir das linhas de `mega_sync`. E é
 * necessário: `mega_titulo` não tem policy de INSERT para ninguém, de propósito.
 *
 * ESTA ROTA NÃO DÁ BAIXA EM NADA. Ela só copia para o espelho o que o Mega
 * respondeu; a tabela de contas a pagar do Loca não é tocada. Quem cobra essa
 * promessa é `src/lib/mega/espelho-nao-da-baixa.test.ts`, por varredura.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!megaConfigurado()) {
    return NextResponse.json(
      { error: "Mega não configurado (MEGA_TENANT / MEGA_USER / MEGA_PASSWORD)." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();

  // SEM LINHA ATIVA EM `mega_sync`, NÃO HÁ SINCRONIZAÇÃO. Fail-closed, igual ao
  // cron do People: uma organização só passa a consultar o ERP quando alguém
  // declarar que ela deve — nunca por o código ter subido.
  const { data: configs, error } = await supabase
    .from("mega_sync")
    .select("org_id")
    .eq("ativo", true);

  if (error) {
    logger.error("cron/mega: não consegui ler mega_sync", erroMeta(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orgs = (configs ?? []) as { org_id: string }[];
  if (orgs.length === 0) {
    return NextResponse.json({ ok: true, orgs: 0, aviso: "Nenhuma organização ativa." });
  }

  // UMA SESSÃO PARA A RODADA INTEIRA, e portanto UMA autenticação. Criar uma
  // por organização multiplicaria os SignIn — o encadeamento que já bloqueou a
  // conta `120.apifin`, que o projeto Financeiro também usa.
  const sessao = new SessaoMega(configMega()!);
  const resultado = [];

  for (const { org_id } of orgs) {
    try {
      const resumo = await sincronizarOrg(supabase, org_id, sessao);
      await registrarRodada(supabase, org_id, resumo, null);
      if (resumo.falhas.length > 0) {
        logger.error("cron/mega: fornecedores que falharam", {
          org_id,
          falhas: resumo.falhas,
        });
      }
      resultado.push({ org_id, ...resumo });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "Falha desconhecida.";
      logger.error("cron/mega: rodada abortada", { org_id, ...erroMeta(e) });
      await registrarRodada(supabase, org_id, null, motivo);
      resultado.push({ org_id, erro: motivo });
      // AUTENTICAÇÃO QUEBRADA NÃO SE TENTA DE NOVO NA MESMA RODADA, nem para a
      // próxima organização: repetir credencial recusada é o que bloqueia a
      // conta no ERP.
      break;
    }
  }

  return NextResponse.json({ ok: true, resultado });
}
