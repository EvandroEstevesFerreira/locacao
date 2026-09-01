import { describe, it, expect } from "vitest";
import {
  percentualConsumido,
  projecaoFinal,
  estouroPrevisto,
  diagnostico,
  totalDetalhado,
  orcamentoSchema,
} from "./orcamento";

describe("percentualConsumido", () => {
  it("calcula a fração do orçamento já comprometida", () => {
    expect(percentualConsumido(400000, 248000)).toBeCloseTo(62, 1);
  });

  it("devolve null com orçamento zero ou negativo — não divide por zero", () => {
    expect(percentualConsumido(0, 1000)).toBeNull();
    expect(percentualConsumido(-1, 1000)).toBeNull();
  });

  it("passa de 100 quando estourou — travar aqui esconderia o estouro", () => {
    expect(percentualConsumido(100000, 130000)).toBeCloseTo(130, 1);
  });

  it("é 0 sem nada realizado", () => {
    expect(percentualConsumido(400000, 0)).toBe(0);
  });
});

describe("projecaoFinal", () => {
  it("projeta pelo ritmo de consumo contra a entrega", () => {
    // O caso do desenho: 62% de orçamento com 31% de obra → 200%.
    expect(projecaoFinal(62, 31)).toBeCloseTo(200, 1);
  });

  it("obra eficiente projeta abaixo de 100%", () => {
    expect(projecaoFinal(30, 60)).toBeCloseTo(50, 1);
  });

  it("devolve null sem avanço físico — não há denominador", () => {
    expect(projecaoFinal(62, null)).toBeNull();
    expect(projecaoFinal(62, 0)).toBeNull();
  });

  it("devolve null sem consumo apurado", () => {
    expect(projecaoFinal(null, 31)).toBeNull();
  });
});

describe("estouroPrevisto", () => {
  it("é a diferença em reais acima do orçamento", () => {
    expect(estouroPrevisto(400000, 200)).toBe(400000);
  });

  it("é null quando a projeção fica dentro do orçamento", () => {
    expect(estouroPrevisto(400000, 90)).toBeNull();
    expect(estouroPrevisto(400000, 100)).toBeNull();
  });

  it("é null sem projeção", () => {
    expect(estouroPrevisto(400000, null)).toBeNull();
  });
});

describe("diagnostico", () => {
  it("acusa consumo mais rápido que a entrega", () => {
    expect(diagnostico(55, 31, 62)).toBe("Consumindo mais rápido que entrega.");
  });

  it("reconhece obra entregando mais que consome", () => {
    expect(diagnostico(55, 60, 30)).toBe("Entregando mais que consome.");
  });

  it("chama de alinhado o que está dentro da margem de 10 pontos", () => {
    // A margem existe para o veredito não oscilar por ruído de arredondamento.
    expect(diagnostico(55, 40, 45)).toBe("Consumo alinhado ao avanço.");
  });

  it("diz o que falta quando falta dado", () => {
    expect(diagnostico(55, null, 62)).toBe("Sem avanço físico lançado.");
    expect(diagnostico(55, 31, null)).toBe("Sem orçamento cadastrado.");
  });

  it("a falta de orçamento tem precedência sobre a de avanço", () => {
    // Sem orçamento não há o que diagnosticar, então é essa a frase que ajuda.
    expect(diagnostico(null, null, null)).toBe("Sem orçamento cadastrado.");
  });
});

describe("totalDetalhado", () => {
  it("soma os itens do orçamento", () => {
    expect(
      totalDetalhado([{ valor_previsto: 120000 }, { valor_previsto: 200000 }]),
    ).toBe(320000);
  });

  it("é 0 sem itens", () => {
    expect(totalDetalhado([])).toBe(0);
  });
});

describe("orcamentoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  const OUTRO = "22222222-2222-4222-8222-222222222222";

  it("aceita o id em branco que o input oculto manda", () => {
    const r = orcamentoSchema.safeParse({
      id: "",
      obra_id: UUID,
      valor_total: "400000",
      observacoes: "",
      itens: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBeNull();
      expect(r.data.valor_total).toBe(400000);
      expect(r.data.observacoes).toBeNull();
    }
  });

  it("aceita valor com vírgula, que é como o brasileiro digita", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "1500,50",
      itens: [],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor_total).toBe(1500.5);
  });

  it("recusa valor negativo", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "-1",
      itens: [],
    });
    expect(r.success).toBe(false);
  });

  it("aceita detalhamento por item", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [{ item_id: UUID, quantidade: "3", valor_previsto: "120000" }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.itens[0].valor_previsto).toBe(120000);
      expect(r.data.itens[0].quantidade).toBe(3);
    }
  });

  it("aceita itens diferentes no mesmo orçamento", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [
        { item_id: UUID, valor_previsto: "1" },
        { item_id: OUTRO, valor_previsto: "2" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("recusa o mesmo item duas vezes — o banco tem unique e o erro seria cru", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [
        { item_id: UUID, valor_previsto: "1" },
        { item_id: UUID, valor_previsto: "2" },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // A mensagem tem de sair NA LINHA do item, senão o formulário não tem
      // onde pendurá-la e o erro fica invisível.
      expect(r.error.issues[0].path).toEqual(["itens", 1, "item_id"]);
    }
  });

  it("aceita o próprio output — a action revalida o que o resolver transformou", () => {
    const primeira = orcamentoSchema.parse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [{ item_id: UUID, quantidade: "3", valor_previsto: "120000" }],
    });
    const r = orcamentoSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });
});
