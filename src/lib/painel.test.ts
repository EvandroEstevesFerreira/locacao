import { describe, it, expect } from "vitest";
import { montarLinha, montarPainel, resumirPainel, type EntradaPainel } from "./painel";

const HOJE = "2026-07-02";

function entrada(over: Partial<EntradaPainel> = {}): EntradaPainel {
  return {
    obra: {
      id: "o1",
      codigo: "OB-01",
      nome: "Obra Um",
      data_inicio: "2026-01-01",
      data_fim_prevista: "2026-12-31",
    },
    avancos: [{ semana: "2026-06-29", percentual: 31 }],
    orcado: 400000,
    realizado: 248000,
    itensAbertos: 14,
    custoMensal: 10000,
    mesesRestantes: 6,
    ...over,
  };
}

describe("montarLinha", () => {
  it("cruza os três percentuais e projeta o estouro", () => {
    const l = montarLinha(entrada(), HOJE);
    expect(l.prazo).toBeCloseTo(50, 0);
    expect(l.fisico).toBe(31);
    expect(l.consumido).toBeCloseTo(62, 0);
    expect(l.projecao).toBeCloseTo(200, 0);
    expect(l.estouro).toBeCloseTo(400000, 0);
    expect(l.veredito).toBe("Consumindo mais rápido que entrega.");
  });

  it("mede o excesso de consumo sobre a entrega", () => {
    const l = montarLinha(entrada(), HOJE);
    // 62% consumido contra 31% entregue = 31 pontos de excesso.
    expect(l.desvioConsumo).toBeCloseTo(31, 0);
  });

  it("calcula a previsão de desembolso até o fim dos contratos", () => {
    const l = montarLinha(entrada({ custoMensal: 10000, mesesRestantes: 6 }), HOJE);
    expect(l.previsaoAteFim).toBe(60000);
  });

  it("obra sem orçamento não tem consumo nem projeção", () => {
    const l = montarLinha(entrada({ orcado: null }), HOJE);
    expect(l.consumido).toBeNull();
    expect(l.projecao).toBeNull();
    expect(l.estouro).toBeNull();
    expect(l.veredito).toBe("Sem orçamento cadastrado.");
  });

  it("obra sem avanço lançado não projeta, mas ainda tem prazo e consumo", () => {
    const l = montarLinha(entrada({ avancos: [] }), HOJE);
    expect(l.fisico).toBeNull();
    expect(l.prazo).toBeCloseTo(50, 0);
    expect(l.consumido).toBeCloseTo(62, 0);
    expect(l.projecao).toBeNull();
    expect(l.veredito).toBe("Sem avanço físico lançado.");
  });

  it("obra sem período não tem prazo", () => {
    const l = montarLinha(
      entrada({
        obra: {
          id: "o1",
          codigo: "OB-01",
          nome: "Obra Um",
          data_inicio: null,
          data_fim_prevista: null,
        },
      }),
      HOJE,
    );
    expect(l.prazo).toBeNull();
    expect(l.desvioPrazo).toBeNull();
  });
});

describe("montarPainel", () => {
  it("põe em cima a obra com estouro em reais", () => {
    const painel = montarPainel(
      [
        // Saudável: consome menos do que entrega.
        entrada({
          obra: {
            id: "boa",
            codigo: "OB-BOA",
            nome: "Saudável",
            data_inicio: "2026-01-01",
            data_fim_prevista: "2026-12-31",
          },
          avancos: [{ semana: "2026-06-29", percentual: 70 }],
          realizado: 200000,
        }),
        // Estourando.
        entrada({
          obra: {
            id: "ruim",
            codigo: "OB-RUIM",
            nome: "Estourando",
            data_inicio: "2026-01-01",
            data_fim_prevista: "2026-12-31",
          },
          avancos: [{ semana: "2026-06-29", percentual: 20 }],
          realizado: 300000,
        }),
      ],
      HOJE,
    );
    expect(painel[0].obraId).toBe("ruim");
    expect(painel[1].obraId).toBe("boa");
  });

  it("obra sem dado nenhum vai para o FIM, não para o topo", () => {
    // Enterrar uma obra saudável embaixo de uma desconhecida seria pior: "não
    // se sabe" não é "está mal".
    const painel = montarPainel(
      [
        entrada({
          obra: {
            id: "vazia",
            codigo: "OB-VAZIA",
            nome: "Sem dados",
            data_inicio: null,
            data_fim_prevista: null,
          },
          avancos: [],
          orcado: null,
        }),
        entrada({
          obra: {
            id: "atrasada",
            codigo: "OB-ATRASADA",
            nome: "Atrasada",
            data_inicio: "2026-01-01",
            data_fim_prevista: "2026-12-31",
          },
          avancos: [{ semana: "2026-06-29", percentual: 10 }],
          orcado: null,
        }),
      ],
      HOJE,
    );
    expect(painel[0].obraId).toBe("atrasada");
    expect(painel[1].obraId).toBe("vazia");
  });
});

describe("resumirPainel", () => {
  it("soma estouro, itens e previsão, e conta o que está sem dado", () => {
    const painel = montarPainel(
      [
        entrada(),
        entrada({
          obra: {
            id: "o2",
            codigo: "OB-02",
            nome: "Obra Dois",
            data_inicio: null,
            data_fim_prevista: null,
          },
          avancos: [],
          orcado: null,
          itensAbertos: 3,
          custoMensal: 5000,
          mesesRestantes: 2,
        }),
      ],
      HOJE,
    );
    const r = resumirPainel(painel);
    expect(r.obras).toBe(2);
    expect(r.comEstouro).toBe(1);
    expect(r.estouroTotal).toBeCloseTo(400000, 0);
    expect(r.itensAbertos).toBe(17);
    expect(r.previsaoAteFim).toBe(70000);
    // O número que impede o painel de mentir por otimismo.
    expect(r.semDados).toBe(1);
  });

  it("painel vazio não quebra", () => {
    const r = resumirPainel([]);
    expect(r.obras).toBe(0);
    expect(r.estouroTotal).toBe(0);
    expect(r.semDados).toBe(0);
  });
});
