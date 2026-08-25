import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { paginaTreinamento, TRILHAS } from "./gerar";
import { TOTAL_MODULOS, validarTrilhas } from "./tipos";
import { CORES_PERMITIDAS, JS } from "./layout";

const DESTINO = "docs/treinamento";
const html = paginaTreinamento();

/**
 * A página sem os blocos <script> e <style>.
 *
 * O JS monta seletores por concatenação — `a[href="#' + mod.id + '"]` — e um
 * varredor de marcação leria aquilo como uma âncora chamada literalmente
 * `' + mod.id + '`. Código não é marcação; a checagem de link olha só o HTML.
 */
const marcacao = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "");

describe("estrutura", () => {
  it("as três trilhas passam pelo validador", () => {
    expect(validarTrilhas(TRILHAS)).toEqual([]);
  });

  it("são dezoito módulos", () => {
    expect(TRILHAS.flatMap((t) => t.modulos)).toHaveLength(TOTAL_MODULOS);
  });
});

describe("os cinco checks da spec", () => {
  it("1. nenhum buraco de dado no HTML final", () => {
    expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("2. todo link interno tem destino", () => {
    const ancoras = [...marcacao.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const ids = new Set([...marcacao.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    expect(ancoras.length).toBeGreaterThan(TOTAL_MODULOS);
    expect(ancoras.filter((a) => !ids.has(a))).toEqual([]);
  });

  it("3. nenhuma cor fora da lista permitida", () => {
    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    const usadas = [...html.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toUpperCase());
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
    expect(html.toLowerCase()).not.toContain("#cf2927");
  });

  it("4. os dezoito módulos aparecem no índice E no corpo", () => {
    for (const m of TRILHAS.flatMap((t) => t.modulos)) {
      expect(html, `índice sem ${m.id}`).toContain(`href="#${m.id}"`);
      expect(html, `corpo sem ${m.id}`).toContain(`id="${m.id}"`);
      expect(html, `título de ${m.id}`).toContain(m.titulo);
    }
  });

  it("5. nenhum recurso externo", () => {
    expect(html).not.toMatch(/src="https?:\/\/|@import|<link[^>]+href="http/);
  });
});

describe("o JS e o HTML da página inteira falam a mesma língua", () => {
  // Aqui sem isenção nenhuma, diferente de layout.test.ts: esta é a página
  // completa, com a casca da trilha que gerar.ts monta.
  it("todo atributo data-* que o JS lê existe na página", () => {
    const lidos = [
      ...JS.matchAll(/getAttribute\("(data-[a-z-]+)"\)/g),
      ...JS.matchAll(/\[(data-[a-z-]+)=/g),
    ].map((x) => x[1]);
    for (const attr of new Set(lidos)) {
      expect(html, `o JS lê ${attr}, que a página não emite`).toContain(attr);
    }
  });

  it("toda classe que o JS consulta existe na página", () => {
    const classes = [...JS.matchAll(/querySelector(?:All)?\('?"?\.([a-z-]+)/g)].map(
      (x) => x[1],
    );
    for (const c of new Set(classes)) {
      expect(html, `o JS consulta .${c}, que a página não emite`).toContain(
        `class="${c}`,
      );
    }
  });

  it("cada trilha tem a âncora que o progresso procura", () => {
    // O JS resolve `getElementById("trilha-" + id)`. Se a casca deixasse de
    // emitir esse id, a barra voltaria a ficar em zero — o bug da Tarefa 2.
    for (const t of TRILHAS) {
      expect(html).toContain(`id="trilha-${t.id}"`);
      expect(html).toContain(`data-trilha="${t.id}"`);
    }
  });
});

describe("aviso do recibo de ferramenta", () => {
  it("está marcado como em construção", () => {
    // Sem isto, alguém procura no Loca uma tela que não existe.
    expect(html).toMatch(/recibo de ferramenta[\s\S]{0,600}em construção/i);
  });

  it("fica ao fim da Trilha A, não da B", () => {
    const posRecibo = html.indexOf("recibo-ferramenta");
    const posTrilhaB = html.indexOf('id="trilha-imoveis"');
    expect(posRecibo).toBeGreaterThan(0);
    expect(posRecibo).toBeLessThan(posTrilhaB);
  });
});

describe("acessibilidade e mobile", () => {
  it("declara idioma e viewport", () => {
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("width=device-width");
  });

  it("todo diagrama tem alternativa textual", () => {
    const svgs = [...html.matchAll(/<svg[^>]*>/g)];
    expect(svgs.length).toBeGreaterThan(0);
    for (const s of svgs) {
      expect(s[0], "svg sem role=img").toContain('role="img"');
      expect(s[0], "svg sem aria-label").toContain("aria-label=");
    }
  });
});

describe("arquivo publicável", () => {
  it("escreve docs/treinamento/index.html", () => {
    // Apaga antes: arquivo de execução anterior que já não corresponde ao
    // conteúdo é pior que arquivo nenhum.
    rmSync(DESTINO, { recursive: true, force: true });
    mkdirSync(DESTINO, { recursive: true });
    writeFileSync(`${DESTINO}/index.html`, html, "utf8");
    expect(html.length).toBeGreaterThan(50_000);
  });
});
