// A regra de e-mail corporativo da Sistenge — SEM DEPENDÊNCIA NENHUMA.
//
// Este arquivo não importa nada de propósito. O importador do inventário
// (`scripts/db/importar-inventario-ti.mjs`) precisa da mesma regra que a tela
// usa, e ele roda em Node puro, fora do bundler do Next: não resolve o alias
// `@/`, não tem zod, não tem `server-only`.
//
// Node 24 remove os tipos de um `.ts` na importação, então um módulo sem
// `import` nenhum é carregável dos dois lados. É isso que permite haver UMA
// implementação em vez de duas — e duas cópias de uma regra de e-mail
// divergiriam do jeito mais caro possível: o termo de responsabilidade de uma
// pessoa indo para a caixa de outra.
//
// `src/lib/termo.ts` reexporta o que está aqui; a tela continua importando de
// lá.

/** O domínio de e-mail da Sistenge. Uma constante, não uma string solta. */
export const DOMINIO_EMAIL = "sistenge.com";

/**
 * O endereço provável de um funcionário, a partir do nome.
 *
 * É um PALPITE, e por isso quem grava tem de marcar `email_confirmado = false`.
 * O padrão aparece na própria planilha de inventário, que traz alguns nomes já
 * em formato de login (`Rodrigo.Ferreira`).
 *
 * Devolve `null` quando não dá para formar `nome.sobrenome` — nome de uma
 * palavra só, vazio, ou com algarismo (`Monitor 0109947` é uma linha da
 * planilha, não uma pessoa). Inventar `lourival.lourival` seria produzir um
 * endereço com cara de verdadeiro, que é pior que endereço nenhum.
 */
export function emailDerivado(nome: string): string | null {
  const partes = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // O ponto separa nome de sobrenome tanto em "Rodrigo.Ferreira" quanto no
    // endereço final, então vale como espaço.
    .replace(/[.\s]+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p.length > 0);

  // Uma parte que não é palavra derruba o nome inteiro, e não só a parte: um
  // "nome" com algarismo dentro não é nome de gente.
  if (partes.length < 2 || partes.some((p) => !/^[a-z]+$/.test(p))) return null;
  return `${partes[0]}.${partes[partes.length - 1]}@${DOMINIO_EMAIL}`;
}
