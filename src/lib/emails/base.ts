// Tipos e utilitários comuns aos e-mails do Loca. O desenho fica em `./layout`.
//
// A pasta é `emails/` (plural) de propósito: `src/lib/email.ts` continua sendo o
// transporte (Resend) e `src/lib/templates.ts` é de templates de DOCUMENTO
// (contrato, termo). Três coisas com nomes parecidos e papéis diferentes.
//
// Regras de HTML de e-mail que valem para tudo aqui dentro — não são as do app:
//  - layout em `<table>`, nunca flex/grid; Outlook usa o motor do Word;
//  - todo estilo inline; `<style>` com classe é removido por vários clientes;
//  - largura fixa de 600px, o consenso que cabe em qualquer painel de leitura;
//  - toda imagem com `alt` que faça sentido sozinho — o Outlook desktop bloqueia
//    imagem por padrão, então o e-mail tem de se explicar sem elas.

import {
  BRANCO,
  SLATE_50,
  SLATE_100,
  SLATE_200,
  SLATE_400,
  SLATE_500,
  SLATE_900,
  DESTRUCTIVE,
  WARNING_TEXTO,
  WARNING_FUNDO,
  WARNING_BORDA,
} from "@/lib/brand-colors";

/** Largura do corpo do e-mail, em px. */
export const LARGURA = 600;

/**
 * Pilha de fontes. Nenhuma webfont: o Outlook não carrega `@font-face` e cai
 * para Times New Roman, que destrói o desenho. Arial existe em todo lugar.
 */
export const FONTE = "Arial, Helvetica, sans-serif";

/** Cor de ação. Na identidade Sistenge 2026 é o slate-900 — o vermelho da marca
 *  fica restrito ao logotipo e a marcações de crítico. */
export const ACENTO = SLATE_900;

export const CORES = {
  BRANCO,
  SLATE_50,
  SLATE_100,
  SLATE_200,
  SLATE_400,
  SLATE_500,
  SLATE_900,
  DESTRUCTIVE,
  WARNING_TEXTO,
  WARNING_FUNDO,
  WARNING_BORDA,
} as const;

/**
 * Escapa texto para interpolação em HTML.
 *
 * Existe porque os e-mails de hoje interpolam dado do banco cru: um fornecedor
 * cadastrado como `Móveis & Cia <Ltda>` quebrava a marcação, e um valor com `<`
 * podia engolir o resto da tabela. Nada de dado dinâmico entra sem passar aqui.
 */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Dados da organização que aparecem no rodapé. Vêm de `organizacao`. */
export type Remetente = {
  /** Nome curto, usado no corpo do texto. */
  nome: string;
  /** `organizacao.razao_social`; cai para `nome` quando vazia. */
  razaoSocial?: string | null;
  /** `organizacao.cnpj`, já formatado. */
  cnpj?: string | null;
};

export type Contexto = {
  remetente: Remetente;
  /** Base dos links do corpo. */
  appUrl: string;
  /**
   * Base das imagens, quando diferente de `appUrl`.
   *
   * Existe porque a galeria de escolha roda de `file://` e precisa apontar o
   * logotipo para o `public/` do disco — com a URL de produção a imagem chega
   * quebrada e o cabeçalho fica impossível de julgar. Em produção fica vazio e
   * cai para `appUrl`.
   */
  assetsUrl?: string;
};

/** Origem das imagens do e-mail. */
export function baseAssets(ctx: Contexto): string {
  return ctx.assetsUrl || ctx.appUrl;
}

/** Uma métrica do topo: número grande + rótulo. */
export type Metrica = { valor: string; rotulo: string };

export type Cabecalho = {
  titulo: string;
  /** Linha de contexto sob o título: obra, período, número do registro. */
  subtitulo?: string;
  /** Resumo em números, exibido como uma linha sob o subtítulo. */
  metricas?: Metrica[];
};

export type TipoColuna = "texto" | "moeda" | "numero" | "data";

export type ColunaTabela = { label: string; tipo?: TipoColuna };

/**
 * Uma linha de tabela, com a ênfase opcional de fechamento.
 *
 * Existe porque o e-mail de relatório tem linhas de subtotal e de total, e sem
 * distinção visual o leitor soma de novo o que já está somado. No e-mail antigo
 * a intenção estava lá, mas o fundo era interpolado dentro de uma string de
 * aspas duplas — saía o texto literal `${SLATE_100}` no HTML e nenhuma cor era
 * aplicada.
 */
export type LinhaTabela = {
  /** Células em HTML já escapado. */
  celulas: string[];
  enfase?: "subtotal" | "total";
};

/** Envelopa células cruas nas linhas sem ênfase — o caso comum. */
export function linhasSimples(celulas: string[][]): LinhaTabela[] {
  return celulas.map((c) => ({ celulas: c }));
}

/** Alinhamento derivado do tipo — número e moeda à direita, sempre. */
export function alinhamento(tipo?: TipoColuna): "left" | "right" {
  return tipo === "moeda" || tipo === "numero" ? "right" : "left";
}

export type NivelAviso = "info" | "atencao" | "critico";

/** Cabeçalho `<!doctype>` + `<head>` de todo e-mail do Loca. */
export function documento(titulo: string, corpoHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${esc(titulo)}</title>
</head>
${corpoHtml}
</html>`;
}

/**
 * Linha institucional do rodapé — igual nas três famílias.
 *
 * "Controle de locações Sistenge." + razão social + CNPJ, e nada mais: foi o que
 * ficou definido. Sem endereço, sem telefone, sem aviso de confidencialidade.
 */
export function rodapeTexto(r: Remetente): string[] {
  const linhas = ["Controle de locações Sistenge."];
  const razao = r.razaoSocial?.trim() || r.nome;
  if (razao) linhas.push(esc(razao));
  if (r.cnpj?.trim()) linhas.push(`CNPJ ${esc(r.cnpj.trim())}`);
  return linhas;
}

/** Métricas achatadas em uma linha de texto. */
export function metricasEmLinha(metricas: Metrica[]): string {
  return metricas.map((m) => `${esc(m.valor)} ${esc(m.rotulo)}`).join(" · ");
}
