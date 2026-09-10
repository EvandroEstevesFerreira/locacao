import { describe, it, expect } from "vitest";

import { vencimentoEfetivo, situacaoDoTitulo } from "./vencimento";

/**
 * A DATA DE PAGAR É A PRORROGADA, não a de vencimento.
 *
 * Medido em 10/09/2026 sobre 5.372 parcelas reais: 866 (16,1%) têm prorrogação,
 * e ela é SEMPRE para depois — nunca uma única vez para antes. Às vezes por
 * meses (venc. 03/12/2024, prorrogado para 31/03/2025).
 *
 * Mostrar o vencimento original nesses casos faria a tela apontar atraso em
 * título que está em dia — e mandar alguém correr atrás de pagamento que o
 * financeiro já renegociou.
 */

describe("vencimentoEfetivo", () => {
  it("usa a prorrogação quando ela existe", () => {
    expect(
      vencimentoEfetivo({ dataVencimento: "2024-12-03", dataProrrogado: "2025-03-31" }),
    ).toBe("2025-03-31");
  });

  it("cai no vencimento quando não há prorrogação", () => {
    expect(
      vencimentoEfetivo({ dataVencimento: "2026-09-15", dataProrrogado: null }),
    ).toBe("2026-09-15");
  });

  // O Mega repete a data quando não houve prorrogação de fato. Tratar isso como
  // "prorrogado" encheria a tela de aviso onde não há nada a avisar.
  it("não considera prorrogação quando as duas datas são iguais", () => {
    const t = { dataVencimento: "2026-09-15", dataProrrogado: "2026-09-15" };
    expect(vencimentoEfetivo(t)).toBe("2026-09-15");
  });

  // NUNCA MEDIMOS PRORROGAÇÃO PARA TRÁS em 5.372 parcelas. Se aparecer, é dado
  // estranho: adiantar a data de pagar por conta própria é o erro caro dos
  // dois, então o vencimento original prevalece.
  it("ignora prorrogação anterior ao vencimento", () => {
    expect(
      vencimentoEfetivo({ dataVencimento: "2026-09-15", dataProrrogado: "2026-09-01" }),
    ).toBe("2026-09-15");
  });
});

describe("situacaoDoTitulo", () => {
  const hoje = "2026-09-10";

  it("saldo zerado é pago, mesmo vencido", () => {
    expect(
      situacaoDoTitulo({
        saldoAtual: 0,
        dataVencimento: "2026-01-01",
        dataProrrogado: null,
        hojeISO: hoje,
      }),
    ).toBe("pago");
  });

  it("em aberto com data futura está a vencer", () => {
    expect(
      situacaoDoTitulo({
        saldoAtual: 100,
        dataVencimento: "2026-09-15",
        dataProrrogado: null,
        hojeISO: hoje,
      }),
    ).toBe("a_vencer");
  });

  it("em aberto vencendo hoje ainda não está atrasado", () => {
    expect(
      situacaoDoTitulo({
        saldoAtual: 100,
        dataVencimento: hoje,
        dataProrrogado: null,
        hojeISO: hoje,
      }),
    ).toBe("vence_hoje");
  });

  it("em aberto com data passada está atrasado", () => {
    expect(
      situacaoDoTitulo({
        saldoAtual: 100,
        dataVencimento: "2026-09-01",
        dataProrrogado: null,
        hojeISO: hoje,
      }),
    ).toBe("atrasado");
  });

  // ESTE É O CASO QUE JUSTIFICA A FUNÇÃO INTEIRA. Vencido no papel, prorrogado
  // para o mês que vem: está EM DIA. Sem isto, a tela acusaria atraso e alguém
  // ligaria para o fornecedor cobrando uma renegociação que o próprio
  // financeiro fez.
  it("não acusa atraso quando a prorrogação joga a data para frente", () => {
    expect(
      situacaoDoTitulo({
        saldoAtual: 100,
        dataVencimento: "2026-09-01",
        dataProrrogado: "2026-10-05",
        hojeISO: hoje,
      }),
    ).toBe("a_vencer");
  });
});
