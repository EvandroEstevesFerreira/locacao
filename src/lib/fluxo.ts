import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, format, startOfMonth } from "date-fns";
import { periodosPorMes, type Cadencia } from "@/lib/locacao";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>;

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export type MesFluxo = {
  chave: string; // yyyy-MM
  label: string; // "jul/2026"
  pago: number;
  pendente: number;
  projetado: number; // estimativa de contratos sem lançamento no mês
  total: number; // pago + pendente + projetado
  acumulado: number;
};

export type FluxoCaixa = {
  meses: MesFluxo[];
  totalPrevisto: number;
  maxTotal: number;
};

function chaveMes(d: Date) {
  return format(d, "yyyy-MM");
}
function labelMes(chave: string) {
  const [ano, mes] = chave.split("-").map(Number);
  return `${MESES_PT[(mes ?? 1) - 1]}/${ano}`;
}

/**
 * Projeção de desembolsos mês a mês: lançamentos reais (por vencimento) +
 * custo mensal estimado dos contratos ativos nos meses SEM lançamento próprio.
 * Horizonte: do mês atual até o maior fim previsto/vencimento (máx. 12 meses).
 */
export async function gerarFluxoCaixa(
  supabase: DB,
  filtros: { obra_id?: string } = {},
): Promise<FluxoCaixa> {
  // --- Lançamentos (contas a pagar) ---
  let ql = supabase
    .from("lancamento_financeiro")
    .select("contrato_id, vencimento, valor, status, obra_id");
  if (filtros.obra_id) ql = ql.eq("obra_id", filtros.obra_id);
  const { data: lancamentos } = await ql;

  // --- Contratos ativos + itens em aberto (para projeção) ---
  let qc = supabase
    .from("contrato_locacao")
    .select(
      "id, obra_id, data_inicio, data_fim_prevista, cadencia, item_locado(quantidade, valor_unitario_periodo, status, movimentacao(quantidade, tipo))",
    )
    .eq("status", "ativo");
  if (filtros.obra_id) qc = qc.eq("obra_id", filtros.obra_id);
  const { data: contratos } = await qc;

  // --- Contratos de imóvel vigentes (para projeção da parcela mensal) ---
  const { data: contratosImovel } = await supabase
    .from("contrato_imovel")
    .select(
      "id, data_inicio, data_fim, valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, imovel:imovel_id(obra_id)",
    )
    .eq("vigente", true);

  const hojeMes = startOfMonth(new Date());
  let fimMes = addMonths(hojeMes, 1);

  // custo mensal estimado por contrato + janela de vigência (em meses)
  const projPorContrato = (contratos ?? []).map(
    (c: Record<string, unknown>) => {
      const itens = (c.item_locado as Record<string, unknown>[]) ?? [];
      const custoMensal = itens.reduce((s, i) => {
        // Saldo em aberto = quantidade - devolvido (respeita devoluções parciais).
        const movs = (i.movimentacao as Record<string, unknown>[]) ?? [];
        const devolvido = movs
          .filter((m) => m.tipo === "devolucao")
          .reduce((a, m) => a + Number(m.quantidade), 0);
        const saldo = Math.max(0, Number(i.quantidade) - devolvido);
        if (saldo <= 0) return s;
        return (
          s +
          saldo *
            Number(i.valor_unitario_periodo) *
            periodosPorMes(c.cadencia as Cadencia)
        );
      }, 0);
      const inicio = startOfMonth(new Date(String(c.data_inicio)));
      const fim = c.data_fim_prevista
        ? startOfMonth(new Date(String(c.data_fim_prevista)))
        : addMonths(hojeMes, 11);
      if (fim > fimMes) fimMes = fim;
      return { id: c.id as string, custoMensal, inicio, fim };
    },
  );

  // custo mensal projetado dos imóveis (contrato vigente) + janela de vigência
  const projPorImovel = (contratosImovel ?? [])
    .filter((c: Record<string, unknown>) => {
      if (!filtros.obra_id) return true;
      const imv = c.imovel as { obra_id: string | null } | null;
      return imv?.obra_id === filtros.obra_id;
    })
    .map((c: Record<string, unknown>) => {
      const custoMensal =
        Number(c.valor_aluguel) +
        Number(c.valor_condominio) +
        Number(c.valor_iptu) +
        (c.seguro_fianca_mensal ? Number(c.seguro_fianca) : 0);
      const inicio = c.data_inicio
        ? startOfMonth(new Date(String(c.data_inicio)))
        : hojeMes;
      const fim = c.data_fim
        ? startOfMonth(new Date(String(c.data_fim)))
        : addMonths(hojeMes, 11);
      if (fim > fimMes) fimMes = fim;
      // prefixo "imovel:" garante id único (não colide com lançamentos por contrato)
      return { id: `imovel:${c.id}`, custoMensal, inicio, fim };
    });

  const proj = [...projPorContrato, ...projPorImovel];

  // estende o horizonte até o maior vencimento pendente
  for (const l of lancamentos ?? []) {
    const v = startOfMonth(new Date(String(l.vencimento)));
    if (v > fimMes) fimMes = v;
  }

  // limite de 12 meses à frente
  const limite = addMonths(hojeMes, 11);
  if (fimMes > limite) fimMes = limite;

  // --- Monta os meses ---
  const meses: MesFluxo[] = [];
  let cursor = hojeMes;
  let acumulado = 0;

  while (cursor <= fimMes) {
    const chave = chaveMes(cursor);
    const lancMes = (lancamentos ?? []).filter(
      (l) => chaveMes(new Date(String(l.vencimento))) === chave,
    );
    const pago = lancMes
      .filter((l) => l.status === "pago")
      .reduce((s, l) => s + Number(l.valor), 0);
    const pendente = lancMes
      .filter((l) => l.status !== "pago")
      .reduce((s, l) => s + Number(l.valor), 0);
    const contratosComLanc = new Set(
      lancMes.map((l) => l.contrato_id).filter(Boolean),
    );

    // projeção: contratos ativos/imóveis vigentes no mês SEM lançamento próprio
    const projetado = proj
      .filter(
        (p) =>
          !contratosComLanc.has(p.id) &&
          cursor >= p.inicio &&
          cursor <= p.fim,
      )
      .reduce((s, p) => s + p.custoMensal, 0);

    const total = pago + pendente + projetado;
    acumulado += total;
    meses.push({
      chave,
      label: labelMes(chave),
      pago,
      pendente,
      projetado,
      total,
      acumulado,
    });
    cursor = addMonths(cursor, 1);
  }

  const totalPrevisto = meses.reduce((s, m) => s + m.total, 0);
  const maxTotal = meses.reduce((m, x) => Math.max(m, x.total), 0);

  return { meses, totalPrevisto, maxTotal };
}
