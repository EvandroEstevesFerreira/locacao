import { describe, it, expect } from "vitest";

import { parseContratos, separaCodigo, contratoMegaSchema } from "./contratos";

/**
 * Amostra REAL de `Visoes/GetVisoesFornecedor`, copiada da resposta de
 * 11/09/2026 — 958 contratos de 247 fornecedores numa chamada.
 */
const CRU = {
  produto: "11927 - Sistema de Controle de Iluminação de Datacenter",
  fornecedor: "735 - CCN AUTOMACAO LTDA",
  cto_in_codigo: 1360,
  cto_ch_status: null,
  cto_st_alternativo: "CONT ILUM DATACENTER",
  pai_cto_in_codigo: null,
  projeto: "608 - RACIONAL - DANTE",
  grupoItem: null,
  custo: "20 - ALOCAÇÃO DE CUSTO DIRETO OPERACIONAL",
  usu_criacao: "120.aaraujo",
  data_criacao: "2025-12-19T00:00:00",
  total_contratado: 28821.18,
  total_distratado: 0,
  medicao: 28821.18,
  saldo: 0,
  nota: 28821.18,
  desconto: 0,
  desconto_fd: 0,
  adiantamento: 0,
  adiant_fd: 0,
};

describe("separaCodigo", () => {
  // O Mega manda "735 - CCN AUTOMACAO LTDA" num campo só. O código é o que
  // casa com `fornecedor.codigo_mega`; o nome é o que a tela mostra.
  it("separa o código do nome", () => {
    expect(separaCodigo("735 - CCN AUTOMACAO LTDA")).toEqual({
      codigo: "735",
      nome: "CCN AUTOMACAO LTDA",
    });
  });

  it("aguenta hífen no meio do nome", () => {
    expect(separaCodigo("608 - RACIONAL - DANTE")).toEqual({
      codigo: "608",
      nome: "RACIONAL - DANTE",
    });
  });

  it("devolve só nome quando não há código", () => {
    expect(separaCodigo("SEM CODIGO")).toEqual({ codigo: null, nome: "SEM CODIGO" });
  });

  it("aguenta nulo e vazio", () => {
    expect(separaCodigo(null)).toEqual({ codigo: null, nome: null });
    expect(separaCodigo("")).toEqual({ codigo: null, nome: null });
  });
});

describe("contratoMegaSchema", () => {
  it("achata a amostra real", () => {
    const c = contratoMegaSchema.parse(CRU);
    expect(c.codigo).toBe("1360");
    expect(c.nome).toBe("CONT ILUM DATACENTER");
    expect(c.codigoAgente).toBe("735");
    expect(c.agenteNome).toBe("CCN AUTOMACAO LTDA");
    expect(c.codigoProjeto).toBe("608");
    expect(c.projetoNome).toBe("RACIONAL - DANTE");
    expect(c.totalContratado).toBe(28821.18);
    expect(c.medicao).toBe(28821.18);
    expect(c.saldo).toBe(0);
  });

  // `nota` vem como STRING em `GetTabelaFornecedores` e como número aqui. O
  // mesmo ERP, dois tipos para o mesmo campo — exigir número derrubaria a
  // rodada inteira no dia em que a outra rota fosse usada.
  it("aceita nota como texto ou número", () => {
    expect(contratoMegaSchema.parse({ ...CRU, nota: "28821.18" }).nota).toBe(28821.18);
  });

  it("recusa contrato sem código", () => {
    expect(() => contratoMegaSchema.parse({ ...CRU, cto_in_codigo: null })).toThrow();
  });
});

describe("parseContratos", () => {
  it("sobrevive a linha estranha sem perder as boas", () => {
    const r = parseContratos([CRU, { lixo: 1 }, { ...CRU, cto_in_codigo: 1361 }]);
    expect(r.contratos).toHaveLength(2);
    expect(r.recusados).toBe(1);
  });

  it("recusa resposta que não é lista", () => {
    expect(parseContratos({ erro: "nao autorizado" }).contratos).toEqual([]);
  });
});
