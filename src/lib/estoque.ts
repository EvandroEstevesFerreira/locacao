// Estoque: o livro-razão de saldo por quantidade, e o BI em cima dele.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE MÓDULO EXISTE, E O QUE ELE DELIBERADAMENTE NÃO FAZ
// ═══════════════════════════════════════════════════════════════════════════
//
// Boa parte de um módulo de estoque JÁ existia no Loca antes desta fatia:
//
//   entrada .............. `recebimento` + `recebimento_item` (0049)
//   saída para contrato .. `item_locado` (0006)
//   saída para pessoa .... `termo_equipamento_item` (0056)
//   devolução ............ `movimentacao` (0006)
//   baixa e perda ........ `equipamento_unidade.situacao` (0055)
//   onde está ............ `equipamento_unidade.obra_id` (0055)
//
// O que NÃO existia é saldo por QUANTIDADE. Para item `controle = 'quantidade'`
// — cimento, escora, EPI, consumível — ninguém sabia quanto entrou, quanto saiu
// e quanto tem. Este módulo é esse razão.
//
// E é por isso que ele NÃO cria um controle paralelo de equipamento por peça.
// Fazer isso daria ao sistema duas verdades sobre onde a betoneira está — "em
// uso" na frota e "disponível" no estoque — e ninguém saberia em qual acreditar.
// Peça continua sendo assunto de `frota.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════
// AS DUAS REGRAS QUE SUSTENTAM O RESTO
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. SALDO É DERIVADO, NUNCA GRAVADO. Coluna de saldo é a fonte clássica de
//    divergência: qualquer caminho de escrita que esqueça de atualizá-la faz o
//    número mentir para sempre, e ninguém descobre até o inventário. Somar o
//    razão não tem esse defeito.
//
// 2. QUANTIDADE É SEMPRE POSITIVA; O TIPO DÁ O SINAL. Guardar quantidade
//    negativa obriga toda consulta a lembrar da convenção, e a primeira que
//    esquecer soma saída como entrada.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional, textoOpcional, uuidOpcional } from "@/lib/campos";

export const TIPOS_MOVIMENTO = [
  "entrada",
  "saida",
  "ajuste_positivo",
  "ajuste_negativo",
  "baixa",
] as const;
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number];

export const TIPO_MOVIMENTO_INFO: Record<
  TipoMovimento,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; ajuda: string }
> = {
  entrada: {
    label: "Entrada",
    variant: "default",
    ajuda: "Compra, recebimento de fornecedor ou devolução ao almoxarifado.",
  },
  saida: {
    label: "Saída",
    variant: "secondary",
    ajuda: "Requisição para a obra, consumo ou entrega a funcionário.",
  },
  ajuste_positivo: {
    label: "Ajuste positivo",
    variant: "outline",
    ajuda: "Inventário encontrou mais do que o sistema registrava.",
  },
  ajuste_negativo: {
    label: "Ajuste negativo",
    variant: "outline",
    ajuda: "Inventário encontrou menos do que o sistema registrava.",
  },
  baixa: {
    label: "Baixa",
    variant: "destructive",
    ajuda: "Perda, quebra ou descarte. Sai do saldo e fica registrado o motivo.",
  },
};

export const ORIGENS = ["manual", "recebimento", "termo", "contrato", "inventario"] as const;
export type OrigemMovimento = (typeof ORIGENS)[number];

export const ORIGEM_INFO: Record<OrigemMovimento, { label: string }> = {
  manual: { label: "Lançamento manual" },
  recebimento: { label: "Recebimento" },
  termo: { label: "Termo de responsabilidade" },
  contrato: { label: "Contrato de locação" },
  inventario: { label: "Inventário" },
};

/** +1 soma ao saldo, −1 subtrai. É a única definição do sinal no sistema. */
export function sinalDoTipo(tipo: TipoMovimento): 1 | -1 {
  return tipo === "entrada" || tipo === "ajuste_positivo" ? 1 : -1;
}

export type Movimento = {
  tipo: TipoMovimento;
  quantidade: number;
};

/** Arredonda para 3 casas — a precisão da coluna `numeric(14,3)`. */
function arredondar(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Saldo a partir do razão.
 *
 * Pode ficar NEGATIVO, e isso é de propósito: saldo negativo significa que
 * saiu mais do que entrou, o que é um erro de lançamento real que precisa
 * aparecer. Travar em zero esconderia exatamente o problema que o razão existe
 * para revelar.
 */
export function saldoDe(movimentos: Movimento[]): number {
  return arredondar(
    movimentos.reduce((s, m) => s + sinalDoTipo(m.tipo) * m.quantidade, 0),
  );
}

// ── BI ───────────────────────────────────────────────────────────────────────

export type LinhaEstoque = {
  itemId: string;
  descricao: string;
  unidade: string | null;
  saldo: number;
  /** Quanto saiu no período analisado — a base do giro e da curva ABC. */
  saidaPeriodo: number;
  /** Ponto de pedido. `null` = não configurado, e aí não há ruptura a apontar. */
  minimo: number | null;
  /** Dias desde o último movimento, ou `null` se nunca teve. */
  diasSemMovimento: number | null;
};

export type ClasseABC = "A" | "B" | "C";

/**
 * Curva ABC por consumo no período.
 *
 * Classifica por quanto SAIU, não por saldo: um item parado com saldo alto é
 * problema de capital empatado, não de importância. A é o topo que soma 80% do
 * consumo, B vai até 95%, C é o resto — os cortes clássicos de Pareto.
 *
 * Empate no consumo mantém a ordem alfabética, para a lista não dançar entre
 * duas leituras da mesma tela.
 */
export function curvaABC(
  linhas: LinhaEstoque[],
): (LinhaEstoque & { classe: ClasseABC; acumulado: number })[] {
  const total = linhas.reduce((s, l) => s + l.saidaPeriodo, 0);

  const ordenadas = [...linhas].sort(
    (a, b) =>
      b.saidaPeriodo - a.saidaPeriodo ||
      a.descricao.localeCompare(b.descricao, "pt-BR"),
  );

  // Sem consumo nenhum no período, Pareto não tem o que classificar: tudo é C.
  // Devolver "A" para o primeiro da lista alfabética seria inventar relevância.
  if (total <= 0) {
    return ordenadas.map((l) => ({ ...l, classe: "C" as const, acumulado: 0 }));
  }

  let soma = 0;
  return ordenadas.map((l) => {
    // A classe sai do acumulado ANTES deste item, não depois.
    //
    // É a convenção de Pareto, e a diferença não é cosmética: com dois itens em
    // que o maior é 99,9% do consumo, classificar pelo acumulado depois jogaria
    // justamente ele em C — o item mais importante do estoque marcado como
    // irrelevante. O item que LEVA ao corte pertence à classe superior.
    const antes = (soma / total) * 100;
    soma += l.saidaPeriodo;
    const acumulado = (soma / total) * 100;
    const classe: ClasseABC = antes < 80 ? "A" : antes < 95 ? "B" : "C";
    // `acumulado` sai depois porque é o número que se lê na tela: "estes itens
    // somam 80% do consumo".
    return { ...l, classe, acumulado };
  });
}

/**
 * Índice de giro: quantas vezes o estoque se renovou no período.
 *
 * `null` com saldo médio zero ou negativo — dividir daria infinito, e "giro
 * infinito" num painel é ruído que tira a atenção dos números que significam
 * algo.
 */
export function giro(saidaPeriodo: number, saldoMedio: number): number | null {
  if (saldoMedio <= 0) return null;
  return arredondar(saidaPeriodo / saldoMedio);
}

/**
 * Itens abaixo do ponto de pedido.
 *
 * Item sem mínimo configurado NÃO entra: sem parâmetro não há ruptura, e
 * apontar todo item sem configuração como problema faria a lista nascer inútil
 * e ser ignorada.
 */
export function emRuptura(linhas: LinhaEstoque[]): LinhaEstoque[] {
  return linhas.filter((l) => l.minimo !== null && l.saldo < l.minimo);
}

/** Itens com saldo mas sem movimento há mais de `dias` — capital parado. */
export function semGiro(linhas: LinhaEstoque[], dias = 90): LinhaEstoque[] {
  return linhas.filter(
    (l) => l.saldo > 0 && (l.diasSemMovimento === null || l.diasSemMovimento > dias),
  );
}

/** Saldos negativos: erro de lançamento que precisa aparecer, não ser escondido. */
export function saldoNegativo(linhas: LinhaEstoque[]): LinhaEstoque[] {
  return linhas.filter((l) => l.saldo < 0);
}

export type ResumoEstoque = {
  itens: number;
  emRuptura: number;
  semGiro: number;
  negativos: number;
  saidaPeriodo: number;
};

export function resumirEstoque(linhas: LinhaEstoque[]): ResumoEstoque {
  return {
    itens: linhas.length,
    emRuptura: emRuptura(linhas).length,
    semGiro: semGiro(linhas).length,
    negativos: saldoNegativo(linhas).length,
    saidaPeriodo: arredondar(linhas.reduce((s, l) => s + l.saidaPeriodo, 0)),
  };
}

// ── Schema ───────────────────────────────────────────────────────────────────

const quantidade = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) =>
    typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
  )
  .refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) > 0, {
    message: "Informe uma quantidade maior que zero.",
  })
  .transform((v) => Number(v));

export const movimentoSchema = z.object({
  id: idOpcional,
  item_id: z.string().uuid("Selecione o item."),
  // Nulo = almoxarifado central, a mesma convenção da peça em `frota.ts`.
  obra_id: uuidOpcional,
  tipo: z.enum(TIPOS_MOVIMENTO),
  // Sempre positiva: o TIPO dá o sinal. Ver o cabeçalho deste arquivo.
  quantidade,
  data: z.string().min(1, "Informe a data do movimento."),
  documento: textoOpcional(80),
  observacoes: textoOpcional(300),
});

export type MovimentoInput = z.input<typeof movimentoSchema>;
export type MovimentoDados = z.output<typeof movimentoSchema>;
