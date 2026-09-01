import { describe, it, expect } from "vitest";
import {
  segundaDaSemana,
  diasEntre,
  percentualPrazo,
  desvio,
  semanasSemLancamento,
  previsaoTermino,
  avancoSchema,
} from "./avanco";

describe("segundaDaSemana", () => {
  // Canoniza qualquer dia para a segunda-feira daquela semana. É o que faz o
  // `unique (obra_id, semana)` significar "um lançamento por semana".
  it("devolve a própria data quando já é segunda", () => {
    expect(segundaDaSemana("2026-08-31")).toBe("2026-08-31"); // segunda
  });

  it("recua de qualquer dia da semana para a segunda anterior", () => {
    expect(segundaDaSemana("2026-09-01")).toBe("2026-08-31"); // terça
    expect(segundaDaSemana("2026-09-02")).toBe("2026-08-31"); // quarta
    expect(segundaDaSemana("2026-09-05")).toBe("2026-08-31"); // sábado
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    // O caso que quase toda implementação erra: getDay() do domingo é 0, então
    // a conta ingênua joga o domingo para a semana seguinte.
    expect(segundaDaSemana("2026-09-06")).toBe("2026-08-31");
  });

  it("atravessa virada de mês e de ano", () => {
    expect(segundaDaSemana("2026-01-01")).toBe("2025-12-29");
  });
});

describe("diasEntre", () => {
  it("conta dias de calendário", () => {
    expect(diasEntre("2026-08-01", "2026-08-31")).toBe(30);
    expect(diasEntre("2026-08-31", "2026-08-01")).toBe(-30);
    expect(diasEntre("2026-08-31", "2026-08-31")).toBe(0);
  });

  it("não perde dia no horário de verão nem na virada de ano", () => {
    expect(diasEntre("2025-12-29", "2026-01-05")).toBe(7);
  });
});

describe("percentualPrazo", () => {
  const obra = { data_inicio: "2026-01-01", data_fim_prevista: "2026-12-31" };

  it("devolve null quando falta qualquer uma das datas", () => {
    expect(
      percentualPrazo({ data_inicio: null, data_fim_prevista: "2026-12-31" }, "2026-06-01"),
    ).toBeNull();
    expect(
      percentualPrazo({ data_inicio: "2026-01-01", data_fim_prevista: null }, "2026-06-01"),
    ).toBeNull();
  });

  it("calcula a fração do período decorrida", () => {
    // 2026-01-01 a 2026-12-31 = 364 dias. Em 2026-07-02 passaram 182.
    expect(percentualPrazo(obra, "2026-07-02")).toBeCloseTo(50, 1);
  });

  it("trava em 0 e em 100 fora do período", () => {
    expect(percentualPrazo(obra, "2025-06-01")).toBe(0);
    expect(percentualPrazo(obra, "2027-06-01")).toBe(100);
  });

  it("obra de um dia não divide por zero", () => {
    const umDia = { data_inicio: "2026-05-10", data_fim_prevista: "2026-05-10" };
    expect(percentualPrazo(umDia, "2026-05-09")).toBe(0);
    expect(percentualPrazo(umDia, "2026-05-10")).toBe(100);
  });
});

describe("desvio", () => {
  it("é positivo quando o prazo corre mais rápido que a obra", () => {
    expect(desvio(55, 31)).toBe(24);
  });

  it("é negativo quando a obra está adiantada", () => {
    expect(desvio(30, 45)).toBe(-15);
  });

  it("é null quando não há prazo ou não há avanço", () => {
    expect(desvio(null, 31)).toBeNull();
    expect(desvio(55, null)).toBeNull();
  });
});

describe("semanasSemLancamento", () => {
  it("é null quando a obra nunca teve lançamento", () => {
    expect(semanasSemLancamento(null, "2026-08-31")).toBeNull();
  });

  it("é 0 quando o último lançamento é o desta semana", () => {
    expect(semanasSemLancamento("2026-08-31", "2026-09-02")).toBe(0);
  });

  it("conta as semanas desde o último lançamento", () => {
    expect(semanasSemLancamento("2026-08-10", "2026-08-31")).toBe(3);
  });
});

describe("previsaoTermino", () => {
  it("projeta pelo ritmo das últimas semanas com lançamento", () => {
    const avancos = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 35 },
      { semana: "2026-08-17", percentual: 30 },
      { semana: "2026-08-10", percentual: 25 },
    ];
    // 15 pontos em 3 semanas = 5 pontos/semana. Faltam 60 → 12 semanas.
    expect(previsaoTermino(avancos, "2026-08-31")).toBe("2026-11-23");
  });

  it("devolve null com ritmo zero — obra parada não projeta", () => {
    const parada = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 40 },
    ];
    expect(previsaoTermino(parada, "2026-08-31")).toBeNull();
  });

  it("devolve null com ritmo negativo — correção para baixo não é projeção", () => {
    const corrigida = [
      { semana: "2026-08-31", percentual: 30 },
      { semana: "2026-08-24", percentual: 40 },
    ];
    expect(previsaoTermino(corrigida, "2026-08-31")).toBeNull();
  });

  it("devolve null com menos de dois pontos", () => {
    expect(previsaoTermino([{ semana: "2026-08-31", percentual: 40 }], "2026-08-31")).toBeNull();
    expect(previsaoTermino([], "2026-08-31")).toBeNull();
  });

  it("ignora semanas antigas além das quatro mais recentes", () => {
    const avancos = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 35 },
      { semana: "2026-08-17", percentual: 30 },
      { semana: "2026-08-10", percentual: 25 },
      // Ruído antigo: se entrasse na conta, o ritmo despencaria e a projeção
      // com ele. A janela é de LANÇAMENTOS, não de semanas de calendário.
      { semana: "2026-01-05", percentual: 0 },
    ];
    expect(previsaoTermino(avancos, "2026-08-31")).toBe("2026-11-23");
  });

  it("obra em 100% termina na própria semana do último lançamento", () => {
    const pronta = [
      { semana: "2026-08-31", percentual: 100 },
      { semana: "2026-08-24", percentual: 90 },
    ];
    expect(previsaoTermino(pronta, "2026-08-31")).toBe("2026-08-31");
  });

  it("não depende da ordem em que os lançamentos chegam", () => {
    const desordenado = [
      { semana: "2026-08-10", percentual: 25 },
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-17", percentual: 30 },
      { semana: "2026-08-24", percentual: 35 },
    ];
    expect(previsaoTermino(desordenado, "2026-08-31")).toBe("2026-11-23");
  });
});

describe("avancoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("aceita o id em branco que o input oculto manda", () => {
    const r = avancoSchema.safeParse({
      id: "",
      obra_id: UUID,
      semana: "2026-08-31",
      percentual: "34",
      observacoes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBeNull();
      expect(r.data.percentual).toBe(34);
      expect(r.data.observacoes).toBeNull();
    }
  });

  it("recusa percentual fora de 0 a 100", () => {
    const base = { obra_id: UUID, semana: "2026-08-31", observacoes: "" };
    expect(avancoSchema.safeParse({ ...base, percentual: "-1" }).success).toBe(false);
    expect(avancoSchema.safeParse({ ...base, percentual: "101" }).success).toBe(false);
  });

  it("recusa semana que não é data ISO", () => {
    const r = avancoSchema.safeParse({
      obra_id: UUID,
      semana: "31/08/2026",
      percentual: "34",
      observacoes: "",
    });
    expect(r.success).toBe(false);
  });
});
