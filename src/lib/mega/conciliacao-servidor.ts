import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import {
  sugerirConciliacao,
  type LancamentoAberto,
  type TituloQuitado,
} from "./conciliacao";

/**
 * Calcula e grava as sugestões de baixa de uma organização.
 *
 * Recebe o `supabase` de quem chama (o cron, com service role), seguindo a
 * regra do AGENTS.md para escrita compartilhada.
 *
 * ESTE ARQUIVO LÊ `lancamento_financeiro` E NUNCA O ESCREVE. A leitura é o que
 * permite propor; a escrita é da server action de confirmação, que roda com
 * sessão de usuário depois de alguém clicar. Há varredura cobrando isto em
 * `espelho-nao-da-baixa.test.ts`.
 */
export async function conciliarOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ sugestoes: number }> {
  const [tit, lanc, decididas] = await Promise.all([
    supabase
      .from("mega_titulo")
      .select(
        "id, fornecedor_id, imovel_id, tipo_documento, numero_documento, " +
          "data_vencimento, data_prorrogado, valor_parcela, saldo_atual",
      )
      .eq("org_id", orgId)
      .eq("saldo_atual", 0),
    supabase
      .from("lancamento_financeiro")
      .select("id, contrato_id, contrato_imovel_id, competencia, valor, nf_numero, status")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .eq("status", "pendente"),
    // JÁ DECIDIDAS NÃO VOLTAM PARA A FILA. É para isto que a tabela existe: um
    // upsert cego reabriria como "sugerida" tudo que alguém já recusou, e a
    // fila nunca esvaziaria.
    supabase
      .from("mega_conciliacao")
      .select("mega_titulo_id")
      .eq("org_id", orgId)
      .neq("status", "sugerida"),
  ]);

  if (tit.error) throw new Error(tit.error.message);
  if (lanc.error) throw new Error(lanc.error.message);
  if (decididas.error) throw new Error(decididas.error.message);

  const fechados = new Set((decididas.data ?? []).map((d) => d.mega_titulo_id as string));
  // `Number()` nos numéricos, como todo leitor deste repositório faz (ver
  // `src/lib/data/mega.ts`): o PostgREST entrega `numeric` como string, e um
  // `saldo_atual` de `"0.00"` reprovaria no filtro de quitados sem levantar
  // erro nenhum — a fila simplesmente nunca encheria.
  const titulos: TituloQuitado[] = ((tit.data ?? []) as unknown as LinhaTitulo[])
    .filter((t) => !fechados.has(t.id))
    .map((t) => ({ ...t, valor_parcela: Number(t.valor_parcela), saldo_atual: Number(t.saldo_atual) }));

  // O lançamento aponta para o CONTRATO, não para o agente. O dono vem de lá —
  // e é por isso que o select acima traz os dois ids de contrato.
  const lancamentos = await comAgente(supabase, orgId, lanc.data ?? []);

  const sugestoes = sugerirConciliacao({ titulos, lancamentos });
  if (sugestoes.length === 0) return { sugestoes: 0 };

  const { error } = await supabase.from("mega_conciliacao").upsert(
    sugestoes.map((s) => ({ org_id: orgId, ...s, status: "sugerida" as const })),
    { onConflict: "org_id,mega_titulo_id" },
  );
  if (error) throw new Error(error.message);

  logger.info("conciliacao: sugestões gravadas", { org_id: orgId, total: sugestoes.length });
  return { sugestoes: sugestoes.length };
}

type LinhaTitulo = Omit<TituloQuitado, "valor_parcela" | "saldo_atual"> & {
  valor_parcela: unknown;
  saldo_atual: unknown;
};

type LinhaLancamento = {
  id: string;
  contrato_id: string | null;
  contrato_imovel_id: string | null;
  competencia: string;
  valor: unknown;
  nf_numero: string | null;
  status: "pendente" | "pago";
};

/** Resolve fornecedor/imóvel de cada lançamento a partir do contrato dele. */
async function comAgente(
  supabase: SupabaseClient,
  orgId: string,
  linhas: LinhaLancamento[],
): Promise<LancamentoAberto[]> {
  const [contratos, imoveis] = await Promise.all([
    supabase.from("contrato_locacao").select("id, fornecedor_id").eq("org_id", orgId),
    supabase.from("contrato_imovel").select("id, imovel_id").eq("org_id", orgId),
  ]);
  if (contratos.error) throw new Error(contratos.error.message);
  if (imoveis.error) throw new Error(imoveis.error.message);

  const fornPorContrato = new Map(
    (contratos.data ?? []).map((c) => [c.id as string, c.fornecedor_id as string | null]),
  );
  const imovPorContrato = new Map(
    (imoveis.data ?? []).map((c) => [c.id as string, c.imovel_id as string | null]),
  );

  return linhas.map((l) => ({
    id: l.id,
    fornecedor_id: l.contrato_id ? (fornPorContrato.get(l.contrato_id) ?? null) : null,
    imovel_id: l.contrato_imovel_id ? (imovPorContrato.get(l.contrato_imovel_id) ?? null) : null,
    competencia: l.competencia,
    valor: Number(l.valor),
    nf_numero: l.nf_numero,
    status: l.status,
  }));
}
