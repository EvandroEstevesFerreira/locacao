// O modelo de conteúdo do treinamento — e do manual, que é a mesma coisa em
// outra ordem.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE O CONTEÚDO MORA NO CÓDIGO
// ═══════════════════════════════════════════════════════════════════════════
//
// Treinamento de software É documentação de software. Se a tela muda, a aula
// muda no mesmo commit, e o diff mostra as duas coisas lado a lado. No banco, a
// tela muda e a aula fica mentindo em silêncio, porque nada liga uma coisa à
// outra — o mesmo defeito do manual em Word, só dentro do sistema.
//
// Custo aceito: corrigir uma vírgula exige deploy.
// ═══════════════════════════════════════════════════════════════════════════

import type { ModuloKey } from "@/lib/modulos";
import type { Papel } from "@/lib/permissoes";

/**
 * Um passo de uma aula.
 *
 * `esperado` é o que separa treinamento de passeio guiado: "clique em Salvar"
 * ensina a clicar; "clique em Salvar — tem de aparecer o item na lista" ensina
 * a reconhecer que funcionou, e a perceber quando NÃO funcionou.
 */
export type Passo = {
  /** Onde a pessoa está: rota ou nome da tela. */
  onde: string;
  /** O que fazer. Imperativo, uma ação. */
  acao: string;
  /** O que tem de acontecer. */
  esperado: string;
};

export type Aula = {
  /** Estável e único na trilha. Entra na URL e no registro. */
  id: string;
  titulo: string;
  /** Uma frase: por que esta aula existe. É o que o manual mostra no índice. */
  resumo: string;
  /**
   * Rotas que esta aula cobre.
   *
   * É o ÚNICO campo que existe para o manual, e é o que permite indexar por
   * tela sem escrever nada duas vezes.
   */
  rotas: string[];
  passos: Passo[];
  /** Armadilhas e regras que a tela não explica sozinha. */
  atencao?: string[];
  /** Versão da trilha em que esta aula mudou materialmente. */
  desdeVersao: number;
};

/**
 * Uma pergunta do questionário.
 *
 * `porque` é mostrado SEMPRE, acertando ou errando. Errar e não saber por que
 * só ensina a chutar melhor.
 */
export type Pergunta = {
  id: string;
  enunciado: string;
  /** Quatro alternativas. */
  alternativas: string[];
  /** Índice da correta em `alternativas`. NUNCA vai ao cliente. */
  correta: number;
  porque: string;
  /** O `id` da aula que responde esta pergunta — o link de "revise isto". */
  aula: string;
};

export type Trilha = {
  /** Slug da rota: `/treinamento/<chave>`. */
  chave: string;
  titulo: string;
  /** Uma frase na lista de trilhas. */
  resumo: string;
  /**
   * Módulo que a trilha ensina, ou `null` para trilha de todos.
   *
   * Quando há módulo, só quem tem o módulo liberado vê a trilha — a regra é a
   * de `moduloLiberado` em `src/lib/modulos.ts`, e não é redecidida aqui.
   */
  modulo: ModuloKey | null;
  /** Papéis a que a trilha se aplica. Vazio = todos. */
  papeis: Papel[];
  /** Bump DELIBERADO quando o conteúdo muda de forma material. */
  versao: number;
  aulas: Aula[];
  perguntas: Pergunta[];
};
