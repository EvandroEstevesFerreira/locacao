import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { paginaIndice, renderizarTudo } from "./galeria";
import { CATALOGO } from "./catalogo";
import { esc } from "./base";
import { textoDe } from "./templates";

// Este teste faz duas coisas de propósito: verifica que os HTML saem íntegros E
// escreve a pré-visualização em .artefatos/emails/. Separar em script à parte
// significaria que a renderização só é exercitada quando alguém lembra de rodar
// o script — e e-mail transacional quase nunca é olhado antes de disparar.
const DESTINO = ".artefatos/emails";

const arquivos = renderizarTudo();

describe("galeria de e-mails", () => {
  it("renderiza o catálogo inteiro", () => {
    expect(arquivos).toHaveLength(CATALOGO.length);
    expect(new Set(arquivos.map((a) => a.nome)).size).toBe(arquivos.length);
  });

  it("escreve os arquivos e o índice", () => {
    // Apaga antes de escrever: arquivo de uma execução anterior que não existe
    // mais no catálogo continuaria na pasta, e uma pré-visualização com um
    // e-mail que o sistema já não manda é pior que nenhuma.
    rmSync(DESTINO, { recursive: true, force: true });
    mkdirSync(DESTINO, { recursive: true });
    for (const a of arquivos) {
      writeFileSync(`${DESTINO}/${a.nome}`, a.html, "utf8");
    }
    writeFileSync(`${DESTINO}/index.html`, paginaIndice(arquivos), "utf8");
    expect(arquivos.length).toBeGreaterThan(0);
  });
});

describe("invariantes de todo e-mail", () => {
  it.each(arquivos.map((a) => [a.nome, a] as const))(
    "%s — íntegro",
    (_nome, a) => {
      // Nenhum buraco de dado chegando à caixa de entrada.
      expect(a.html).not.toMatch(/undefined|NaN|\[object Object\]/);

      // Identidade: logotipo e rodapé institucional.
      expect(a.html).toContain("/marca/sistenge-email");
      expect(a.html).toContain('alt="Sistenge"');
      expect(a.html).toContain("Controle de locações Sistenge.");
      expect(a.html).toContain("CNPJ 12.345.678/0001-90");

      // Assunto e alternativa em texto existem e dizem algo.
      expect(a.assunto.length).toBeGreaterThan(8);
      expect(a.texto.length).toBeGreaterThan(80);

      // Largura fixa: o e-mail não pode depender de viewport.
      expect(a.html).toContain("width:600px");

      // Nada de flex/grid — o Outlook usa o motor do Word.
      expect(a.html).not.toMatch(/display:\s*(flex|grid)/);

      // Nenhum `<style>`: vários clientes o removem, e aí o e-mail chega cru.
      expect(a.html).not.toContain("<style");
    },
  );

  it("o cabeçalho usa o logotipo em negativo sobre o bloco escuro", () => {
    for (const a of arquivos) {
      expect(a.html).toContain("sistenge-email-negativo.png");
      expect(a.html).toContain("background:#0F172A;padding:22px 28px;");
    }
  });
});

describe("escape de dado do banco", () => {
  it("o fornecedor com & no nome sai escapado, não cru", () => {
    // "Móveis & Equipamentos Rocha" é o caso que quebrava o HTML antes de `esc`.
    const relatorio = arquivos.find((a) => a.item.id === "relatorio");
    expect(relatorio).toBeDefined();
    expect(relatorio!.html).toContain("Móveis &amp; Equipamentos Rocha");
    expect(relatorio!.html).not.toContain("Móveis & Equipamentos Rocha");
  });

  it("esc neutraliza marcação em nome de fornecedor", () => {
    expect(esc('Rocha <img src=x onerror="1"> & Cia')).toBe(
      "Rocha &lt;img src=x onerror=&quot;1&quot;&gt; &amp; Cia",
    );
  });
});

describe("alternativa em texto puro", () => {
  it("não deixa marcação vazar", () => {
    for (const a of arquivos) {
      expect(a.texto).not.toContain("<");
      expect(a.texto).not.toContain("&amp;");
    }
  });

  it("preserva o título e o rodapé", () => {
    const [primeiro] = arquivos;
    expect(primeiro.texto).toContain("Avisos de vencimento");
    expect(primeiro.texto).toContain("Controle de locações Sistenge.");
  });

  it("desfaz as entidades que o esc criou", () => {
    expect(textoDe("<p>Móveis &amp; Cia &lt;Ltda&gt;</p>")).toBe(
      "Móveis & Cia <Ltda>",
    );
  });
});
