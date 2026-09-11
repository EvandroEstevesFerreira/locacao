import { describe, it, expect } from "vitest";

import { chaveDoPonto, imovelDaConta, type PontoConsumo } from "./consumo";
import type { TituloMega } from "./contrato";

/**
 * A conta de consumo do Mega encontra o imóvel pela INSTALAÇÃO, e por mais
 * nada.
 *
 * Medido em 11/09/2026 sobre os 803 títulos CONTA: 157 deles (20%) colidem em
 * agente + mês + valor. Três contas de água de imóveis diferentes no mesmo dia,
 * R$ 74,83 / R$ 74,86 / R$ 75,44 — uma conta do Loca casou com três títulos.
 */

const PONTOS: PontoConsumo[] = [
  { imovelId: "dante-12", concessionaria: "2719", identificador: "3022286" },
  { imovelId: "dante-16", concessionaria: "2719", identificador: "3022287" },
  // Mesmo número, outra concessionária: acontece, e por isso a chave é o par.
  { imovelId: "hortolandia", concessionaria: "2726", identificador: "3022286" },
];

function conta(over: Partial<TituloMega> = {}): TituloMega {
  return {
    codigoAgente: "2719",
    agenteNome: null,
    agenteCnpj: null,
    numeroAp: "9001",
    numeroParcela: "001",
    filial: "3",
    tipoDocumento: "CONTA",
    numeroDocumento: "3022286",
    dataVencimento: "2026-08-24",
    dataProrrogado: null,
    valorParcela: 74.86,
    saldoAtual: 0,
    ...over,
  };
}

describe("chaveDoPonto", () => {
  it("é o par concessionária + identificador", () => {
    expect(chaveDoPonto("2719", "3022286")).not.toBe(chaveDoPonto("2726", "3022286"));
  });

  // O Mega guarda o documento como texto digitado; o cadastro guarda só
  // dígitos. "3.022.286" e "3022286" são a mesma instalação.
  it("ignora máscara e espaço dos dois lados", () => {
    expect(chaveDoPonto("2719", " 3.022.286 ")).toBe(chaveDoPonto("2719", "3022286"));
  });
});

describe("imovelDaConta", () => {
  it("acha o imóvel pela instalação", () => {
    expect(imovelDaConta(conta(), PONTOS)).toBe("dante-12");
  });

  // A MESMA INSTALAÇÃO EM DUAS CONCESSIONÁRIAS É IMÓVEL DIFERENTE. Sem o par,
  // a conta de água da Hortolândia apareceria no DANTE 12.
  it("separa pelo agente quando o número se repete", () => {
    expect(imovelDaConta(conta({ codigoAgente: "2726" }), PONTOS)).toBe("hortolandia");
  });

  // ESTE É O TESTE QUE JUSTIFICA O CADASTRO INTEIRO. Valor e data iguais aos de
  // outra conta não podem influir em nada: o que decide é a instalação.
  it("ignora valor e vencimento", () => {
    const a = imovelDaConta(conta({ valorParcela: 74.83, dataVencimento: "2026-01-01" }), PONTOS);
    expect(a).toBe("dante-12");
  });

  // CONTA SEM INSTALAÇÃO CONHECIDA FICA ÓRFÃ, e isso é resultado, não falha: é
  // assim que aparece a conta de imóvel já entregue que a empresa segue
  // pagando. Chutar um imóvel aqui esconderia justamente o vazamento.
  it("devolve nulo quando a instalação não está cadastrada", () => {
    expect(imovelDaConta(conta({ numeroDocumento: "9999999" }), PONTOS)).toBeNull();
  });

  it("devolve nulo quando o título não tem documento", () => {
    expect(imovelDaConta(conta({ numeroDocumento: null }), PONTOS)).toBeNull();
    expect(imovelDaConta(conta({ numeroDocumento: "" }), PONTOS)).toBeNull();
  });

  // Enquanto o financeiro não adotar a convenção, o documento segue sendo um
  // contador sequencial ("316", "317"). Esses não casam com nada — e é melhor
  // assim do que casar com o ponto errado.
  it("não casa sequencial curto por acaso", () => {
    expect(imovelDaConta(conta({ numeroDocumento: "316" }), PONTOS)).toBeNull();
  });
});
