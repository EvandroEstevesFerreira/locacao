import { NextResponse } from "next/server";
import { format } from "date-fns";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorios";
import { DocumentoRelatorio } from "@/lib/pdf";
import { emailConfigurado, enviarEmail, montarEmailRelatorio } from "@/lib/email";

export const runtime = "nodejs";
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
  if (!emailConfigurado()) {
    return NextResponse.json(
      { error: "Resend não configurado (RESEND_API_KEY / EMAIL_FROM)." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const agora = new Date();
  const hojeStr = format(agora, "yyyy-MM-dd");
  const isoWeekday = ((agora.getDay() + 6) % 7) + 1; // 1=segunda … 7=domingo
  const diaDoMes = agora.getDate();

  const { data: configs } = await supabase
    .from("config_relatorio_email")
    .select("org_id, tipo, frequencia, dia, destinatarios, ultimo_envio")
    .eq("ativo", true);

  const enviados: { org: string; tipo: string }[] = [];

  for (const cfg of configs ?? []) {
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

    const periodoLabel = format(agora, "dd/MM/yyyy");
    const html = montarEmailRelatorio(orgNome, relatorio, periodoLabel);

    const pdf = await renderToBuffer(
      <DocumentoRelatorio relatorio={relatorio} periodo={periodoLabel} />,
    );
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
  }

  return NextResponse.json({ ok: true, enviados });
}
