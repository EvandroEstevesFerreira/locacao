// Pré-visualização local: escreve os cenários do catálogo como HTML em disco.
//
// Serve para ver os e-mails sem disparar nada. Um e-mail transacional só é
// conferido em produção quando alguém aciona o gatilho — e aí já foi para a
// caixa de alguém.
//
// É função pura que devolve os arquivos; quem escreve em disco é `galeria.test.ts`.

import { CATALOGO, type ItemCatalogo } from "./catalogo";
import * as ex from "./exemplos";
import type { Contexto } from "./base";

export type ArquivoGaleria = {
  nome: string;
  html: string;
  item: ItemCatalogo;
  assunto: string;
  texto: string;
};

/** Renderiza o catálogo inteiro. */
export function renderizarTudo(ctx: Contexto = ex.CONTEXTO): ArquivoGaleria[] {
  return CATALOGO.map((item) => {
    const email = item.render(ctx);
    return {
      nome: `${item.id}.html`,
      html: email.html,
      item,
      assunto: email.assunto,
      texto: email.texto,
    };
  });
}

// ---------------------------------------------------------------------------
// Página de índice
// ---------------------------------------------------------------------------

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin:0; font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;
  background:#F1F5F9; color:#0F172A; }
header { background:#0F172A; color:#fff; padding:28px 32px; }
header h1 { margin:0 0 6px; font-size:22px; }
header p { margin:0; color:#94A3B8; font-size:13px; max-width:72ch; }
nav { position:sticky; top:0; background:#fff; border-bottom:1px solid #E2E8F0;
  padding:10px 32px; display:flex; flex-wrap:wrap; gap:6px; z-index:5; }
nav a { font-size:12px; padding:5px 10px; background:#F1F5F9; color:#0F172A;
  text-decoration:none; border-radius:3px; }
nav a:hover { background:#0F172A; color:#fff; }
main { padding:0 32px 64px; display:grid; grid-template-columns:repeat(2,1fr);
  gap:28px; align-items:start; }
section { margin-top:32px; background:#fff; border:1px solid #E2E8F0; }
.cab { padding:14px 18px; border-bottom:1px solid #E2E8F0; }
.cab h2 { margin:0 0 4px; font-size:16px; display:flex; gap:10px;
  align-items:center; flex-wrap:wrap; }
.tag { font-size:10px; letter-spacing:.6px; text-transform:uppercase;
  background:#FEF3C7; color:#92400E; border:1px solid #B45309;
  padding:2px 7px; border-radius:2px; font-weight:400; }
.gatilho { color:#64748B; font-size:12px; }
.assunto { margin:8px 0 0; font-size:12px; color:#0F172A;
  font-family:ui-monospace,Consolas,monospace; word-break:break-word; }
.acoes { padding:10px 18px; border-bottom:1px solid #E2E8F0; }
.acoes a { font-size:12px; color:#64748B; }
.moldura { height:560px; overflow:hidden; }
iframe { width:640px; height:1120px; border:0; transform:scale(.5);
  transform-origin:0 0; }
@media (max-width:1200px) { main { grid-template-columns:1fr; }
  iframe { width:100%; transform:none; } .moldura { height:640px; overflow:auto; } }
`;

export function paginaIndice(arquivos: ArquivoGaleria[]): string {
  const secoes = arquivos
    .map(
      (a) => `<section id="${a.item.id}">
      <div class="cab">
        <h2>${a.item.titulo}${
          a.item.aguardandoGatilho
            ? '<span class="tag">sem gatilho ainda</span>'
            : ""
        }</h2>
        <div class="gatilho">${a.item.gatilho}</div>
        <p class="assunto">Assunto: ${a.assunto}</p>
      </div>
      <div class="acoes"><a href="${a.nome}" target="_blank">abrir em tamanho real ↗</a></div>
      <div class="moldura"><iframe src="${a.nome}" loading="lazy" title="${a.item.titulo}"></iframe></div>
    </section>`,
    )
    .join("");

  const links = CATALOGO.map((i) => `<a href="#${i.id}">${i.titulo}</a>`).join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Loca — e-mails</title>
<style>${CSS}</style></head>
<body>
<header>
  <h1>E-mails do Loca</h1>
  <p>Os dez cenários no layout <strong>Cartão</strong>. Os marcados como
  "sem gatilho ainda" estão prontos, mas nenhum lugar do sistema os dispara —
  esperam a entrega do fluxo correspondente. Cada quadro está a 50%; use
  "abrir em tamanho real" para julgar a leitura.</p>
</header>
<nav>${links}</nav>
<main>${secoes}</main>
</body></html>`;
}
