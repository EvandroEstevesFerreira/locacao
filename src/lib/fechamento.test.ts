import { describe, it, expect } from "vitest";
import {
  montarFechamento,
  competenciaAnterior,
  variacao,
  estaFechada,
  fechamentoSchema,
} from "./fechamento";

describe("montarFechamento", () => {
  it("o saldo é sobre o ACUMULADO, não sobre o mês", () => {
    // Ninguém orça locação por mês; orça a obra. Saldo mensal seria uma fração
    // sem significado.
    const f = montarFechamento("2026-09-01", {
      orcado: 400000,
      realizadoAcumulado: 248000,
      realizadoMes: 31000,
      avancoFisico: 31,
    });
    expect(f.saldo).toBe(152000);
    expect(f.consumido).toBeCloseTo(62, 1);
  });

  it("saldo negativo quando estourou", () => {
    const f = montarFechamento("2026-09-01", {
      orcado: 100000,
      realizadoAcumulado: 130000,
      realizadoMes: 10000,
      avancoFisico: 50,
    });
    expect(f.saldo).toBe(-30000);
    expect(f.consumido).toBeCloseTo(130, 1);
  });

  it("orçado zero não divide por zero", () => {
    const f = montarFechamento("2026-09-01", {
      orcado: 0,
      realizadoAcumulado: 5000,
      realizadoMes: 5000,
      avancoFisico: null,
    });
    expect(f.consumido).toBeNull();
    expect(f.saldo).toBe(-5000);
  });

  it("não devolve lixo de ponto flutuante no saldo", () => {
    const f = montarFechamento("2026-09-01", {
      orcado: 100.1,
      realizadoAcumulado: 33.37,
      realizadoMes: 0,
      avancoFisico: null,
    });
    expect(f.saldo).toBe(66.73);
  });
});

describe("competenciaAnterior", () => {
  it("volta um mês", () => {
    expect(competenciaAnterior("2026-09-01")).toBe("2026-08-01");
  });

  it("atravessa a virada de ano", () => {
    expect(competenciaAnterior("2026-01-01")).toBe("2025-12-01");
  });

  it("mantém dois dígitos no mês", () => {
    expect(competenciaAnterior("2026-11-01")).toBe("2026-10-01");
  });
});

describe("variacao", () => {
  const atual = montarFechamento("2026-09-01", {
    orcado: 400000,
    realizadoAcumulado: 248000,
    realizadoMes: 31000,
    avancoFisico: 31,
  });

  it("compara com o mês anterior fechado", () => {
    const anterior = montarFechamento("2026-08-01", {
      orcado: 400000,
      realizadoAcumulado: 200000,
      realizadoMes: 40000,
      avancoFisico: 25,
    });
    const v = variacao(atual, anterior);
    expect(v.consumido).toBeCloseTo(12, 0);
    expect(v.avanco).toBeCloseTo(6, 0);
  });

  it("é null sem mês anterior — melhor que mostrar variação sem base", () => {
    const v = variacao(atual, null);
    expect(v.consumido).toBeNull();
    expect(v.avanco).toBeNull();
  });

  it("é null no avanço quando um dos dois meses não tem avanço lançado", () => {
    const anterior = montarFechamento("2026-08-01", {
      orcado: 400000,
      realizadoAcumulado: 200000,
      realizadoMes: 40000,
      avancoFisico: null,
    });
    expect(variacao(atual, anterior).avanco).toBeNull();
    // O consumo, que não depende do avanço, continua comparável.
    expect(variacao(atual, anterior).consumido).toBeCloseTo(12, 0);
  });
});

describe("estaFechada", () => {
  it("reconhece a competência fechada", () => {
    const fechadas = new Set(["2026-08-01", "2026-07-01"]);
    expect(estaFechada("2026-08-01", fechadas)).toBe(true);
    expect(estaFechada("2026-09-01", fechadas)).toBe(false);
  });
});

describe("fechamentoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("normaliza AAAA-MM para o dia 1", () => {
    const r = fechamentoSchema.safeParse({ obra_id: UUID, competencia: "2026-09" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.competencia).toBe("2026-09-01");
  });

  it("aceita a data completa e o próprio output", () => {
    const primeira = fechamentoSchema.parse({
      obra_id: UUID,
      competencia: "2026-09-01",
    });
    expect(primeira.competencia).toBe("2026-09-01");
    const r = fechamentoSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });

  it("recusa competência fora do formato", () => {
    expect(
      fechamentoSchema.safeParse({ obra_id: UUID, competencia: "09/2026" }).success,
    ).toBe(false);
  });

  it("aceita o id em branco do input oculto", () => {
    const r = fechamentoSchema.safeParse({
      id: "",
      obra_id: UUID,
      competencia: "2026-09",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBeNull();
  });
});
