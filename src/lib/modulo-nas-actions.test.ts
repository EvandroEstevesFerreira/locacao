import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// Toda server action da Frota confere o módulo
// ═══════════════════════════════════════════════════════════════════════════
//
// O QUE ESTA VARREDURA IMPEDE. O middleware protege a NAVEGAÇÃO: ele barra
// `GET` para quem não tem o módulo. As mutações nunca passam por ele — uma
// server action é `POST`, e até a 0.101.0 elas conferiam apenas o PAPEL.
//
// Papel não sabe nada de módulo. Um operador com a Frota desmarcada, numa aba
// que ficou aberta antes da mudança, continuava movimentando peça, lançando
// certificado e excluindo ordem de reparo. A tela dele não mostrava o caminho;
// o servidor não recusava a chamada.
//
// Sem esta varredura, a próxima action de frota nasce sem a guarda — e o
// buraco volta silencioso, porque nada quebra: ela simplesmente funciona para
// quem não deveria.

const RAIZ = join(process.cwd(), "src", "app", "(app)", "frota");

/** Todo arquivo de server action sob `frota/`. */
function arquivosDeAction(dir: string): { nome: string; texto: string }[] {
  const saida: { nome: string; texto: string }[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDeAction(caminho));
    } else if (/actions\.tsx?$/.test(entrada)) {
      saida.push({
        nome: caminho.slice(caminho.indexOf("frota")).split("\\").join("/"),
        texto: readFileSync(caminho, "utf8"),
      });
    }
  }
  return saida;
}

/**
 * O corpo de cada função exportada.
 *
 * O recorte vai de uma `export async function` até a próxima — é o que atribui
 * a guarda à função certa, em vez de aceitar um `exigirModulo` que exista em
 * qualquer lugar do arquivo.
 */
function funcoesExportadas(texto: string): { nome: string; corpo: string }[] {
  const marcas = [...texto.matchAll(/export async function\s+([A-Za-z0-9_]+)/g)];
  return marcas.map((m, i) => ({
    nome: m[1],
    corpo: texto.slice(m.index!, marcas[i + 1]?.index ?? texto.length),
  }));
}

describe("as server actions da Frota conferem o módulo", () => {
  const arquivos = arquivosDeAction(RAIZ);

  it("a varredura encontra os arquivos de action", () => {
    // Vacuity: se a pasta mudar de lugar, a lista fica vazia e o teste passaria
    // sem olhar nada — dando a impressão de proteção que não existe.
    expect(arquivos.length).toBeGreaterThanOrEqual(4);
    expect(arquivos.map((a) => a.nome)).toContain("frota/actions.ts");
  });

  it("encontra funções dentro deles", () => {
    const total = arquivos.reduce(
      (n, a) => n + funcoesExportadas(a.texto).length,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("NENHUMA action escreve sem antes conferir o módulo", () => {
    const semGuarda: string[] = [];

    for (const a of arquivos) {
      for (const f of funcoesExportadas(a.texto)) {
        // `guarda()` de `certificado-actions.ts` é a guarda compartilhada das
        // duas actions daquele arquivo: quem a chama está coberto.
        const usaGuardaLocal = /\bguarda\(\)/.test(f.corpo);
        if (!/\bexigirModulo\(/.test(f.corpo) && !usaGuardaLocal) {
          semGuarda.push(`${a.nome}: ${f.nome}`);
        }
      }
    }

    expect(
      semGuarda,
      "O middleware só barra GET — server action é POST e não passa por ele. " +
        "Sem `exigirModulo(perfil, \"frota\")` no começo, um usuário com a " +
        "Frota desmarcada continua movimentando peça por uma aba aberta. " +
        "Acrescente a guarda, ou chame a `guarda()` compartilhada do arquivo.",
    ).toEqual([]);
  });
});
