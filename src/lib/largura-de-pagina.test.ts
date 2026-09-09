import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Varredura das larguras de página, sem lista de rotas a manter.
//
// O app chegou a OITO larguras de container diferentes — md, 2xl, 3xl, 4xl,
// 5xl, 6xl, 1536px e "sem cap nenhum" — espalhadas por 67 telas. Não foi
// desleixo de uma pessoa: cada um chutou um cap na hora de acomodar a tabela do
// dia, e ninguém tinha como saber qual era a regra, porque não havia regra.
//
// O sintoma que o usuário vê é barra de rolagem horizontal onde há espaço de
// tela sobrando: a /contratos capada em 1152px mostrava barra numa janela de
// 1920px, com ~400px vazios de cada lado, enquanto a /frota, sem cap, exibia
// uma lista mais larga sem barra alguma.
//
// A regra agora são três utilitários de `globals.css`, um por PAPEL de tela.
// Este teste é o que a faz durar: a tela nova que voltar ao `mx-auto max-w-*`
// cru reprova aqui, e não seis meses depois com o nono cap no ar.

const RAIZ = join(process.cwd(), "src", "app", "(app)");

/** Os três papéis. Um deles precisa estar em toda página. */
const UTILITARIOS = ["pagina-form", "pagina-leitura", "pagina-lista"] as const;

function paginas(dir = RAIZ, achadas: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) paginas(caminho, achadas);
    else if (entrada === "page.tsx") achadas.push(caminho);
  }
  return achadas;
}

const rota = (p: string) =>
  p.replace(RAIZ, "").replace(/\\/g, "/").replace("/page.tsx", "") || "/";

describe("largura de página", () => {
  const arquivos = paginas();

  it("existe página para varrer", () => {
    // Sem isto o arquivo passaria por vacuidade se a pasta mudasse de lugar.
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("toda página declara seu papel com um dos três utilitários", () => {
    const sem = arquivos
      .filter((p) => {
        const s = readFileSync(p, "utf8");
        return !UTILITARIOS.some((u) => s.includes(u));
      })
      .map(rota);

    expect(
      sem,
      `Páginas sem papel declarado. Use pagina-form (formulário), pagina-leitura (detalhe/texto) ou pagina-lista (tabela), definidos em src/app/globals.css:\n${sem.join("\n")}`,
    ).toEqual([]);
  });

  it("nenhuma página volta ao `mx-auto max-w-*` cru", () => {
    // O padrão antigo. Ele é o que produzia oito larguras: cada tela escolhia a
    // sua, e duas listas do mesmo tipo saíam com caps diferentes.
    const cru = /mx-auto[^"]*max-w-|max-w-[A-Za-z0-9[\]px-]+[^"]*mx-auto/;
    const reincidentes = arquivos
      .filter((p) => cru.test(readFileSync(p, "utf8")))
      .map(rota);

    expect(
      reincidentes,
      `Container de página com largura própria. Troque pelo utilitário do papel da tela:\n${reincidentes.join("\n")}`,
    ).toEqual([]);
  });

  it("cada página usa UM papel só", () => {
    // Duas larguras na mesma tela significa que ela tem dois containers de
    // topo — normalmente um retorno antecipado (estado vazio) que ficou com o
    // cap antigo, e que passaria a divergir da tela cheia.
    const misturadas = arquivos
      .map((p) => {
        const s = readFileSync(p, "utf8");
        return { rota: rota(p), papeis: UTILITARIOS.filter((u) => s.includes(u)) };
      })
      .filter((x) => x.papeis.length > 1)
      .map((x) => `${x.rota} → ${x.papeis.join(" + ")}`);

    expect(misturadas, `Telas com mais de um papel:\n${misturadas.join("\n")}`).toEqual(
      [],
    );
  });
});
