import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  custoLinhaLocado,
  dataDeISO,
  hojeSaoPaulo,
  periodosEntre,
  type Cadencia,
  type StatusContrato,
} from "@/lib/locacao";
import { termoOr } from "@/lib/lista";
import { normalizarBuscaNumero } from "@/lib/registros";
import type { ListaParams, Pagina } from "./lista-params";

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
    // Nunca `new Date()` aqui: entra em `differenceInCalendarDays` contra datas
    // do banco, e no runtime UTC do Vercel isso cobra um período a mais depois
    // das 21h de Brasília.
    const hoje = hojeSaoPaulo();

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

/** Uma linha da listagem de contratos, já plana. */
export type ContratoListItem = {
  id: string;
  numero: string;
  numero_registro: string | null;
  cadencia: Cadencia;
  data_inicio: string;
  data_fim_prevista: string | null;
  status: StatusContrato;
  obraCodigo: string | null;
  obraNome: string | null;
  fornecedorNome: string | null;
};

export async function listarContratos(
  p: ListaParams & { obraId?: string },
): Promise<Pagina<ContratoListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("contrato_locacao")
    .select(
      "id, numero, numero_registro, cadencia, data_inicio, data_fim_prevista, status, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)",
      { count: "exact" },
    );
  if (p.obraId) query = query.eq("obra_id", p.obraId);
  // Busca pelos DOIS números: o do fornecedor (`numero`, digitado) e o do
  // registro no Loca (`numero_registro`, gerado). Quem tem o papel na mão
  // procura por um; quem tem o e-mail, pelo outro.
  if (p.q) {
    query = query.or(
      termoOr(["numero", "numero_registro"], normalizarBuscaNumero(p.q)),
    );
  }

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);

  // Lista vazia é a resposta semanticamente correta quando o RLS nega — mas
  // registramos, porque um erro de query silencioso é indistinguível disso.
  if (error) console.error("listarContratos", error.message);

  type Bruto = {
    id: string;
    numero: string;
    numero_registro: string | null;
    cadencia: Cadencia;
    data_inicio: string;
    data_fim_prevista: string | null;
    status: StatusContrato;
    obra: { codigo: string; nome: string } | null;
    fornecedor: { nome: string } | null;
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map((c) => ({
      id: c.id,
      numero: c.numero,
      numero_registro: c.numero_registro,
      cadencia: c.cadencia,
      data_inicio: c.data_inicio,
      data_fim_prevista: c.data_fim_prevista,
      status: c.status,
      obraCodigo: c.obra?.codigo ?? null,
      obraNome: c.obra?.nome ?? null,
      fornecedorNome: c.fornecedor?.nome ?? null,
    })),
    total: count ?? 0,
  };
}
