import { describe, it, expect } from "vitest";
import {
  periodosEntre,
  periodosPorMes,
  custoLinhaLocado,
} from "./locacao";

const d = (iso: string) => {
  const [a, m, dia] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, dia ?? 1);
};

describe("periodosEntre", () => {
  it("arredonda para cima sem pró-rata (período iniciado = cheio)", () => {
    // semanal, 8 dias (inclusivo = 8) → 2 períodos
    expect(periodosEntre("semanal", d("2026-01-01"), d("2026-01-08"))).toBe(2);
  });
  it("com pró-rata, proporcional aos dias", () => {
    const p = periodosEntre("semanal", d("2026-01-01"), d("2026-01-08"), true);
    expect(p).toBeCloseTo(8 / 7, 5);
  });
  it("mínimo de 1 dia", () => {
    expect(periodosEntre("diaria", d("2026-01-01"), d("2026-01-01"))).toBe(1);
  });
});

describe("periodosPorMes", () => {
  it("mensal = 1, semanal ~4,29, diária = 30", () => {
    expect(periodosPorMes("mensal")).toBe(1);
    expect(periodosPorMes("diaria")).toBe(30);
    expect(periodosPorMes("semanal")).toBeCloseTo(30 / 7, 5);
  });
});

describe("custoLinhaLocado — devoluções parciais", () => {
  const base = {
    valorUnitarioPeriodo: 100,
    cadencia: "mensal" as const,
    retirada: d("2026-01-01"),
    fim: d("2026-04-01"), // ~3 meses depois
  };

  it("sem devolução: cobra a quantidade cheia até o fim", () => {
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 10,
      devolucoes: [],
    });
    expect(saldo).toBe(10);
    // 91 dias inclusivos / 30 = 3.03 → ceil 4 períodos
    const periodos = Math.ceil((91 + 0) / 30);
    expect(custo).toBe(10 * 100 * periodos);
  });

  it("NÃO cobra quantidade cheia após devolução parcial (corrige o bug)", () => {
    // 10 unidades; devolve 6 em 01/02 (32 dias → 2 períodos), saldo 4 até 01/04.
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 10,
      devolucoes: [{ quantidade: 6, data: d("2026-02-01") }],
    });
    expect(saldo).toBe(4);
    const perDevolvido = Math.ceil((31 + 1) / 30); // 01/01→01/02 inclusivo = 32 → 2
    const perSaldo = Math.ceil((90 + 1) / 30); // 01/01→01/04 = 91 → 4
    expect(custo).toBe(6 * 100 * perDevolvido + 4 * 100 * perSaldo);
    // e é MENOR que cobrar tudo cheio até o fim
    expect(custo).toBeLessThan(10 * 100 * perSaldo);
  });

  it("totalmente devolvido: só cobra até as datas de devolução, saldo 0", () => {
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 5,
      devolucoes: [
        { quantidade: 2, data: d("2026-01-15") },
        { quantidade: 3, data: d("2026-02-10") },
      ],
    });
    expect(saldo).toBe(0);
    const per1 = Math.ceil((14 + 1) / 30); // 15 dias → 1
    const per2 = Math.ceil((40 + 1) / 30); // 41 dias → 2
    expect(custo).toBe(2 * 100 * per1 + 3 * 100 * per2);
  });
});
