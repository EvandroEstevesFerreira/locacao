// Cron dos dias 1 e 16: os indicadores de locação para a diretoria.
//
// "Quinzenal" aqui são DIAS FIXOS, não "a cada 14 dias". Dias fixos tornam a
// primeira e a segunda metade do mês comparáveis mês a mês; a cada 14 dias a
// janela deriva pelo calendário e a comparação morre — que é justamente o que
// um indicador de diretoria existe para permitir.
//
// Roda sem sessão de usuário, então usa `createAdminClient()`: é um dos dois
// lugares onde isso é permitido. O filtro por organização é explícito.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { montarContexto, SELECT_ORGANIZACAO_EMAIL } from "@/lib/emails/contexto";
import {
  indicadoresQuinzenais,
  type LinhaIndicador,
} from "@/lib/emails/templates";
import { formatarBRL, hojeISOSaoPaulo, dataDeISO } from "@/lib/locacao";
import { entradasPainel } from "@/lib/data/painel";
import { montarPainel, resumirPainel } from "@/lib/painel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/** "1ª quinzena de setembro/2026", pela data de referência. */
function rotuloPeriodo(hojeISO: string): string {
  const d = dataDeISO(hojeISO);
  const mes = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  // Dia 16 fecha a primeira quinzena; do 16 em diante, o e-mail é da segunda.
  const metade = d.getDate() < 16 ? "1ª" : "2ª";
  return `${metade} quinzena de ${mes}`;
}

export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!emailConfigurado()) {
    return NextResponse.json(
      { error: "Resend não configurado (RESEND_API_KEY / EMAIL_FROM)." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  // Ancorado no fuso de São Paulo: o Vercel roda em UTC, e o cron das 07:00 UTC
  // ainda é o dia anterior em Brasília. Sem isto, o e-mail do dia 1 sairia
  // rotulado como do dia 31 e cairia na quinzena errada.
  const hojeISO = hojeISOSaoPaulo();
  const periodo = rotuloPeriodo(hojeISO);

  const resumoGeral: { org: string; obras: number; enviado: boolean }[] = [];
  const erros: { org: string; erro: string }[] = [];

  const { data: orgs } = await supabase
    .from("organizacao")
    .select(`id, ${SELECT_ORGANIZACAO_EMAIL}`);

  for (const org of orgs ?? []) {
    try {
      const { data: cfg } = await supabase
        .from("config_alerta")
        .select("destinatarios")
        .eq("org_id", org.id)
        .maybeSingle();

      const destinatarios = (cfg?.destinatarios ?? []).filter(Boolean);

      // `entradasPainel` LANÇA em erro de leitura, de propósito: um painel
      // vazio por falha viraria "nenhuma obra com problema" na caixa da
      // diretoria. O catch abaixo registra e segue para a próxima organização.
      const entradas = await entradasPainel(hojeISO, supabase, org.id);
      const linhas = montarPainel(entradas, hojeISO);
      const resumo = resumirPainel(linhas);

      if (destinatarios.length === 0 || linhas.length === 0) {
        resumoGeral.push({ org: org.id, obras: linhas.length, enviado: false });
        continue;
      }

      const linhasEmail: LinhaIndicador[] = linhas.map((l) => ({
        obra: l.rotulo,
        prazo: pct(l.prazo),
        avanco: pct(l.fisico),
        consumido: pct(l.consumido),
        projecao:
          l.projecao === null
            ? l.consumido === null
              ? "sem orçamento"
              : "sem avanço lançado"
            : l.estouro !== null
              ? `${l.projecao.toFixed(0)}% · +${formatarBRL(l.estouro)}`
              : `${l.projecao.toFixed(0)}%`,
        itens: String(l.itensAbertos),
        previsao: formatarBRL(l.previsaoAteFim),
        situacao: l.veredito,
      }));

      const email = indicadoresQuinzenais(
        {
          periodo,
          linhas: linhasEmail,
          comEstouro: resumo.comEstouro,
          estouroTotal: formatarBRL(resumo.estouroTotal),
          semDados: resumo.semDados,
          previsaoTotal: formatarBRL(resumo.previsaoAteFim),
        },
        montarContexto(org),
      );

      // A trava de modo de teste vive dentro de `enviarEmail`.
      await enviarEmail(destinatarios, email);
      resumoGeral.push({ org: org.id, obras: linhas.length, enviado: true });
    } catch (err) {
      logger.error("cron/indicadores", erroMeta(err));
      erros.push({
        org: org.id,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ periodo, resumo: resumoGeral, erros });
}
