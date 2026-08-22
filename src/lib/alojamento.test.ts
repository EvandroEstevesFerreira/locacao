import { describe, it, expect } from "vitest";
import { medidaDisciplinarSchema, entregaOcupanteSchema } from "./alojamento";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

const medida = {
  ocupante_id: UUID_A,
  imovel_id: UUID_B,
  data: "2026-08-22",
  tipo: "escrita" as const,
  fato_descricao: "Descumpriu o horário de silêncio pela segunda vez no mês.",
};

describe("medidaDisciplinarSchema", () => {
  it("aceita uma advertência escrita completa", () => {
    expect(medidaDisciplinarSchema.safeParse(medida).success).toBe(true);
  });

  it("exige descrição do fato com substância", () => {
    const r = medidaDisciplinarSchema.safeParse({ ...medida, fato_descricao: "brigou" });
    expect(r.success).toBe(false);
  });

  it("recusa suspensão acima de 30 dias (CLT, art. 474)", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 31,
      suspensao_inicio: "2026-08-25",
    });
    expect(r.success).toBe(false);
  });

  it("aceita suspensão de 30 dias", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 30,
      suspensao_inicio: "2026-08-25",
    });
    expect(r.success).toBe(true);
  });

  it("suspensão sem data de início é recusada", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 3,
    });
    expect(r.success).toBe(false);
  });

  it("advertência verbal não exige dias de suspensão", () => {
    const r = medidaDisciplinarSchema.safeParse({ ...medida, tipo: "verbal" });
    expect(r.success).toBe(true);
  });

  it("campo de texto vazio vira null", () => {
    const r = medidaDisciplinarSchema.parse({ ...medida, fato_local: "  " });
    expect(r.fato_local).toBeNull();
  });
});

const entrega = {
  ocupante_id: UUID_A,
  imovel_id: UUID_B,
  tipo: "chaves" as const,
  entregue_em: "2026-08-01",
};

describe("entregaOcupanteSchema", () => {
  it("aceita uma entrega simples", () => {
    expect(entregaOcupanteSchema.safeParse(entrega).success).toBe(true);
  });

  it("exige ao menos uma das duas datas", () => {
    const r = entregaOcupanteSchema.safeParse({ ...entrega, entregue_em: "" });
    expect(r.success).toBe(false);
  });

  it("recusa devolução anterior à entrega", () => {
    const r = entregaOcupanteSchema.safeParse({
      ...entrega,
      devolvido_em: "2026-07-01",
      tratativa: "sem_ressalva",
    });
    expect(r.success).toBe(false);
  });

  it("devolução sem tratativa é recusada", () => {
    const r = entregaOcupanteSchema.safeParse({ ...entrega, devolvido_em: "2026-09-01" });
    expect(r.success).toBe(false);
  });

  it("devolução com tratativa passa", () => {
    const r = entregaOcupanteSchema.safeParse({
      ...entrega,
      devolvido_em: "2026-09-01",
      tratativa: "desgaste_natural",
    });
    expect(r.success).toBe(true);
  });
});
