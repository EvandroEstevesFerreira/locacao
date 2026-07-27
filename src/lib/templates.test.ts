import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  corpoParaParagrafos,
  DEFAULT_TEMPLATES,
} from "./templates";

describe("renderTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    expect(renderTemplate("Aluguel: {{aluguel}}", { aluguel: "R$ 1.900,00" })).toBe(
      "Aluguel: R$ 1.900,00",
    );
  });

  it("tolera espaços dentro das chaves", () => {
    expect(renderTemplate("{{ locador }}", { locador: "Fulano" })).toBe("Fulano");
  });

  it("variável desconhecida ou nula vira string vazia", () => {
    expect(renderTemplate("[{{x}}]", {})).toBe("[]");
    expect(renderTemplate("[{{x}}]", { x: null })).toBe("[]");
  });

  it("substitui múltiplas ocorrências", () => {
    expect(renderTemplate("{{a}}-{{a}}", { a: "1" })).toBe("1-1");
  });
});

describe("corpoParaParagrafos", () => {
  it("quebra por linha em branco e junta quebras simples", () => {
    const corpo = "Primeiro\nparágrafo.\n\nSegundo parágrafo.";
    expect(corpoParaParagrafos(corpo)).toEqual([
      "Primeiro parágrafo.",
      "Segundo parágrafo.",
    ]);
  });

  it("ignora parágrafos vazios", () => {
    expect(corpoParaParagrafos("A\n\n\n\nB\n\n")).toEqual(["A", "B"]);
  });
});

describe("DEFAULT_TEMPLATES", () => {
  it("o contrato de imóvel renderiza sem sobrar chaves quando há dados", () => {
    const vars = {
      locataria: "Sistenge",
      locador: "Fulano",
      imovel: "Casa 12 (Casa)",
      imovel_endereco: "Rua X",
      vigencia: "01/01 a 31/12",
      aluguel: "R$ 1.000",
      condominio: "R$ 0",
      iptu: "R$ 0",
      seguro_fianca: "R$ 0",
      total_mensal: "R$ 1.000",
      vencimento: "dia 1",
      indice_reajuste: "IGP-M",
      dados_bancarios: "Banco X",
    };
    const texto = renderTemplate(DEFAULT_TEMPLATES.contrato_imovel.corpo, vars);
    expect(texto).not.toMatch(/\{\{/);
  });
});
