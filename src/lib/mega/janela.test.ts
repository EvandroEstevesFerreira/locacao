import { describe, it, expect } from "vitest";

import { janelasDeConsulta, LIMITE_ANOS_MEGA } from "./janela";

/**
 * O Mega recusa consulta com mais de 2 anos entre as datas:
 *
 *   "O intervalo máximo permitido entre as datas é 2 ano. Informado a data
 *    inicial 01/01/2025 e data final 31/12/2027"
 *
 * Medido em 10/09/2026, contra a API de produção, depois de as 37 consultas da
 * primeira rodada voltarem recusadas.
 */

const dias = (a: string, b: string) =>
  (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;

describe("janelasDeConsulta", () => {
  it("cobre do ano passado ao ano que vem, sem buraco entre as janelas", () => {
    const js = janelasDeConsulta("2026-09-10");
    expect(js[0].inicio).toBe("2025-01-01");
    expect(js[js.length - 1].fim).toBe("2027-12-31");

    // Emenda exata: o fim de uma janela e o início da seguinte não podem
    // pular um dia, ou o título que vence nesse dia some do espelho.
    for (let i = 1; i < js.length; i += 1) {
      expect(dias(js[i - 1].fim, js[i].inicio)).toBe(1);
    }
  });

  // ESTE É O TESTE QUE O ERP COBRA. Uma janela de um dia a mais e a consulta
  // volta recusada — e recusada para os 37 fornecedores, todo dia.
  it("nenhuma janela passa do limite do Mega", () => {
    for (const hoje of ["2026-09-10", "2027-01-01", "2028-12-31", "2026-02-29"]) {
      for (const j of janelasDeConsulta(hoje)) {
        expect(dias(j.inicio, j.fim), `${hoje}: ${j.inicio}..${j.fim}`).toBeLessThanOrEqual(
          LIMITE_ANOS_MEGA * 366,
        );
      }
    }
  });

  // Cada janela é uma chamada A MAIS por fornecedor, e são 37 fornecedores. Sem
  // este teto, alguém alarga o horizonte e a rodada vira centenas de chamadas
  // contra a conta que já foi bloqueada uma vez.
  it("resolve o horizonte em no máximo duas chamadas por fornecedor", () => {
    expect(janelasDeConsulta("2026-09-10").length).toBeLessThanOrEqual(2);
  });

  it("é estável dentro do mesmo ano", () => {
    expect(janelasDeConsulta("2026-01-01")).toEqual(janelasDeConsulta("2026-12-31"));
  });
});
