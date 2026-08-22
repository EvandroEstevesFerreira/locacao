import { describe, it, expect } from "vitest";
import { ocupanteSchema } from "./imoveis";

const base = {
  imovel_id: "11111111-1111-4111-8111-111111111111",
  nome: "Fulano de Tal",
};

describe("ocupanteSchema", () => {
  it("aceita o mínimo: imóvel e nome", () => {
    expect(ocupanteSchema.safeParse(base).success).toBe(true);
  });

  it("exige o nome", () => {
    expect(ocupanteSchema.safeParse({ ...base, nome: "  " }).success).toBe(false);
  });

  it("campo de texto vazio vira null, não string vazia", () => {
    const r = ocupanteSchema.parse({ ...base, cargo: "", quarto: "  " });
    expect(r.cargo).toBeNull();
    expect(r.quarto).toBeNull();
  });

  it("recusa saída anterior à entrada", () => {
    const r = ocupanteSchema.safeParse({
      ...base,
      data_entrada: "2026-08-10",
      data_saida: "2026-08-01",
    });
    expect(r.success).toBe(false);
  });

  it("aceita saída igual à entrada", () => {
    const r = ocupanteSchema.safeParse({
      ...base,
      data_entrada: "2026-08-10",
      data_saida: "2026-08-10",
    });
    expect(r.success).toBe(true);
  });

  it("aceita entrada sem saída", () => {
    const r = ocupanteSchema.safeParse({ ...base, data_entrada: "2026-08-10" });
    expect(r.success).toBe(true);
  });
});
