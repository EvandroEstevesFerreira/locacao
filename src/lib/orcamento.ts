// Orçamento de locação: o terceiro percentual, e o cruzamento dos três.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Prazo decorrido e avanço físico já existem (src/lib/avanco.ts). Faltava o
// consumo do orçamento, que é o que transforma dois números em diagnóstico:
//
//   consumido 62%  ÷  avanço 31%  =  2,0  →  200% do orçamento no fim
//
// "Consumi 62%" isolado não diz nada. Ao lado de "entreguei 31%", diz que a
// obra vai estourar o dobro — e é esse número que muda decisão de diretor.
//
// Tudo aqui é puro. O número que a diretoria vai ler tem de ser testável sem
// banco.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional, textoOpcional } from "@/lib/campos";

/**
 * Percentual do orçamento já comprometido.
 *
 * `null` com orçado ≤ 0: obra sem orçamento não tem percentual, e dividir por
 * zero daria `Infinity` — a tela mostraria "∞%".
 *
 * NÃO trava em 100 de propósito. Travar esconderia exatamente o que interessa:
 * uma obra em 130% precisa aparecer como 130%.
 */
export function percentualConsumido(orcado: number, realizado: number): number | null {
  if (!Number.isFinite(orcado) || orcado <= 0) return null;
  return (realizado / orcado) * 100;
}

/**
 * Quanto do orçamento a obra consumirá no ritmo atual, em percentual.
 *
 * A conta é uma regra de três: se 31% de obra custou 62% do orçamento, 100% de
 * obra custará 200%.
 *
 * `null` sem avanço físico — e é o caso mais importante desta função. Uma obra
 * em 0% que já gastou R$ 10.000 projetaria infinito, e "estouro de ∞" num
 * painel de diretoria destrói a confiança em tudo que está ao lado.
 */
export function projecaoFinal(
  consumido: number | null,
  fisico: number | null,
): number | null {
  if (consumido === null || fisico === null || fisico <= 0) return null;
  return (consumido / fisico) * 100;
}

/** Reais acima do orçamento na projeção. `null` quando não estoura. */
export function estouroPrevisto(orcado: number, projecao: number | null): number | null {
  if (projecao === null || projecao <= 100) return null;
  return orcado * ((projecao - 100) / 100);
}

/**
 * Margem, em pontos percentuais, para o veredito não oscilar.
 *
 * Sem ela, uma obra com 45% de consumo e 44% de avanço mudaria de diagnóstico a
 * cada semana por ruído de arredondamento — e diagnóstico que muda toda semana
 * deixa de ser lido.
 */
const MARGEM_PONTOS = 10;

/** O veredito legível do cruzamento dos três percentuais. */
export function diagnostico(
  prazo: number | null,
  fisico: number | null,
  consumido: number | null,
): string {
  // A ordem das faltas importa: dizer QUAL dado falta é o que faz a pessoa
  // saber o que preencher. "Dados insuficientes" não ensina nada.
  //
  // Orçamento vem primeiro porque sem ele não há nada a diagnosticar, mesmo
  // que prazo e avanço estejam completos.
  if (consumido === null) return "Sem orçamento cadastrado.";
  if (fisico === null) return "Sem avanço físico lançado.";

  if (consumido > fisico + MARGEM_PONTOS) return "Consumindo mais rápido que entrega.";
  if (consumido < fisico - MARGEM_PONTOS) return "Entregando mais que consome.";
  return "Consumo alinhado ao avanço.";
}

/** Soma do detalhamento, para a linha de divergência contra o total. */
export function totalDetalhado(itens: { valor_previsto: number }[]): number {
  return itens.reduce((soma, i) => soma + i.valor_previsto, 0);
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Mora aqui, e não em `orcamento-actions.ts`, porque arquivo "use server" não
// atravessa para o cliente e o formulário precisa do schema.

/**
 * Dinheiro de formulário.
 *
 * Aceita string com vírgula (é como se digita em português), número e o próprio
 * output — a action revalida o que o zodResolver já transformou, então
 * `parse(parse(x))` precisa dar `parse(x)`. Mesmo padrão do helper de `imoveis.ts`.
 */
const dinheiro = (msg: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
    )
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: msg,
    })
    .transform((v) => (v === "" ? 0 : Number(v)));

export const orcamentoItemSchema = z.object({
  item_id: z.string().uuid("Selecione o item."),
  quantidade: dinheiro("Quantidade inválida."),
  valor_previsto: dinheiro("Valor previsto inválido."),
});

export const orcamentoSchema = z
  .object({
    id: idOpcional,
    obra_id: z.string().uuid("Selecione a obra."),
    valor_total: dinheiro("Informe o valor do orçamento."),
    observacoes: textoOpcional(500),
    itens: z.array(orcamentoItemSchema).default([]),
  })
  .superRefine((d, ctx) => {
    // O banco tem `unique (orcamento_id, item_id)`, e sem esta checagem o erro
    // chegaria cru na tela: "duplicate key value violates unique constraint".
    const vistos = new Set<string>();
    d.itens.forEach((i, idx) => {
      if (vistos.has(i.item_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["itens", idx, "item_id"],
          message: "Este item já está no orçamento.",
        });
      }
      vistos.add(i.item_id);
    });
  });

export type OrcamentoInput = z.input<typeof orcamentoSchema>;
export type OrcamentoDados = z.output<typeof orcamentoSchema>;
