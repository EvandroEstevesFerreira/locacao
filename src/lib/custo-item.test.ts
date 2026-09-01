import { describe, it, expect } from "vitest";
import {
  ratearProporcional,
  naoAtribuido,
  resumirPorItem,
  rateioSchema,
} from "./custo-item";

describe("ratearProporcional", () => {
  it("divide proporcionalmente ao custo mensal contratado", () => {
    const parcelas = ratearProporcional(40000, [
      { item_locado_id: "a", descricao: "Betoneira", custoMensal: 3000 },
      { item_locado_id: "b", descricao: "Gerador", custoMensal: 1000 },
    ]);
    expect(parcelas).toEqual([
      { item_locado_id: "a", valor: 30000 },
      { item_locado_id: "b", valor: 10000 },
    ]);
  });

  it("a soma das parcelas fecha exatamente com o total", () => {
    // Três itens iguais em R$ 100: 33,33 × 3 = 99,99 e sobraria um centavo
    // órfão, que num painel de diretoria é a linha que ninguém concilia.
    const parcelas = ratearProporcional(100, [
      { item_locado_id: "a", descricao: "A", custoMensal: 1 },
      { item_locado_id: "b", descricao: "B", custoMensal: 1 },
      { item_locado_id: "c", descricao: "C", custoMensal: 1 },
    ]);
    expect(parcelas.reduce((s, p) => s + p.valor, 0)).toBe(100);
    expect(parcelas[2].valor).toBeCloseTo(33.34, 2);
  });

  it("sem peso nenhum, divide igualmente", () => {
    const parcelas = ratearProporcional(90, [
      { item_locado_id: "a", descricao: "A", custoMensal: 0 },
      { item_locado_id: "b", descricao: "B", custoMensal: 0 },
      { item_locado_id: "c", descricao: "C", custoMensal: 0 },
    ]);
    expect(parcelas.map((p) => p.valor)).toEqual([30, 30, 30]);
  });

  it("sem itens, devolve vazio", () => {
    expect(ratearProporcional(1000, [])).toEqual([]);
  });

  it("um item só recebe tudo", () => {
    const parcelas = ratearProporcional(1234.56, [
      { item_locado_id: "a", descricao: "A", custoMensal: 500 },
    ]);
    expect(parcelas).toEqual([{ item_locado_id: "a", valor: 1234.56 }]);
  });
});

describe("naoAtribuido", () => {
  it("é o que falta atribuir", () => {
    expect(
      naoAtribuido(1000, [{ item_locado_id: "a", valor: 600 }]),
    ).toBe(400);
  });

  it("é zero quando fecha", () => {
    expect(
      naoAtribuido(1000, [
        { item_locado_id: "a", valor: 600 },
        { item_locado_id: "b", valor: 400 },
      ]),
    ).toBe(0);
  });

  it("é negativo quando atribuiu mais que a nota — e isso é permitido", () => {
    expect(naoAtribuido(1000, [{ item_locado_id: "a", valor: 1200 }])).toBe(-200);
  });

  it("não devolve lixo de ponto flutuante", () => {
    expect(
      naoAtribuido(100, [
        { item_locado_id: "a", valor: 33.33 },
        { item_locado_id: "b", valor: 33.33 },
        { item_locado_id: "c", valor: 33.34 },
      ]),
    ).toBe(0);
  });
});

describe("resumirPorItem", () => {
  it("confronta orçado e realizado, e ordena por quem passou mais", () => {
    const linhas = resumirPorItem([
      { itemId: "1", descricao: "Betoneira", orcado: 30000, realizado: 42000 },
      { itemId: "2", descricao: "Gerador", orcado: 20000, realizado: 15000 },
    ]);
    expect(linhas[0].descricao).toBe("Betoneira");
    expect(linhas[0].desvio).toBe(12000);
    expect(linhas[0].consumido).toBeCloseTo(140, 0);
    expect(linhas[1].desvio).toBe(-5000);
  });

  it("item sem orçamento vai para o FIM, não para o topo", () => {
    // "Não orçado" não é "dentro do orçamento": deixá-lo em cima esconderia o
    // item que de fato estourou.
    const linhas = resumirPorItem([
      { itemId: "1", descricao: "Sem orçamento", orcado: null, realizado: 99999 },
      { itemId: "2", descricao: "Estourado", orcado: 100, realizado: 200 },
    ]);
    expect(linhas[0].descricao).toBe("Estourado");
    expect(linhas[1].descricao).toBe("Sem orçamento");
    expect(linhas[1].desvio).toBeNull();
    expect(linhas[1].consumido).toBeNull();
  });

  it("orçado zero não divide por zero", () => {
    const linhas = resumirPorItem([
      { itemId: "1", descricao: "Zerado", orcado: 0, realizado: 500 },
    ]);
    expect(linhas[0].consumido).toBeNull();
  });

  it("itens sem orçamento ficam em ordem alfabética entre si", () => {
    const linhas = resumirPorItem([
      { itemId: "1", descricao: "Zebra", orcado: null, realizado: 1 },
      { itemId: "2", descricao: "Andaime", orcado: null, realizado: 1 },
    ]);
    expect(linhas.map((l) => l.descricao)).toEqual(["Andaime", "Zebra"]);
  });
});

describe("rateioSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  const OUTRO = "22222222-2222-4222-8222-222222222222";

  it("aceita rateio com valor em vírgula", () => {
    const r = rateioSchema.safeParse({
      lancamento_id: UUID,
      parcelas: [{ item_locado_id: OUTRO, valor: "1500,50" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.parcelas[0].valor).toBe(1500.5);
  });

  it("aceita rateio vazio — detalhar é opcional", () => {
    const r = rateioSchema.safeParse({ lancamento_id: UUID, parcelas: [] });
    expect(r.success).toBe(true);
  });

  it("recusa o mesmo item duas vezes, com a mensagem na linha", () => {
    const r = rateioSchema.safeParse({
      lancamento_id: UUID,
      parcelas: [
        { item_locado_id: OUTRO, valor: "1" },
        { item_locado_id: OUTRO, valor: "2" },
      ],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["parcelas", 1, "item_locado_id"]);
    }
  });

  it("aceita o próprio output", () => {
    const primeira = rateioSchema.parse({
      lancamento_id: UUID,
      parcelas: [{ item_locado_id: OUTRO, valor: "1500,50" }],
    });
    const r = rateioSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });
});
