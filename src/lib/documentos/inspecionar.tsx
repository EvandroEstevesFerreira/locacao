// Lê o TEXTO de um documento antes de ele virar PDF.
//
// POR QUE ISTO EXISTE.
//
// Os testes de documento deste projeto contavam páginas e conferiam que o
// buffer começava com "%PDF-". Duas vezes isso deixou passar um defeito que
// estava no texto, não na forma:
//
//   - o rodapé do romaneio dizia "Recursos Humanos" num documento que vai ao
//     FORNECEDOR, porque a string estava cravada no primitivo `Documento`;
//   - onze termos imprimiam "Comprometo-me a:" e "Estou ciente de que:" colados
//     com uma lista única, pondo uma ciência sob os compromissos num documento
//     que é parte do contrato de trabalho (0.58.1).
//
// Os dois só apareceram quando alguém renderizou e LEU. Extrair texto do PDF
// pronto exigiria interpretar o CMap das fontes com subconjunto — projeto
// próprio e frágil. Percorrer a árvore React custa quase nada e pega a mesma
// classe de defeito, porque é a mesma string.
//
// O que ISTO NÃO substitui: paginação, quebra e sobreposição continuam sendo
// caso de `renderToBuffer` e `contarPaginas`. Aqui se verifica o QUE está
// escrito; lá, se cabe na página.

import type { ReactNode, ReactElement } from "react";
import { isValidElement, Children } from "react";

/**
 * Todo texto de uma árvore React, na ordem em que aparece.
 *
 * Percorre `props.children` e também as props que carregam elementos ou texto —
 * `Documento` recebe `titulo`, `subtitulo` e `rodape` como strings, e é
 * justamente num deles que o defeito do rodapé estava.
 */
export function textosDe(no: ReactNode): string[] {
  const achados: string[] = [];

  function visitar(n: ReactNode): void {
    if (n === null || n === undefined || typeof n === "boolean") return;

    if (typeof n === "string") {
      const s = n.trim();
      if (s) achados.push(s);
      return;
    }
    if (typeof n === "number") {
      achados.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      for (const filho of n) visitar(filho);
      return;
    }

    if (isValidElement(n)) {
      const el = n as ReactElement<Record<string, unknown>>;
      const props = el.props ?? {};

      // Componente de função: executa para enxergar o que ele DEVOLVE. Sem
      // isto, a árvore pararia no primeiro `<Secao>` e o texto de dentro dos
      // componentes do projeto — que é onde ele mora — ficaria invisível.
      if (typeof el.type === "function") {
        try {
          const fn = el.type as (p: unknown) => ReactNode;
          visitar(fn(props));
          return;
        } catch {
          // Componente que depende de contexto ou de hook não roda aqui. Cai
          // para a varredura de props abaixo, que ainda pega os rótulos.
        }
      }

      for (const [chave, valor] of Object.entries(props)) {
        if (chave === "children") continue;
        // Props que não são texto de tela: estilo, chaves, callbacks. Incluí-las
        // encheria o resultado de ruído e faria qualquer asserção passar por
        // acidente.
        if (chave === "style" || chave === "key" || typeof valor === "function") continue;
        if (typeof valor === "string" || typeof valor === "number") {
          visitar(valor as ReactNode);
        } else if (Array.isArray(valor) || isValidElement(valor)) {
          visitar(valor as ReactNode);
        } else if (valor && typeof valor === "object") {
          // Estruturas de dados dos primitivos: `campos`, `linhas`, `colunas`,
          // `assinantes`. São objetos simples cujos valores são o texto impresso.
          for (const v of Object.values(valor as Record<string, unknown>)) {
            if (typeof v === "string" || typeof v === "number") visitar(v as ReactNode);
            else if (Array.isArray(v)) visitar(v as ReactNode);
          }
        }
      }

      Children.forEach(props.children as ReactNode, visitar);
      return;
    }
  }

  visitar(no);
  return achados;
}

/** Todo o texto do documento numa string só, para asserções de conteúdo. */
export function textoDe(no: ReactNode): string {
  return textosDe(no).join("\n");
}

/**
 * O texto contém `agulha`, ignorando acento, caixa e espaço repetido.
 *
 * A normalização existe porque a asserção interessante é sobre o CONTEÚDO, e
 * escrever a agulha com o acento exato do documento transforma o teste num
 * exercício de digitação — que falha por motivo errado e ensina a relaxar a
 * asserção.
 */
export function contemTexto(no: ReactNode, agulha: string): boolean {
  return normalizar(textoDe(no)).includes(normalizar(agulha));
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
