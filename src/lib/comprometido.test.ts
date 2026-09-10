import { describe, expect, it } from "vitest";
import { comprometidoDoContrato, dataDeISO } from "./locacao";

// O contrato 1726 (Locação de Ar Condicionado, 5I), com os números do documento:
//   2 x 12000BTU @ 156,667 = 313,33/mês
//   7 x 18000BTU @ 246,457 = 1.725,20/mês
//   mensal 2.038,53 · 16 meses · total previsto 32.616,48
const LINHAS = [
  {
    quantidade: 2,
    valor_unitario_periodo: 156.667,
    data_retirada: "2026-07-13",
    data_devolucao: null,
    movimentacao: [],
  },
  {
    quantidade: 7,
    valor_unitario_periodo: 246.457,
    data_retirada: "2026-07-13",
    data_devolucao: null,
    movimentacao: [],
  },
];

describe("comprometidoDoContrato", () => {
  it("projeta cada item até o FIM DO CONTRATO, e não até hoje", () => {
    // É o que distingue "comprometido" de "acumulado": o acumulado para em
    // hoje, o comprometido vai até onde o contrato vai.
    const ano = comprometidoDoContrato({
      linhas: LINHAS,
      cadencia: "mensal",
      fimContrato: dataDeISO("2027-07-13"),
      prorata: false,
    });
    // TREZE períodos, não doze, e isso é regra do sistema — não defeito.
    // `periodosEntre` é inclusiva e arredonda para cima ("período iniciado =
    // período cheio"), com mensal aproximado em 30 dias: 366 dias / 30 = 12,2,
    // que vira 13.
    //
    // Fica escrito aqui porque quem comparar esta projeção com "16 meses" do
    // documento vai achar que um dos dois está errado, e vai ser tentado a
    // consertar o lado errado.
    expect(Math.round(ano!)).toBe(Math.round(2038.533 * 13));
  });

  it("o item JÁ DEVOLVIDO para na devolução, não no fim do contrato", () => {
    // Comprometer até o fim um equipamento que já voltou inflaria a projeção e
    // faria a conferência acusar divergência que não existe.
    const comDevolucao = comprometidoDoContrato({
      linhas: [{ ...LINHAS[0]!, data_devolucao: "2026-09-13" }, LINHAS[1]!],
      cadencia: "mensal",
      fimContrato: dataDeISO("2027-07-13"),
      prorata: false,
    });
    const semDevolucao = comprometidoDoContrato({
      linhas: LINHAS,
      cadencia: "mensal",
      fimContrato: dataDeISO("2027-07-13"),
      prorata: false,
    });
    expect(comDevolucao!).toBeLessThan(semDevolucao!);
  });

  it("contrato sem fim previsto não projeta nada", () => {
    // Sem horizonte não há o que comprometer, e chutar "um ano" seria inventar
    // um número que ninguém contratou.
    expect(
      comprometidoDoContrato({
        linhas: LINHAS,
        cadencia: "mensal",
        fimContrato: null,
        prorata: false,
      }),
    ).toBe(null);
  });

  it("sem itens, o comprometido é zero e não nulo", () => {
    // Zero é uma resposta: o contrato existe e nada foi cadastrado nele. Nulo
    // significaria "não dá para saber", que é outra coisa.
    expect(
      comprometidoDoContrato({
        linhas: [],
        cadencia: "mensal",
        fimContrato: dataDeISO("2027-07-13"),
        prorata: false,
      }),
    ).toBe(0);
  });
});
