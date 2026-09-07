import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import { peopleConfigurado } from "@/lib/people/cliente";
import { sincronizarPessoas, registrarRodada } from "@/lib/people/servidor";
import { precisaVarreduraCompleta } from "@/lib/people/mapeamento";

/**
 * A sincronização diária da base de pessoas com o Sistenge People.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * `createAdminClient()` aqui é o caso permitido pelo AGENTS.md: o cron roda sem
 * sessão de usuário, então não há RLS de organização a respeitar — o recorte
 * por `org_id` é feito à mão, a partir das linhas de `people_sync`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!peopleConfigurado()) {
    return NextResponse.json(
      { error: "People não configurado (PEOPLE_API_URL / PEOPLE_API_TOKEN)." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const agoraISO = new Date().toISOString();

  // SEM LINHA EM `people_sync`, NÃO HÁ SINCRONIZAÇÃO. Fail-closed: uma
  // organização só recebe pessoas quando alguém declarar que ela deve.
  const { data: configs, error } = await supabase
    .from("people_sync")
    .select("org_id, ultimo_atualizado_em, ultima_varredura_completa")
    .eq("ativo", true);

  if (error) {
    logger.error("cron/people: não consegui ler people_sync", erroMeta(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linhas = (configs ?? []) as {
    org_id: string;
    ultimo_atualizado_em: string | null;
    ultima_varredura_completa: string | null;
  }[];

  const resumo = [];
  for (const cfg of linhas) {
    // Toda semana a rodada é COMPLETA em vez de delta. É a única que enxerga
    // quem sumiu do People — ausência não é mudança, e `?desde=` nunca a traz.
    const completa = precisaVarreduraCompleta(
      cfg.ultima_varredura_completa,
      agoraISO,
    );

    const r = await sincronizarPessoas(
      supabase,
      cfg.org_id,
      cfg.ultimo_atualizado_em,
      agoraISO,
      completa,
    );
    const falhaAoRegistrar = await registrarRodada(supabase, cfg.org_id, r, agoraISO);

    if (!r.ok) {
      logger.error("cron/people: rodada falhou", {
        org_id: cfg.org_id,
        erro: r.erro,
      });
    }
    if (falhaAoRegistrar) {
      logger.error("cron/people: não consegui registrar a rodada", {
        org_id: cfg.org_id,
        erro: falhaAoRegistrar,
      });
    }

    if (r.ausentes > 0) {
      logger.warn("cron/people: vínculos que sumiram do People", {
        org_id: cfg.org_id,
        ausentes: r.ausentes,
      });
    }

    resumo.push({
      org_id: cfg.org_id,
      ok: r.ok,
      completa: r.completa,
      recebidas: r.recebidas,
      gravadas: r.gravadas,
      paginas: r.paginas,
      ausentes: r.ausentes,
      erro: r.erro,
    });
  }

  // 200 mesmo com organização que falhou: o resumo diz quais, e devolver 500
  // faria a Vercel marcar o cron inteiro como quebrado quando uma de várias
  // organizações teve problema.
  return NextResponse.json({ organizacoes: resumo.length, resumo });
}
