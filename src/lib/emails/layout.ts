// O layout único dos e-mails do Loca — "Cartão".
//
// Cartão branco sobre fundo cinza, cabeçalho em bloco slate-900 com o logotipo
// em negativo. Escolhido em 2026-08-24 entre três candidatos; os outros dois
// foram descartados junto com a interface `Familia` que existia só para
// renderizar os três. Uma marca, um layout — a indireção não tinha mais função.
//
// Regras de HTML de e-mail que valem para tudo aqui — não são as do app:
//  - layout em `<table>`, nunca flex/grid; o Outlook usa o motor do Word;
//  - todo estilo inline; `<style>` com classe é removido por vários clientes;
//  - largura fixa de 600px;
//  - toda imagem com `alt` que se explique sozinho — o Outlook desktop bloqueia
//    imagem por padrão, e o e-mail tem de funcionar sem elas.

import {
  ACENTO,
  CORES as C,
  FONTE,
  LARGURA,
  alinhamento,
  baseAssets,
  documento,
  esc,
  metricasEmLinha,
  rodapeTexto,
  type Cabecalho,
  type ColunaTabela,
  type LinhaTabela,
  type Contexto,
  type NivelAviso,
} from "./base";

/** Largura de exibição do logotipo, em px — metade do PNG, que sai em 2x. */
const LOGO_LARGURA = 220;
const LOGO_ALTURA = 61;

/**
 * O logotipo do cabeçalho é a versão em NEGATIVO: o bloco é slate-900.
 * O PNG tem o fundo assado — com transparência, o Outlook em modo escuro põe
 * preto atrás e a marca some.
 */
function logo(ctx: Contexto): string {
  return `<img src="${esc(baseAssets(ctx))}/marca/sistenge-email-negativo.png"
    width="${LOGO_LARGURA}" height="${LOGO_ALTURA}" alt="Sistenge"
    style="display:block;border:0;width:${LOGO_LARGURA}px;height:${LOGO_ALTURA}px;">`;
}

/** Cores de cada nível de aviso. Crítico é o único lugar fora do logotipo em que
 *  vermelho aparece — e é o `--destructive`, não o vermelho da marca. */
function coresAviso(nivel: NivelAviso) {
  if (nivel === "critico") {
    return { fundo: "#FEF2F2", borda: C.DESTRUCTIVE, texto: C.DESTRUCTIVE };
  }
  if (nivel === "atencao") {
    return { fundo: C.WARNING_FUNDO, borda: C.WARNING_BORDA, texto: C.WARNING_TEXTO };
  }
  return { fundo: C.SLATE_100, borda: C.SLATE_400, texto: C.SLATE_900 };
}

// ---------------------------------------------------------------------------
// Primitivos de conteúdo
// ---------------------------------------------------------------------------

/** Parágrafo de corpo. Recebe HTML já escapado. */
export function p(html: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${C.SLATE_900};">${html}</p>`;
}

/** Texto pequeno e discreto: ressalvas, instruções secundárias. */
export function nota(html: string): string {
  return `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${C.SLATE_500};">${html}</p>`;
}

/** Título de seção dentro do corpo. */
export function secao(texto: string): string {
  return `<h2 style="margin:22px 0 10px;font-size:15px;color:${C.SLATE_900};font-weight:bold;">${esc(
    texto,
  )}</h2>`;
}

/** Lista com marcadores. Recebe HTML já escapado. */
export function lista(itens: string[]): string {
  const li = itens.map((i) => `<li style="margin-bottom:6px;">${i}</li>`).join("");
  return `<ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.55;color:${C.SLATE_900};">${li}</ul>`;
}

/** Bloco destacado. */
export function aviso(html: string, nivel: NivelAviso = "info"): string {
  const c = coresAviso(nivel);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:0 0 16px;"><tr><td style="border:1px solid ${c.borda};background:${c.fundo};
    padding:12px 16px;font-size:13px;line-height:1.55;color:${c.texto};">${html}</td></tr></table>`;
}

/** Botão de ação. */
export function botao(url: string, texto: string): string {
  // Tabela e não `<a>` solto: no Outlook o padding de um inline-block é ignorado
  // e o botão vira um link colado no texto.
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 8px;">
    <tr><td style="background:${ACENTO};padding:12px 22px;">
      <a href="${esc(url)}" style="color:${C.BRANCO};text-decoration:none;font-size:14px;
        font-weight:bold;display:inline-block;">${esc(texto)}</a>
    </td></tr></table>`;
}

/** Pares rótulo/valor. O valor chega como HTML já escapado. */
export function dados(itens: [string, string][]): string {
  const linhas = itens
    .map(
      ([rotulo, valor]) =>
        `<tr>
          <td style="padding:9px 0;font-size:13px;color:${C.SLATE_500};width:170px;
            vertical-align:top;">${esc(rotulo)}</td>
          <td style="padding:9px 0;font-size:14px;font-weight:bold;color:${C.SLATE_900};">${valor}</td>
        </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:0 0 16px;">${linhas}</table>`;
}

/** Tabela de dados. As células chegam como HTML já escapado. */
export function tabela(colunas: ColunaTabela[], linhas: LinhaTabela[]): string {
  const th = colunas
    .map(
      (col) =>
        `<th style="padding:9px 12px;text-align:${alinhamento(col.tipo)};
          background:${C.SLATE_100};color:${C.SLATE_500};font-size:11px;letter-spacing:0.6px;
          text-transform:uppercase;font-weight:bold;">${esc(col.label)}</th>`,
    )
    .join("");

  const tr = linhas
    .map((linha) => {
      const fundo =
        linha.enfase === "total"
          ? C.SLATE_100
          : linha.enfase === "subtotal"
            ? C.SLATE_50
            : C.BRANCO;
      const peso = linha.enfase ? "font-weight:bold;" : "";
      const celulas = linha.celulas
        .map((cel, i) => {
          const tipo = colunas[i]?.tipo;
          const nowrap = tipo && tipo !== "texto" ? "white-space:nowrap;" : "";
          return `<td style="padding:10px 12px;border-bottom:1px solid ${C.SLATE_200};
            font-size:13px;color:${C.SLATE_900};text-align:${alinhamento(tipo)};${nowrap}${peso}">${cel}</td>`;
        })
        .join("");
      return `<tr style="background:${fundo};">${celulas}</tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-collapse:collapse;margin:0 0 16px;"><thead><tr>${th}</tr></thead>
    <tbody>${tr}</tbody></table>`;
}

// ---------------------------------------------------------------------------
// A página
// ---------------------------------------------------------------------------

/** Monta o e-mail inteiro em volta do corpo já montado. */
export function pagina(cab: Cabecalho, corpo: string, ctx: Contexto): string {
  const metricas = cab.metricas?.length
    ? `<p style="margin:8px 0 0;font-size:12px;color:${C.SLATE_400};">${metricasEmLinha(
        cab.metricas,
      )}</p>`
    : "";

  const rodape = rodapeTexto(ctx.remetente)
    .map((l, i) => (i === 0 ? `<strong>${l}</strong>` : l))
    .join("<br>");

  return documento(
    cab.titulo,
    `<body style="margin:0;padding:0;background:${C.SLATE_50};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="background:${C.SLATE_50};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="${LARGURA}" cellpadding="0" cellspacing="0" border="0"
        style="width:${LARGURA}px;max-width:100%;font-family:${FONTE};background:${C.BRANCO};
        border:1px solid ${C.SLATE_200};">

        <tr><td style="background:${C.SLATE_900};padding:22px 28px;">${logo(ctx)}</td></tr>
        <tr><td style="padding:26px 28px 0;">
          <h1 style="margin:0;font-size:19px;line-height:1.35;font-weight:bold;color:${C.SLATE_900};">
            ${esc(cab.titulo)}</h1>
          ${
            cab.subtitulo
              ? `<p style="margin:6px 0 0;font-size:13px;color:${C.SLATE_500};">${esc(cab.subtitulo)}</p>`
              : ""
          }
          ${metricas}
        </td></tr>
        <tr><td style="padding:20px 28px 8px;">${corpo}</td></tr>
        <tr><td style="background:${C.SLATE_50};border-top:1px solid ${C.SLATE_200};padding:16px 28px;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:${C.SLATE_400};">${rodape}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>`,
  );
}
