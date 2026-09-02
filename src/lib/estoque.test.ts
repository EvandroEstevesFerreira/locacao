import { describe, it, expect } from "vitest";
import {
  sinalDoTipo,
  saldoDe,
  curvaABC,
  giro,
  emRuptura,
  semGiro,
  saldoNegativo,
  resumirEstoque,
  movimentoSchema,
  type LinhaEstoque,
} from "./estoque";

function linha(over: Partial<LinhaEstoque> = {}): LinhaEstoque {
  return {
    itemId: "i1",
    descricao: "Cimento CP-II 50kg",
    unidade: "sc",
    saldo: 100,
    saidaPeriodo: 50,
    minimo: 20,
    diasSemMovimento: 3,
    ...over,
  };
}

describe("sinalDoTipo", () => {
  it("entrada e ajuste positivo somam", () => {
    expect(sinalDoTipo("entrada")).toBe(1);
    expect(sinalDoTipo("ajuste_positivo")).toBe(1);
  });

  it("saída, ajuste negativo e baixa subtraem", () => {
    expect(sinalDoTipo("saida")).toBe(-1);
    expect(sinalDoTipo("ajuste_negativo")).toBe(-1);
    expect(sinalDoTipo("baixa")).toBe(-1);
  });
});

describe("saldoDe", () => {
  it("soma o razão respeitando o sinal de cada tipo", () => {
    expect(
      saldoDe([
        { tipo: "entrada", quantidade: 100 },
        { tipo: "saida", quantidade: 30 },
        { tipo: "baixa", quantidade: 5 },
        { tipo: "ajuste_positivo", quantidade: 2 },
      ]),
    ).toBe(67);
  });

  it("razão vazio é saldo zero", () => {
    expect(saldoDe([])).toBe(0);
  });

  it("PERMITE saldo negativo — é erro de lançamento que precisa aparecer", () => {
    // Travar em zero esconderia exatamente o problema que o razão revela.
    expect(saldoDe([{ tipo: "saida", quantidade: 10 }])).toBe(-10);
  });

  it("não devolve lixo de ponto flutuante", () => {
    expect(
      saldoDe([
        { tipo: "entrada", quantidade: 0.1 },
        { tipo: "entrada", quantidade: 0.2 },
      ]),
    ).toBe(0.3);
  });

  it("guarda 3 casas decimais — a precisão da coluna do banco", () => {
    expect(
      saldoDe([
        { tipo: "entrada", quantidade: 1.005 },
        { tipo: "saida", quantidade: 0.002 },
      ]),
    ).toBe(1.003);
  });
});

describe("curvaABC", () => {
  it("classifica por CONSUMO, não por saldo", () => {
    // Um item parado com saldo alto é capital empatado, não item importante.
    const r = curvaABC([
      linha({ itemId: "parado", descricao: "Parado", saldo: 10000, saidaPeriodo: 1 }),
      linha({ itemId: "girando", descricao: "Girando", saldo: 5, saidaPeriodo: 900 }),
    ]);
    expect(r[0].itemId).toBe("girando");
    expect(r[0].classe).toBe("A");
    expect(r[1].classe).toBe("C");
  });

  it("aplica os cortes de Pareto em 80 e 95", () => {
    const r = curvaABC([
      linha({ itemId: "a", descricao: "A", saidaPeriodo: 80 }),
      linha({ itemId: "b", descricao: "B", saidaPeriodo: 15 }),
      linha({ itemId: "c", descricao: "C", saidaPeriodo: 5 }),
    ]);
    expect(r.map((l) => l.classe)).toEqual(["A", "B", "C"]);
    expect(r[0].acumulado).toBeCloseTo(80, 1);
    expect(r[2].acumulado).toBeCloseTo(100, 1);
  });

  it("sem consumo nenhum, TUDO é C — não se inventa relevância", () => {
    const r = curvaABC([
      linha({ itemId: "x", descricao: "X", saidaPeriodo: 0 }),
      linha({ itemId: "y", descricao: "Y", saidaPeriodo: 0 }),
    ]);
    expect(r.every((l) => l.classe === "C")).toBe(true);
  });

  it("empate no consumo mantém ordem alfabética — a lista não dança", () => {
    const r = curvaABC([
      linha({ itemId: "z", descricao: "Zebra", saidaPeriodo: 10 }),
      linha({ itemId: "a", descricao: "Andaime", saidaPeriodo: 10 }),
    ]);
    expect(r.map((l) => l.descricao)).toEqual(["Andaime", "Zebra"]);
  });

  it("lista vazia não quebra", () => {
    expect(curvaABC([])).toEqual([]);
  });
});

describe("giro", () => {
  it("é quantas vezes o estoque se renovou", () => {
    expect(giro(300, 100)).toBe(3);
  });

  it("é null com saldo médio zero ou negativo — nada de giro infinito", () => {
    expect(giro(300, 0)).toBeNull();
    expect(giro(300, -5)).toBeNull();
  });
});

describe("emRuptura", () => {
  it("aponta o que está abaixo do mínimo", () => {
    const r = emRuptura([
      linha({ itemId: "ok", saldo: 100, minimo: 20 }),
      linha({ itemId: "faltando", saldo: 5, minimo: 20 }),
    ]);
    expect(r.map((l) => l.itemId)).toEqual(["faltando"]);
  });

  it("item SEM mínimo configurado não entra", () => {
    // Sem parâmetro não há ruptura. Apontar todo item sem configuração faria a
    // lista nascer inútil e ser ignorada.
    expect(emRuptura([linha({ saldo: 0, minimo: null })])).toEqual([]);
  });

  it("saldo exatamente no mínimo ainda não é ruptura", () => {
    expect(emRuptura([linha({ saldo: 20, minimo: 20 })])).toEqual([]);
  });
});

describe("semGiro", () => {
  it("aponta saldo parado além do prazo", () => {
    const r = semGiro([
      linha({ itemId: "girando", saldo: 10, diasSemMovimento: 5 }),
      linha({ itemId: "parado", saldo: 10, diasSemMovimento: 200 }),
    ]);
    expect(r.map((l) => l.itemId)).toEqual(["parado"]);
  });

  it("item sem saldo não é capital parado", () => {
    expect(semGiro([linha({ saldo: 0, diasSemMovimento: 999 })])).toEqual([]);
  });

  it("item com saldo que NUNCA se moveu é o pior caso, e entra", () => {
    const r = semGiro([linha({ itemId: "nunca", saldo: 10, diasSemMovimento: null })]);
    expect(r.map((l) => l.itemId)).toEqual(["nunca"]);
  });
});

describe("saldoNegativo", () => {
  it("expõe o erro de lançamento", () => {
    const r = saldoNegativo([linha({ itemId: "erro", saldo: -3 }), linha({ saldo: 5 })]);
    expect(r.map((l) => l.itemId)).toEqual(["erro"]);
  });
});

describe("resumirEstoque", () => {
  it("conta os quatro sinais de atenção e soma o consumo", () => {
    const r = resumirEstoque([
      linha({ itemId: "1", saldo: 100, saidaPeriodo: 50, minimo: 20, diasSemMovimento: 3 }),
      linha({ itemId: "2", saldo: 2, saidaPeriodo: 10, minimo: 20, diasSemMovimento: 3 }),
      linha({ itemId: "3", saldo: 50, saidaPeriodo: 0, minimo: null, diasSemMovimento: 200 }),
      linha({ itemId: "4", saldo: -1, saidaPeriodo: 5, minimo: null, diasSemMovimento: 1 }),
    ]);
    expect(r.itens).toBe(4);
    expect(r.emRuptura).toBe(1);
    expect(r.semGiro).toBe(1);
    expect(r.negativos).toBe(1);
    expect(r.saidaPeriodo).toBe(65);
  });

  it("estoque vazio não quebra", () => {
    const r = resumirEstoque([]);
    expect(r.itens).toBe(0);
    expect(r.saidaPeriodo).toBe(0);
  });
});

describe("movimentoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  const base = { item_id: UUID, tipo: "entrada" as const, data: "2026-09-02" };

  it("aceita quantidade com vírgula, que é como se digita", () => {
    const r = movimentoSchema.safeParse({ ...base, quantidade: "12,5" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantidade).toBe(12.5);
  });

  it("recusa quantidade zero e negativa — o sinal vem do TIPO", () => {
    expect(movimentoSchema.safeParse({ ...base, quantidade: "0" }).success).toBe(false);
    expect(movimentoSchema.safeParse({ ...base, quantidade: "-5" }).success).toBe(false);
  });

  it("recusa quantidade em branco", () => {
    expect(movimentoSchema.safeParse({ ...base, quantidade: "" }).success).toBe(false);
  });

  it("obra em branco vira null — almoxarifado central", () => {
    const r = movimentoSchema.safeParse({ ...base, quantidade: "1", obra_id: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.obra_id).toBeNull();
  });

  it("recusa tipo fora da lista", () => {
    expect(
      movimentoSchema.safeParse({ ...base, tipo: "sumiu", quantidade: "1" }).success,
    ).toBe(false);
  });

  it("aceita o próprio output — a action revalida o que o resolver transformou", () => {
    const primeira = movimentoSchema.parse({ ...base, quantidade: "12,5", obra_id: UUID });
    const r = movimentoSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });
});
