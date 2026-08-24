import { describe, it, expect } from "vitest";
import { z } from "zod";

import * as alojamento from "./alojamento";
import * as config from "./config";
import * as financeiro from "./financeiro";
import * as fornecedor from "./fornecedor";
import * as imoveis from "./imoveis";
import * as itens from "./itens";
import * as locacao from "./locacao";
import * as obra from "./obra";
import * as permissoes from "./permissoes";

/**
 * O USUÁRIO NUNCA PODE VER UMA MENSAGEM CRUA DO ZOD.
 *
 * Foi exatamente esse o sintoma reportado: a tela de dados da empresa mostrando
 *
 *     Invalid input: expected string, received null
 *
 * dentro da caixa de erro, em inglês, sem dizer qual campo. A mensagem é o
 * default do zod para incompatibilidade de TIPO — e incompatibilidade de tipo
 * num formulário é sempre defeito nosso, nunca erro do usuário. O usuário pode
 * digitar um CNPJ errado; ele não tem como fazer um campo chegar como `null`
 * quando o schema espera `string`.
 *
 * `schemas-varredura.test.ts` cobre a re-validação do output. Este cobre a
 * outra ponta: o FORMULÁRIO VAZIO, que é o que a pessoa vê quando abre a tela e
 * salva antes de preencher. Os dois juntos fecham o caminho por onde o defeito
 * chegou à produção seis vezes.
 *
 * Nota sobre acentuação: as mensagens do sistema saem em PT-BR acentuado (regra
 * inviolável do AGENTS.md). Uma mensagem em inglês num `issue` de tipo é, por si
 * só, o sinal de que ela não foi escrita por nós.
 */

const MODULOS: Record<string, Record<string, unknown>> = {
  alojamento,
  config,
  financeiro,
  fornecedor,
  imoveis,
  itens,
  locacao,
  obra,
  permissoes,
};

/**
 * O formulário vazio de cada schema: todo campo de texto como `""`, como o
 * navegador de fato envia. Booleanos e arrays entram com o default que o
 * `defaultValues` do react-hook-form usa.
 *
 * Não é o caso mínimo válido — é o INVÁLIDO esperado. Salvar aqui deve falhar,
 * e a questão é COMO falha: com a nossa mensagem ou com a do zod.
 */
const VAZIOS: Record<string, unknown> = {
  imovelSchema: { tipo: "", apelido: "", status: "" },
  contratoImovelSchema: {
    imovel_id: "",
    data_inicio: "",
    valor_aluguel: "",
    valor_condominio: "",
    valor_iptu: "",
    seguro_fianca: "",
    seguro_fianca_mensal: false,
    vigente: true,
  },
  contaConsumoSchema: {
    imovel_id: "",
    tipo: "",
    competencia: "",
    valor: "",
    vencimento: "",
    pago: false,
    lancar: false,
  },
  reparoSchema: { imovel_id: "", data: "", descricao: "" },
  ocupanteSchema: { imovel_id: "", nome: "" },
  ocorrenciaSchema: { imovel_id: "", data: "", descricao: "" },
  medidaDisciplinarSchema: {
    ocupante_id: "",
    imovel_id: "",
    data: "",
    tipo: "escrita",
    fato_descricao: "",
  },
  entregaOcupanteSchema: { ocupante_id: "", imovel_id: "", tipo: "chaves" },
  fechamentoLimpezaSchema: { id: "", imovel_id: "" },
  tarefaLimpezaSchema: { grupo: "", descricao: "", frequencia: "D" },
  obraSchema: { codigo: "", nome: "", status: "ativa", destinatarios_alerta: "" },
  empresaSchema: {
    nome: "",
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    endereco: "",
    cidade: "",
    uf: "",
    cep: "",
    telefone: "",
    email: "",
    site: "",
    representante_nome: "",
    representante_cargo: "",
    representante_cpf: "",
    responsaveis: "",
    observacoes: "",
  },
  fornecedorSchema: {
    nome: "",
    cnpj: "",
    contato_nome: "",
    contato_telefone: "",
    contato_email: "",
    observacoes: "",
    ativo: true,
    obras: [],
    confirmar_duplicado: false,
  },
  contratoSchema: {
    obra_id: "",
    fornecedor_id: "",
    numero: "",
    cadencia: "mensal",
    data_inicio: "",
    status: "ativo",
    observacoes: "",
    cobranca_prorata: false,
  },
  itemLocadoSchema: {
    contrato_id: "",
    item_id: "",
    quantidade: "",
    valor_unitario_periodo: "",
    data_retirada: "",
    data_devolucao_prevista: "",
    identificacao: "",
  },
  itemSchema: { tipo: "equipamento", descricao: "", unidade: "", ativo: true },
  configRelatorioSchema: {
    ativo: false,
    tipo: "",
    frequencia: "mensal",
    dia: "",
    destinatarios: "",
  },
  baixaSchema: { id: "", valorPago: "", multa: "", juros: "", nfNumero: "", dataPagamento: "" },
  trocarSenhaSchema: { senha: "", confirmar: "" },
  papelSchema: "",
  criarUsuarioSchema: { nome: "", email: "", papel: "operador", senha: "", obras: [], modulos: [] },
  editarUsuarioSchema: {
    id: "",
    nome: "",
    papel: "operador",
    ativo: true,
    obras: [],
    modulos: [],
    nova_senha: "",
  },
  lancamentoSchema: {
    obra_id: "",
    contrato_id: "",
    descricao: "",
    valor: "",
    vencimento: "",
    competencia: "",
    status: "pendente",
    data_pagamento: "",
  },
};

/**
 * Mensagens que denunciam erro de TIPO — sempre defeito nosso.
 *
 * O zod as emite em inglês; toda mensagem escrita por nós é PT-BR acentuado.
 */
const CRUAS = [
  /expected \w+, received/i,
  /invalid input/i,
  /invalid type/i,
  /required/i,
  /expected array/i,
  /^invalid$/i,
];

function ehCrua(m: string) {
  return CRUAS.some((r) => r.test(m));
}

function encontrarSchemas(): { nome: string; modulo: string; schema: z.ZodType }[] {
  const achados: { nome: string; modulo: string; schema: z.ZodType }[] = [];
  for (const [modulo, exportados] of Object.entries(MODULOS)) {
    for (const [nome, valor] of Object.entries(exportados)) {
      if (!nome.endsWith("Schema")) continue;
      if (!valor || typeof (valor as z.ZodType).safeParse !== "function") continue;
      achados.push({ nome, modulo, schema: valor as z.ZodType });
    }
  }
  return achados;
}

const SCHEMAS = encontrarSchemas();

describe("o formulário vazio nunca produz mensagem crua do zod", () => {
  it("todo schema tem um formulário vazio declarado", () => {
    const faltando = SCHEMAS.filter((s) => !(s.nome in VAZIOS)).map(
      (s) => `${s.modulo}.${s.nome}`,
    );
    expect(
      faltando,
      `Schemas sem caso vazio em VAZIOS. Declare o formulário em branco — é o ` +
        `que o usuário vê ao abrir a tela e salvar antes de preencher:\n  ` +
        faltando.join("\n  "),
    ).toEqual([]);
  });

  for (const { nome, modulo, schema } of SCHEMAS) {
    const vazio = VAZIOS[nome];
    if (vazio === undefined) continue;

    it(`${modulo}.${nome}`, () => {
      const r = schema.safeParse(vazio);
      if (r.success) return; // formulário que pode ser salvo em branco: tudo bem

      const cruas = r.error.issues
        .filter((i) => ehCrua(i.message))
        .map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`);

      expect(
        cruas,
        `Mensagem crua do zod chegaria à tela. Escreva uma mensagem em PT-BR ` +
          `no campo correspondente:\n  ` + cruas.join("\n  "),
      ).toEqual([]);
    });
  }
});
