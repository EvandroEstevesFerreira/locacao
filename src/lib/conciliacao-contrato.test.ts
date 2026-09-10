import { describe, expect, it } from "vitest";
import { conciliarContrato, TOLERANCIA_CONCILIACAO } from "./locacao";

describe("conciliarContrato", () => {
  it("sem valor contratado, não há o que conferir", () => {
    // O campo é opcional: contrato antigo não tem o número do documento, e a
    // ausência não pode virar alarme.
    expect(conciliarContrato({ contratado: null, comprometido: 40000 })).toEqual({
      situacao: "sem_referencia",
    });
  });

  it("bate exatamente", () => {
    expect(
      conciliarContrato({ contratado: 32616.48, comprometido: 32616.48 }),
    ).toEqual({ situacao: "confere" });
  });

  it("centavo de arredondamento NÃO acusa divergência", () => {
    // O contrato 1726 tem valor unitário com três casas (156,667) e a coluna
    // guardava duas: o mensal saía 2.038,56 contra 2.038,53 do documento. Um
    // alarme que toca em todo contrato é um alarme que ninguém lê.
    expect(
      conciliarContrato({ contratado: 32616.48, comprometido: 32616.96 }),
    ).toEqual({ situacao: "confere" });
  });

  it("o cadastro projetando MAIS que o contrato é o caso do 1726", () => {
    // 597 dias cadastrados contra os 16 meses que o documento usou para chegar
    // ao total. São ~8 mil reais de diferença, e alguém precisa decidir qual
    // dos dois está certo.
    const r = conciliarContrato({ contratado: 32616.48, comprometido: 40771.2 });
    expect(r.situacao).toBe("acima");
    if (r.situacao === "acima") {
      expect(Math.round(r.diferenca)).toBe(8155);
    }
  });

  it("o cadastro projetando MENOS é falta de item, e é outro problema", () => {
    // Seis aparelhos cadastrados onde o contrato prevê sete. Hoje isso passa em
    // silêncio e o contrato subfatura até alguém conferir no papel.
    const r = conciliarContrato({ contratado: 32616.48, comprometido: 27687.4 });
    expect(r.situacao).toBe("abaixo");
    if (r.situacao === "abaixo") {
      expect(Math.round(r.diferenca)).toBe(4929);
    }
  });

  it("a diferença é sempre positiva — o sentido está na situação", () => {
    const acima = conciliarContrato({ contratado: 100, comprometido: 150 });
    const abaixo = conciliarContrato({ contratado: 100, comprometido: 50 });
    if (acima.situacao === "acima") expect(acima.diferenca).toBeGreaterThan(0);
    if (abaixo.situacao === "abaixo") expect(abaixo.diferenca).toBeGreaterThan(0);
  });

  it("a tolerância é de um real, e vale para os dois lados", () => {
    expect(TOLERANCIA_CONCILIACAO).toBe(1);
    expect(
      conciliarContrato({ contratado: 1000, comprometido: 1000.99 }).situacao,
    ).toBe("confere");
    expect(
      conciliarContrato({ contratado: 1000, comprometido: 999.01 }).situacao,
    ).toBe("confere");
    expect(
      conciliarContrato({ contratado: 1000, comprometido: 1001.5 }).situacao,
    ).toBe("acima");
  });

  it("contratado zero é valor informado, e não ausência", () => {
    // Zero é um número que alguém digitou. Tratá-lo como "não informado"
    // esconderia um contrato cadastrado errado.
    expect(
      conciliarContrato({ contratado: 0, comprometido: 5000 }).situacao,
    ).toBe("acima");
  });
});
