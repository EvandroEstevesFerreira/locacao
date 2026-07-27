import { NextResponse } from "next/server";
import { format } from "date-fns";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  type TipoRelatorio,
  type Relatorio,
} from "@/lib/relatorios";
import { DocumentoRelatorio } from "@/lib/pdf";
import { emailConfigurado, enviarEmail, montarEmailRelatorio } from "@/lib/email";
import { hojeISOSaoPaulo, dataDeISO } from "@/lib/locacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// Fora do try/catch: evita construir JSX dentro de try (regra do ESLint).
async function renderRelatorioPdf(relatorio: Relatorio, periodo: string) {
  return renderToBuffer(
    <DocumentoRelatorio relatorio={relatorio} periodo={periodo} />,
  );
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
  const agora = new Date();
  // Datas ancoradas no fuso de São Paulo (o Vercel roda em UTC).
  const hojeStr = hojeISOSaoPaulo(agora);
  const hojeData = dataDeISO(hojeStr);
  const isoWeekday = ((hojeData.getDay() + 6) % 7) + 1; // 1=segunda … 7=domingo
  const diaDoMes = hojeData.getDate();

  const { data: configs } = await supabase
    .from("config_relatorio_email")
    .select("org_id, tipo, frequencia, dia, destinatarios, ultimo_envio")
    .eq("ativo", true);

  const enviados: { org: string; tipo: string }[] = [];
  const erros: { org: string; erro: string }[] = [];

  for (const cfg of configs ?? []) {
   try {
    const destinatarios = (cfg.destinatarios ?? []).filter(Boolean);
    if (destinatarios.length === 0) continue;

    // Já enviado hoje? (dedup contra reexecução do cron)
    if (cfg.ultimo_envio === hojeStr) continue;

    // Hoje é dia de enviar?
    const ehDia =
      cfg.frequencia === "semanal"
        ? isoWeekday === Number(cfg.dia)
        : diaDoMes === Number(cfg.dia);
    if (!ehDia) continue;

    const tipo = (
      TIPOS_RELATORIO.some((t) => t.valor === cfg.tipo)
        ? cfg.tipo
        : "custo_por_obra"
    ) as TipoRelatorio;

    const relatorio = await gerarRelatorio(supabase, tipo, {});

    const { data: org } = await supabase
      .from("organizacao")
      .select("nome")
      .eq("id", cfg.org_id)
      .single();
    const orgNome = org?.nome ?? "Organização";

    const periodoLabel = format(hojeData, "dd/MM/yyyy");
    const html = montarEmailRelatorio(orgNome, relatorio, periodoLabel);

    const pdf = await renderRelatorioPdf(relatorio, periodoLabel);
    const anexo = {
      filename: `relatorio-${tipo}-${hojeStr}.pdf`,
      content: Buffer.from(pdf).toString("base64"),
    };

    await enviarEmail(
      destinatarios,
      `Loca — ${relatorio.titulo}`,
      html,
      [anexo],
    );

    await supabase
      .from("config_relatorio_email")
      .update({ ultimo_envio: hojeStr })
      .eq("org_id", cfg.org_id);

    enviados.push({ org: cfg.org_id, tipo });
   } catch (e) {
    // Isola a falha: uma org com erro não impede as demais.
    logger.error("cron.relatorio_email.org_falha", { org_id: cfg.org_id, ...erroMeta(e) });
    erros.push({ org: cfg.org_id, erro: e instanceof Error ? e.message : String(e) });
   }
  }

  return NextResponse.json({ ok: true, enviados, erros });
}
