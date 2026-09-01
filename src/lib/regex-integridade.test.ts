import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ehDataISO } from "./locacao";

/**
 * CONTRABARRA PERDIDA — a classe de defeito que já escapou duas vezes.
 *
 * Ambas nasceram do mesmo jeito: um regex escrito dentro de um template literal
 * durante uma edição de arquivo, em que `\d` virou `d`.
 *
 *   1. `intervaloDoMes` saiu como `/^d{4}-d{2}$/` (0.34.0). O filtro por mês do
 *      Financeiro nunca se aplicava — a tela ignorava o parâmetro sem erro.
 *      Pego pelos testes do helper, antes de chegar ao usuário.
 *   2. `criarRascunhoRecebimento` saiu como `/^d{4}-d{2}-d{2}$/` (0.39.0). O
 *      botão "Registrar recebimento" não criava nada, silenciosamente. ESTE
 *      chegou à produção, porque a action não tinha teste.
 *
 * O modo de falha é o pior possível: o regex continua sendo um regex VÁLIDO,
 * compila, passa por typecheck, por lint e por build. Só recusa tudo.
 *
 * Este teste varre o código-fonte procurando quantificador de dígito sem a
 * contrabarra. Não é elegante — é a rede que pega a classe inteira, inclusive
 * em código que ninguém pensou em testar.
 */

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === ".next") continue;
      arquivosDeCodigo(p, acc);
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe("regex: contrabarra perdida", () => {
  const raiz = path.join(process.cwd(), "src");
  const arquivos = arquivosDeCodigo(raiz);

  it("encontrou arquivos para varrer", () => {
    // Sem esta trava, um refactor de estrutura tornaria a varredura um teste
    // vazio que passa sempre.
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("nenhum quantificador de dígito perdeu a contrabarra", () => {
    // `d{2}` ou `d{4}` precedido por qualquer coisa que NÃO seja contrabarra,
    // dentro do que parece um literal de regex (entre barras).
    const suspeito = /\/[^\n/]*(?<!\\)\bd\{\d/;

    const achados: string[] = [];
    for (const arquivo of arquivos) {
      // Não varre a si mesmo: os exemplos deste cabeçalho são de propósito.
      if (arquivo.endsWith("regex-integridade.test.ts")) continue;

      const linhas = fs.readFileSync(arquivo, "utf8").split("\n");
      linhas.forEach((linha, i) => {
        // Linha de comentário inteira é pulada: os comentários que DOCUMENTAM
        // este defeito precisam poder citar o regex errado — foi assim que a
        // segunda ocorrência ficou explicada no código. Cobre `//`, `/*` e a
        // continuação `*` do JSDoc, que o strip por regex não pegava.
        const t = linha.trim();
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        // Comentário no fim de uma linha de código: aí sim vale cortar.
        const semComentario = linha.replace(/\/\/.*$/, "");
        if (suspeito.test(semComentario)) {
          achados.push(
            `${path.relative(process.cwd(), arquivo)}:${i + 1}  ${linha.trim()}`,
          );
        }
      });
    }

    expect(
      achados,
      "Regex com `d{N}` sem contrabarra — recusa TODA entrada válida e passa " +
        "por typecheck, lint e build sem reclamar:\n  " + achados.join("\n  "),
    ).toEqual([]);
  });
});

describe("ehDataISO", () => {
  it("aceita data de calendário", () => {
    expect(ehDataISO("2026-08-24")).toBe(true);
    expect(ehDataISO("1999-01-01")).toBe(true);
  });

  it("recusa o que não é data de calendário", () => {
    for (const ruim of ["", "2026-08", "24/08/2026", "2026-8-4", "abc", null, undefined]) {
      expect(ehDataISO(ruim)).toBe(false);
    }
  });

  it("recusa timestamp completo — a coluna é `date`", () => {
    expect(ehDataISO("2026-08-24T10:00:00Z")).toBe(false);
  });
});
