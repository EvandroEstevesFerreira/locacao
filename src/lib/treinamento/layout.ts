// O desenho do treinamento: casca, CSS, JS de progresso e montagem dos blocos.
//
// Único lugar que sabe desenhar. Os dezoito módulos escrevem conteúdo com os
// tipos de `./tipos` e não sabem nada daqui — mudar o visual de todos é mexer
// neste arquivo, e nenhum conteúdo acompanha.
//
// Isto é uma PÁGINA WEB, não e-mail. As regras de `src/lib/emails/layout.ts`
// (estilo inline, sem `<style>`, tudo em `<table>`) valem lá porque cliente de
// e-mail remove a tag e usa o motor do Word. Aqui `<style>`, grid e flex são o
// certo. O que continua valendo dos dois lados: zero asset externo.

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
  MARCA_VERMELHO,
  DARK_FUNDO,
  DARK_CARD,
  DARK_TEXTO,
  DARK_TEXTO_FRACO,
} from "@/lib/brand-colors";
import type { Modulo, PerfilKey, Trilha } from "./tipos";

/**
 * Cores permitidas na página.
 *
 * A paleta de `brand-colors.ts` mais os extras abaixo, cada um declarado com o
 * porquê. Exigir que TODA cor viesse de `brand-colors.ts` reprovaria cor
 * legítima — `src/lib/emails/layout.ts` já usa `#FEF2F2` literal pelo mesmo
 * motivo. O que a lista garante é que nenhuma cor entra sem passar por esta
 * decisão, e em particular que o `#cf2927` — o vermelho errado que ainda vive
 * em `apresentacao-loca.html` — nunca volte.
 */
const EXTRAS = [
  // Fundo do bloco de resposta ERRADA. Mesmo literal de emails/layout.ts.
  "#FEF2F2",
  // Resposta CERTA. Não há verde na paleta Sistenge, e a alternativa seria
  // sinalizar acerto só pelo texto. Vem sempre acompanhado do ícone ✓, porque
  // cor sozinha não serve para quem não a distingue.
  "#ECFDF5",
  "#065F46",
] as const;

export const CORES_PERMITIDAS: string[] = [
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
  MARCA_VERMELHO,
  DARK_FUNDO,
  DARK_CARD,
  DARK_TEXTO,
  DARK_TEXTO_FRACO,
  ...EXTRAS,
];

export const PERFIL_LABEL: Record<PerfilKey, string> = {
  master: "Master",
  administrador: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
};

/**
 * Escapa texto para interpolação em HTML.
 *
 * Mesma função e mesmo motivo de `src/lib/emails/base.ts`: conteúdo com `&` ou
 * `<` quebra a marcação em silêncio, e "Itens & Contratos" é um título
 * perfeitamente natural de se escrever.
 */
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

export const CSS = `
:root {
  --fundo: ${SLATE_100};
  --card: ${BRANCO};
  --texto: ${SLATE_900};
  --fraco: ${SLATE_500};
  --tenue: ${SLATE_400};
  --linha: ${SLATE_200};
  --suave: ${SLATE_50};
  --acento: ${SLATE_900};
  --acento-texto: ${BRANCO};
  --marca: ${MARCA_VERMELHO};
  --aviso-fundo: ${WARNING_FUNDO};
  --aviso-borda: ${WARNING_BORDA};
  --aviso-texto: ${WARNING_TEXTO};
  --erro-fundo: ${EXTRAS[0]};
  --erro-texto: ${DESTRUCTIVE};
  --certo-fundo: ${EXTRAS[1]};
  --certo-texto: ${EXTRAS[2]};
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fundo: ${DARK_FUNDO};
    --card: ${DARK_CARD};
    --texto: ${DARK_TEXTO};
    --fraco: ${DARK_TEXTO_FRACO};
    --tenue: ${DARK_TEXTO_FRACO};
    --linha: ${SLATE_500};
    --suave: ${DARK_FUNDO};
    --acento: ${DARK_TEXTO};
    --acento-texto: ${DARK_FUNDO};
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--fundo);
  color: var(--texto);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}
a { color: inherit; }

/* Cabeçalho */
.topo { background: var(--acento); color: var(--acento-texto); padding: 28px 20px 32px; }
.topo-int { max-width: 900px; margin: 0 auto; }
.marca { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; opacity: .75; }
.topo h1 { margin: 6px 0 8px; font-size: 28px; line-height: 1.2; }
.topo p { margin: 0; max-width: 62ch; opacity: .85; font-size: 15px; }

/* Navegação por trilha */
.nav { max-width: 900px; margin: -18px auto 0; padding: 0 20px; }
.nav-cartao {
  background: var(--card); border: 1px solid var(--linha); border-radius: 8px;
  padding: 14px 16px;
}
.nav-cartao h2 { margin: 0 0 10px; font-size: 13px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--fraco); }
.nav-trilha { margin-bottom: 12px; }
.nav-trilha > a { display: block; font-weight: 700; text-decoration: none;
  padding: 8px 4px; min-height: 44px; }
.nav-mods { display: flex; flex-wrap: wrap; gap: 6px; padding-left: 4px; }
.nav-mods a {
  font-size: 13px; text-decoration: none; padding: 10px 12px; min-height: 44px;
  display: inline-flex; align-items: center;
  background: var(--suave); border: 1px solid var(--linha); border-radius: 6px;
}
.nav-mods a[data-feito="1"]::before { content: "✓ "; color: var(--certo-texto); }

/* Corpo */
main { max-width: 900px; margin: 0 auto; padding: 28px 20px 80px; }
.trilha { margin-top: 40px; }
.trilha-cab { border-bottom: 3px solid var(--acento); padding-bottom: 12px; }
.trilha-n { font-size: 12px; letter-spacing: 2px; text-transform: uppercase;
  color: var(--fraco); }
.trilha-cab h2 { margin: 4px 0 6px; font-size: 24px; }
.trilha-cab p { margin: 0 0 12px; color: var(--fraco); font-size: 15px; }
.barra { height: 6px; background: var(--linha); border-radius: 3px; overflow: hidden; }
.barra > span { display: block; height: 100%; width: 0; background: var(--acento); }

/* Módulo */
.modulo {
  background: var(--card); border: 1px solid var(--linha); border-radius: 8px;
  padding: 20px; margin-top: 20px;
}
.mod-cab { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; }
.mod-n {
  flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;
  background: var(--acento); color: var(--acento-texto);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700;
}
.mod-cab h3 { margin: 0; font-size: 20px; }
.perfis { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 0; }
.perfil {
  font-size: 11px; letter-spacing: .5px; text-transform: uppercase;
  border: 1px solid var(--linha); background: var(--suave); color: var(--fraco);
  padding: 3px 8px; border-radius: 3px;
}
.bloco { margin-top: 20px; }
.bloco > h4 {
  margin: 0 0 8px; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase;
  color: var(--fraco);
}
.bloco p { margin: 0 0 10px; }
.bloco ol, .bloco ul { margin: 0; padding-left: 22px; }
.bloco li { margin-bottom: 6px; }
.exemplo { border-left: 3px solid var(--marca); padding-left: 14px; }
figure { margin: 14px 0 0; overflow-x: auto; }
figure svg { max-width: 100%; height: auto; }

/* Exercícios */
.exercicio { display: flex; gap: 10px; align-items: flex-start;
  padding: 10px 0; min-height: 44px; cursor: pointer; }
.exercicio input { margin-top: 5px; width: 18px; height: 18px; flex: 0 0 auto; }

/* Verificação */
.pergunta { border: 1px solid var(--linha); border-radius: 6px; padding: 14px;
  margin-bottom: 12px; }
.pergunta > p { font-weight: 600; margin: 0 0 10px; }
.alts { display: flex; flex-direction: column; gap: 6px; }
.alt {
  text-align: left; font: inherit; font-size: 15px; cursor: pointer;
  background: var(--suave); color: var(--texto);
  border: 1px solid var(--linha); border-radius: 6px;
  padding: 12px 14px; min-height: 44px;
}
.alt[data-estado="certo"] { background: var(--certo-fundo); color: var(--certo-texto);
  border-color: var(--certo-texto); font-weight: 700; }
.alt[data-estado="errado"] { background: var(--erro-fundo); color: var(--erro-texto);
  border-color: var(--erro-texto); }
.comentario { display: none; margin: 10px 0 0; font-size: 14px;
  border-left: 3px solid var(--aviso-borda); background: var(--aviso-fundo);
  color: var(--aviso-texto); padding: 10px 12px; }
.comentario[data-visivel="1"] { display: block; }

/* Aviso de recurso inexistente */
.em-construcao {
  margin-top: 20px; border: 1px dashed var(--aviso-borda);
  background: var(--aviso-fundo); color: var(--aviso-texto);
  border-radius: 8px; padding: 18px;
}
.em-construcao h3 { margin: 0 0 8px; font-size: 17px; }
.em-construcao p { margin: 0 0 8px; }

@media (max-width: 780px) {
  .topo h1 { font-size: 23px; }
  .modulo { padding: 16px; }
  main { padding: 20px 14px 60px; }
  .nav { padding: 0 14px; }
}
`;

// ---------------------------------------------------------------------------
// JS — progresso por pessoa, no navegador
// ---------------------------------------------------------------------------

/**
 * Todo acesso a `localStorage` vai dentro de `try/catch`.
 *
 * Em janela privada, com dados de site bloqueados, e na captura de miniatura, o
 * próprio acessor LANÇA. Sem o try/catch a página quebra inteira em vez de
 * abrir simplesmente sem progresso salvo — que é o comportamento correto.
 */
export const JS = `
(function () {
  var CHAVE = "loca-treinamento:";

  function ler(k) {
    try { return localStorage.getItem(CHAVE + k); } catch (e) { return null; }
  }
  function gravar(k, v) {
    try { localStorage.setItem(CHAVE + k, v); } catch (e) { /* sem persistência */ }
  }

  function progresso() {
    var trilhas = document.querySelectorAll("[data-trilha]");
    for (var i = 0; i < trilhas.length; i++) {
      var id = trilhas[i].getAttribute("data-trilha");
      // Pelo ANCESTRAL, e não por atributo repetido em cada módulo: a seção da
      // trilha já contém os módulos dela. A primeira versão filtrava os módulos
      // por um atributo de trilha que secaoModulo nunca emitiu, e a barra ficava
      // travada em zero para sempre.
      var secao = document.getElementById("trilha-" + id);
      var mods = secao ? secao.querySelectorAll(".modulo") : [];
      var feitos = 0;
      for (var j = 0; j < mods.length; j++) {
        if (mods[j].getAttribute("data-feito") === "1") feitos++;
      }
      var pct = mods.length ? Math.round((feitos / mods.length) * 100) : 0;
      var barra = trilhas[i].querySelector("span");
      if (barra) barra.style.width = pct + "%";
    }
  }

  function conferirModulo(mod) {
    var caixas = mod.querySelectorAll('.exercicio input[type="checkbox"]');
    var todas = caixas.length > 0;
    for (var i = 0; i < caixas.length; i++) {
      if (!caixas[i].checked) todas = false;
    }
    mod.setAttribute("data-feito", todas ? "1" : "0");
    var link = document.querySelector('.nav-mods a[href="#' + mod.id + '"]');
    if (link) link.setAttribute("data-feito", todas ? "1" : "0");
  }

  function ligarExercicios() {
    var caixas = document.querySelectorAll('.exercicio input[type="checkbox"]');
    for (var i = 0; i < caixas.length; i++) {
      (function (caixa) {
        if (ler("ex:" + caixa.id) === "1") caixa.checked = true;
        caixa.addEventListener("change", function () {
          gravar("ex:" + caixa.id, caixa.checked ? "1" : "0");
          conferirModulo(caixa.closest(".modulo"));
          progresso();
        });
      })(caixas[i]);
    }
  }

  function revelar(pergunta, escolha) {
    var correta = parseInt(pergunta.getAttribute("data-correta"), 10);
    var alts = pergunta.querySelectorAll(".alt");
    for (var i = 0; i < alts.length; i++) {
      alts[i].setAttribute(
        "data-estado",
        i === correta ? "certo" : i === escolha ? "errado" : ""
      );
      alts[i].textContent =
        (i === correta ? "\\u2713 " : i === escolha ? "\\u2715 " : "") +
        alts[i].getAttribute("data-texto");
    }
    var com = pergunta.querySelector(".comentario");
    if (com) com.setAttribute("data-visivel", "1");
  }

  function ligarPerguntas() {
    var perguntas = document.querySelectorAll(".pergunta");
    for (var i = 0; i < perguntas.length; i++) {
      (function (pergunta) {
        var salvo = ler("pg:" + pergunta.id);
        if (salvo !== null) revelar(pergunta, parseInt(salvo, 10));
        var alts = pergunta.querySelectorAll(".alt");
        for (var j = 0; j < alts.length; j++) {
          (function (indice) {
            alts[indice].addEventListener("click", function () {
              gravar("pg:" + pergunta.id, String(indice));
              revelar(pergunta, indice);
            });
          })(j);
        }
      })(perguntas[i]);
    }
  }

  ligarExercicios();
  ligarPerguntas();
  var mods = document.querySelectorAll(".modulo");
  for (var k = 0; k < mods.length; k++) conferirModulo(mods[k]);
  progresso();
})();
`;

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export function cabecalho(): string {
  return `<header class="topo">
  <div class="topo-int">
    <div class="marca">Sistenge</div>
    <h1>Treinamento do Loca</h1>
    <p>Três trilhas. A Fundação vale para todos; depois siga a de ferramentas e
    locações, a de imóveis e alojamento, ou as duas. Cada módulo tem exercícios
    para fazer no sistema de verdade — o seu progresso fica salvo neste
    navegador.</p>
  </div>
</header>`;
}

export function navTrilhas(trilhas: Trilha[]): string {
  const blocos = trilhas
    .map(
      (t) => `<div class="nav-trilha">
      <a href="#trilha-${esc(t.id)}">Trilha ${t.numero} · ${esc(t.titulo)}</a>
      <div class="nav-mods">
        ${t.modulos
          .map((m) => `<a href="#${esc(m.id)}">${m.numero}. ${esc(m.titulo)}</a>`)
          .join("")}
      </div>
    </div>`,
    )
    .join("");

  return `<nav class="nav"><div class="nav-cartao">
    <h2>Índice</h2>
    ${blocos}
  </div></nav>`;
}

function blocoPerguntas(m: Modulo): string {
  return m.perguntas
    .map((p, i) => {
      const alts = p.alternativas
        .map(
          (a) =>
            `<button type="button" class="alt" data-texto="${esc(a)}">${esc(a)}</button>`,
        )
        .join("");
      return `<div class="pergunta" id="pg-${esc(m.id)}-${i}" data-correta="${p.correta}">
        <p>${esc(p.enunciado)}</p>
        <div class="alts">${alts}</div>
        <p class="comentario">${esc(p.comentario)}</p>
      </div>`;
    })
    .join("");
}

/** Uma seção de módulo, com os cinco blocos. `svg` já vem pronto ou é `null`. */
export function secaoModulo(m: Modulo, svg: string | null): string {
  const perfis = m.perfis
    .map((p) => `<span class="perfil">${esc(PERFIL_LABEL[p])}</span>`)
    .join("");

  const passos = m.caminho.map((c) => `<li>${esc(c)}</li>`).join("");

  const exercicios = m.exercicios
    .map(
      (e, i) => `<label class="exercicio" for="ex-${esc(m.id)}-${i}">
        <input type="checkbox" id="ex-${esc(m.id)}-${i}">
        <span>${esc(e)}</span>
      </label>`,
    )
    .join("");

  const figura = svg ? `<figure>${svg}</figure>` : "";

  return `<article class="modulo" id="${esc(m.id)}" data-feito="0">
    <div class="mod-cab">
      <span class="mod-n">${m.numero}</span>
      <h3>${esc(m.titulo)}</h3>
    </div>
    <div class="perfis">${perfis}</div>

    <div class="bloco"><h4>O problema</h4><p>${esc(m.problema)}</p></div>
    <div class="bloco"><h4>O caminho</h4><ol>${passos}</ol>${figura}</div>
    <div class="bloco"><h4>No exemplo</h4><p class="exemplo">${esc(m.exemplo)}</p></div>
    <div class="bloco"><h4>Faça você</h4>${exercicios}</div>
    <div class="bloco"><h4>Confira</h4>${blocoPerguntas(m)}</div>
  </article>`;
}
