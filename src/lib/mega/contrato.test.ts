import { describe, it, expect } from "vitest";

import { dataMegaParaISO, tituloMegaSchema, parseTitulos } from "./contrato";

// Amostra REAL, copiada de uma resposta da rota FaturaPagar/Saldo. Não inventar
// forma aqui: foi exatamente por acreditar na documentação em vez do que a API
// responde que o formato do agente saiu errado da primeira vez.
const CRU = {
  Filial: { Id: 3, Nome: null, NomeFantasia: null, Agente: null, OrganizacaoPai: null },
  Agente: {
    Expand: "tipos",
    Id: "1-2506",
    Padrao: 1,
    Codigo: 2506,
    Tipo: null,
    Nome: "FERRAMENTAS MAXIMA EQUIPAMENTOS PARA CONSTRUCAO LTDA",
    NomeFantasia: "FERRAMENTAS MAXIMA EQUIPAMENTOS PARA CONSTRUCAO LTDA",
    Cnpj: "21.496.043/0001-80",
    Consolidador: "E",
    Tipos: null,
  },
  NumeroAP: 16691,
  TipoDocumento: "NF MAT",
  NumeroDocumento: "71050",
  NumeroParcela: "001",
  DataVencimento: "01/12/2024",
  DataProrrogado: "01/12/2024",
  ValorParcela: 693.4,
  SaldoAtual: 0.0,
};

describe("dataMegaParaISO", () => {
  it("converte dd/MM/yyyy para ISO", () => {
    expect(dataMegaParaISO("01/12/2024")).toBe("2024-12-01");
  });

  // O DIA E O MÊS TROCADOS SÃO O ERRO CARO AQUI. "05/08" é 5 de agosto no Mega
  // e 8 de maio para quem lê como americano — e um vencimento errado por três
  // meses passa despercebido numa lista.
  it("lê 05/08/2026 como 5 de agosto, não 8 de maio", () => {
    expect(dataMegaParaISO("05/08/2026")).toBe("2026-08-05");
  });

  it("devolve null para vazio, nulo ou lixo", () => {
    expect(dataMegaParaISO(null)).toBeNull();
    expect(dataMegaParaISO("")).toBeNull();
    expect(dataMegaParaISO("nunca")).toBeNull();
    expect(dataMegaParaISO("2024-12-01")).toBeNull();
  });

  it("recusa data impossível em vez de rolar para o mês seguinte", () => {
    expect(dataMegaParaISO("31/02/2026")).toBeNull();
  });
});

describe("tituloMegaSchema", () => {
  it("achata a amostra real", () => {
    const t = tituloMegaSchema.parse(CRU);
    expect(t).toEqual({
      codigoAgente: "2506",
      agenteNome: "FERRAMENTAS MAXIMA EQUIPAMENTOS PARA CONSTRUCAO LTDA",
      agenteCnpj: "21.496.043/0001-80",
      numeroAp: "16691",
      numeroParcela: "001",
      filial: "3",
      tipoDocumento: "NF MAT",
      numeroDocumento: "71050",
      dataVencimento: "2024-12-01",
      dataProrrogado: "2024-12-01",
      valorParcela: 693.4,
      saldoAtual: 0,
    });
  });

  // NumeroAP vem como INT do Mega e vira chave de texto no espelho. Se o schema
  // exigisse string, a sincronização inteira falharia na primeira linha.
  it("aceita NumeroAP numérico e guarda como texto", () => {
    expect(tituloMegaSchema.parse(CRU).numeroAp).toBe("16691");
  });

  it("aguenta os opcionais nulos", () => {
    const t = tituloMegaSchema.parse({
      ...CRU,
      TipoDocumento: null,
      NumeroDocumento: null,
      DataProrrogado: null,
      Filial: null,
    });
    expect(t.tipoDocumento).toBeNull();
    expect(t.numeroDocumento).toBeNull();
    expect(t.dataProrrogado).toBeNull();
    expect(t.filial).toBeNull();
  });

  // SEM VENCIMENTO NÃO HÁ TÍTULO. Deixar passar com data nula encheria o
  // espelho de linhas que nenhuma tela consegue ordenar nem conciliar.
  it("recusa título sem vencimento válido", () => {
    expect(() => tituloMegaSchema.parse({ ...CRU, DataVencimento: null })).toThrow();
  });
});

describe("parseTitulos", () => {
  it("devolve as linhas válidas e conta as recusadas, sem derrubar a rodada", () => {
    const r = parseTitulos([CRU, { lixo: true }, { ...CRU, NumeroAP: 16692 }]);
    expect(r.titulos).toHaveLength(2);
    expect(r.recusados).toBe(1);
  });

  // UMA LINHA ESTRANHA NÃO PODE CUSTAR AS OUTRAS 5.371. O espelho de um dia
  // inteiro não se perde porque o Mega mandou um registro fora do formato.
  it("não lança quando tudo é inválido", () => {
    const r = parseTitulos([{ a: 1 }, { b: 2 }]);
    expect(r.titulos).toEqual([]);
    expect(r.recusados).toBe(2);
  });

  it("recusa resposta que não é lista", () => {
    expect(parseTitulos({ erro: "nao autorizado" }).titulos).toEqual([]);
  });
});
