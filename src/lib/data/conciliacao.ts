import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger, erroMeta } from "@/lib/logger";
import { dataDePagamento } from "@/lib/mega/vencimento";

/**
 * A fila de conciliação, achatada para a tela.
 *
 * `createClient()`, nunca `createAdminClient()`: o isolamento por organização
 * desta tela depende de RLS, e um client admin faria todo tenant ver a fila de
 * todos, em silêncio.
 *
 * Tipos de retorno PLANOS de propósito: o PostgREST devolve `T | T[] | null`
 * para o embed, e essa ambiguidade não sobe para o componente.
 */

export type ItemFila = {
  id: string;
  status: "sugerida" | "confirmada" | "recusada";
  confianca: "alta" | "media" | "baixa";
  motivo: string;
  agenteNome: string;
  tipoDocumento: string;
  numeroDocumento: string;
  valorPago: number;
  dataPagamento: string | null;
  lancamentoId: string | null;
  lancamentoDescricao: string | null;
  lancamentoValor: number | null;
};

type Embed<T> = T | T[] | null;

function um<T>(v: Embed<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listarFilaConciliacao(
  status: "sugerida" | "recusada" = "sugerida",
): Promise<ItemFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mega_conciliacao")
    .select(
      "id, status, confianca, motivo, " +
        "mega_titulo ( agente_nome, codigo_mega, tipo_documento, numero_documento, " +
        "valor_parcela, saldo_atual, data_vencimento, data_prorrogado ), " +
        "lancamento_financeiro ( id, descricao, valor )",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    // Erro em LISTA: loga e devolve vazio. A tela mostra o estado vazio em vez
    // de explodir — quem explode é o detalhe, e não há detalhe aqui.
    logger.error("conciliacao: não consegui ler a fila", erroMeta(error));
    return [];
  }

  // Tipagem explícita: este projeto não tem tipos gerados do Supabase, então a
  // inferência do PostgREST é por análise da string do select e cai para
  // `GenericStringError` com join aninhado. Mesmo padrão de `data/custodia.ts`.
  const linhas = (data ?? []) as unknown as Record<string, unknown>[];

  return linhas.map((r) => {
    const t = um(r.mega_titulo as Embed<{
      agente_nome: string | null;
      codigo_mega: string;
      tipo_documento: string;
      numero_documento: string;
      valor_parcela: number;
      saldo_atual: number;
      data_vencimento: string;
      data_prorrogado: string | null;
    }>);
    const l = um(r.lancamento_financeiro as Embed<{
      id: string;
      descricao: string;
      valor: number;
    }>);

    return {
      id: r.id as string,
      status: r.status as ItemFila["status"],
      confianca: r.confianca as ItemFila["confianca"],
      motivo: r.motivo as string,
      // O código do Mega como fallback: nome nulo é comum, e uma linha sem
      // identificação nenhuma é pior que uma linha com o código cru.
      agenteNome: t?.agente_nome ?? t?.codigo_mega ?? "Agente não identificado",
      tipoDocumento: t?.tipo_documento ?? "",
      numeroDocumento: t?.numero_documento ?? "",
      valorPago: Number(t?.valor_parcela ?? 0),
      // A PRORROGADA, e só com saldo zerado — é `dataDePagamento` que faz esse
      // recorte, e é por isso que ela exige o saldo na assinatura.
      dataPagamento: t
        ? dataDePagamento({
            saldoAtual: Number(t.saldo_atual),
            dataVencimento: t.data_vencimento,
            dataProrrogado: t.data_prorrogado,
          })
        : null,
      lancamentoId: l?.id ?? null,
      lancamentoDescricao: l?.descricao ?? null,
      lancamentoValor: l ? Number(l.valor) : null,
    };
  });
}
