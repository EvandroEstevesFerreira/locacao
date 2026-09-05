import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Os dois importadores normalizam nome de pessoa, cada um com a sua cópia.
 *
 * `importar-inventario-ti.mjs` cria os funcionários; `gerar-termos-inventario.mjs`
 * procura por eles. Se as normalizações divergirem, o segundo não acha o que o
 * primeiro criou — e o sintoma seria "SEM FUNCIONÁRIO CADASTRADO" para gente
 * que está cadastrada, ou pior, um funcionário duplicado.
 *
 * A cópia é deliberada: os scripts rodam em momentos diferentes e são
 * independentes. O que não pode é divergir sem ninguém notar. Este teste é o
 * que impede.
 */

const RAIZ = process.cwd();
const IMPORTADOR = path.join(RAIZ, "scripts/db/importar-inventario-ti.mjs");
const GERADOR = path.join(RAIZ, "scripts/db/gerar-termos-inventario.mjs");

/** Extrai um bloco de código de um script, pelo nome. */
function trecho(arquivo: string, marcador: string, ate: string): string {
  const fonte = fs.readFileSync(arquivo, "utf8");
  const ini = fonte.indexOf(marcador);
  if (ini < 0) throw new Error(`"${marcador}" não encontrado em ${path.basename(arquivo)}`);
  const fim = fonte.indexOf(ate, ini);
  return fonte.slice(ini, fim < 0 ? undefined : fim + ate.length);
}

/** Compila a função do script num closure testável, sem executar o resto. */
function carregarNormalizador(arquivo: string): (s: string) => string | null {
  const naoEPessoa = trecho(arquivo, "const NAO_E_PESSOA", ";");
  const fn = trecho(arquivo, "function pessoaNormalizada", "\n}");
  return new Function(
    `${naoEPessoa}\n${fn.replace(/^export\s+/, "")}\nreturn pessoaNormalizada;`,
  )() as (s: string) => string | null;
}

describe("normalização de nome: os dois scripts concordam", () => {
  const doImportador = carregarNormalizador(IMPORTADOR);
  const doGerador = carregarNormalizador(GERADOR);

  // Os casos reais da planilha de 16/07 — não são hipóteses.
  const CASOS = [
    "Andrea.Marques",
    "andrea.marques",
    "Andrea Marques",
    "JOÃO.UBIRAJARA",
    "salatiel.evangelista",
    "Adolfo Vari (new)",
    "Jessica Matos atual",
    "ADRIANO ARAUJO",
    "Leandro Santos new",
    "Marco Antonio",
    "vivian fernandes",
    // E os que NÃO são pessoa:
    "LIVRE",
    "LIVRE - 7º ANDAR",
    "LIVRE - COM ISABEL",
    "disponivel",
    "DEVOLVIDA(alugada)",
    "Servidor Hortolandia",
    "OBRA",
    "Obra Campinas",
    "ORÇAMENTOS",
    "Almoxarifado",
    "Rack",
    "Paseli",
    "Não Possui",
    "",
  ];

  for (const caso of CASOS) {
    it(`"${caso || "(vazio)"}"`, () => {
      expect(doGerador(caso)).toBe(doImportador(caso));
    });
  }
});

describe("pessoaNormalizada", () => {
  const norm = carregarNormalizador(GERADOR);

  it("achata as três grafias da mesma pessoa numa só", () => {
    // É o caso que motiva a normalização existir: a planilha tem "Andrea.Marques"
    // e "andrea.marques" em linhas diferentes, e são a mesma pessoa.
    const formas = ["Andrea.Marques", "andrea.marques", "ANDREA MARQUES"];
    expect(new Set(formas.map(norm)).size).toBe(1);
  });

  it("descarta o que não é pessoa", () => {
    for (const x of ["LIVRE", "disponivel", "OBRA", "Servidor", "Rack", "Não Possui"]) {
      expect(norm(x), x).toBeNull();
    }
  });

  it("não confunde pessoa com marcação anexada ao nome", () => {
    // "(new)" e "atual" são anotações do inventário sobre a MÁQUINA, não
    // sobrenomes. Mantê-los criaria "Adolfo Vari (new)" como pessoa distinta de
    // "Adolfo Vari".
    expect(norm("Adolfo Vari (new)")).toBe("Adolfo Vari");
    expect(norm("Jessica Matos atual")).toBe("Jessica Matos");
  });

  it("preserva partículas curtas em minúscula", () => {
    // "Fabiano Del Rei" — "Del" tem 3 letras e vira "Del"; partícula de 2 fica
    // como está, que é a forma correta em PT-BR ("de", "da", "do").
    expect(norm("fabiano de souza")).toBe("Fabiano de Souza");
  });

  it("LIVRE com nome dentro continua não sendo pessoa", () => {
    // "LIVRE - COM ISABEL" diz que a máquina está livre, guardada com a Isabel.
    // Tratá-la como posse da Isabel seria inventar uma responsabilidade.
    expect(norm("LIVRE - COM ISABEL")).toBeNull();
    expect(norm("Livre - Eduardo Uda")).toBeNull();
  });
});
