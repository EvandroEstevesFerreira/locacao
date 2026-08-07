import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  custoLinhaLocado,
  dataDeISO,
  periodosEntre,
  type Cadencia,
} from "@/lib/locacao";

export type MovimentacaoDaLinha = {
  id: string;
  quantidade: number;
  tipo: string;
  data: string;
  vistoria_id: string | null;
  vistoria: { vistoria_foto: { count: number }[] } | null;
};

export type ItemLocadoCalculado = {
  id: string;
  quantidade: number;
  valor_unitario_periodo: number;
  data_retirada: string;
  data_devolucao_prevista: string | null;
  data_devolucao: string | null;
  status: "em_aberto" | "devolvido";
  identificacao: string | null;
  item: { descricao: string; unidade: string | null } | null;
  movimentacao: MovimentacaoDaLinha[];
  /** Quantidade ainda em poder da obra (quantidade − devoluções). */
  saldo: number;
  periodos: number;
  custo: number;
};

/**
 * Itens locados do contrato com saldo, períodos e custo já calculados.
 *
 * Envolvido em `cache()` porque três seções da página de detalhe consomem o
 * mesmo resultado: o "custo estimado acumulado" no resumo, a tabela de itens e
 * o histórico de devoluções. Sem o cache, decompor a página em seções
 * independentes triplicaria esta consulta — que é a mais pesada da rota, por
 * trazer as movimentações e as contagens de foto aninhadas.
 *
 * Os três parâmetros são primitivos de propósito: `cache()` chaveia por
 * IDENTIDADE de argumento, então passar o objeto `contrato` daria miss a cada
 * chamada.
 */
export const obterItensLocadosCalculados = cache(
  async (
    contratoId: string,
    cadencia: Cadencia,
    prorata: boolean,
  ): Promise<ItemLocadoCalculado[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("item_locado")
      .select(
        "id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, data_devolucao, status, identificacao, item:item_id(descricao,unidade), movimentacao(id, quantidade, tipo, data, vistoria_id, vistoria:vistoria_id(vistoria_foto(count)))",
      )
      .eq("contrato_id", contratoId)
      .order("created_at");

    type Bruta = Omit<ItemLocadoCalculado, "saldo" | "periodos" | "custo">;
    const linhas = (data ?? []) as unknown as Bruta[];
    const hoje = new Date();

    return linhas.map((l) => {
      const retirada = dataDeISO(l.data_retirada);
      const fim = l.data_devolucao ? dataDeISO(l.data_devolucao) : hoje;
      const devolucoes = (l.movimentacao ?? [])
        .filter((m) => m.tipo === "devolucao")
        .map((m) => ({
          quantidade: Number(m.quantidade),
          data: dataDeISO(m.data),
        }));
      // Custo respeita devoluções parciais: cada unidade é cobrada até voltar.
      const { saldo, custo } = custoLinhaLocado({
        quantidade: Number(l.quantidade),
        valorUnitarioPeriodo: Number(l.valor_unitario_periodo),
        cadencia,
        retirada,
        devolucoes,
        fim,
        prorata,
      });
      return {
        ...l,
        saldo,
        custo,
        periodos: periodosEntre(cadencia, retirada, fim, prorata),
      };
    });
  },
);

/** Quantas fotos uma vistoria tem, a partir do `vistoria_foto(count)` aninhado. */
export function contaFotos(
  v: { vistoria_foto: { count: number }[] } | null,
): number {
  return v?.vistoria_foto?.[0]?.count ?? 0;
}
