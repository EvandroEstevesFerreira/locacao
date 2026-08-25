// Monta a página do treinamento a partir das três trilhas.
//
// O HTML resultante vive em `docs/treinamento/index.html`, escrito pelo teste, e
// é o arquivo publicado como Artifact. NUNCA editar aquele arquivo à mão: ele é
// gerado, e a próxima execução do teste desfaz a edição. O cabeçalho do arquivo
// gerado diz isso também.

import { TRILHA_0 } from "./trilha-0";
import { TRILHA_A } from "./trilha-a";
import { TRILHA_B } from "./trilha-b";
import { DIAGRAMAS } from "./diagramas";
import { CSS, JS, cabecalho, navTrilhas, secaoModulo } from "./layout";
import type { Trilha } from "./tipos";

export const TRILHAS: Trilha[] = [TRILHA_0, TRILHA_A, TRILHA_B];

/**
 * Aviso ao fim da Trilha A.
 *
 * O recibo de ferramenta por funcionário foi pedido junto com este treinamento,
 * e o sistema não faz isso: falta uma tabela de colaborador independente de
 * imóvel, entrega e devolução por unidade de equipamento, numeração, PDF, RLS e
 * telas. Dizer isso aqui é o que impede alguém de procurar no Loca uma tela que
 * ninguém construiu — e de concluir que não achou por incompetência própria.
 */
function avisoRecibo(): string {
  return `<aside class="em-construcao" id="recibo-ferramenta">
  <h3>Recibo de ferramenta por funcionário — em construção</h3>
  <p>O controle de <strong>quem está com cada ferramenta</strong> ainda não
  existe no Loca. Hoje o sistema acompanha o equipamento do fornecedor até a
  obra; a entrega para a pessoa que vai usá-la é feita fora do sistema.</p>
  <p>É o elo tracejado no diagrama da cadeia de custódia, no módulo de
  recebimento. Está em projeto — quando entrar, este treinamento ganha o
  módulo.</p>
</aside>`;
}

function secaoTrilha(t: Trilha): string {
  const modulos = t.modulos
    .map((m) => secaoModulo(m, m.diagrama ? DIAGRAMAS[m.diagrama] : null))
    .join("");

  return `<section class="trilha" id="trilha-${t.id}">
  <header class="trilha-cab">
    <span class="trilha-n">Trilha ${t.numero}</span>
    <h2>${t.titulo}</h2>
    <p>${t.subtitulo}</p>
    <div class="barra" data-trilha="${t.id}"><span></span></div>
  </header>
  ${modulos}
  ${t.id === "ferramentas" ? avisoRecibo() : ""}
</section>`;
}

export function paginaTreinamento(trilhas: Trilha[] = TRILHAS): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Treinamento do Loca</title>
<!-- ARQUIVO GERADO por src/lib/treinamento/gerar.ts. Nao editar a mao: a
     proxima execucao de "npm test" sobrescreve qualquer alteracao daqui.
     Para mudar o conteudo, edite trilha-0.ts, trilha-a.ts ou trilha-b.ts;
     para mudar o desenho, layout.ts. -->
<style>${CSS}</style>
</head>
<body>
${cabecalho()}
${navTrilhas(trilhas)}
<main>${trilhas.map(secaoTrilha).join("")}</main>
<script>${JS}</script>
</body>
</html>`;
}
