// O registro das trilhas. Trilha nova entra aqui e passa a existir no sistema.

import type { Trilha } from "./tipos";
import { PRIMEIROS_PASSOS } from "./primeiros-passos";

export type { Passo, Aula, Pergunta, Trilha } from "./tipos";

/**
 * Todas as trilhas, na ordem em que devem ser feitas.
 *
 * Primeiros passos vem primeiro de propósito: é a única que todo papel faz, e
 * as outras supõem que a pessoa já sabe achar uma obra e ler uma lista.
 */
export const TRILHAS: Trilha[] = [PRIMEIROS_PASSOS];

export function trilhaPorChave(chave: string): Trilha | undefined {
  return TRILHAS.find((t) => t.chave === chave);
}
