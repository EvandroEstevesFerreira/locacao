import { describe, it, expect } from "vitest";
import { obraSchema } from "./obra";

describe("obraSchema — período", () => {
  const base = {
    codigo: "OB-01",
    nome: "Obra",
    status: "ativa" as const,
    destinatarios_alerta: [],
  };

  it("aceita obra sem período — é o estado de toda obra já cadastrada", () => {
    const r = obraSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.data_inicio).toBeNull();
      expect(r.data.data_fim_prevista).toBeNull();
      expect(r.data.data_fim_real).toBeNull();
    }
  });

  it("recusa fim previsto anterior ao início", () => {
    const r = obraSchema.safeParse({
      ...base,
      data_inicio: "2026-06-01",
      data_fim_prevista: "2026-05-01",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // A mensagem tem de sair NO CAMPO, não na raiz: erro de raiz não é
      // renderizado por campo nenhum do formulário.
      expect(r.error.issues[0].path).toEqual(["data_fim_prevista"]);
    }
  });

  it("aceita fim igual ao início — obra de um dia", () => {
    const r = obraSchema.safeParse({
      ...base,
      data_inicio: "2026-06-01",
      data_fim_prevista: "2026-06-01",
    });
    expect(r.success).toBe(true);
  });

  it("aceita início sem fim previsto, e fim previsto sem início", () => {
    expect(obraSchema.safeParse({ ...base, data_inicio: "2026-06-01" }).success).toBe(true);
    expect(obraSchema.safeParse({ ...base, data_fim_prevista: "2026-06-01" }).success).toBe(true);
  });

  it("aceita o próprio output — a action revalida o que o resolver transformou", () => {
    const primeira = obraSchema.parse({
      ...base,
      data_inicio: "2026-06-01",
      data_fim_prevista: "2026-12-01",
    });
    const r = obraSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });
});
