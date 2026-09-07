import { z } from "zod";

/**
 * O contrato da API de pessoas do Sistenge People, em zod.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * POR QUE VALIDAR O QUE O OUTRO LADO PROMETEU. O contrato está fechado, mas o
 * que chega pela rede é `unknown` até alguém olhar. Um deploy do People com um
 * campo renomeado escreveria `undefined` em 483 linhas de `funcionario` — e o
 * dano só apareceria na hora de emitir um termo, com o nome de quem recebe em
 * branco. Aqui a rodada morre inteira em vez de gravar meia verdade.
 *
 * Este arquivo é client-safe de propósito (sem `server-only`): a tela de
 * conciliação da fase 2 precisa dos tipos, e um arquivo `server-only` não pode
 * ser importado por componente cliente.
 */

/** `clt` · `pj` · `estagio` · `aprendiz` · `ambos` */
export const VINCULOS_PEOPLE = ["clt", "pj", "estagio", "aprendiz", "ambos"] as const;
export type VinculoPeople = (typeof VINCULOS_PEOPLE)[number];

/** `ativo` · `afastado` · `desligado` */
export const SITUACOES_PEOPLE = ["ativo", "afastado", "desligado"] as const;
export type SituacaoPeople = (typeof SITUACOES_PEOPLE)[number];

export const SITUACAO_PEOPLE_INFO: Record<
  SituacaoPeople,
  { label: string; ativo: boolean }
> = {
  // `ativo` aqui é o booleano de `funcionario.ativo`, e não um rótulo.
  //
  // AFASTADO CONTA COMO ATIVO de propósito: quem está de licença continua
  // respondendo pelo notebook que levou para casa, e some da lista de quem pode
  // receber termo se virar `false`.
  ativo: { label: "Ativo", ativo: true },
  afastado: { label: "Afastado", ativo: true },
  desligado: { label: "Desligado", ativo: false },
};

/**
 * Uma pessoa, como o People a entrega.
 *
 * `.nullable()` em quase tudo não é frouxidão: é o contrato. Medido em
 * 07/09/2026 sobre as 483 do recorte — `cpf` falta em 41, `telefone` em 42,
 * `cargo` e `centro_custo` em 5, e `email` em 289 (60%).
 */
export const pessoaPeopleSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1),
  cpf: z.string().nullable(),
  matricula: z.string().nullable(),
  cargo: z.string().nullable(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  vinculo: z.enum(VINCULOS_PEOPLE),
  situacao: z.enum(SITUACOES_PEOPLE),
  admissao: z.string().nullable(),
  desligamento: z.string().nullable(),
  centro_custo: z
    .object({ codigo: z.string(), nome: z.string() })
    .nullable(),
  atualizado_em: z.string().min(1),
});

export type PessoaPeople = z.infer<typeof pessoaPeopleSchema>;

/**
 * O envelope de uma página.
 *
 * `proxima_pagina` é OPACO e vem `null` na última. O contrato pede
 * explicitamente para não construí-lo à mão — o formato pode mudar sem aviso,
 * porque é detalhe interno do People.
 */
export const paginaPeopleSchema = z.object({
  pessoas: z.array(pessoaPeopleSchema),
  proxima_pagina: z.string().nullable(),
});

export type PaginaPeople = z.infer<typeof paginaPeopleSchema>;

/** O corpo de erro, quando o People recusa. */
export const erroPeopleSchema = z.object({
  erro: z.string(),
  mensagem: z.string().optional(),
});
