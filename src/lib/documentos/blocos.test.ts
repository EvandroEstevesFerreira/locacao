import { describe, it, expect } from "vitest";
import { agruparBlocos, ehSubtitulo } from "./blocos";

/**
 * O DEFEITO QUE ESTE ARQUIVO GUARDA.
 *
 * `Bloco` tinha `texto: string[]` e `itens: string[]` — dois baldes — e por isso
 * não conseguia representar "parágrafo, lista, parágrafo, lista". Todos os
 * textos saíam primeiro, todas as listas depois, numa numeração corrida.
 *
 * No FRM-EQ-001 isso imprimia "Comprometo-me a:" e "Estou ciente de que:"
 * colados, seguidos de uma lista única de 11 itens — de modo que "o desgaste
 * natural é responsabilidade da empresa", que é uma CIÊNCIA, aparecia sob os
 * COMPROMISSOS, num documento que é parte do contrato de trabalho.
 *
 * Onze textos de template tinham a mesma estrutura: a política de alojamento, a
 * medida disciplinar, os termos de chaves e kit.
 *
 * Só apareceu ao renderizar o PDF e ler.
 */

describe("agruparBlocos — texto entre listas separa as listas", () => {
  it("dois lead-ins produzem duas listas independentes", () => {
    const blocos = agruparBlocos([
      "Declaro receber os equipamentos discriminados neste termo.",
      "Comprometo-me a:",
      "— Utilizar somente para fins de trabalho.",
      "— Zelar pela conservação.",
      "Estou ciente de que:",
      "— O desgaste natural é da empresa.",
      "— Danos por culpa podem ser descontados.",
    ]);

    expect(blocos).toHaveLength(1);
    const partes = blocos[0].partes;

    // texto, lista(2), texto, lista(2) — nesta ordem.
    expect(partes.map((p) => p.tipo)).toEqual(["texto", "texto", "lista", "texto", "lista"]);

    const listas = partes.filter((p) => p.tipo === "lista");
    expect(listas).toHaveLength(2);
    expect(listas[0].tipo === "lista" && listas[0].itens).toHaveLength(2);
    expect(listas[1].tipo === "lista" && listas[1].itens).toHaveLength(2);
  });

  it("a segunda lista NÃO herda os itens da primeira", () => {
    // É a asserção que falharia antes da correção: os quatro itens vinham numa
    // lista só, numerada de 1 a 4.
    const blocos = agruparBlocos([
      "Comprometo-me a:",
      "— A",
      "— B",
      "Estou ciente de que:",
      "— C",
    ]);
    const listas = blocos[0].partes.filter((p) => p.tipo === "lista");
    expect(listas[0].tipo === "lista" && listas[0].itens).toEqual(["A", "B"]);
    expect(listas[1].tipo === "lista" && listas[1].itens).toEqual(["C"]);
  });

  it("itens consecutivos continuam na mesma lista", () => {
    const blocos = agruparBlocos(["— A", "— B", "— C"]);
    const listas = blocos[0].partes.filter((p) => p.tipo === "lista");
    expect(listas).toHaveLength(1);
    expect(listas[0].tipo === "lista" && listas[0].itens).toEqual(["A", "B", "C"]);
  });

  it("caixa alta sem ponto final abre uma subseção nova", () => {
    const blocos = agruparBlocos([
      "Texto de abertura.",
      "PRINCÍPIOS ORIENTADORES",
      "— Primeiro princípio.",
    ]);
    expect(blocos).toHaveLength(2);
    expect(blocos[0].titulo).toBeUndefined();
    expect(blocos[1].titulo).toBe("PRINCÍPIOS ORIENTADORES");
  });

  it("descarta blocos vazios", () => {
    expect(agruparBlocos([])).toEqual([]);
  });

  it("a ordem das partes é a do texto original", () => {
    // Sem isto, um documento com parágrafo depois da lista imprimiria o
    // parágrafo antes dela — que é o defeito na sua forma mais visível.
    const blocos = agruparBlocos(["— A", "Parágrafo depois da lista.", "— B"]);
    expect(blocos[0].partes.map((p) => p.tipo)).toEqual(["lista", "texto", "lista"]);
  });
});

describe("ehSubtitulo", () => {
  it("reconhece caixa alta sem ponto final", () => {
    expect(ehSubtitulo("PRINCÍPIOS ORIENTADORES")).toBe(true);
    expect(ehSubtitulo("DAS PROIBIÇÕES")).toBe(true);
  });

  it("não trata lead-in em caixa baixa como subtítulo", () => {
    // "Comprometo-me a:" é lead-in de lista, não título de seção. Promovê-lo a
    // título criaria uma seção numerada nova no meio da declaração.
    expect(ehSubtitulo("Comprometo-me a:")).toBe(false);
    expect(ehSubtitulo("Estou ciente de que:")).toBe(false);
  });

  it("frase terminada em ponto não é subtítulo, mesmo em caixa alta", () => {
    expect(ehSubtitulo("ISTO É UMA FRASE.")).toBe(false);
  });
});
