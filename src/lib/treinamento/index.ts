// O registro das trilhas. Trilha nova entra aqui e passa a existir no sistema.

import type { Trilha } from "./tipos";
import { PRIMEIROS_PASSOS } from "./primeiros-passos";
import { OBRAS } from "./obras";
import { AVANCO } from "./avanco";
import { CATALOGO } from "./catalogo";
import { FROTA } from "./frota";
import { TERMOS } from "./termos";
import { ESTOQUE } from "./estoque";

export type { Passo, Aula, Pergunta, Trilha } from "./tipos";

/**
 * Todas as trilhas, na ordem em que devem ser feitas.
 *
 * Primeiros passos vem primeiro de propósito: é a única que todo papel faz, e
 * as outras supõem que a pessoa já sabe achar uma obra e ler uma lista.
 *
 * Depois dela vem o grupo Obra, porque a obra é o centro do sistema: quase toda
 * lista das outras telas se filtra por ela, e o avanço é o contraponto físico
 * de tudo o que o orçamento mede em dinheiro.
 *
 * Por fim o grupo Equipamento, e a ordem dentro do grupo também não é
 * alfabética: o catálogo vem antes de Frota e de Estoque porque as duas telas
 * mostram consequências de uma escolha feita no catálogo — o controle por peça
 * ou por quantidade —, e quem não entendeu essa escolha procura na tela errada.
 * Termo vem depois de Frota porque é o termo que move a peça para "em uso", e a
 * aula só faz sentido para quem já viu a situação da peça mudar.
 */
export const TRILHAS: Trilha[] = [
  PRIMEIROS_PASSOS,
  OBRAS,
  AVANCO,
  CATALOGO,
  FROTA,
  TERMOS,
  ESTOQUE,
];

export function trilhaPorChave(chave: string): Trilha | undefined {
  return TRILHAS.find((t) => t.chave === chave);
}
