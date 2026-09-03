import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * VARREDURA — o modo de falha desta arquitetura, reprovado no CI.
 *
 * O livro de custódia só é verdade se `equipamento_unidade.obra_id` tiver UM
 * escritor. Um `.update({ obra_id })` novo em qualquer action faz o campo e o
 * livro divergirem sem estourar erro nenhum, e a divergência num livro de
 * custódia aparece como equipamento que consta com duas pessoas.
 *
 * Este teste não tem lista de arquivos a manter: varre `src/` e exige que os
 * únicos lugares que escrevem `obra_id` ou `situacao` sobre a peça sejam os
 * autorizados abaixo. Arquivo novo entra na varredura por existir.
 */

const RAIZ = join(process.cwd(), "src");

/** Quem pode escrever, e por quê. Acrescentar aqui exige justificar. */
const AUTORIZADOS: Record<string, string> = {
  "lib/custodia-servidor.ts":
    "o escritor único: abrirCustodia grava obra_id como cache do livro",
  "app/(app)/itens/actions.ts":
    "adicionarUnidade — cadastro da peça, antes de existir posse a registrar",
  "app/(app)/frota/actions.ts":
    "moverPeca e mudarSituacao, que passam pelo livro e pela matriz",
  "app/(app)/termos/actions.ts":
    "moverPecasDoTermo e liberarPecas — a situacao por evento de termo",
};

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      arquivos(caminho, acc);
    } else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      acc.push(caminho);
    }
  }
  return acc;
}

function relativo(caminho: string): string {
  return caminho.slice(RAIZ.length + 1).replace(/\\/g, "/");
}

describe("escritor único de custódia", () => {
  const todos = arquivos(RAIZ);

  it("encontra arquivos para varrer", () => {
    // Sem isto o teste passaria por vacuidade se a raiz mudasse de lugar.
    expect(todos.length).toBeGreaterThan(100);
  });

  it("os quatro autorizados existem no disco", () => {
    // Lista que aponta para arquivo apagado é lista que não guarda nada.
    const presentes = new Set(todos.map(relativo));
    for (const a of Object.keys(AUTORIZADOS)) {
      expect(presentes, `autorizado inexistente: ${a}`).toContain(a);
    }
  });

  it("só os autorizados escrevem obra_id ou situacao da peça", () => {
    const infratores: string[] = [];

    for (const caminho of todos) {
      const rel = relativo(caminho);
      if (rel in AUTORIZADOS) continue;

      const src = readFileSync(caminho, "utf8");
      // Só interessa quem escreve NA PEÇA. `from("obra")` e a situação do
      // termo usam os mesmos nomes de campo e não são desta varredura.
      if (!src.includes("equipamento_unidade")) continue;
      // `upsert` ao lado de `update`: é a variação mais provável de aparecer, e
      // escreve os mesmos campos pela mesma porta.
      if (/\.(update|upsert)\(\s*\{[^}]*\b(obra_id|situacao)\b/.test(src)) {
        infratores.push(rel);
      }
    }

    expect(
      infratores,
      `Estes arquivos escrevem obra_id/situacao de equipamento_unidade fora do ` +
        `escritor único (src/lib/custodia-servidor.ts). O campo é cache do ` +
        `livro de custódia: escrever direto o faz divergir em silêncio, e a ` +
        `divergência aparece como equipamento que consta com duas pessoas. ` +
        `Use abrirCustodia, ou acrescente o arquivo a AUTORIZADOS com a razão.`,
    ).toEqual([]);
  });
});
