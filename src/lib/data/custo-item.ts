import "server-only";

import { createClient } from "@/lib/supabase/server";
import { periodosPorMes, type Cadencia } from "@/lib/locacao";
import type {
  ItemParaRateio,
  ParcelaItem,
  EntradaItemCusto,
} from "@/lib/custo-item";

export type ContextoRateio = {
  lancamentoId: string;
  descricao: string;
  valor: number;
  obraId: string;
  /** Null quando o lançamento não tem contrato — aí não há o que ratear. */
  contratoId: string | null;
  /** As linhas do contrato, com peso para o rateio sugerido. */
  itens: ItemParaRateio[];
  /** O rateio já gravado, se houver. */
  parcelas: ParcelaItem[];
};

/**
 * Tudo que a tela de rateio precisa, numa leitura.
 *
 * `null` quando o lançamento não existe — a página chama `notFound()`.
 */
export async function contextoRateio(
  lancamentoId: string,
): Promise<ContextoRateio | null> {
  const supabase = await createClient();

  const { data: lanc, error } = await supabase
    .from("lancamento_financeiro")
    .select("id, descricao, valor, obra_id, contrato_id")
    .eq("id", lancamentoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !lanc) {
    if (error) console.error("contextoRateio/lancamento", error);
    return null;
  }

  let itens: ItemParaRateio[] = [];
  if (lanc.contrato_id) {
    const { data: contrato, error: erroC } = await supabase
      .from("contrato_locacao")
      .select(
        "cadencia, item_locado(id, quantidade, valor_unitario_periodo, status, item:item_id(descricao))",
      )
      .eq("id", lanc.contrato_id)
      .maybeSingle();

    if (erroC) console.error("contextoRateio/contrato", erroC);

    type LinhaItem = {
      id: string;
      quantidade: string | number;
      valor_unitario_periodo: string | number;
      status: string;
      item: { descricao: string } | null;
    };

    if (contrato) {
      const periodos = periodosPorMes(contrato.cadencia as Cadencia);
      itens = ((contrato.item_locado ?? []) as unknown as LinhaItem[]).map((i) => ({
        item_locado_id: i.id,
        // O status entra no rótulo porque item devolvido continua podendo
        // receber custo de competência anterior — esconder isso faria a pessoa
        // procurar uma linha que existe.
        descricao: `${i.item?.descricao ?? "(item)"}${
          i.status === "em_aberto" ? "" : " · devolvido"
        }`,
        custoMensal:
          Number(i.quantidade) * Number(i.valor_unitario_periodo) * periodos,
      }));
    }
  }

  const { data: parcelas, error: erroP } = await supabase
    .from("lancamento_item")
    .select("item_locado_id, valor")
    .eq("lancamento_id", lancamentoId);
  if (erroP) console.error("contextoRateio/parcelas", erroP);

  return {
    lancamentoId: lanc.id,
    descricao: lanc.descricao,
    valor: Number(lanc.valor),
    obraId: lanc.obra_id,
    contratoId: lanc.contrato_id,
    itens,
    parcelas: (parcelas ?? []).map((p) => ({
      item_locado_id: p.item_locado_id,
      valor: Number(p.valor),
    })),
  };
}

/**
 * Orçado contra realizado por item do CATÁLOGO, numa obra.
 *
 * O orçado vem do detalhamento do orçamento vigente (subprojeto B); o realizado
 * vem do rateio dos lançamentos (subprojeto C), somado por item do catálogo —
 * porque é o item do catálogo, e não a linha do contrato, que a diretoria
 * reconhece: "quanto gastei de betoneira nesta obra".
 */
export async function custoPorItemDaObra(
  obraId: string,
): Promise<EntradaItemCusto[]> {
  const supabase = await createClient();

  // Orçado por item, do orçamento vigente.
  const { data: orc, error: erroOrc } = await supabase
    .from("orcamento_locacao")
    .select("orcamento_item(item_id, valor_previsto, item:item_id(descricao))")
    .eq("obra_id", obraId)
    .eq("vigente", true)
    .maybeSingle();
  if (erroOrc) console.error("custoPorItemDaObra/orcamento", erroOrc);

  type LinhaOrc = {
    item_id: string;
    valor_previsto: string | number;
    item: { descricao: string } | null;
  };

  const orcado = new Map<string, number>();
  const nomes = new Map<string, string>();
  for (const o of ((orc?.orcamento_item ?? []) as unknown as LinhaOrc[]) ?? []) {
    orcado.set(o.item_id, Number(o.valor_previsto));
    if (o.item?.descricao) nomes.set(o.item_id, o.item.descricao);
  }

  // Realizado por item: rateio → linha do contrato → item do catálogo.
  const { data: rateios, error: erroR } = await supabase
    .from("lancamento_item")
    .select(
      "valor, lancamento:lancamento_id(obra_id, deleted_at), item_locado:item_locado_id(item_id, item:item_id(descricao))",
    );
  if (erroR) console.error("custoPorItemDaObra/rateio", erroR);

  type LinhaRateio = {
    valor: string | number;
    lancamento: { obra_id: string; deleted_at: string | null } | null;
    item_locado: { item_id: string; item: { descricao: string } | null } | null;
  };

  const realizado = new Map<string, number>();
  for (const r of ((rateios ?? []) as unknown as LinhaRateio[])) {
    // O filtro por obra é feito aqui, e não no `.eq()`, porque o PostgREST não
    // filtra por coluna de relação aninhada sem `!inner` — e `!inner` mudaria a
    // cardinalidade da consulta em silêncio.
    if (r.lancamento?.obra_id !== obraId) continue;
    if (r.lancamento?.deleted_at) continue;
    const itemId = r.item_locado?.item_id;
    if (!itemId) continue;
    realizado.set(itemId, (realizado.get(itemId) ?? 0) + Number(r.valor));
    if (r.item_locado?.item?.descricao) {
      nomes.set(itemId, r.item_locado.item.descricao);
    }
  }

  // A união das duas fontes: item orçado sem gasto e item gasto sem orçamento
  // precisam APARECER. Mostrar só a interseção esconderia justamente os dois
  // casos que interessam.
  const ids = new Set([...orcado.keys(), ...realizado.keys()]);

  return [...ids].map((itemId) => ({
    itemId,
    descricao: nomes.get(itemId) ?? "(item)",
    orcado: orcado.has(itemId) ? (orcado.get(itemId) as number) : null,
    realizado: realizado.get(itemId) ?? 0,
  }));
}
