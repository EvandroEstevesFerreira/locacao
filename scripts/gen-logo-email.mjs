// Gera o logotipo Sistenge em PNG para uso em e-mail — clientes de e-mail não
// renderizam SVG de forma confiável (Outlook desktop simplesmente não renderiza).
//
// Os paths NÃO são copiados para cá: o script os extrai de src/lib/pdf-logo.tsx,
// que é a única cópia dos paths do "Versão Fundo Claro.svg" oficial. Duas cópias
// divergiriam na primeira correção, e o e-mail sairia com uma marca diferente da
// do contrato em PDF.
//
// Uso: node scripts/gen-logo-email.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const FONTE_LOGO = "src/lib/pdf-logo.tsx";
const FONTE_CORES = "src/lib/brand-colors.ts";
const DESTINO = "public/marca";

/** Largura de exibição no e-mail, em px. O PNG sai em 2x para telas retina. */
const LARGURA_EXIBICAO = 200;
const ESCALA = 2;

function hexDe(nome) {
  const src = readFileSync(FONTE_CORES, "utf8");
  const m = src.match(new RegExp(`export const ${nome} = "(#[0-9A-Fa-f]{6})"`));
  if (!m) throw new Error(`Cor ${nome} não encontrada em ${FONTE_CORES}.`);
  return m[1];
}

function lerLogo() {
  const src = readFileSync(FONTE_LOGO, "utf8");

  const vb = src.match(/LOGO_VIEWBOX = "([^"]+)"/);
  if (!vb) throw new Error("LOGO_VIEWBOX não encontrado.");

  // <Path fill={TOKEN} d="..." />  e  <Polygon fill={TOKEN} points="..." />
  const re = /<(Path|Polygon)\s+fill=\{(\w+)\}\s+(d|points)="([^"]+)"\s*\/>/g;
  const formas = [...src.matchAll(re)].map(([, tag, token, attr, valor]) => ({
    tag: tag.toLowerCase(),
    token,
    attr,
    valor,
  }));
  if (formas.length === 0) throw new Error("Nenhuma forma encontrada no logo.");
  return { viewBox: vb[1], formas };
}

/**
 * @param {{icone: string, wordmark: string}} cores
 */
function montarSvg({ viewBox, formas }, cores, larguraPx) {
  const [, , vbW, vbH] = viewBox.split(/\s+/).map(Number);
  const alturaPx = Math.round((larguraPx * vbH) / vbW);

  const corpo = formas
    .map((f) => {
      const fill = f.token === "ICONE_VERMELHO" ? cores.icone : cores.wordmark;
      return `<${f.tag} fill="${fill}" ${f.attr}="${f.valor}"/>`;
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
    `width="${larguraPx}" height="${alturaPx}">${corpo}</svg>`;
  return { svg, alturaPx };
}

const logo = lerLogo();
const VERMELHO = hexDe("MARCA_VERMELHO");
const SLATE_900 = hexDe("SLATE_900");
const BRANCO = hexDe("BRANCO");

// Duas versões, porque as três famílias de e-mail precisam das duas: cabeçalho
// claro usa o wordmark slate-900; cabeçalho em bloco escuro usa o branco.
//
// O fundo vai ASSADO no PNG, não transparente. Com transparência, o Outlook em
// modo escuro força um fundo preto atrás da imagem e o wordmark slate-900
// simplesmente desaparece — o cabeçalho chega vazio. Cada versão carrega a sua
// própria placa e fica legível em qualquer tema.
const VERSOES = [
  {
    nome: "sistenge-email",
    cores: { icone: VERMELHO, wordmark: SLATE_900 },
    fundo: BRANCO,
  },
  {
    nome: "sistenge-email-negativo",
    cores: { icone: VERMELHO, wordmark: BRANCO },
    fundo: SLATE_900,
  },
];

/** Respiro em volta da marca, em fração da largura. Sem ele a placa corta rente
 *  aos glifos e a borda aparece como um retângulo estranho dentro do cabeçalho. */
const RESPIRO = 0.05;

function rgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    alpha: 1,
  };
}

mkdirSync(DESTINO, { recursive: true });

for (const v of VERSOES) {
  const { svg } = montarSvg(logo, v.cores, LARGURA_EXIBICAO * ESCALA);

  // O SVG fica sem placa: quem o usa (web, apresentação) tem CSS de verdade.
  writeFileSync(`${DESTINO}/${v.nome}.svg`, svg);

  const respiro = Math.round(LARGURA_EXIBICAO * ESCALA * RESPIRO);
  // `density` NÃO serve para dimensionar: ela reescala o SVG inteiro e ignora a
  // largura declarada — saía 1707px de largura. O tamanho vem do resize.
  const info = await sharp(Buffer.from(svg))
    .resize({ width: LARGURA_EXIBICAO * ESCALA })
    .extend({
      top: respiro,
      bottom: respiro,
      left: respiro,
      right: respiro,
      background: rgb(v.fundo),
    })
    .flatten({ background: rgb(v.fundo) })
    .png({ compressionLevel: 9 })
    .toFile(`${DESTINO}/${v.nome}.png`);

  console.log(
    `OK: ${DESTINO}/${v.nome}.png — ${info.width}x${info.height}px, fundo ${v.fundo} ` +
      `(exibir a ${LARGURA_EXIBICAO + respiro / ESCALA}px de largura)`,
  );
}
