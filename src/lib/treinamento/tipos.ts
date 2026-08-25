// Conteúdo do treinamento como dado tipado — sem HTML e sem cor.
//
// Existe separado do layout pelo mesmo motivo que `src/lib/emails/templates.ts`
// existe separado de `layout.ts`: quem escreve o conteúdo decide O QUE se diz, e
// nunca como se desenha. Mudar o visual dos dezoito módulos é mexer em
// `layout.ts`, e nenhum conteúdo acompanha.
//
// E, mais decisivo: com o conteúdo em dado, os cinco checks da spec — cobertura
// dos dezoito módulos, integridade de link, paleta, buraco de dado, recurso
// externo — são cinco asserções. Escrito como HTML à mão, nenhum deles seria
// verificável; seria conferência visual, que é onde erro passa.

import type { Papel } from "@/lib/permissoes";

/** Os quatro perfis do Loca. Reaproveita `Papel` para não divergir dele. */
export type PerfilKey = Papel;

export type DiagramaKey =
  | "cadeia-custodia"
  | "tela-lista"
  | "ciclo-contrato-imovel"
  | "matriz-perfis";

export type Pergunta = {
  enunciado: string;
  alternativas: string[];
  /** Índice em `alternativas`. */
  correta: number;
  /**
   * Por que a correta é correta.
   *
   * Obrigatório, e o validador recusa vazio: "errado" não ensina nada. O que
   * ensina é "errado, porque a competência é o mês a que a despesa pertence e o
   * vencimento é quando ela é paga".
   */
  comentario: string;
};

export type Modulo = {
  /** Slug sem acento — vira `id` de âncora no HTML. */
  id: string;
  /** Posição dentro da trilha, começando em 1. */
  numero: number;
  titulo: string;
  /** Para quem é. Ao menos um perfil. */
  perfis: PerfilKey[];
  /** A dor real, em 2-3 frases. */
  problema: string;
  /** Passos numerados. */
  caminho: string[];
  /** Diagrama que acompanha o passo a passo, quando houver. */
  diagrama?: DiagramaKey;
  /** O que acontece com a obra do fio condutor neste passo. */
  exemplo: string;
  /** Exercícios no Loca real. */
  exercicios: string[];
  perguntas: Pergunta[];
  /** Recurso que o sistema ainda não tem — sai marcado na tela. */
  emConstrucao?: boolean;
};

export type Trilha = {
  id: "fundacao" | "ferramentas" | "imoveis";
  numero: 0 | 1 | 2;
  titulo: string;
  subtitulo: string;
  modulos: Modulo[];
};

/** Dezoito, conforme a spec: seis por trilha. */
export const TOTAL_MODULOS = 18;

/**
 * Devolve a lista de problemas encontrados. Vazia significa válido.
 *
 * Devolve lista em vez de lançar porque o gerador quer relatar todos os
 * problemas de uma vez: consertar um por execução, em dezoito módulos, é lento.
 */
export function validarTrilhas(trilhas: Trilha[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  let total = 0;

  for (const t of trilhas) {
    t.modulos.forEach((m, i) => {
      total++;

      if (vistos.has(m.id)) {
        problemas.push(`id de módulo repetido: "${m.id}"`);
      }
      vistos.add(m.id);

      if (m.numero !== i + 1) {
        problemas.push(
          `numeração fora de sequência na trilha "${t.id}": "${m.id}" é ${m.numero}, esperado ${i + 1}`,
        );
      }
      if (m.perfis.length === 0) {
        problemas.push(`módulo "${m.id}" sem perfil`);
      }
      if (m.caminho.length === 0) {
        problemas.push(`módulo "${m.id}" sem passo a passo`);
      }
      if (m.exercicios.length === 0) {
        problemas.push(`módulo "${m.id}" sem exercício`);
      }
      if (m.perguntas.length === 0) {
        problemas.push(`módulo "${m.id}" sem pergunta de verificação`);
      }

      for (const p of m.perguntas) {
        if (p.correta < 0 || p.correta >= p.alternativas.length) {
          problemas.push(
            `módulo "${m.id}": alternativa correta inexistente (${p.correta} de ${p.alternativas.length})`,
          );
        }
        if (p.comentario.trim() === "") {
          problemas.push(`módulo "${m.id}": pergunta sem comentário`);
        }
      }
    });
  }

  if (total !== TOTAL_MODULOS) {
    problemas.push(`${total} módulos, esperado ${TOTAL_MODULOS}`);
  }

  return problemas;
}
