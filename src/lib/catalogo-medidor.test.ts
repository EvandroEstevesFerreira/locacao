import { describe, it, expect } from "vitest";
import {
  tipoEquipamentoSchema,
  UNIDADES_MEDIDOR,
  UNIDADE_MEDIDOR_INFO,
} from "./catalogo";

const base = {
  categoria_id: "3f8b1c2e-9d4a-4c6b-8e1f-2a7d5c9b0e34",
  nome: "gerador",
  natureza_padrao: "equipamento" as const,
  ativo: true,
  intervalo_manutencao: "",
  unidade_medidor: "",
};

describe("o intervalo de manutenção e sua unidade", () => {
  it("aceita horas, que era o único caso antes dos veículos", () => {
    const r = tipoEquipamentoSchema.safeParse({
      ...base,
      intervalo_manutencao: "250",
      unidade_medidor: "h",
    });
    expect(r.success).toBe(true);
  });

  it("aceita quilômetros", () => {
    const r = tipoEquipamentoSchema.safeParse({
      ...base,
      nome: "carro",
      intervalo_manutencao: "10000",
      unidade_medidor: "km",
    });
    expect(r.success).toBe(true);
  });

  it("aceita os dois em branco — é o caso da maioria", () => {
    // NOTEBOOK, ANDAIME, BETONEIRA: nenhum tem revisão por uso.
    expect(tipoEquipamentoSchema.safeParse(base).success).toBe(true);
  });

  it("recusa intervalo sem unidade", () => {
    // 250 sozinho pode ser horas de gerador ou quilômetros de nada. Antes desta
    // trava o número ia para o banco e a conta de revisão escolhia sozinha.
    const r = tipoEquipamentoSchema.safeParse({
      ...base,
      intervalo_manutencao: "250",
    });
    expect(r.success).toBe(false);
  });

  it("recusa unidade sem intervalo", () => {
    const r = tipoEquipamentoSchema.safeParse({ ...base, unidade_medidor: "km" });
    expect(r.success).toBe(false);
  });

  it("recusa unidade fora do vocabulário", () => {
    // "milhas" ou "horas" por extenso quebrariam a leitura no banco, que tem o
    // mesmo check.
    const r = tipoEquipamentoSchema.safeParse({
      ...base,
      intervalo_manutencao: "250",
      unidade_medidor: "milhas",
    });
    expect(r.success).toBe(false);
  });

  it("normaliza o nome em caixa alta, como antes", () => {
    const r = tipoEquipamentoSchema.parse({
      ...base,
      intervalo_manutencao: "250",
      unidade_medidor: "h",
    });
    expect(r.nome).toBe("GERADOR");
  });

  it("é idempotente", () => {
    // `parse(parse(x))` tem de dar `parse(x)`. O `refine` cruzado não pode
    // quebrar isso — a varredura de schemas do projeto cobra a propriedade.
    const uma = tipoEquipamentoSchema.parse({
      ...base,
      intervalo_manutencao: "250",
      unidade_medidor: "h",
    });
    expect(tipoEquipamentoSchema.parse(uma)).toEqual(uma);
  });
});

describe("vocabulário do medidor", () => {
  it("toda unidade tem rótulo e nome de medidor", () => {
    for (const u of UNIDADES_MEDIDOR) {
      expect(UNIDADE_MEDIDOR_INFO[u].label.length).toBeGreaterThan(0);
      expect(UNIDADE_MEDIDOR_INFO[u].medidor.length).toBeGreaterThan(0);
    }
  });

  it("horímetro conta horas e hodômetro conta km", () => {
    // A troca destes dois é justamente o defeito que a fatia conserta: 10.000
    // rotulado como horas são cinco anos e meio de motor ligado sem parar.
    expect(UNIDADE_MEDIDOR_INFO.h.medidor).toBe("Horímetro");
    expect(UNIDADE_MEDIDOR_INFO.h.label).toBe("horas");
    expect(UNIDADE_MEDIDOR_INFO.km.medidor).toBe("Hodômetro");
    expect(UNIDADE_MEDIDOR_INFO.km.label).toBe("km");
  });
});
