import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { sinalDoTipo, type LinhaEstoque, type TipoMovimento } from "@/lib/estoque";

export type MovimentoLinha = {
  id: string;
  data: string;
  tipo: TipoMovimento;
  quantidade: number;
  itemId: string;
  itemDescricao: string;
  unidade: string | null;
  obraRotulo: string | null;
  origem: string;
  documento: string | null;
  observacoes: string | null;
  /** Preenchido quando ESTE movimento é um estorno de outro. */
  estornaId: string | null;
  /** Verdadeiro quando este movimento JÁ FOI estornado por outro. */
  estornado: boolean;
};

/** Dias entre duas datas ISO, sem passar por fuso. */
function diasEntre(aISO: string, bISO: string): number {
  const [a1, a2, a3] = aISO.split("-").map(Number);
  const [b1, b2, b3] = bISO.split("-").map(Number);
  return Math.round(
    (Date.UTC(b1, b2 - 1, b3) - Date.UTC(a1, a2 - 1, a3)) / 86_400_000,
  );
}

export type FiltrosEstoque = { obra?: string; q?: string; dias?: number };

/**
 * O saldo de cada item por quantidade, somado do razão.
 *
 * Só itens com `controle = 'quantidade'`: peça de equipamento é assunto de
 * `frota.ts`, e trazê-la para cá criaria a segunda verdade que este módulo
 * existe para evitar.
 *
 * Erro devolve vazio e registra — é tela de listagem, onde vazio é honesto.
 */
export async function saldosDeEstoque(f: FiltrosEstoque): Promise<LinhaEstoque[]> {
  const supabase = await createClient();
  const hoje = hojeISOSaoPaulo();
  const janela = f.dias ?? 90;

  const { data: itens, error: erroItens } = await supabase
    .from("item_catalogo")
    .select("id, descricao, unidade, estoque_minimo")
    .eq("controle", "quantidade")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("descricao");

  if (erroItens || !itens) {
    console.error("saldosDeEstoque/itens", erroItens);
    return [];
  }

  let q = supabase
    .from("movimento_estoque")
    .select("item_id, tipo, quantidade, data, obra_id");
  if (f.obra) q = q.eq("obra_id", f.obra);

  const { data: movs, error: erroMovs } = await q;
  if (erroMovs) console.error("saldosDeEstoque/movimentos", erroMovs);

  type Bruto = {
    item_id: string;
    tipo: TipoMovimento;
    quantidade: string | number;
    data: string;
  };

  const saldo = new Map<string, number>();
  const saida = new Map<string, number>();
  const ultimo = new Map<string, string>();

  // O corte do período do BI: o que saiu nos últimos `janela` dias.
  const inicio = new Date(Date.UTC(...(hoje.split("-").map(Number) as [number, number, number])));
  inicio.setUTCDate(inicio.getUTCDate() - janela);
  const desde = inicio.toISOString().slice(0, 10);

  for (const m of ((movs ?? []) as unknown as Bruto[])) {
    const qtd = Number(m.quantidade);
    saldo.set(m.item_id, (saldo.get(m.item_id) ?? 0) + sinalDoTipo(m.tipo) * qtd);

    // O consumo do período conta só o que de fato SAIU para uso. Ajuste de
    // inventário e baixa reduzem saldo mas não são consumo — misturá-los
    // inflaria a curva ABC e o giro com correção de erro.
    if (m.tipo === "saida" && m.data >= desde) {
      saida.set(m.item_id, (saida.get(m.item_id) ?? 0) + qtd);
    }

    const atual = ultimo.get(m.item_id);
    if (!atual || m.data > atual) ultimo.set(m.item_id, m.data);
  }

  const termo = (f.q ?? "").trim().toLowerCase();

  return itens
    .filter((i) =>
      termo === "" ? true : i.descricao.toLowerCase().includes(termo),
    )
    .map((i) => {
      const visto = ultimo.get(i.id);
      return {
        itemId: i.id,
        descricao: i.descricao,
        unidade: i.unidade,
        saldo: Math.round((saldo.get(i.id) ?? 0) * 1000) / 1000,
        saidaPeriodo: Math.round((saida.get(i.id) ?? 0) * 1000) / 1000,
        minimo: i.estoque_minimo === null ? null : Number(i.estoque_minimo),
        diasSemMovimento: visto ? diasEntre(visto, hoje) : null,
      };
    });
}

/** O razão, do mais recente para o mais antigo. */
export async function movimentosDeEstoque(
  f: FiltrosEstoque & { item?: string; limite?: number },
): Promise<MovimentoLinha[]> {
  const supabase = await createClient();

  let q = supabase
    .from("movimento_estoque")
    .select(
      "id, data, tipo, quantidade, origem, documento, observacoes, estorna_id, item_id, " +
        "item:item_id(descricao, unidade), obra:obra_id(codigo, nome)",
    )
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(f.limite ?? 200);

  if (f.obra) q = q.eq("obra_id", f.obra);
  if (f.item) q = q.eq("item_id", f.item);

  const { data, error } = await q;
  if (error || !data) {
    console.error("movimentosDeEstoque", error);
    return [];
  }

  type Bruto = {
    id: string;
    data: string;
    tipo: TipoMovimento;
    quantidade: string | number;
    origem: string;
    documento: string | null;
    observacoes: string | null;
    estorna_id: string | null;
    item_id: string;
    item: { descricao: string; unidade: string | null } | null;
    obra: { codigo: string; nome: string } | null;
  };

  const linhas = data as unknown as Bruto[];
  // Quem já foi estornado: a tela precisa marcar as duas pontas, senão o leitor
  // vê duas linhas contrárias e não sabe que uma anula a outra.
  const estornados = new Set(linhas.map((l) => l.estorna_id).filter(Boolean));

  return linhas.map((m) => ({
    id: m.id,
    data: m.data,
    tipo: m.tipo,
    quantidade: Number(m.quantidade),
    itemId: m.item_id,
    itemDescricao: m.item?.descricao ?? "(item)",
    unidade: m.item?.unidade ?? null,
    obraRotulo: m.obra ? `${m.obra.codigo} — ${m.obra.nome}` : null,
    origem: m.origem,
    documento: m.documento,
    observacoes: m.observacoes,
    estornaId: m.estorna_id,
    estornado: estornados.has(m.id),
  }));
}

/** Itens por quantidade, para o seletor do formulário de movimento. */
export async function itensDeEstoque(): Promise<
  { id: string; descricao: string; unidade: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_catalogo")
    .select("id, descricao, unidade")
    .eq("controle", "quantidade")
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("descricao");

  if (error || !data) {
    console.error("itensDeEstoque", error);
    return [];
  }
  return data;
}
