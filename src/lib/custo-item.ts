// Custo por item: o elo que faltava entre a nota e o equipamento.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `lancamento_financeiro` se liga ao CONTRATO, não ao item. Um contrato de
// R$ 40.000 com betoneira, gerador e 200 escoras é uma linha só no financeiro —
// e não havia como dizer quanto a betoneira custou. A diretoria pediu
// exatamente isso: "acompanhamento das contas de cada item".
//
// A escolha central, e ela é de negócio:
//
//   NÃO existe regra oculta de rateio. O valor por item é GRAVADO,
//   explicitamente, e o rateio proporcional é só um botão que PRÉ-PREENCHE.
//
// Rateio automático invisível produz um número que ninguém consegue explicar
// quando o diretor pergunta "por que a betoneira deu isso?". Valor gravado se
// explica olhando a linha. O preenchimento automático dá a conveniência sem
// esconder a origem.
//
// Tudo aqui é puro.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional } from "@/lib/campos";

/** Uma linha de contrato, com o custo mensal que serve de peso no rateio. */
export type ItemParaRateio = {
  item_locado_id: string;
  descricao: string;
  /** Custo mensal estimado da linha: quantidade × valor × períodos por mês. */
  custoMensal: number;
};

export type ParcelaItem = { item_locado_id: string; valor: number };

/** Arredonda para centavos, evitando o lixo binário de ponto flutuante. */
function centavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Rateio sugerido, proporcional ao custo mensal contratado de cada item.
 *
 * É SUGESTÃO: o formulário pré-preenche com isto e a pessoa ajusta. O valor
 * gravado é o que a pessoa confirmou, não o que esta função calculou.
 *
 * A última parcela absorve a diferença de arredondamento. Sem isso, dividir
 * R$ 100 entre 3 itens iguais daria 33,33 × 3 = 99,99 e sobraria um centavo
 * órfão — que, num painel de diretoria, é a linha que ninguém consegue
 * conciliar.
 *
 * Peso total zero (contrato sem valor lançado nas linhas) devolve divisão
 * IGUAL: é o único palpite defensável quando não há peso, e melhor do que
 * devolver vazio e deixar a pessoa digitar tudo à mão.
 */
export function ratearProporcional(
  valorTotal: number,
  itens: ItemParaRateio[],
): ParcelaItem[] {
  if (itens.length === 0) return [];

  const pesoTotal = itens.reduce((s, i) => s + i.custoMensal, 0);
  const usarIgual = pesoTotal <= 0;

  const parcelas = itens.map((i) => ({
    item_locado_id: i.item_locado_id,
    valor: centavos(
      usarIgual ? valorTotal / itens.length : valorTotal * (i.custoMensal / pesoTotal),
    ),
  }));

  // A diferença de arredondamento vai para a última parcela.
  const soma = parcelas.reduce((s, p) => s + p.valor, 0);
  const resto = centavos(valorTotal - soma);
  if (resto !== 0) {
    parcelas[parcelas.length - 1].valor = centavos(
      parcelas[parcelas.length - 1].valor + resto,
    );
  }
  return parcelas;
}

/**
 * Quanto do lançamento ainda não foi atribuído a item nenhum.
 *
 * Positivo = falta atribuir; negativo = atribuiu mais do que a nota. Os dois
 * casos são PERMITIDOS e exibidos, em vez de proibidos: a mesma escolha do
 * orçamento por item, porque forçar o fechamento na vírgula obriga a detalhar
 * tudo ou nada, e o resultado prático é não detalhar.
 */
export function naoAtribuido(valorLancamento: number, parcelas: ParcelaItem[]): number {
  return centavos(valorLancamento - parcelas.reduce((s, p) => s + p.valor, 0));
}

/** Orçado contra realizado, por item do catálogo. */
export type LinhaItemCusto = {
  itemId: string;
  descricao: string;
  orcado: number | null;
  realizado: number;
  /** Realizado menos orçado. Positivo = passou do orçado. */
  desvio: number | null;
  /** Fração do orçado consumida, ou null sem orçamento para o item. */
  consumido: number | null;
};

export type EntradaItemCusto = {
  itemId: string;
  descricao: string;
  orcado: number | null;
  realizado: number;
};

/**
 * Monta o confronto por item, ordenado por quem passou mais do orçado.
 *
 * Item sem orçamento próprio vai para o fim: como no painel de obras, "não
 * orçado" não é "dentro do orçamento", e deixá-lo no topo esconderia o item que
 * de fato estourou.
 */
export function resumirPorItem(entradas: EntradaItemCusto[]): LinhaItemCusto[] {
  return entradas
    .map((e) => ({
      itemId: e.itemId,
      descricao: e.descricao,
      orcado: e.orcado,
      realizado: e.realizado,
      desvio: e.orcado === null ? null : centavos(e.realizado - e.orcado),
      consumido:
        e.orcado === null || e.orcado <= 0 ? null : (e.realizado / e.orcado) * 100,
    }))
    .sort((a, b) => {
      // Sem orçamento vai para o fim, mantendo a ordem alfabética entre eles.
      if (a.desvio === null && b.desvio === null) {
        return a.descricao.localeCompare(b.descricao, "pt-BR");
      }
      if (a.desvio === null) return 1;
      if (b.desvio === null) return -1;
      return b.desvio - a.desvio;
    });
}

// ── Schema ───────────────────────────────────────────────────────────────────

export const parcelaItemSchema = z.object({
  item_locado_id: z.string().uuid("Selecione o item do contrato."),
  valor: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
    )
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: "Valor inválido.",
    })
    .transform((v) => (v === "" ? 0 : Number(v))),
});

export const rateioSchema = z
  .object({
    id: idOpcional,
    lancamento_id: z.string().uuid("Lançamento inválido."),
    parcelas: z.array(parcelaItemSchema).default([]),
  })
  .superRefine((d, ctx) => {
    // O banco tem `unique (lancamento_id, item_locado_id)`; sem esta checagem o
    // erro chegaria cru como "duplicate key value violates unique constraint".
    const vistos = new Set<string>();
    d.parcelas.forEach((p, idx) => {
      if (vistos.has(p.item_locado_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["parcelas", idx, "item_locado_id"],
          message: "Este item já está no rateio.",
        });
      }
      vistos.add(p.item_locado_id);
    });
  });

export type RateioInput = z.input<typeof rateioSchema>;
export type RateioDados = z.output<typeof rateioSchema>;
