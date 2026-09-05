import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { LaudoAvaria, type DadosLaudoAvaria } from "./laudo-avaria";
import { textoDe, contemTexto } from "./inspecionar";

vi.setConfig({ testTimeout: 120_000 });

/**
 * O laudo é o único dos três documentos de equipamento que registra uma
 * APURAÇÃO em vez de um fato. Romaneio e termo dizem o que chegou e o que
 * voltou; o laudo diz quem responde — e pode legitimamente ainda não saber.
 *
 * Metade dos casos LÊ o documento. Contar página foi o que deixou o rodapé
 * "Recursos Humanos" chegar a um fornecedor.
 */

const base: DadosLaudoAvaria = {
  numero: "AVA-2026-0003",
  orgNome: "Sistenge Engenharia",
  fornecedor: "Locadora Alfa",
  obra: "OB-042 — Residencial Vista Verde",
  contratoNumero: "CT-8891",
  contratoRegistro: "CTR-2026-0007",
  data: "05/09/2026",
  descricao: "Mangote do vibrador rompido a 40 cm do cabeçote.",
  laudo: null,
  responsabilidade: "A apurar",
  status: "Aberta",
  custoEstimado: "R$ 1.250,00",
  peca: "VI-0087",
  devolucao: "DEV-2026-0009",
  localData: "05/09/2026.",
};

describe("LaudoAvaria — o que está escrito", () => {
  it("diz que é laudo de avaria, e traz o número do registro", () => {
    const doc = <LaudoAvaria dados={base} />;
    expect(contemTexto(doc, "Laudo de avaria de equipamento")).toBe(true);
    expect(contemTexto(doc, "AVA-2026-0003")).toBe(true);
  });

  it("o rodapé é o de locações, não o de Recursos Humanos", () => {
    const doc = <LaudoAvaria dados={base} />;
    expect(contemTexto(doc, "controle de locações")).toBe(true);
    expect(contemTexto(doc, "Recursos Humanos")).toBe(false);
  });

  it("imprime “A apurar” em vez de omitir a responsabilidade", () => {
    // O CASO QUE MAIS IMPORTA NESTE ARQUIVO.
    //
    // Omitir o campo quando a responsabilidade é indefinida produziria um laudo
    // que não diz quem responde SEM dizer que não sabe — e um documento assim é
    // lido como se soubesse. A conclusão tem de aparecer, mesmo inconclusa.
    const doc = <LaudoAvaria dados={base} />;
    expect(contemTexto(doc, "Responsabilidade")).toBe(true);
    expect(contemTexto(doc, "A apurar")).toBe(true);
  });

  it("nomeia a peça e a devolução em que o dano foi constatado", () => {
    // Distinguir importa: dano constatado na devolução é discussão com o
    // fornecedor; dano constatado em uso é problema da obra até prova em
    // contrário.
    const doc = <LaudoAvaria dados={base} />;
    expect(contemTexto(doc, "VI-0087")).toBe(true);
    expect(contemTexto(doc, "DEV-2026-0009")).toBe(true);
  });

  it("o texto da apuração aparece quando existe", () => {
    const doc = (
      <LaudoAvaria
        dados={{
          ...base,
          laudo: "Apurado com o operador: o mangote prendeu na ferragem durante a concretagem.",
          responsabilidade: "Da obra",
        }}
      />
    );
    expect(
      contemTexto(doc, "o mangote prendeu na ferragem durante a concretagem"),
    ).toBe(true);
    expect(contemTexto(doc, "Da obra")).toBe(true);
  });

  it("o custo estimado sai formatado, não como número cru", () => {
    expect(contemTexto(<LaudoAvaria dados={base} />, "R$ 1.250,00")).toBe(true);
  });

  it("não sobra placeholder nem undefined no texto", () => {
    const texto = textoDe(<LaudoAvaria dados={base} />);
    expect(texto).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("sobrevive ao caso sem fornecedor, sem peça e sem devolução", () => {
    // É a avaria constatada em uso, num item controlado por quantidade, num
    // contrato cujo fornecedor foi excluído. O documento tem de sair.
    const texto = textoDe(
      <LaudoAvaria
        dados={{
          ...base,
          fornecedor: null,
          peca: null,
          devolucao: null,
          contratoNumero: null,
          contratoRegistro: null,
        }}
      />,
    );
    expect(texto).not.toMatch(/undefined|null/);
  });
});

describe("LaudoAvaria — a forma", () => {
  it("um laudo sem apuração escrita cabe em uma página", async () => {
    const buffer = await renderToBuffer(<LaudoAvaria dados={base} />);
    expect(contarPaginas(buffer)).toBe(1);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("aguenta uma apuração longa sem quebrar", async () => {
    const longo: DadosLaudoAvaria = {
      ...base,
      laudo: Array.from(
        { length: 40 },
        (_, n) =>
          `Parágrafo ${n + 1} da apuração, com o relato do que foi verificado em campo e a conclusão parcial.`,
      ).join(" "),
    };
    const buffer = await renderToBuffer(<LaudoAvaria dados={longo} />);
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });
});
