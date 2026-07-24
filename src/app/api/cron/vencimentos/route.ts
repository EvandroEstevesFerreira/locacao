import { NextResponse } from "next/server";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailConfigurado,
  enviarEmail,
  montarEmailVencimentos,
  type LinhaAlerta,
} from "@/lib/email";
import { formatarData } from "@/lib/locacao";

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
  const hoje = format(agora, "yyyy-MM-dd");

  const { data: configs } = await supabase
    .from("config_alerta")
    .select("org_id, dias_alerta, destinatarios")
    .eq("ativo", true);

  const resumo: { org: string; enviados: number }[] = [];

  for (const cfg of configs ?? []) {
    const destinatarios = (cfg.destinatarios ?? []).filter(Boolean);
    if (destinatarios.length === 0) continue;

    // Prazos configurados (maior → menor). Sem prazos válidos, pula.
    const prazos = Array.from(
      new Set(
        ((cfg.dias_alerta ?? []) as unknown[]).map((n) => Number(n)),
      ),
    )
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => b - a);
    if (prazos.length === 0) continue;
    const maxPrazo = prazos[0];

    // Marco atual = menor prazo >= dias restantes (escalona 30 → 15 → 3).
    const marcoDe = (diasRestantes: number) => {
      const elegiveis = prazos.filter((p) => p >= diasRestantes);
      return elegiveis.length ? Math.min(...elegiveis) : null;
    };

    // Janela de busca: do dia de hoje até o maior prazo à frente.
    const limite = format(addDays(agora, maxPrazo), "yyyy-MM-dd");

    // Candidatos: devoluções, fins de contrato e pagamentos dentro da janela.
    const [devolucoes, contratos, pagamentos] = await Promise.all([
      supabase
        .from("item_locado")
        .select("id, data_devolucao_prevista, item:item_id(descricao), contrato:contrato_id(numero)")
        .eq("org_id", cfg.org_id)
        .eq("status", "em_aberto")
        .not("data_devolucao_prevista", "is", null)
        .gte("data_devolucao_prevista", hoje)
        .lte("data_devolucao_prevista", limite),
      supabase
        .from("contrato_locacao")
        .select("id, numero, data_fim_prevista")
        .eq("org_id", cfg.org_id)
        .eq("status", "ativo")
        .not("data_fim_prevista", "is", null)
        .gte("data_fim_prevista", hoje)
        .lte("data_fim_prevista", limite),
      supabase
        .from("lancamento_financeiro")
        .select("id, descricao, valor, vencimento")
        .eq("org_id", cfg.org_id)
        .eq("status", "pendente")
        .lte("vencimento", limite),
    ]);

    type Cand = {
      tipo: string;
      referencia_id: string;
      data_referencia: string;
      dias: number; // marco (prazo) que este aviso representa
      linha: LinhaAlerta;
    };
    const brutos: Omit<Cand, "dias">[] = [];

    for (const d of devolucoes.data ?? []) {
      const item = d.item as unknown as { descricao: string } | null;
      const contrato = d.contrato as unknown as { numero: string } | null;
      brutos.push({
        tipo: "devolucao",
        referencia_id: d.id,
        data_referencia: d.data_devolucao_prevista!,
        linha: {
          categoria: "Devolução prevista",
          descricao: `${item?.descricao ?? "Item"} (contrato ${contrato?.numero ?? "—"})`,
          data: formatarData(d.data_devolucao_prevista),
        },
      });
    }
    for (const c of contratos.data ?? []) {
      brutos.push({
        tipo: "contrato_fim",
        referencia_id: c.id,
        data_referencia: c.data_fim_prevista!,
        linha: {
          categoria: "Fim de contrato",
          descricao: `Contrato ${c.numero}`,
          data: formatarData(c.data_fim_prevista),
        },
      });
    }
    for (const p of pagamentos.data ?? []) {
      brutos.push({
        tipo: "pagamento",
        referencia_id: p.id,
        data_referencia: p.vencimento,
        linha: {
          categoria: "Pagamento",
          descricao: p.descricao,
          data: formatarData(p.vencimento),
        },
      });
    }

    // Anexa o marco (dias) a cada candidato; descarta o que não está
    // dentro de nenhum prazo configurado.
    const candidatos: Cand[] = [];
    for (const b of brutos) {
      const diasRestantes = differenceInCalendarDays(
        new Date(`${b.data_referencia}T00:00:00`),
        agora,
      );
      const marco = marcoDe(diasRestantes);
      if (marco === null) continue;
      candidatos.push({ ...b, dias: marco });
    }
    if (candidatos.length === 0) continue;

    // Remove os que já foram notificados (mesma referência + data + marco).
    const ids = candidatos.map((c) => c.referencia_id);
    const { data: jaEnviados } = await supabase
      .from("notificacao_log")
      .select("tipo, referencia_id, data_referencia, dias")
      .eq("org_id", cfg.org_id)
      .in("referencia_id", ids);
    const chave = (t: string, r: string, d: string, dias: number | null) =>
      `${t}:${r}:${d}:${dias}`;
    const enviadosSet = new Set(
      (jaEnviados ?? []).map((e) =>
        chave(e.tipo, e.referencia_id, e.data_referencia, e.dias),
      ),
    );
    const novos = candidatos.filter(
      (c) =>
        !enviadosSet.has(
          chave(c.tipo, c.referencia_id, c.data_referencia, c.dias),
        ),
    );
    if (novos.length === 0) continue;

    const { data: org } = await supabase
      .from("organizacao")
      .select("nome")
      .eq("id", cfg.org_id)
      .single();

    const html = montarEmailVencimentos(
      org?.nome ?? "Organização",
      novos.map((c) => c.linha),
    );
    await enviarEmail(destinatarios, "Loca — Avisos de vencimento", html);

    await supabase.from("notificacao_log").insert(
      novos.map((c) => ({
        org_id: cfg.org_id,
        tipo: c.tipo,
        referencia_id: c.referencia_id,
        data_referencia: c.data_referencia,
        dias: c.dias,
        destinatarios,
      })),
    );

    resumo.push({ org: cfg.org_id, enviados: novos.length });
  }

  return NextResponse.json({ ok: true, resumo });
}
