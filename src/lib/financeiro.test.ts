import { describe, it, expect } from "vitest";
import { mesesRecorrentes, calcularEncargos } from "./financeiro";

describe("mesesRecorrentes", () => {
  it("gera uma parcela por mês do início até o limite 'ate'", () => {
    const r = mesesRecorrentes({
      inicio: "2026-01-15",
      fim: null,
      ate: "2026-03",
      diaVencimento: 10,
    });
    expect(r.map((m) => m.competencia)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
    expect(r[0].vencimento).toBe("2026-01-10");
  });

  it("respeita o fim do contrato quando anterior ao limite", () => {
    const r = mesesRecorrentes({
      inicio: "2026-01-01",
      fim: "2026-02-28",
      ate: "2026-12",
      diaVencimento: 5,
    });
    expect(r).toHaveLength(2);
    expect(r[1].competencia).toBe("2026-02-01");
  });

  it("faz clamp do dia de vencimento ao último dia do mês (fevereiro)", () => {
    const r = mesesRecorrentes({
      inicio: "2026-02-01",
      fim: "2026-02-28",
      ate: "2026-02",
      diaVencimento: 31,
    });
    expect(r[0].vencimento).toBe("2026-02-28");
  });
});

describe("calcularEncargos", () => {
  it("não cobra encargos quando não há atraso", () => {
    const r = calcularEncargos({
      valor: 1000,
      vencimento: "2026-07-10",
      referencia: "2026-07-10",
    });
    expect(r).toEqual({ diasAtraso: 0, multa: 0, juros: 0, total: 1000 });
  });

  it("aplica multa 2% + juros 1% a.m. pró-rata sobre o atraso", () => {
    const r = calcularEncargos({
      valor: 1000,
      vencimento: "2026-07-01",
      referencia: "2026-07-31", // 30 dias
    });
    expect(r.diasAtraso).toBe(30);
    expect(r.multa).toBe(20); // 2%
    expect(r.juros).toBe(10); // 1% a.m. por 30 dias
    expect(r.total).toBe(1030);
  });
});
