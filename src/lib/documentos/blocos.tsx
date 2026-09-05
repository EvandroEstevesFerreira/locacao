// Blocos narrativos vindos de `documento_template`.
//
// Todos os documentos do alojamento seguem a mesma convenção de forma, para que
// o RH aprenda uma regra só ao editar qualquer texto em Configurações:
//
//   CAIXA ALTA sem ponto final  → título de subseção
//   começa com "— "             → item de lista numerada
//   qualquer outro              → parágrafo corrido, e FECHA a lista aberta
//
// A última regra é o que separa "Comprometo-me a:" de "Estou ciente de que:":
// cada um introduz a sua lista, com a numeração recomeçando.
//
// A convenção é simples de propósito. A alternativa era inventar uma linguagem
// de marcação dentro de um textarea que o RH abre poucas vezes por ano.

import { Text, StyleSheet } from "@react-pdf/renderer";
import { Secao, Lista } from "@/lib/pdf-form";

const s = StyleSheet.create({
  paragrafo: {
    fontSize: 8.5,
    textAlign: "justify",
    marginBottom: 4,
    lineHeight: 1.35,
  },
});

/**
 * Um parágrafo no corpo do documento.
 *
 * Usado onde o texto vem de um REGISTRO, e não do template: a descrição do fato
 * numa medida disciplinar já emitida, por exemplo, entra no lugar das linhas em
 * branco que a folha vazia traz.
 */
export function Paragrafo({ texto }: { texto: string }) {
  return <Text style={s.paragrafo}>{texto}</Text>;
}

/**
 * Uma parte do bloco, NA ORDEM em que aparece no texto.
 *
 * O modelo anterior tinha `texto: string[]` e `itens: string[]` — dois baldes —
 * e por isso não conseguia representar "parágrafo, lista, parágrafo, lista".
 * Todos os textos saíam primeiro e todas as listas depois, numa numeração
 * corrida.
 *
 * O efeito num documento assinado: no FRM-EQ-001, "Comprometo-me a:" e "Estou
 * ciente de que:" apareciam colados, e os onze itens saíam numa lista só — de
 * modo que "o desgaste natural é responsabilidade da empresa", que é uma
 * ciência, era impresso sob os compromissos. Onze textos de template tinham o
 * mesmo defeito.
 */
export type Parte =
  | { tipo: "texto"; valor: string }
  | { tipo: "lista"; itens: string[] };

export type Bloco = { titulo?: string; partes: Parte[] };

/** Um parágrafo do template é título de subseção quando está em caixa alta. */
export function ehSubtitulo(p: string): boolean {
  return p === p.toUpperCase() && !p.endsWith(".");
}

/**
 * Agrupa os parágrafos do template em blocos de subseção.
 *
 * Um parágrafo comum FECHA a lista aberta. É o que faz "Estou ciente de que:"
 * começar uma lista nova em vez de continuar a numeração da anterior — sem
 * precisar reconhecer os dois-pontos: qualquer texto entre listas as separa.
 */
export function agruparBlocos(paragrafos: string[]): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco = { titulo: undefined, partes: [] };

  for (const p of paragrafos) {
    // O ITEM DE LISTA VEM PRIMEIRO. `ehSubtitulo` só olha caixa alta e ponto
    // final, então `— PROIBIDO FUMAR` passaria por título de subseção e o item
    // sumiria da lista. O prefixo é o sinal mais forte: quem escreveu `— `
    // quis um item.
    if (p.startsWith("— ")) {
      const ultima = atual.partes[atual.partes.length - 1];
      if (ultima?.tipo === "lista") ultima.itens.push(p.slice(2));
      else atual.partes.push({ tipo: "lista", itens: [p.slice(2)] });
      continue;
    }
    if (ehSubtitulo(p)) {
      blocos.push(atual);
      atual = { titulo: p, partes: [] };
      continue;
    }
    atual.partes.push({ tipo: "texto", valor: p });
  }

  blocos.push(atual);
  return blocos.filter((b) => b.titulo || b.partes.length > 0);
}

/** Desenha os blocos, cada um como uma seção. */
export function Narrativa({
  paragrafos,
  tituloPadrao = "Apresentação",
}: {
  paragrafos: string[];
  /** Título do primeiro bloco, quando o template abre sem um título próprio. */
  tituloPadrao?: string;
}) {
  return (
    <>
      {agruparBlocos(paragrafos).map((b, i) => (
        <Secao key={i} titulo={b.titulo ?? tituloPadrao}>
          {b.partes.map((parte, j) =>
            parte.tipo === "texto" ? (
              <Text key={j} style={s.paragrafo}>
                {parte.valor}
              </Text>
            ) : (
              <Lista key={j} tipo="numerada" itens={parte.itens} />
            ),
          )}
        </Secao>
      ))}
    </>
  );
}
