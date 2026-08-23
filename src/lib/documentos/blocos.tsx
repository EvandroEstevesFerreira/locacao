// Blocos narrativos vindos de `documento_template`.
//
// Todos os documentos do alojamento seguem a mesma convenção de forma, para que
// o RH aprenda uma regra só ao editar qualquer texto em Configurações:
//
//   CAIXA ALTA sem ponto final  → título de subseção
//   começa com "— "             → item de lista numerada
//   qualquer outro              → parágrafo corrido
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

export type Bloco = { titulo?: string; texto: string[]; itens: string[] };

/** Um parágrafo do template é título de subseção quando está em caixa alta. */
export function ehSubtitulo(p: string): boolean {
  return p === p.toUpperCase() && !p.endsWith(".");
}

/** Agrupa os parágrafos do template em blocos de subseção. */
export function agruparBlocos(paragrafos: string[]): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco = { titulo: undefined, texto: [], itens: [] };
  for (const p of paragrafos) {
    if (ehSubtitulo(p)) {
      blocos.push(atual);
      atual = { titulo: p, texto: [], itens: [] };
    } else if (p.startsWith("— ")) {
      atual.itens.push(p.slice(2));
    } else {
      atual.texto.push(p);
    }
  }
  blocos.push(atual);
  return blocos.filter(
    (b) => b.titulo || b.texto.length > 0 || b.itens.length > 0,
  );
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
          {b.texto.map((t, j) => (
            <Text key={j} style={s.paragrafo}>
              {t}
            </Text>
          ))}
          {b.itens.length > 0 ? <Lista tipo="numerada" itens={b.itens} /> : null}
        </Secao>
      ))}
    </>
  );
}
