import { describe, it, expect } from "vitest";
import { expandirLinhas, type Relatorio } from "./relatorios";

const base = (over: Partial<Relatorio>): Relatorio => ({
  titulo: "T",
  colunas: [
    { key: "obra", label: "Obra", tipo: "texto" },
    { key: "valor", label: "Valor", tipo: "moeda" },
  ],
  linhas: [],
  ...over,
});

describe("expandirLinhas", () => {
  it("agrupa por obra com subtotais e total geral", () => {
    const r = base({
      agruparPor: "obra",
      linhas: [
        { obra: "A", valor: 10 },
        { obra: "B", valor: 5 },
        { obra: "A", valor: 20 },
      ],
    });
    const out = expandirLinhas(r);
    expect(out.map((l) => l.tipo)).toEqual([
      "dado",
      "dado",
      "subtotal",
      "dado",
      "subtotal",
      "total",
    ]);
    const subA = out[2];
    expect(subA).toMatchObject({ tipo: "subtotal", rotulo: "A", valores: { valor: 30 } });
    const total = out[out.length - 1];
    expect(total).toMatchObject({ tipo: "total", rotulo: "TOTAL GERAL", valores: { valor: 35 } });
  });

  it("sem agruparPor gera só total geral", () => {
    const r = base({ linhas: [{ obra: "A", valor: 10 }, { obra: "B", valor: 5 }] });
    const out = expandirLinhas(r);
    expect(out.map((l) => l.tipo)).toEqual(["dado", "dado", "total"]);
    expect(out[2]).toMatchObject({ valores: { valor: 15 } });
  });

  it("relatório vazio não gera total", () => {
    expect(expandirLinhas(base({ linhas: [] }))).toEqual([]);
  });

  it("sem colunas de moeda não gera subtotal/total", () => {
    const r: Relatorio = {
      titulo: "T",
      colunas: [{ key: "obra", label: "Obra", tipo: "texto" }],
      agruparPor: "obra",
      linhas: [{ obra: "A" }, { obra: "B" }],
    };
    expect(expandirLinhas(r).map((l) => l.tipo)).toEqual(["dado", "dado"]);
  });
});
