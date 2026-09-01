// Cron de segunda-feira: prazo decorrido contra avanço físico, por obra.
//
// Roda sem sessão de usuário, então usa `createAdminClient()` — é um dos dois
// lugares onde isso é permitido (o outro é a Admin API do Auth). Não há RLS a
// respeitar aqui, e o filtro por organização é explícito em cada consulta.
//
// A dedup é por `avanco_email_enviado_em` na própria obra? NÃO: seria coluna
// nova para um problema que o agendamento já resolve. O cron dispara só na
// segunda-feira (`20 8 * * 1` em vercel.json), e a Vercel não repete a
// execução do mesmo horário. Se algum dia precisar de reenvio manual, aí vale
// a coluna de controle — não antes.

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { montarContexto, SELECT_ORGANIZACAO_EMAIL } from "@/lib/emails/contexto";
import {
  avancoSemanal,
  type LinhaAvanco,
  type LinhaSemLancamento,
} from "@/lib/emails/templates";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import {
  segundaDaSemana,
  percentualPrazo,
  desvio,
  previsaoTermino,
  semanasSemLancamento,
  type PontoAvanco,
} from "@/lib/avanco";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

function textoDesvio(pontos: number | null): string {
  if (pontos === null) return "—";
  const abs = Math.abs(pontos).toFixed(0);
  if (pontos > 0) return `${abs} pts de atraso`;
  if (pontos < 0) return `${abs} pts adiantada`;
  return "no prazo";
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
  // Ancorado no fuso de São Paulo: o Vercel roda em UTC e o cron dispara às
  // 08:20 UTC, que ainda é domingo em Brasília em parte do ano. Sem isto, a
  // "semana atual" sairia trocada.
  const hojeISO = hojeISOSaoPaulo();
  const semana = segundaDaSemana(hojeISO);

  const resumo: { org: string; obras: number; enviados: number; cobranca: number }[] = [];
  const erros: { org: string; erro: string }[] = [];

  const { data: orgs } = await supabase
    .from("organizacao")
    .select(`id, ${SELECT_ORGANIZACAO_EMAIL}`);

  for (const org of orgs ?? []) {
    try {
      const { data: obras } = await supabase
        .from("obra")
        .select("id, codigo, nome, data_inicio, data_fim_prevista, destinatarios_alerta")
        .eq("org_id", org.id)
        .eq("status", "ativa")
        .is("deleted_at", null)
        .order("codigo");

      if (!obras || obras.length === 0) continue;

      const ids = obras.map((o) => o.id);

      // Histórico das últimas semanas de todas as obras numa consulta. O ritmo
      // precisa de mais de um ponto por obra, então não dá para pedir só a
      // semana atual.
      const { data: avancos } = await supabase
        .from("avanco_obra")
        .select("obra_id, semana, percentual")
        .in("obra_id", ids)
        .order("semana", { ascending: false });

      const porObra = new Map<string, PontoAvanco[]>();
      for (const a of avancos ?? []) {
        const lista = porObra.get(a.obra_id) ?? [];
        lista.push({ semana: a.semana, percentual: Number(a.percentual) });
        porObra.set(a.obra_id, lista);
      }

      // Itens locados em aberto por obra — o dado que a diretoria pediu junto
      // dos percentuais. O vínculo é item_locado → contrato → obra.
      const { data: itens } = await supabase
        .from("item_locado")
        .select("id, contrato:contrato_id(obra_id)")
        .eq("org_id", org.id)
        .eq("status", "em_aberto");

      const itensPorObra = new Map<string, number>();
      for (const it of itens ?? []) {
        const obraId = (it.contrato as unknown as { obra_id: string } | null)?.obra_id;
        if (!obraId) continue;
        itensPorObra.set(obraId, (itensPorObra.get(obraId) ?? 0) + 1);
      }

      const ctx = montarContexto(org);
      let enviados = 0;
      const semLancamento: LinhaSemLancamento[] = [];

      // Um e-mail por obra, para os destinatários DELA. Obra sem destinatário
      // cadastrado não gera envio, mas continua entrando na cobrança
      // consolidada do administrativo — a lacuna existe de todo jeito.
      for (const obra of obras) {
        const destinatarios = (obra.destinatarios_alerta ?? []).filter(Boolean);
        const historico = porObra.get(obra.id) ?? [];

        const fisico = historico[0]?.percentual ?? null;
        const prazo = percentualPrazo(obra, hojeISO);
        const previsao = previsaoTermino(historico, hojeISO);
        const rotulo = `${obra.codigo} — ${obra.nome}`;

        const linha: LinhaAvanco = {
          obra: rotulo,
          fisico: pct(fisico),
          prazo: pct(prazo),
          desvio: textoDesvio(desvio(prazo, fisico)),
          previsao: previsao
            ? formatarData(previsao)
            : "ritmo insuficiente para projetar",
          itens: String(itensPorObra.get(obra.id) ?? 0),
        };

        // A cobrança é da ORGANIZAÇÃO, não da obra — quem lança é o
        // administrativo, e é a ele que a lacuna interessa. Vai num envio
        // único ao fim, para `config_alerta.destinatarios`.
        const semanas = semanasSemLancamento(historico[0]?.semana ?? null, hojeISO);
        if (semanas === null) {
          semLancamento.push({ obra: rotulo, desde: "nunca informada" });
        } else if (semanas > 0) {
          semLancamento.push({
            obra: rotulo,
            desde: `${semanas} ${semanas === 1 ? "semana" : "semanas"} sem informação`,
          });
        }

        // Obra sem NADA a dizer não gera e-mail. Sem período e sem lançamento,
        // o e-mail sairia com cinco travessões e uma bronca — para alguém que
        // talvez nem saiba que a tela existe. Ruído no primeiro contato queima
        // a credibilidade do aviso, e o aviso é o produto aqui.
        const temAlgoADizer = fisico !== null || prazo !== null;
        if (!temAlgoADizer || destinatarios.length === 0) continue;

        const email = avancoSemanal(
          // A obra recebe o que é dela e mais nada: a cobrança consolidada é
          // do administrativo.
          { semana: formatarData(semana), linhas: [linha], semLancamento: [] },
          ctx,
        );
        // A trava de modo de teste vive dentro de `enviarEmail`: com ela ligada,
        // nenhum destinatário real recebe.
        await enviarEmail(destinatarios, email);
        enviados += 1;
      }

      // A cobrança consolidada, para quem lança. Só sai se houver lacuna E
      // alguém configurado para receber.
      let cobranca = 0;
      if (semLancamento.length > 0) {
        const { data: cfg } = await supabase
          .from("config_alerta")
          .select("destinatarios")
          .eq("org_id", org.id)
          .maybeSingle();

        const paraAdmin = (cfg?.destinatarios ?? []).filter(Boolean);
        if (paraAdmin.length > 0) {
          const email = avancoSemanal(
            { semana: formatarData(semana), linhas: [], semLancamento },
            ctx,
          );
          await enviarEmail(paraAdmin, email);
          cobranca = 1;
        }
      }

      resumo.push({ org: org.id, obras: obras.length, enviados, cobranca });
    } catch (err) {
      logger.error("cron/avanco", erroMeta(err));
      erros.push({ org: org.id, erro: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ semana, resumo, erros });
}
