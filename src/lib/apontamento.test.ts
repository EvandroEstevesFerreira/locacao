import { describe, it, expect } from "vitest";
import {
  horasAteRevisao,
  estadoRevisao,
  apontamentoSchema,
} from "./apontamento";

describe("horasAteRevisao", () => {
  it("conta a partir da última revisão, não do zero da máquina", () => {
    // A armadilha: uma máquina com 1.240 h que revisou aos 1.000 e tem
    // intervalo de 250 está a 10 h da próxima — não a 250 nem vencida em 990.
    expect(horasAteRevisao(1240, 250, 1000)).toBe(10);
  });

  it("devolve NEGATIVO quando venceu, e o negativo é a informação", () => {
    // "Passou 30 h do intervalo" é o que faz alguém agir. Truncar em zero diria
    // só "chegou a hora" e esconderia há quanto tempo passou.
    expect(horasAteRevisao(1280, 250, 1000)).toBe(-30);
  });

  it("devolve null quando o tipo não tem intervalo", () => {
    // É o caso da maioria: só faz sentido onde o fabricante publica o número.
    expect(horasAteRevisao(1240, null, 1000)).toBeNull();
    expect(horasAteRevisao(1240, 0, 1000)).toBeNull();
  });

  it("devolve null quando a peça nunca foi apontada", () => {
    // Sem leitura não há conta. Zero aqui diria "revisão vencida" para toda
    // máquina que ninguém apontou ainda — um alarme falso no primeiro dia.
    expect(horasAteRevisao(null, 250, 0)).toBeNull();
  });
});

describe("estadoRevisao", () => {
  it("avisa a 10% do intervalo, não num número fixo de horas", () => {
    // 25 h de antecedência é muito para um intervalo de 50 e pouco para um de
    // 500. A proporção resolve os dois.
    expect(estadoRevisao(25, 250)).toBe("proxima");
    expect(estadoRevisao(26, 250)).toBe("em_dia");
    expect(estadoRevisao(5, 50)).toBe("proxima");
    expect(estadoRevisao(6, 50)).toBe("em_dia");
  });

  it("vencida tem precedência sobre próxima", () => {
    expect(estadoRevisao(-1, 250)).toBe("vencida");
    expect(estadoRevisao(0, 250)).toBe("proxima");
  });

  it("sem intervalo não é 'em dia' — é 'sem intervalo'", () => {
    // A distinção importa na tela: "em dia" afirma algo que ninguém verificou.
    expect(estadoRevisao(null, null)).toBe("sem_intervalo");
    expect(estadoRevisao(10, null)).toBe("sem_intervalo");
  });
});

describe("apontamentoSchema", () => {
  const base = { unidade_id: "11111111-1111-4111-8111-111111111111", data: "2026-09-05" };

  it("aceita leitura com vírgula decimal", () => {
    // O horímetro mostra 1.234,5 e o teclado é brasileiro.
    const r = apontamentoSchema.safeParse({ ...base, leitura: "1234.5" });
    expect(r.success && r.data.leitura).toBe(1234.5);
  });

  it("aceita leitura zero", () => {
    // Horímetro novo marca zero. Recusar obrigaria a inventar 0,1.
    expect(apontamentoSchema.safeParse({ ...base, leitura: "0" }).success).toBe(true);
  });

  it("recusa leitura negativa", () => {
    expect(apontamentoSchema.safeParse({ ...base, leitura: "-5" }).success).toBe(false);
  });

  it("recusa leitura absurda", () => {
    // Dígito a mais na digitação. Sem o teto, uma leitura de 12.340.000 viraria
    // um "faltam -12 milhões de horas" que nenhuma tela sabe mostrar.
    expect(
      apontamentoSchema.safeParse({ ...base, leitura: "99999999" }).success,
    ).toBe(false);
  });

  it("recusa data fora do formato ISO", () => {
    const r = apontamentoSchema.safeParse({
      ...base,
      data: "05/09/2026",
      leitura: "10",
    });
    expect(r.success).toBe(false);
  });

  it("`reiniciado` nasce falso", () => {
    const r = apontamentoSchema.safeParse({ ...base, leitura: "10" });
    expect(r.success && r.data.reiniciado).toBe(false);
  });
});
