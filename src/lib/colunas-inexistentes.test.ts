import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// Consulta que cita coluna inexistente falha em SILÊNCIO
// ═══════════════════════════════════════════════════════════════════════════
//
// O DEFEITO QUE ORIGINOU ISTO. `/termos/novo` filtrava itens do catálogo por
// `.is("deleted_at", null)`, e `item_catalogo` NÃO TEM essa coluna. O PostgREST
// recusa a consulta inteira quando ela cita coluna inexistente; `data` volta
// `null`; e o `?? []` do call site transforma o erro numa lista vazia.
//
// Nada na tela, nada no log. Com 27 itens ativos no banco, o seletor mostrava
// só "Selecione o item…" — e por isso o sistema tinha ZERO termos emitidos.
// O mesmo filtro impossível estava em duas consultas de Estoque: não era
// deslize, era padrão copiado de tabela que tem a coluna para uma que não tem.
//
// Este projeto não gera os tipos do Supabase, então o TypeScript não vê nada
// disso. Esta varredura é o que vê.
//
// SEM LISTA A MANTER: as tabelas que têm `deleted_at` são lidas das próprias
// migrations. Tabela nova com a coluna passa a valer sozinha; consulta nova
// numa tabela sem ela reprova.

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const FONTES = ["src", "scripts"];

/** Tabelas que ganharam `deleted_at` em alguma migration. */
function tabelasComDeletedAt(): Set<string> {
  const comas = new Set<string>();
  const arquivos = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));

  for (const nome of arquivos) {
    const sql = readFileSync(join(MIGRATIONS, nome), "utf8").toLowerCase();

    // `create table ... ( ... deleted_at ... )`
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)\s*\(/g,
    )) {
      const corpo = sql.slice(m.index! + m[0].length, m.index! + m[0].length + 4000);
      const fim = corpo.indexOf(");");
      if (/\bdeleted_at\b/.test(fim > 0 ? corpo.slice(0, fim) : corpo)) {
        comas.add(m[1]);
      }
    }

    // `alter table x add column ... deleted_at`
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:public\.)?([a-z0-9_]+)([^;]*deleted_at[^;]*);/g,
    )) {
      if (/add\s+column/.test(m[2])) comas.add(m[1]);
    }
  }
  return comas;
}

/**
 * Tira comentários antes de varrer.
 *
 * A primeira versão desta guarda reprovou o arquivo que ela mesma tinha
 * consertado: o comentário lá diz literalmente `SEM .is("deleted_at", null)`
 * para explicar o que não fazer, e a varredura leu o aviso como se fosse a
 * consulta. Guarda que não distingue código de comentário acusa quem documenta.
 */
function semComentarios(texto: string): string {
  // TIRA A LINHA, não a esvazia. Esvaziar deixava `\n\n` no meio da cadeia, e
  // o recorte de cada consulta para justamente na linha em branco — um
  // comentário entre `.select()` e `.is()` partia a consulta ao meio e a
  // varredura não via o filtro. Descoberto reintroduzindo o defeito de
  // propósito para ver a guarda reprovar: ela passou.
  return texto
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
    .join("\n");
}

/** Todo arquivo de código sob `src/` e `scripts/`. */
function fontes(): { nome: string; texto: string }[] {
  const saida: { nome: string; texto: string }[] = [];
  const anda = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      const caminho = join(dir, entrada);
      if (statSync(caminho).isDirectory()) anda(caminho);
      else if (/\.(ts|tsx|mjs)$/.test(entrada) && !entrada.endsWith(".test.ts")) {
        saida.push({ nome: caminho, texto: semComentarios(readFileSync(caminho, "utf8")) });
      }
    }
  };
  for (const raiz of FONTES) {
    try {
      anda(join(process.cwd(), raiz));
    } catch {
      // `scripts/` pode não existir num checkout parcial.
    }
  }
  return saida;
}

describe("consultas — coluna que a tabela não tem", () => {
  const comDeletedAt = tabelasComDeletedAt();

  it("as migrations declaram tabelas com deleted_at", () => {
    // Vacuity: se a leitura das migrations parar de casar, toda consulta
    // pareceria estar num tabela sem a coluna e o teste viraria ruído.
    expect(comDeletedAt.size).toBeGreaterThan(8);
    expect(comDeletedAt.has("obra")).toBe(true);
    expect(comDeletedAt.has("certificado_equipamento")).toBe(true);
  });

  it("item_catalogo NÃO tem deleted_at — é o caso que originou a varredura", () => {
    expect(comDeletedAt.has("item_catalogo")).toBe(false);
  });

  it("nenhuma consulta filtra deleted_at numa tabela que não tem a coluna", () => {
    const problemas: string[] = [];

    for (const f of fontes()) {
      // Cada cadeia começa em `.from("x")` e vai até a próxima — é o recorte
      // que atribui o filtro à tabela certa.
      const marcas = [...f.texto.matchAll(/\.from\(\s*"([a-z0-9_]+)"\s*\)/g)];
      for (let i = 0; i < marcas.length; i++) {
        const tabela = marcas[i][1];
        const inicio = marcas[i].index! + marcas[i][0].length;
        const fim = marcas[i + 1]?.index ?? Math.min(inicio + 1200, f.texto.length);
        const trecho = f.texto.slice(inicio, fim).split("\n\n")[0];

        // `deleted_at` dentro de um embed — `rel:fk(col, deleted_at)` — é da
        // tabela relacionada, não desta. Só conta o filtro direto.
        const filtroDireto = /\.(is|eq|not)\(\s*"deleted_at"/.test(trecho);
        if (filtroDireto && !comDeletedAt.has(tabela)) {
          problemas.push(`${f.nome}: .from("${tabela}") filtra deleted_at`);
        }
      }
    }

    expect(
      problemas,
      "PostgREST recusa a consulta INTEIRA quando ela cita coluna inexistente: " +
        "`data` volta null e o `?? []` do call site vira uma lista vazia, sem " +
        "erro na tela nem no log. Foi assim que o seletor de item do termo " +
        "ficou vazio com 27 itens no banco. Nestas tabelas a exclusão é " +
        "`ativo = false`.",
    ).toEqual([]);
  });
});
