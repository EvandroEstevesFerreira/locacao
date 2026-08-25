// Os quatro diagramas do treinamento, em SVG embutido.
//
// Regras que valem para os quatro:
//
//  - **`currentColor` em traço e texto.** O SVG herda a cor do corpo da página,
//    então o mesmo desenho funciona em tema claro e escuro sem media query. Cor
//    literal fica reservada ao ÚNICO elemento que carrega sentido: o elo que o
//    sistema ainda não tem.
//  - **Sem `width` no `<svg>`.** Só `viewBox`; a largura vem do CSS. Com largura
//    fixa em px o diagrama estoura a tela de 390px, que é onde o operador abre.
//  - **Nunca distinguir só por cor.** O elo inexistente é tracejado E rotulado;
//    a matriz de perfis usa ✓ e — em vez de verde e vermelho. Quem não enxerga
//    a cor, e quem imprime em preto e branco, continua lendo.
//  - **Nada de `<script>`, `<style>` ou imagem externa** dentro do SVG.

import { WARNING_BORDA } from "@/lib/brand-colors";
import { STATUS_IMOVEL_INFO, STATUS_CAUCAO_INFO } from "@/lib/imoveis";
import { PAPEL_INFO } from "@/lib/permissoes";
import type { DiagramaKey } from "./tipos";

export type Diagrama = {
  /** Nome acessível — vai no `<title>` e no `aria-label`. */
  titulo: string;
  /** A afirmação que a figura sustenta — vai no `<figcaption>`. */
  legenda: string;
  svg: string;
};

/** Cor do elo que o sistema ainda não tem. Âmbar de aviso, não o vermelho da
 *  marca — que fica restrito a logotipo e marcação de crítico. */
const PENDENTE = WARNING_BORDA;

/** Ponta de seta. O `id` é referenciado por fragmento no mesmo SVG. */
function defs(id: string, cor = "currentColor"): string {
  return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5"
    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="${cor}"/></marker></defs>`;
}

function caixa(x: number, y: number, w: number, h: number, texto: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"
    fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle"
    font-size="13" fill="currentColor">${texto}</text>`;
}

function abre(viewBox: string, titulo: string): string {
  return `<svg viewBox="${viewBox}" role="img" aria-label="${titulo}"
    xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto">
    <title>${titulo}</title>`;
}

// ---------------------------------------------------------------------------
// 1 — Cadeia de custódia
//
// Três nós e quatro elos, não uma fila de quatro caixas: a ferramenta VOLTA
// pelos mesmos lugares por onde foi. Desenhado como fila, o retorno some, e o
// retorno é metade do controle.
// ---------------------------------------------------------------------------

const cadeiaCustodia = `${abre("0 0 660 250", "Cadeia de custódia da ferramenta")}
${defs("seta")}
${defs("seta-pendente", PENDENTE)}

${caixa(20, 100, 160, 56, "Fornecedor")}
${caixa(250, 100, 160, 56, "Sistenge · obra")}
${caixa(480, 100, 160, 56, "Funcionário")}

<path d="M180,116 H244" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta)"/>
<text x="212" y="106" text-anchor="middle" font-size="11" fill="currentColor">recebe</text>
<text x="212" y="92" text-anchor="middle" font-size="11" fill="currentColor">REC</text>

<path d="M244,140 H180" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta)"/>
<text x="212" y="166" text-anchor="middle" font-size="11" fill="currentColor">devolve</text>
<text x="212" y="180" text-anchor="middle" font-size="11" fill="currentColor">DEV</text>

<path d="M410,116 H474" stroke="${PENDENTE}" stroke-width="1.5"
  stroke-dasharray="6 4" marker-end="url(#seta-pendente)"/>
<text x="442" y="106" text-anchor="middle" font-size="11" fill="${PENDENTE}">entrega</text>

<path d="M474,140 H410" stroke="${PENDENTE}" stroke-width="1.5"
  stroke-dasharray="6 4" marker-end="url(#seta-pendente)"/>
<text x="442" y="166" text-anchor="middle" font-size="11" fill="${PENDENTE}">devolve</text>

<rect x="415" y="196" width="230" height="38" rx="5" fill="none"
  stroke="${PENDENTE}" stroke-width="1.5" stroke-dasharray="6 4"/>
<text x="530" y="213" text-anchor="middle" font-size="11" fill="${PENDENTE}">tracejado = em construção</text>
<text x="530" y="227" text-anchor="middle" font-size="11" fill="${PENDENTE}">o Loca ainda não controla isto</text>
</svg>`;

// ---------------------------------------------------------------------------
// 2 — Anatomia de uma tela de lista
//
// Vale por dez telas: obras, fornecedores, itens, contratos, imóveis, vistorias,
// financeiro e relatórios repetem esta mesma estrutura. Ensinar uma vez.
// ---------------------------------------------------------------------------

const telaLista = `${abre("0 0 660 330", "Anatomia de uma tela de lista")}
${defs("seta-l")}

<rect x="180" y="20" width="460" height="290" rx="8" fill="none"
  stroke="currentColor" stroke-width="1.5"/>

<rect x="200" y="40" width="200" height="30" rx="5" fill="none"
  stroke="currentColor" stroke-width="1"/>
<text x="212" y="60" font-size="12" fill="currentColor">Buscar…</text>

<rect x="412" y="40" width="100" height="30" rx="5" fill="none"
  stroke="currentColor" stroke-width="1"/>
<text x="424" y="60" font-size="12" fill="currentColor">Obra ▾</text>
<rect x="522" y="40" width="98" height="30" rx="5" fill="none"
  stroke="currentColor" stroke-width="1"/>
<text x="534" y="60" font-size="12" fill="currentColor">Status ▾</text>

<line x1="200" y1="92" x2="620" y2="92" stroke="currentColor" stroke-width="1.5"/>
<text x="206" y="108" font-size="11" fill="currentColor">NÚMERO</text>
<text x="300" y="108" font-size="11" fill="currentColor">DESCRIÇÃO</text>
<text x="470" y="108" font-size="11" fill="currentColor">OBRA</text>
<text x="580" y="108" font-size="11" fill="currentColor">VALOR</text>
<line x1="200" y1="118" x2="620" y2="118" stroke="currentColor" stroke-width="1"/>

<line x1="200" y1="152" x2="620" y2="152" stroke="currentColor" stroke-width="0.5"/>
<line x1="200" y1="186" x2="620" y2="186" stroke="currentColor" stroke-width="0.5"/>
<line x1="200" y1="220" x2="620" y2="220" stroke="currentColor" stroke-width="0.5"/>
<text x="206" y="141" font-size="12" fill="currentColor">CTR-2026-0007</text>
<text x="206" y="175" font-size="12" fill="currentColor">CTR-2026-0008</text>
<text x="206" y="209" font-size="12" fill="currentColor">CTR-2026-0009</text>

<text x="620" y="258" text-anchor="end" font-size="12" fill="currentColor">‹ 1 2 3 ›</text>

<text x="20" y="60" font-size="12" fill="currentColor">busca por número</text>
<text x="20" y="76" font-size="12" fill="currentColor">e por nome</text>
<path d="M150,60 H196" stroke="currentColor" stroke-width="1" marker-end="url(#seta-l)"/>

<text x="20" y="112" font-size="12" fill="currentColor">filtros aplicam</text>
<text x="20" y="128" font-size="12" fill="currentColor">na hora</text>
<path d="M150,112 L404,60" stroke="currentColor" stroke-width="1" marker-end="url(#seta-l)"/>

<text x="20" y="168" font-size="12" fill="currentColor">clique no título</text>
<text x="20" y="184" font-size="12" fill="currentColor">ordena a coluna</text>
<path d="M150,168 L196,108" stroke="currentColor" stroke-width="1" marker-end="url(#seta-l)"/>

<text x="20" y="252" font-size="12" fill="currentColor">sem registro, a tela</text>
<text x="20" y="268" font-size="12" fill="currentColor">explica o que falta</text>
<path d="M150,258 L196,200" stroke="currentColor" stroke-width="1" marker-end="url(#seta-l)"/>
</svg>`;

// ---------------------------------------------------------------------------
// 3 — Ciclo de vida do contrato de imóvel
//
// Duas trilhas paralelas, e é isso que o desenho existe para mostrar: a caução
// segue o próprio caminho. Encerrar o contrato NÃO devolve a caução.
// ---------------------------------------------------------------------------

const st = STATUS_IMOVEL_INFO;
const cau = STATUS_CAUCAO_INFO;

const cicloContratoImovel = `${abre("0 0 660 290", "Ciclo de vida do contrato de imóvel")}
${defs("seta-c")}

<text x="20" y="34" font-size="11" fill="currentColor">CONTRATO</text>
${caixa(20, 46, 170, 52, st.ativo.label)}
${caixa(245, 46, 170, 52, st.desocupacao.label)}
${caixa(470, 46, 170, 52, st.encerrado.label)}
<path d="M190,72 H239" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta-c)"/>
<text x="214" y="38" text-anchor="middle" font-size="11" fill="currentColor">aviso</text>
<path d="M415,72 H464" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta-c)"/>
<text x="440" y="38" text-anchor="middle" font-size="11" fill="currentColor">chaves</text>

<line x1="20" y1="128" x2="640" y2="128" stroke="currentColor" stroke-width="0.5"
  stroke-dasharray="3 3"/>

<text x="20" y="158" font-size="11" fill="currentColor">CAUÇÃO — caminho próprio</text>
${caixa(20, 170, 170, 52, cau.em_aberto)}
${caixa(300, 140, 170, 52, cau.devolvida)}
${caixa(300, 210, 170, 52, cau.retida)}
<path d="M190,186 L294,170" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta-c)"/>
<text x="242" y="164" text-anchor="middle" font-size="11" fill="currentColor">sem avaria</text>
<path d="M190,200 L294,232" stroke="currentColor" stroke-width="1.5" marker-end="url(#seta-c)"/>
<text x="242" y="230" text-anchor="middle" font-size="11" fill="currentColor">com avaria</text>

<text x="500" y="192" font-size="11" fill="currentColor">encerrar o contrato</text>
<text x="500" y="208" font-size="11" fill="currentColor">não resolve a caução</text>
</svg>`;

// ---------------------------------------------------------------------------
// 4 — Matriz de perfis
//
// Lida de PAPEL_INFO e dos helpers de `permissoes.ts`. Marcada com ✓ e —, nunca
// só por cor: precisa funcionar impressa em preto e branco.
// ---------------------------------------------------------------------------

const LINHAS: { papel: keyof typeof PAPEL_INFO; cadastrar: boolean; operar: boolean }[] = [
  { papel: "master", cadastrar: true, operar: true },
  { papel: "administrador", cadastrar: true, operar: true },
  { papel: "gestor", cadastrar: false, operar: false },
  { papel: "operador", cadastrar: false, operar: true },
];

const matrizPerfis = `${abre("0 0 660 250", "Matriz de perfis e permissões")}
<text x="330" y="30" font-size="11" text-anchor="middle" fill="currentColor">CADASTRAR</text>
<text x="450" y="30" font-size="11" text-anchor="middle" fill="currentColor">OPERAR</text>
<text x="580" y="30" font-size="11" text-anchor="middle" fill="currentColor">LER E RELATAR</text>
<line x1="20" y1="42" x2="640" y2="42" stroke="currentColor" stroke-width="1.5"/>
${LINHAS.map((l, i) => {
  const y = 72 + i * 42;
  const marca = (ok: boolean) => (ok ? "✓" : "—");
  return `<text x="20" y="${y}" font-size="13" fill="currentColor">${PAPEL_INFO[l.papel].label}</text>
  <text x="330" y="${y}" font-size="15" text-anchor="middle" fill="currentColor">${marca(l.cadastrar)}</text>
  <text x="450" y="${y}" font-size="15" text-anchor="middle" fill="currentColor">${marca(l.operar)}</text>
  <text x="580" y="${y}" font-size="15" text-anchor="middle" fill="currentColor">✓</text>
  <line x1="20" y1="${y + 14}" x2="640" y2="${y + 14}" stroke="currentColor" stroke-width="0.5"/>`;
}).join("")}
<text x="20" y="238" font-size="11" fill="currentColor">Além disto, o acesso por obra limita o que cada um vê dentro do que pode.</text>
</svg>`;

export const DIAGRAMAS: Record<DiagramaKey, Diagrama> = {
  "cadeia-custodia": {
    titulo: "Cadeia de custódia da ferramenta",
    legenda:
      "O Loca controla a ferramenta entre o fornecedor e a obra. Os dois elos tracejados — a entrega ao funcionário e a devolução dele — ainda não existem no sistema.",
    svg: cadeiaCustodia,
  },
  "tela-lista": {
    titulo: "Anatomia de uma tela de lista",
    legenda:
      "Obras, fornecedores, itens, contratos, imóveis, vistorias e financeiro repetem esta mesma estrutura. Aprender uma vez serve para todas.",
    svg: telaLista,
  },
  "ciclo-contrato-imovel": {
    titulo: "Ciclo de vida do contrato de imóvel",
    legenda:
      "O contrato e a caução seguem caminhos paralelos. Encerrar o contrato não resolve a caução — ela precisa ser devolvida ou retida por decisão própria.",
    svg: cicloContratoImovel,
  },
  "matriz-perfis": {
    titulo: "Matriz de perfis e permissões",
    legenda:
      "Todos leem e geram relatórios. Cadastrar é de Master e Administrador; operar inclui o Operador. O Gestor analisa e não edita.",
    svg: matrizPerfis,
  },
};
