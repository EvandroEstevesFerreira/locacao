// Domínio Fornecedor: schema e helpers puros, client-safe.
//
// O schema sai de `fornecedores/actions.ts` para poder ser importado pelo
// formulário: um arquivo "use server" não atravessa para o cliente.
//
// Ganho concreto da migração: `cnpjValido` de src/lib/cnpj.ts implementa o CNPJ
// ALFANUMÉRICO de 2026 (DV mód-11 por ASCII−48) e passa a validar no cliente,
// enquanto o usuário digita — antes o erro só chegava depois do submit.

import { z } from "zod";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";
import { idOpcional, opcional, textoOpcional, emailOpcional } from "@/lib/campos";
import { normalizarTelefone } from "@/lib/telefone";

/**
 * Um contato do fornecedor: quem se liga, e para quê.
 *
 * O telefone é normalizado AQUI, no schema, e não no formulário: assim vale
 * para qualquer caminho de escrita, inclusive uma importação futura. Guarda-se
 * dígitos com DDI; a máscara é da exibição.
 */
export const contatoFornecedorSchema = z.object({
  id: idOpcional,
  nome: z.string().trim().min(1, "Informe o nome do contato.").max(200),
  cargo: textoOpcional(120),
  telefone: opcional.transform((v) => normalizarTelefone(v)),
  principal: z.boolean(),
});

export type ContatoFornecedorInput = z.input<typeof contatoFornecedorSchema>;
export type ContatoFornecedorDados = z.output<typeof contatoFornecedorSchema>;

export const fornecedorSchema = z.object({
  id: idOpcional,
  nome: z.string().trim().min(1, "Informe o nome do fornecedor.").max(200),
  cnpj: opcional
    .refine((v) => v === null || normalizarCnpj(v) === "" || cnpjValido(v), {
      message: "CNPJ inválido. Verifique o número (formato alfanumérico).",
    })
    // Um CNPJ que normaliza para vazio (só máscara digitada) é "não informado".
    .transform((v) => (v !== null && normalizarCnpj(v) !== "" ? v : null)),
  /**
   * O código do fornecedor no Mega, o ERP do contas a pagar.
   *
   * É por ele que se concilia uma nota do Loca com o título de lá. Antes disso
   * a ligação era pelo nome, e nome de empresa é o pior identificador que
   * existe: muda de razão social, vem abreviado, vem com acento de um lado e
   * sem do outro.
   *
   * É opcional porque nem todo fornecedor do Loca existe no Mega — medido em
   * 10/09/2026: 36 dos 38.
   */
  codigo_mega: textoOpcional(30),
  /**
   * A caixa da EMPRESA — destinatário do romaneio e do termo de devolução.
   *
   * O nome do campo é histórico: não é o e-mail de um contato. Amarrar o
   * documento ao e-mail de uma pessoa faria o romaneio parar de chegar no dia
   * em que ela saísse da empresa.
   */
  contato_email: emailOpcional(200),
  /**
   * Os contatos, em tabela própria (`fornecedor_contato`, migration 0104).
   *
   * `contato_nome` e `contato_telefone` saíram deste schema: eram UM contato em
   * coluna plana, e o cadastro real tem o comercial, o do faturamento e o do
   * galpão. As colunas continuam no banco até a migration que as derruba, mas
   * ninguém mais escreve nelas — ver `fornecedor-contato.test.ts`.
   */
  contatos: z
    .array(contatoFornecedorSchema)
    .max(20, "Vinte contatos por fornecedor é o limite.")
    .refine((cs) => cs.filter((c) => c.principal).length <= 1, {
      message: "Marque apenas um contato como principal.",
    }),
  observacoes: textoOpcional(1000),
  ativo: z.boolean(),
  /** IDs das obras vinculadas (relação N:N com fornecedor_obra). */
  obras: z.array(z.string().uuid()),
  /**
   * "Salvar mesmo assim" — o CNPJ duplicado avisa na primeira tentativa e só
   * bloqueia até o usuário confirmar. Não é validação, é decisão dele.
   */
  confirmar_duplicado: z.boolean(),
});

export type FornecedorInput = z.input<typeof fornecedorSchema>;
export type FornecedorDados = z.output<typeof fornecedorSchema>;
