import { describe, it, expect } from "vitest";
import type { ZodType } from "zod";
import {
  imovelSchema,
  contratoImovelSchema,
  contaConsumoSchema,
  reparoSchema,
  ocupanteSchema,
} from "./imoveis";
import {
  medidaDisciplinarSchema,
  entregaOcupanteSchema,
  fechamentoLimpezaSchema,
  tarefaLimpezaSchema,
} from "./alojamento";
import { obraSchema } from "./obra";

/**
 * TODA action deste sistema re-valida o que recebe, e o que ela recebe é o
 * OUTPUT do mesmo schema — o zodResolver já transformou no cliente. Logo o
 * schema tem de aceitar o próprio output: `parse(parse(x))` === `parse(x)`.
 *
 * Sem esta propriedade, deixar um campo opcional em branco vira erro genérico na
 * cara do usuário. Foi o que aconteceu com "Executor" no reparo (desde a 0.23.0)
 * e com o CPF do ocupante (desde a 0.24.0), e nenhum teste acusou porque todos
 * validavam apenas a PRIMEIRA passagem.
 *
 * O caso interessante é sempre o MÍNIMO — só os campos obrigatórios, todo
 * opcional vazio. É aí que o output ganha os `null` que a entrada não aceitava.
 */
const UUID = "11111111-1111-4111-8111-111111111111";

const CASOS: { nome: string; schema: ZodType; minimo: unknown }[] = [
  {
    nome: "imovelSchema",
    schema: imovelSchema,
    minimo: { tipo: "casa", apelido: "Casa 1", status: "ativo" },
  },
  {
    nome: "contratoImovelSchema",
    schema: contratoImovelSchema,
    minimo: {
      imovel_id: UUID,
      data_inicio: "2026-08-01",
      valor_aluguel: "1900",
      valor_condominio: "",
      valor_iptu: "",
      seguro_fianca: "",
      seguro_fianca_mensal: false,
      vigente: true,
    },
  },
  {
    nome: "contaConsumoSchema",
    schema: contaConsumoSchema,
    minimo: {
      imovel_id: UUID,
      tipo: "agua",
      competencia: "2026-08",
      valor: "120",
      vencimento: "2026-09-10",
      pago: false,
      lancar: false,
    },
  },
  {
    nome: "reparoSchema",
    schema: reparoSchema,
    minimo: { imovel_id: UUID, data: "2026-08-01", descricao: "trocou torneira" },
  },
  {
    nome: "ocupanteSchema",
    schema: ocupanteSchema,
    minimo: { imovel_id: UUID, nome: "Fulano de Tal" },
  },
  {
    nome: "medidaDisciplinarSchema",
    schema: medidaDisciplinarSchema,
    minimo: {
      ocupante_id: UUID,
      imovel_id: UUID,
      data: "2026-08-01",
      tipo: "verbal",
      fato_descricao: "Descumpriu o horário de silêncio.",
    },
  },
  {
    nome: "entregaOcupanteSchema",
    schema: entregaOcupanteSchema,
    minimo: {
      ocupante_id: UUID,
      imovel_id: UUID,
      tipo: "chaves",
      entregue_em: "2026-08-01",
    },
  },
  {
    // Faltava aqui, e o defeito estava vivo: salvar uma obra sem endereço, sem
    // responsável ou sem centro de custo falhava com "Dados inválidos".
    nome: "obraSchema",
    schema: obraSchema,
    minimo: { codigo: "OB-01", nome: "Obra", status: "ativa" },
  },
  {
    nome: "fechamentoLimpezaSchema",
    schema: fechamentoLimpezaSchema,
    // O mínimo aqui é a semana aberta e ainda não conferida: os três campos que
    // o Encarregado preenche saem `null`, e é esse output que a action re-valida
    // quando ele salva de novo depois de corrigir uma letra.
    minimo: { id: UUID, imovel_id: UUID },
  },
  {
    nome: "tarefaLimpezaSchema",
    schema: tarefaLimpezaSchema,
    minimo: { grupo: "BANHEIROS", descricao: "Lavar piso", frequencia: "D" },
  },
];

describe("schemas de formulário são idempotentes", () => {
  for (const { nome, schema, minimo } of CASOS) {
    it(`${nome}: aceita o próprio output`, () => {
      const primeira = schema.parse(minimo);
      const r = schema.safeParse(primeira);
      const detalhe = r.success
        ? ""
        : `${r.error.issues[0].path.join(".")}: ${r.error.issues[0].message}`;
      expect(r.success, detalhe).toBe(true);
    });

    it(`${nome}: o output não muda na segunda passagem`, () => {
      const primeira = schema.parse(minimo);
      const segunda = schema.parse(primeira);
      expect(segunda).toEqual(primeira);
    });
  }
});
