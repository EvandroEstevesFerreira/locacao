import { describe, it, expect } from "vitest";
import { termoItemSchema, funcionarioSchema, ESTADO_INFO, ESTADOS } from "./termo";

describe("termoItemSchema", () => {
  const base = {
    item_id: "11111111-1111-4111-8111-111111111111",
    quantidade: "1",
    estado_entrega: "bom",
    controle: "quantidade",
    unidade_id: "",
    observacoes: "",
  };

  it("item por quantidade não exige patrimônio", () => {
    expect(termoItemSchema.safeParse(base).success).toBe(true);
  });

  it("item por peça SEM patrimônio é recusado", () => {
    const r = termoItemSchema.safeParse({ ...base, controle: "peca" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("patrimônio");
    }
  });

  it("item por peça COM patrimônio é aceito", () => {
    const r = termoItemSchema.safeParse({
      ...base,
      controle: "peca",
      unidade_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(r.success).toBe(true);
  });

  it("é idempotente — reparsear o próprio output não quebra", () => {
    const um = termoItemSchema.parse(base);
    expect(() => termoItemSchema.parse(um)).not.toThrow();
  });
});

describe("funcionarioSchema", () => {
  it("aceita funcionário só com nome", () => {
    const r = funcionarioSchema.safeParse({ nome: "José Carlos da Silva" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cpf).toBeNull();
  });

  it("recusa nome em branco", () => {
    expect(funcionarioSchema.safeParse({ nome: "  " }).success).toBe(false);
  });
});

describe("ESTADO_INFO", () => {
  it("todo estado tem rótulo acentuado", () => {
    for (const e of ESTADOS) expect(ESTADO_INFO[e].label.length).toBeGreaterThan(0);
  });
});
