import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ItemOrcado = {
  item_id: string;
  descricao: string;
  quantidade: number | null;
  valor_previsto: number;
};

export type OrcamentoObra = {
  id: string;
  versao: number;
  valor_total: number;
  observacoes: string | null;
  created_at: string;
  itens: ItemOrcado[];
};

export type RealizadoObra = {
  /** Lançamentos COM contrato de locação — o realizado de verdade. */
  comContrato: number;
  /**
   * Lançamentos da obra SEM contrato vinculado.
   *
   * Existe para a tela poder confessar o dado faltante. Sem este número, um
   * "0% consumido" seria mentira por omissão: o dinheiro saiu, só não está
   * atribuído a contrato nenhum — e hoje NENHUM lançamento tem vínculo.
   */
  semContrato: number;
  /** Quanto já foi efetivamente pago, do que tem contrato. */
  pago: number;
};

/** O orçamento vigente da obra, com o detalhamento por item. */
export async function orcamentoVigente(obraId: string): Promise<OrcamentoObra | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orcamento_locacao")
    .select(
      "id, versao, valor_total, observacoes, created_at, orcamento_item(item_id, quantidade, valor_previsto, item:item_id(descricao))",
    )
    .eq("obra_id", obraId)
    .eq("vigente", true)
    .maybeSingle();

  if (error) {
    console.error("orcamentoVigente", error);
    return null;
  }
  if (!data) return null;

  type LinhaItem = {
    item_id: string;
    quantidade: string | number | null;
    valor_previsto: string | number;
    item: { descricao: string } | null;
  };

  return {
    id: data.id,
    versao: data.versao,
    // `numeric` do Postgres chega como STRING no PostgREST; sem Number() a
    // aritmética de percentual viraria concatenação de texto.
    valor_total: Number(data.valor_total),
    observacoes: data.observacoes,
    created_at: data.created_at,
    itens: ((data.orcamento_item ?? []) as unknown as LinhaItem[]).map((i) => ({
      item_id: i.item_id,
      // O FK é `restrict`, então o item não pode ter sido apagado. O fallback
      // existe para o caso de a leitura aninhada vir vazia por permissão.
      descricao: i.item?.descricao ?? "(item indisponível)",
      quantidade: i.quantidade === null ? null : Number(i.quantidade),
      valor_previsto: Number(i.valor_previsto),
    })),
  };
}

/** Todas as versões, da mais recente para a mais antiga. */
export async function historicoOrcamento(
  obraId: string,
): Promise<{ versao: number; valor_total: number; created_at: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamento_locacao")
    .select("versao, valor_total, created_at")
    .eq("obra_id", obraId)
    .order("versao", { ascending: false });

  if (error || !data) {
    console.error("historicoOrcamento", error);
    return [];
  }
  return data.map((d) => ({
    versao: d.versao,
    valor_total: Number(d.valor_total),
    created_at: d.created_at,
  }));
}

/**
 * O realizado de locação da obra.
 *
 * `valor` e não `valor_pago`: orçamento é consumido quando o custo é INCORRIDO.
 * Tratar nota pendente como não consumida faria o percentual despencar todo mês
 * e subir na data do pagamento, sem nada ter mudado na obra.
 *
 * A separação entre com e sem contrato é o que permite à tela ser honesta:
 * `lancamento_financeiro` não tem categoria de custo — `origem` diz COMO o
 * lançamento nasceu, não de que tipo é — então a única forma de saber que um
 * custo é de locação de equipamento é o `contrato_id` estar preenchido.
 */
export async function realizadoLocacao(obraId: string): Promise<RealizadoObra> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .select("valor, valor_pago, contrato_id")
    .eq("obra_id", obraId)
    .is("deleted_at", null);

  if (error || !data) {
    console.error("realizadoLocacao", error);
    return { comContrato: 0, semContrato: 0, pago: 0 };
  }

  let comContrato = 0;
  let semContrato = 0;
  let pago = 0;
  for (const l of data) {
    const valor = Number(l.valor);
    if (l.contrato_id) {
      comContrato += valor;
      pago += Number(l.valor_pago ?? 0);
    } else {
      semContrato += valor;
    }
  }
  return { comContrato, semContrato, pago };
}

export type FechamentoLinha = {
  competencia: string;
  orcado: number;
  realizadoAcumulado: number;
  realizadoMes: number;
  saldo: number;
  avancoFisico: number | null;
  consumido: number | null;
  fechadoEm: string;
  reabertoEm: string | null;
};

/** Os fechamentos de uma obra, do mais recente para o mais antigo. */
export async function fechamentosDaObra(obraId: string): Promise<FechamentoLinha[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fechamento_mensal")
    .select(
      "competencia, orcado, realizado_acumulado, realizado_mes, saldo, avanco_fisico, consumido, fechado_em, reaberto_em",
    )
    .eq("obra_id", obraId)
    .order("competencia", { ascending: false });

  if (error || !data) {
    console.error("fechamentosDaObra", error);
    return [];
  }

  return data.map((f) => ({
    competencia: f.competencia,
    orcado: Number(f.orcado),
    realizadoAcumulado: Number(f.realizado_acumulado),
    realizadoMes: Number(f.realizado_mes),
    saldo: Number(f.saldo),
    avancoFisico: f.avanco_fisico === null ? null : Number(f.avanco_fisico),
    consumido: f.consumido === null ? null : Number(f.consumido),
    fechadoEm: f.fechado_em,
    reabertoEm: f.reaberto_em,
  }));
}
