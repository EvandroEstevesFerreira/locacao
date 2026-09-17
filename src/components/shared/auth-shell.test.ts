import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A tela de entrada é a mesma para todo mundo — cobrado por varredura.
 *
 * Duas promessas, e as duas já foram quebradas em produção, uma em seguida da
 * outra. O `AuthShell` força tema claro com `data-theme="light"`, e isso
 * redefine as VARIÁVEIS de cor no seu subtexto. O que a varredura protege são
 * as duas coisas que o `data-theme` sozinho NÃO resolve:
 *
 * 1. FUNDO OPACO. `bg-muted/40` compila para
 *    `color-mix(in oklab, var(--muted) 40%, transparent)`. Os tokens de dentro
 *    viram claros, mas 60% deixa passar a tela do navegador — escura, porque o
 *    `next-themes` põe `class="dark"` no `<html>` seguindo o sistema. Era o
 *    bug da 0.116.1.
 *
 * 2. COR DE TEXTO DECLARADA NA RAIZ. Cor herdada é valor já COMPUTADO, não
 *    referência a variável: um elemento sem cor própria mantém a que o
 *    `<body>` computou sob o tema escuro. Era o `<h1>Loca`, quase branco sobre
 *    o fundo claro, enquanto o logo e os parágrafos — que declaram a sua —
 *    saíam certos.
 *
 * Nenhum teste de renderização pegaria isto sem navegador, e o typecheck nunca
 * vai reclamar de uma classe do Tailwind. A varredura é o que sobra.
 */

const ARQUIVO = join(process.cwd(), "src", "components", "shared", "auth-shell.tsx");

/** O atributo `className` do `<main>` — a raiz da tela de autenticação. */
function classesDaRaiz(): string {
  const fonte = readFileSync(ARQUIVO, "utf8");
  const i = fonte.indexOf("<main");
  const j = fonte.indexOf(">", i);
  const trecho = fonte.slice(i, j);
  const m = trecho.match(/className="([^"]*)"/);
  return m?.[1] ?? "";
}

describe("a moldura das telas de autenticação", () => {
  // SEM ISTO A VARREDURA PASSA POR VACUIDADE. Se alguém renomear o arquivo, ou
  // trocar `<main>` por outro elemento, as asserções abaixo passariam sobre uma
  // string vazia e não guardariam nada.
  it("a varredura encontra a raiz que deveria", () => {
    const classes = classesDaRaiz();
    expect(classes.length, "não achei o className do <main> em auth-shell.tsx").toBeGreaterThan(20);
    expect(classes).toContain("min-h-dvh");
    expect(readFileSync(ARQUIVO, "utf8")).toContain('data-theme="light"');
  });

  it("o fundo é opaco — alfa deixaria a tela escura do navegador atravessar", () => {
    expect(
      /\bbg-[a-z-]+\/\d+/.test(classesDaRaiz()),
      "a raiz voltou a ter fundo com opacidade (bg-algo/NN). Aqui o alfa não " +
        "clareia a cor, ele revela o fundo escuro do navegador — foi o bug da 0.116.1.",
    ).toBe(false);
  });

  it("a cor do texto é declarada na raiz, não herdada", () => {
    expect(
      /\btext-foreground\b/.test(classesDaRaiz()),
      "a raiz perdeu `text-foreground`. Cor herdada é valor computado, não " +
        "variável: sem declará-la aqui, todo elemento que não traz a própria " +
        "cor fica com a do tema escuro — foi o que deixou o título invisível.",
    ).toBe(true);
  });
});
