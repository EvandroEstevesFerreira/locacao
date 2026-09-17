import { describe, it, expect } from "vitest";
import { ratearPorCabeca, type Atribuicao } from "./rateio";

function pessoas(centro: string | null, n: number): Atribuicao[] {
  return Array.from({ length: n }, (_, i) => ({
    funcionarioId: `${centro ?? "sem"}-${i}`,
    centroCustoId: centro,
  }));
}

describe("ratearPorCabeca", () => {
  it("divide igual quando a conta fecha", () => {
    const r = ratearPorCabeca(30000, 3, [...pessoas("rh", 1), ...pessoas("eng", 2)]);
    expect(r.porCentroCusto).toEqual([
      { centroCustoId: "eng", pessoas: 2, centavos: 20000 },
      { centroCustoId: "rh", pessoas: 1, centavos: 10000 },
    ]);
    expect(r.ociosas).toEqual({ quantidade: 0, centavos: 0 });
  });

  it("a soma das partes é EXATAMENTE o total, mesmo quando não fecha", () => {
    // R$ 3.500,00 entre 50 licenças: 350000/50 = 7000 certinho; o caso torto é
    // o de baixo. Aqui o que se cobra é o invariante em si.
    const r = ratearPorCabeca(350000, 43, [
      ...pessoas("rh", 8),
      ...pessoas("eng", 21),
      ...pessoas("fin", 6),
      ...pessoas("obra605", 8),
    ]);
    const soma =
      r.porCentroCusto.reduce((a, f) => a + f.centavos, 0) + r.ociosas.centavos;
    expect(soma).toBe(350000);
  });

  it("a licença ociosa fica visível e sem dono", () => {
    // 50 contratadas, 43 atribuídas: as 7 restantes NÃO são distribuídas entre
    // todos. Distribuí-las é como ninguém jamais cancela assinatura nenhuma.
    const r = ratearPorCabeca(350000, 50, pessoas("rh", 43));
    expect(r.ociosas.quantidade).toBe(7);
    expect(r.ociosas.centavos).toBeGreaterThan(0);
  });

  it("o resto vai para a maior fatia, não para a primeira", () => {
    // 100 centavos, 3 licenças: 33 cada, sobra 1. Ele vai para quem tem mais
    // gente; empate desempata pelo id, para o resultado ser estável entre
    // renders e não dançar na tela.
    const r = ratearPorCabeca(100, 3, [...pessoas("a", 1), ...pessoas("b", 2)]);
    const b = r.porCentroCusto.find((f) => f.centroCustoId === "b");
    expect(b?.centavos).toBe(67);
  });

  it("pessoa sem centro de custo vira uma fatia própria, e não some", () => {
    // `funcionario.obra_id` é nulável. Sumir com ela faria o total não fechar.
    const r = ratearPorCabeca(20000, 2, [...pessoas("rh", 1), ...pessoas(null, 1)]);
    expect(r.porCentroCusto.some((f) => f.centroCustoId === null)).toBe(true);
  });

  it("contrato sem nenhuma atribuição é 100% ocioso", () => {
    const r = ratearPorCabeca(350000, 50, []);
    expect(r.ociosas).toEqual({ quantidade: 50, centavos: 350000 });
    expect(r.porCentroCusto).toEqual([]);
  });

  it("recusa mais atribuições que licenças contratadas", () => {
    // 3 atribuídas para 2 contratadas é erro de cadastro, não arredondamento.
    expect(() => ratearPorCabeca(20000, 2, pessoas("rh", 3))).toThrow(/contratada/i);
  });

  it("o invariante da soma vale para 200 combinações quaisquer", () => {
    // O centavo perdido não aparece nos casos redondos que a gente escolhe à
    // mão — aparece no 43º mês, no contrato que ninguém olhou.
    for (let i = 0; i < 200; i++) {
      const quantidade = 1 + ((i * 7) % 97);
      const atribuidas = i % (quantidade + 1);
      const total = 100 + ((i * 991) % 500000);
      const r = ratearPorCabeca(
        total,
        quantidade,
        Array.from({ length: atribuidas }, (_, k) => ({
          funcionarioId: `f${k}`,
          centroCustoId: `c${k % 5}`,
        })),
      );
      const soma =
        r.porCentroCusto.reduce((a, f) => a + f.centavos, 0) + r.ociosas.centavos;
      expect(soma).toBe(total);
    }
  });
});
