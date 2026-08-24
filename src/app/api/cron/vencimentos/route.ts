import { NextResponse } from "next/server";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger, erroMeta } from "@/lib/logger";
import {
  emailConfigurado,
  enviarEmail,
  montarEmailVencimentos,
  montarEmailVencimentosCentral,
  type LinhaAlerta,
  type GrupoAlerta,
} from "@/lib/email";
import {
  formatarData,
  formatarBRL,
  hojeISOSaoPaulo,
  dataDeISO,
  periodosPorMes,
  type Cadencia,
} from "@/lib/locacao";

// `id` entra porque o agrupamento é por obra e o rótulo "OB-042 — Vista Verde"
// não serve de chave: duas obras podem ter o mesmo nome, e o rótulo muda quando
// alguém renomeia a obra no meio do dia.
type ObraRef = { id: string; codigo: string; nome: string } | null;
const nomeObra = (o: ObraRef) => (o ? `${o.codigo} — ${o.nome}` : undefined);

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
  // Datas ancoradas no fuso de São Paulo (o Vercel roda em UTC).
  const hoje = hojeISOSaoPaulo();
  const agora = dataDeISO(hoje);

  const { data: configs } = await supabase
    .from("config_alerta")
    .select("org_id, dias_alerta, destinatarios")
    .eq("ativo", true);

  const resumo: { org: string; enviados: number }[] = [];

  const erros: { org: string; erro: string }[] = [];
  for (const cfg of configs ?? []) {
   try {
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
    const [devolucoes, contratos, pagamentos, imovelContratos, imoveisAtivos] =
      await Promise.all([
        supabase
          .from("item_locado")
          .select("id, data_devolucao_prevista, quantidade, valor_unitario_periodo, item:item_id(descricao), contrato:contrato_id(numero, cadencia, obra:obra_id(id, codigo, nome))")
          .eq("org_id", cfg.org_id)
          .eq("status", "em_aberto")
          .not("data_devolucao_prevista", "is", null)
          .gte("data_devolucao_prevista", hoje)
          .lte("data_devolucao_prevista", limite),
        supabase
          .from("contrato_locacao")
          .select("id, numero, cadencia, data_fim_prevista, obra:obra_id(id, codigo, nome), item_locado(quantidade, valor_unitario_periodo)")
          .eq("org_id", cfg.org_id)
          .eq("status", "ativo")
          .not("data_fim_prevista", "is", null)
          .gte("data_fim_prevista", hoje)
          .lte("data_fim_prevista", limite),
        supabase
          .from("lancamento_financeiro")
          .select("id, descricao, valor, vencimento, obra:obra_id(id, codigo, nome)")
          .eq("org_id", cfg.org_id)
          .eq("status", "pendente")
          .lte("vencimento", limite),
        // Imóveis: contratos vigentes (fim de contrato / reajuste dentro da janela)
        supabase
          .from("contrato_imovel")
          .select("id, data_fim, data_reajuste, valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, imovel:imovel_id(apelido, obra:obra_id(id, codigo, nome))")
          .eq("org_id", cfg.org_id)
          .eq("vigente", true),
        // Imóveis ativos + flag de contrato vigente (ausência de contrato)
        supabase
          .from("imovel")
          .select("id, apelido, obra:obra_id(id, codigo, nome), contrato_imovel(vigente)")
          .eq("org_id", cfg.org_id)
          .eq("status", "ativo"),
      ]);

    type Cand = {
      tipo: string;
      referencia_id: string;
      data_referencia: string;
      dias: number; // marco (prazo) que este aviso representa
      /** Nulo quando o alerta não tem obra — só `imovel.obra_id` é nulável. */
      obra_id: string | null;
      obra_rotulo: string | null;
      linha: LinhaAlerta;
    };
    const brutos: Omit<Cand, "dias">[] = [];

    for (const d of devolucoes.data ?? []) {
      const item = d.item as unknown as { descricao: string } | null;
      const contrato = d.contrato as unknown as { numero: string; cadencia: Cadencia; obra: ObraRef } | null;
      const custoMensal =
        Number(d.quantidade) *
        Number(d.valor_unitario_periodo) *
        (contrato ? periodosPorMes(contrato.cadencia) : 0);
      brutos.push({
        tipo: "devolucao",
        referencia_id: d.id,
        data_referencia: d.data_devolucao_prevista!,
        obra_id: contrato?.obra?.id ?? null,
        obra_rotulo: nomeObra(contrato?.obra ?? null) ?? null,
        linha: {
          categoria: "Devolução prevista",
          descricao: `${item?.descricao ?? "Item"} (contrato ${contrato?.numero ?? "—"})`,
          data: formatarData(d.data_devolucao_prevista),
          obra: nomeObra(contrato?.obra ?? null),
          custo: custoMensal > 0 ? formatarBRL(custoMensal) : undefined,
        },
      });
    }
    for (const c of contratos.data ?? []) {
      const obra = c.obra as unknown as ObraRef;
      const itens = (c.item_locado as { quantidade: number; valor_unitario_periodo: number }[] | null) ?? [];
      const custoMensal = itens.reduce(
        (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario_periodo) * periodosPorMes(c.cadencia as Cadencia),
        0,
      );
      brutos.push({
        tipo: "contrato_fim",
        referencia_id: c.id,
        data_referencia: c.data_fim_prevista!,
        obra_id: obra?.id ?? null,
        obra_rotulo: nomeObra(obra) ?? null,
        linha: {
          categoria: "Fim de contrato",
          descricao: `Contrato ${c.numero}`,
          data: formatarData(c.data_fim_prevista),
          obra: nomeObra(obra),
          custo: custoMensal > 0 ? formatarBRL(custoMensal) : undefined,
        },
      });
    }
    for (const p of pagamentos.data ?? []) {
      const obra = p.obra as unknown as ObraRef;
      brutos.push({
        tipo: "pagamento",
        referencia_id: p.id,
        data_referencia: p.vencimento,
        obra_id: obra?.id ?? null,
        obra_rotulo: nomeObra(obra) ?? null,
        linha: {
          categoria: "Pagamento",
          descricao: p.descricao,
          data: formatarData(p.vencimento),
          obra: nomeObra(obra),
          custo: formatarBRL(Number(p.valor)),
        },
      });
    }

    // Imóveis: fim de contrato e reajuste dentro da janela.
    for (const ci of imovelContratos.data ?? []) {
      const imv = ci.imovel as unknown as { apelido: string; obra: ObraRef } | null;
      const apelido = imv?.apelido ?? "Imóvel";
      // `imovel.obra_id` é NULÁVEL — é a única fonte em que isso acontece. O
      // alerta sem obra não tem para onde ir no agrupamento e vai só à central.
      const obraId = imv?.obra?.id ?? null;
      const obra = nomeObra(imv?.obra ?? null);
      const custoMensal =
        Number(ci.valor_aluguel) +
        Number(ci.valor_condominio) +
        Number(ci.valor_iptu) +
        (ci.seguro_fianca_mensal ? Number(ci.seguro_fianca ?? 0) : 0);
      const custo = custoMensal > 0 ? formatarBRL(custoMensal) : undefined;
      if (ci.data_fim && ci.data_fim >= hoje && ci.data_fim <= limite) {
        brutos.push({
          tipo: "imovel_contrato_fim",
          referencia_id: ci.id,
          data_referencia: ci.data_fim,
          obra_id: obraId,
          obra_rotulo: obra ?? null,
          linha: {
            categoria: "Imóvel — fim de contrato",
            descricao: apelido,
            data: formatarData(ci.data_fim),
            obra,
            custo,
          },
        });
      }
      if (ci.data_reajuste && ci.data_reajuste >= hoje && ci.data_reajuste <= limite) {
        brutos.push({
          tipo: "imovel_reajuste",
          referencia_id: ci.id,
          data_referencia: ci.data_reajuste,
          obra_id: obraId,
          obra_rotulo: obra ?? null,
          linha: {
            categoria: "Imóvel — reajuste de aluguel",
            descricao: apelido,
            data: formatarData(ci.data_reajuste),
            obra,
            custo,
          },
        });
      }
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

    // Ausência de contrato: imóvel ativo sem contrato vigente. Não é baseado em
    // data — avisa uma vez por mês (data_referencia = 1º dia do mês, dias = 0).
    const mesRef = format(agora, "yyyy-MM-01");
    for (const im of imoveisAtivos.data ?? []) {
      const cts = (im.contrato_imovel as { vigente: boolean }[] | null) ?? [];
      const temVigente = cts.some((c) => c.vigente);
      if (temVigente) continue;
      const obraIm = (im.obra as unknown as ObraRef) ?? null;
      candidatos.push({
        tipo: "imovel_sem_contrato",
        referencia_id: im.id as string,
        data_referencia: mesRef,
        dias: 0,
        obra_id: obraIm?.id ?? null,
        obra_rotulo: nomeObra(obraIm) ?? null,
        linha: {
          categoria: "Imóvel sem contrato",
          descricao: (im.apelido as string) ?? "Imóvel",
          data: "—",
          obra: nomeObra(obraIm),
        },
      });
    }

    if (candidatos.length === 0) continue;

    // Remove os que já foram notificados (mesma referência + data + marco).
    const ids = candidatos.map((c) => c.referencia_id);
    // A dedupe passa a considerar o PÚBLICO: o mesmo aviso vai à obra e à
    // central, e sem isso o segundo envio seria descartado como repetido.
    const { data: jaEnviados } = await supabase
      .from("notificacao_log")
      .select("tipo, referencia_id, data_referencia, dias, obra_id")
      .eq("org_id", cfg.org_id)
      .in("referencia_id", ids);
    const chave = (
      t: string,
      r: string,
      d: string,
      dias: number | null,
      obra: string | null,
    ) => `${t}:${r}:${d}:${dias}:${obra ?? "central"}`;
    const enviadosSet = new Set(
      (jaEnviados ?? []).map((e) =>
        chave(e.tipo, e.referencia_id, e.data_referencia, e.dias, e.obra_id),
      ),
    );

    const { data: org } = await supabase
      .from("organizacao")
      .select("nome")
      .eq("id", cfg.org_id)
      .single();
    const orgNome = org?.nome ?? "Organização";

    // ── Destinatários por obra ───────────────────────────────────────────────
    // Vinculados à obra (a MESMA fonte que a RLS usa para o acesso) + a lista
    // extra de quem não tem login. Derivar do vínculo é o que impede que alguém
    // tirado da obra continue recebendo por e-mail o que já não pode ver.
    const obraIds = [
      ...new Set(candidatos.map((c) => c.obra_id).filter((v): v is string => !!v)),
    ];
    const porObra = new Map<string, string[]>();
    if (obraIds.length > 0) {
      const [{ data: vinculos }, { data: obras }] = await Promise.all([
        supabase
          .from("obra_usuario")
          .select("obra_id, perfil:perfil_id(email, ativo)")
          .in("obra_id", obraIds),
        supabase
          .from("obra")
          .select("id, destinatarios_alerta")
          .in("id", obraIds),
      ]);

      for (const v of vinculos ?? []) {
        const p = v.perfil as unknown as { email: string | null; ativo: boolean } | null;
        // `ativo` no filtro: usuário desativado perde o acesso à tela e não pode
        // seguir recebendo o conteúdo dela por e-mail.
        if (!p?.ativo || !p.email) continue;
        const lista = porObra.get(v.obra_id) ?? [];
        lista.push(p.email);
        porObra.set(v.obra_id, lista);
      }
      for (const o of obras ?? []) {
        const extras = ((o.destinatarios_alerta ?? []) as string[]).filter(Boolean);
        if (extras.length === 0) continue;
        const lista = porObra.get(o.id) ?? [];
        lista.push(...extras);
        porObra.set(o.id, lista);
      }
      // Deduplica: quem está vinculado à obra E na lista extra receberia dois
      // e-mails idênticos.
      for (const [k, v] of porObra) porObra.set(k, [...new Set(v)]);
    }

    // ── Agrupamento ──────────────────────────────────────────────────────────
    const SEM_OBRA = "__sem_obra__";
    const grupos = new Map<string, Cand[]>();
    for (const c of candidatos) {
      const k = c.obra_id ?? SEM_OBRA;
      grupos.set(k, [...(grupos.get(k) ?? []), c]);
    }

    let enviados = 0;
    const paraCentral: GrupoAlerta[] = [];
    const registros: Record<string, unknown>[] = [];

    for (const [k, doGrupo] of [...grupos].sort()) {
      const rotulo = k === SEM_OBRA ? "Sem obra" : (doGrupo[0].obra_rotulo ?? "Obra");
      const destObra = k === SEM_OBRA ? [] : (porObra.get(k) ?? []);

      // A central recebe TUDO, e a dedupe dela é independente da da obra.
      const novosCentral = doGrupo.filter(
        (c) => !enviadosSet.has(chave(c.tipo, c.referencia_id, c.data_referencia, c.dias, null)),
      );
      if (novosCentral.length > 0) {
        paraCentral.push({
          obra: rotulo,
          linhas: novosCentral.map((c) => c.linha),
          // Obra sem ninguém para avisar: a central absorve e DIZ que absorveu.
          // Sem esta marca, o alerta chegaria como qualquer outro e ninguém
          // saberia que a obra ficou sem aviso próprio.
          semDestinatarios: k !== SEM_OBRA && destObra.length === 0,
        });
        registros.push(
          ...novosCentral.map((c) => ({
            org_id: cfg.org_id,
            tipo: c.tipo,
            referencia_id: c.referencia_id,
            data_referencia: c.data_referencia,
            dias: c.dias,
            obra_id: null,
            destinatarios,
          })),
        );
      }

      if (destObra.length === 0) continue;

      const novosObra = doGrupo.filter(
        (c) => !enviadosSet.has(chave(c.tipo, c.referencia_id, c.data_referencia, c.dias, k)),
      );
      if (novosObra.length === 0) continue;

      try {
        await enviarEmail(
          destObra,
          `Loca — Avisos de vencimento · ${rotulo}`,
          montarEmailVencimentos(orgNome, novosObra.map((c) => c.linha), rotulo),
        );
        enviados += novosObra.length;
        registros.push(
          ...novosObra.map((c) => ({
            org_id: cfg.org_id,
            tipo: c.tipo,
            referencia_id: c.referencia_id,
            data_referencia: c.data_referencia,
            dias: c.dias,
            obra_id: k,
            destinatarios: destObra,
          })),
        );
      } catch (e) {
        // Falha numa obra não pode derrubar as outras nem a central. Sem o
        // registro, o aviso volta a ser candidato amanhã — que é o desejado.
        logger.error("cron.vencimentos.obra_falha", {
          org_id: cfg.org_id,
          obra_id: k,
          ...erroMeta(e),
        });
      }
    }

    // ── Central ──────────────────────────────────────────────────────────────
    if (paraCentral.length > 0 && destinatarios.length > 0) {
      await enviarEmail(
        destinatarios,
        "Loca — Avisos de vencimento",
        montarEmailVencimentosCentral(orgNome, paraCentral),
      );
      enviados += paraCentral.reduce((s, g) => s + g.linhas.length, 0);
    }

    if (registros.length > 0) {
      // O erro deste insert NÃO era tratado. Se ele falhasse, os e-mails já
      // tinham saído e nada ficava registrado — e o mesmo aviso era reenviado
      // no dia seguinte, e no outro, sem que nada acusasse.
      const { error: erroLog } = await supabase
        .from("notificacao_log")
        .insert(registros);
      if (erroLog) {
        logger.error("cron.vencimentos.log_falha", {
          org_id: cfg.org_id,
          registros: registros.length,
          erro: erroLog.message,
        });
        erros.push({ org: cfg.org_id, erro: `log: ${erroLog.message}` });
      }
    }

    resumo.push({ org: cfg.org_id, enviados });
   } catch (e) {
    // Isola a falha: uma org com erro não impede as demais.
    logger.error("cron.vencimentos.org_falha", { org_id: cfg.org_id, ...erroMeta(e) });
    erros.push({ org: cfg.org_id, erro: e instanceof Error ? e.message : String(e) });
   }
  }

  return NextResponse.json({ ok: true, resumo, erros });
}
