// Cobrança da assinatura pendente.
//
// A assinatura do funcionário passou a ser OPCIONAL na emissão (v0.96.0): o
// equipamento sai hoje e o traço vem depois, pelo link no celular. Sem cobrança,
// "depois" é "nunca" — e o termo fica valendo com um papel que se anuncia como
// não assinado.
//
// Roda TODO DIA e decide POR TERMO. "A cada 3 dias" é do termo, não do
// calendário: dois termos emitidos em dias diferentes têm ciclos diferentes, e
// um cron a cada três dias avisaria os dois no mesmo dia, um deles fora do
// prazo dele.
//
// Roda sem sessão de usuário, então usa `createAdminClient()` — é um dos dois
// lugares onde o AGENTS.md permite, porque não há RLS a respeitar.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emTeste } from "@/lib/emails/modo-teste";
import { conviteAssinatura, termosSemAssinatura } from "@/lib/emails/templates";
import {
  appUrl,
  montarContexto,
  type LinhaOrganizacaoEmail,
} from "@/lib/emails/contexto";
import { deveCobrarAssinatura, INTERVALO_COBRANCA_DIAS, estadoLabel } from "@/lib/termo";
import { DIAS_DE_VALIDADE } from "@/lib/assinatura-link";
import { hashDoToken, novoToken } from "@/lib/assinatura-servidor";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPO_LOG = "termo_assinatura_pendente";

function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

type TermoBruto = {
  id: string;
  org_id: string;
  numero_registro: string | null;
  emitido_em: string | null;
  cancelado_em: string | null;
  data_entrega: string;
  observacoes: string | null;
  funcionario: {
    nome: string;
    email: string | null;
    email_confirmado: boolean | null;
    cpf: string | null;
  } | null;
  obra: { codigo: string; nome: string } | null;
  termo_assinatura: { momento: string; papel: string; imagem: string | null }[];
  termo_equipamento_item: {
    quantidade: number;
    estado_entrega: string;
    item: { descricao: string; unidade: string | null } | null;
    unidade: { identificador: string } | null;
  }[];
};

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
  // Nunca `new Date()` aqui: o Vercel roda em UTC e o cron das 08:40 UTC ainda é
  // madrugada em Brasília. A contagem dos 3 dias é de calendário.
  const hojeISO = hojeISOSaoPaulo();

  const { data, error } = await supabase
    .from("termo_equipamento")
    .select(
      "id, org_id, numero_registro, emitido_em, cancelado_em, data_entrega, observacoes, " +
        "funcionario:funcionario_id(nome, email, email_confirmado, cpf), " +
        "obra:obra_id(codigo, nome), " +
        "termo_assinatura(momento, papel, imagem), " +
        "termo_equipamento_item(quantidade, estado_entrega, item:item_id(descricao, unidade), unidade:unidade_id(identificador))",
    )
    .not("emitido_em", "is", null)
    .is("cancelado_em", null);

  if (error) {
    console.error("cron/termos-sem-assinatura", error);
    return NextResponse.json({ error: "Falha ao ler os termos." }, { status: 500 });
  }

  const termos = (data ?? []) as unknown as TermoBruto[];

  // O último aviso de cada termo, numa consulta só. Um `select` por termo faria
  // o cron crescer em requisições junto com a quantidade de pendências.
  const { data: logs } = await supabase
    .from("notificacao_log")
    .select("referencia_id, data_referencia")
    .eq("tipo", TIPO_LOG)
    .order("data_referencia", { ascending: false });

  const ultimoAviso = new Map<string, string>();
  for (const l of (logs ?? []) as { referencia_id: string; data_referencia: string }[]) {
    if (!ultimoAviso.has(l.referencia_id)) {
      ultimoAviso.set(l.referencia_id, l.data_referencia);
    }
  }

  const assinou = (t: TermoBruto) =>
    t.termo_assinatura.some(
      (a) => a.momento === "entrega" && a.papel === "funcionario" && a.imagem,
    );

  const pendentes = termos.filter((t) => !assinou(t));
  const aCobrar = pendentes.filter((t) =>
    deveCobrarAssinatura(
      {
        emitidoEm: t.emitido_em,
        canceladoEm: t.cancelado_em,
        temAssinaturaFuncionario: false,
        ultimoAvisoEm: ultimoAviso.get(t.id) ?? null,
      },
      hojeISO,
    ),
  );

  const cobrados: string[] = [];
  const semCaminho: { termo: string; motivo: string }[] = [];

  for (const t of aCobrar) {
    const f = t.funcionario;
    // Os três pré-requisitos do link, nomeados. A emissão VALE mesmo sem eles;
    // o que não sai é a cobrança automática — e é por isso que o resumo para a
    // administração existe.
    if (!f?.email) {
      semCaminho.push({ termo: t.numero_registro ?? t.id, motivo: "sem e-mail cadastrado" });
      continue;
    }
    if (!f.email_confirmado) {
      semCaminho.push({
        termo: t.numero_registro ?? t.id,
        motivo: "e-mail deduzido, ainda não conferido",
      });
      continue;
    }
    if (!f.cpf) {
      semCaminho.push({
        termo: t.numero_registro ?? t.id,
        motivo: "sem CPF — o link não destrava sem ele",
      });
      continue;
    }

    // REVOGA ANTES DE GERAR. O link vale 7 dias e a cobrança é a cada 3: sem
    // isto o funcionário acumularia links válidos e usaria o mais antigo, que é
    // o que está no topo da caixa. Um válido por vez, sempre o mais recente.
    await supabase
      .from("termo_link")
      .update({ revogado_em: new Date().toISOString() })
      .eq("termo_id", t.id)
      .is("usado_em", null)
      .is("revogado_em", null);

    const token = novoToken();
    const { error: erroLink } = await supabase.from("termo_link").insert({
      org_id: t.org_id,
      termo_id: t.id,
      token_hash: hashDoToken(token),
      expira_em: new Date(
        Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000,
      ).toISOString(),
      criado_por: null,
    });
    if (erroLink) {
      console.error("cron/termos-sem-assinatura/link", t.id, erroLink);
      semCaminho.push({
        termo: t.numero_registro ?? t.id,
        motivo: "falha ao gerar o link",
      });
      continue;
    }

    const { data: org } = await supabase
      .from("organizacao")
      .select("nome, razao_social, cnpj")
      .eq("id", t.org_id)
      .maybeSingle();

    const email = conviteAssinatura(
      {
        funcionario: f.nome,
        obra:
          [t.obra?.codigo, t.obra?.nome].filter(Boolean).join(" — ") || undefined,
        dataEntrega: formatarData(t.data_entrega),
        itens: t.termo_equipamento_item.map((i) => ({
          descricao: i.item?.descricao ?? "—",
          patrimonio: i.unidade?.identificador ?? undefined,
          quantidade: `${i.quantidade}${i.item?.unidade ? ` ${i.item.unidade}` : ""}`,
          estado: estadoLabel(i.estado_entrega),
        })),
        url: `${appUrl()}/assinar/${token}`,
        validade: `${DIAS_DE_VALIDADE} dias`,
      },
      montarContexto((org as LinhaOrganizacaoEmail | null) ?? null),
    );

    try {
      await enviarEmail([f.email], email);
    } catch (e) {
      console.error("cron/termos-sem-assinatura/email", t.id, e);
      semCaminho.push({ termo: t.numero_registro ?? t.id, motivo: "o e-mail não saiu" });
      continue;
    }

    // A GRAVAÇÃO É O QUE IMPEDE O REENVIO, e por isso não acontece em modo de
    // teste: ali ela marcaria como avisado um termo cujo funcionário não recebeu
    // nada, e o aviso real nunca sairia. Mesmo motivo do cron de vencimentos.
    if (!emTeste()) {
      await supabase.from("notificacao_log").insert({
        org_id: t.org_id,
        tipo: TIPO_LOG,
        referencia_id: t.id,
        data_referencia: hojeISO,
        destinatarios: [f.email],
      });
    }
    cobrados.push(t.numero_registro ?? t.id);
  }

  // ── O resumo para a administração ────────────────────────────────────────
  // Um e-mail com a lista, e não um por termo: quem cobra pessoalmente precisa
  // da lista inteira numa tela, e não de dez avisos para juntar à mão.
  const destinoResumo = (process.env.EMAIL_RESUMO_TERMOS ?? "")
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));

  let resumoEnviado = false;
  if (destinoResumo.length > 0 && pendentes.length > 0) {
    const { data: org } = await supabase
      .from("organizacao")
      .select("nome, razao_social, cnpj")
      .eq("id", pendentes[0]!.org_id)
      .maybeSingle();
    try {
      await enviarEmail(
        destinoResumo,
        termosSemAssinatura(
          {
            linhas: pendentes.map((t) => ({
              numero: t.numero_registro ?? "—",
              funcionario: t.funcionario?.nome ?? "—",
              obra: [t.obra?.codigo, t.obra?.nome].filter(Boolean).join(" — ") || "—",
              desde: formatarData(t.data_entrega),
              situacao:
                semCaminho.find((s) => s.termo === (t.numero_registro ?? t.id))
                  ?.motivo ?? "cobrança enviada",
            })),
            intervalo: `${INTERVALO_COBRANCA_DIAS} dias`,
          },
          montarContexto((org as LinhaOrganizacaoEmail | null) ?? null),
        ),
      );
      resumoEnviado = true;
    } catch (e) {
      console.error("cron/termos-sem-assinatura/resumo", e);
    }
  }

  return NextResponse.json({
    pendentes: pendentes.length,
    cobrados: cobrados.length,
    semCaminho,
    resumoEnviado,
  });
}
