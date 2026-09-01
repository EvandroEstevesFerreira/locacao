import "server-only";

import { differenceInCalendarMonths } from "date-fns";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { dataDeISO, periodosPorMes, type Cadencia } from "@/lib/locacao";
import type { EntradaPainel } from "@/lib/painel";

/**
 * As entradas do painel de obras.
 *
 * LANÇA em erro, e não devolve vazio.
 *
 * A regra do projeto é que leitura de lista devolva `[]` e registre — mas isso
 * vale para tela de listagem, onde o estado vazio é honesto. Este agregado
 * alimenta o e-mail quinzenal da DIRETORIA: um `[]` silencioso aqui viraria
 * "nenhuma obra com problema", que é uma afirmação plausível e errada na caixa
 * de entrada de quem decide. Mesma regra de `gerarRelatorio` e
 * `gerarFluxoCaixa`.
 *
 * O `cliente` entra por parâmetro porque o cron roda sem sessão e precisa
 * passar o admin; a tela não passa nada e usa `createClient()`.
 */
export async function entradasPainel(
  hojeISO: string,
  cliente?: SupabaseClient,
  orgId?: string,
): Promise<EntradaPainel[]> {
  const supabase = cliente ?? (await createClient());

  let qObras = supabase
    .from("obra")
    .select("id, codigo, nome, data_inicio, data_fim_prevista")
    .eq("status", "ativa")
    .is("deleted_at", null)
    .order("codigo");
  if (orgId) qObras = qObras.eq("org_id", orgId);

  const { data: obras, error: erroObras } = await qObras;
  if (erroObras) throw new Error(`Falha ao ler as obras do painel: ${erroObras.message}`);
  if (!obras || obras.length === 0) return [];

  const ids = obras.map((o) => o.id);

  // Avanço: todas as semanas de todas as obras, ordenadas. O ritmo precisa de
  // mais de um ponto, então não dá para pedir só a semana atual.
  const { data: avancos, error: erroAvancos } = await supabase
    .from("avanco_obra")
    .select("obra_id, semana, percentual")
    .in("obra_id", ids)
    .order("semana", { ascending: false });
  if (erroAvancos) throw new Error(`Falha ao ler o avanço: ${erroAvancos.message}`);

  // Orçamento vigente de cada obra.
  const { data: orcamentos, error: erroOrc } = await supabase
    .from("orcamento_locacao")
    .select("obra_id, valor_total")
    .in("obra_id", ids)
    .eq("vigente", true);
  if (erroOrc) throw new Error(`Falha ao ler o orçamento: ${erroOrc.message}`);

  // Realizado: só o que tem contrato de locação vinculado (ver a spec do
  // subprojeto B — é a única forma de distinguir locação de imóvel).
  const { data: lancamentos, error: erroLanc } = await supabase
    .from("lancamento_financeiro")
    .select("obra_id, valor, contrato_id")
    .in("obra_id", ids)
    .not("contrato_id", "is", null)
    .is("deleted_at", null);
  if (erroLanc) throw new Error(`Falha ao ler o realizado: ${erroLanc.message}`);

  // Contratos ativos com seus itens em aberto: alimentam a contagem de itens, o
  // custo mensal e os meses restantes.
  const { data: contratos, error: erroContratos } = await supabase
    .from("contrato_locacao")
    .select(
      "id, obra_id, cadencia, data_fim_prevista, item_locado(quantidade, valor_unitario_periodo, status)",
    )
    .in("obra_id", ids)
    .eq("status", "ativo")
    .is("deleted_at", null);
  if (erroContratos)
    throw new Error(`Falha ao ler os contratos: ${erroContratos.message}`);

  const porObraAvancos = new Map<string, { semana: string; percentual: number }[]>();
  for (const a of avancos ?? []) {
    const lista = porObraAvancos.get(a.obra_id) ?? [];
    lista.push({ semana: a.semana, percentual: Number(a.percentual) });
    porObraAvancos.set(a.obra_id, lista);
  }

  const porObraOrcado = new Map<string, number>();
  for (const o of orcamentos ?? []) {
    porObraOrcado.set(o.obra_id, Number(o.valor_total));
  }

  const porObraRealizado = new Map<string, number>();
  for (const l of lancamentos ?? []) {
    porObraRealizado.set(
      l.obra_id,
      (porObraRealizado.get(l.obra_id) ?? 0) + Number(l.valor),
    );
  }

  type LinhaItem = {
    quantidade: string | number;
    valor_unitario_periodo: string | number;
    status: string;
  };

  const porObraItens = new Map<string, number>();
  const porObraCusto = new Map<string, number>();
  const porObraFim = new Map<string, string>();

  for (const c of contratos ?? []) {
    const itens = ((c.item_locado ?? []) as unknown as LinhaItem[]).filter(
      (i) => i.status === "em_aberto",
    );
    porObraItens.set(c.obra_id, (porObraItens.get(c.obra_id) ?? 0) + itens.length);

    const periodos = periodosPorMes(c.cadencia as Cadencia);
    const custo = itens.reduce(
      (s, i) => s + Number(i.quantidade) * Number(i.valor_unitario_periodo) * periodos,
      0,
    );
    porObraCusto.set(c.obra_id, (porObraCusto.get(c.obra_id) ?? 0) + custo);

    // O fim mais distante entre os contratos da obra: é até lá que o
    // desembolso continua.
    if (c.data_fim_prevista) {
      const atual = porObraFim.get(c.obra_id);
      if (!atual || c.data_fim_prevista > atual) {
        porObraFim.set(c.obra_id, c.data_fim_prevista);
      }
    }
  }

  const hoje = dataDeISO(hojeISO);

  return obras.map((o) => {
    const fim = porObraFim.get(o.id);
    // Contrato já vencido não gera desembolso futuro: `Math.max(0, …)` evita
    // previsão NEGATIVA, que apareceria como crédito no e-mail da diretoria.
    const mesesRestantes = fim
      ? Math.max(0, differenceInCalendarMonths(dataDeISO(fim), hoje))
      : 0;

    return {
      obra: {
        id: o.id,
        codigo: o.codigo,
        nome: o.nome,
        data_inicio: o.data_inicio,
        data_fim_prevista: o.data_fim_prevista,
      },
      avancos: porObraAvancos.get(o.id) ?? [],
      orcado: porObraOrcado.get(o.id) ?? null,
      realizado: porObraRealizado.get(o.id) ?? 0,
      itensAbertos: porObraItens.get(o.id) ?? 0,
      custoMensal: porObraCusto.get(o.id) ?? 0,
      mesesRestantes,
    };
  });
}
