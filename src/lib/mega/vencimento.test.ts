import { describe, it, expect } from "vitest";

import { vencimentoEfetivo, dataDePagamento, situacaoDoTitulo } from "./vencimento";

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

/**
 * QUANDO se pagou — a pergunta que até 11/09/2026 se dizia impossível.
 *
 * O `AGENTS.md` afirmava que a API do Mega não devolve data de pagamento. A
 * regra do dono do processo é que a prorrogação É essa data; medido no espelho
 * no mesmo dia, as 450 parcelas copiadas têm prorrogação preenchida e nenhuma
 * prorroga para trás.
 */
describe("dataDePagamento", () => {
  it("devolve a prorrogação quando o título está quitado", () => {
    expect(
      dataDePagamento({
        saldoAtual: 0,
        dataVencimento: "2024-12-03",
        dataProrrogado: "2025-03-31",
      }),
    ).toBe("2025-03-31");
  });

  it("devolve o vencimento quando não houve prorrogação", () => {
    expect(
      dataDePagamento({
        saldoAtual: 0,
        dataVencimento: "2026-08-15",
        dataProrrogado: "2026-08-15",
      }),
    ).toBe("2026-08-15");
  });

  // A GUARDA QUE JUSTIFICA O SALDO NA ASSINATURA. Em título aberto a
  // prorrogação é previsão; devolvê-la como "pago em" marcaria como quitado o
  // que ainda vai vencer.
  it("devolve nulo enquanto há saldo", () => {
    expect(
      dataDePagamento({
        saldoAtual: 2038.53,
        dataVencimento: "2026-09-15",
        dataProrrogado: "2026-09-15",
      }),
    ).toBeNull();
  });

  it("devolve nulo mesmo com saldo negativo, que é dado estranho", () => {
    expect(
      dataDePagamento({
        saldoAtual: -10,
        dataVencimento: "2026-09-15",
        dataProrrogado: "2026-09-15",
      }),
    ).toBeNull();
  });

  it("não antecipa se a prorrogação vier para trás", () => {
    expect(
      dataDePagamento({
        saldoAtual: 0,
        dataVencimento: "2026-09-15",
        dataProrrogado: "2026-09-01",
      }),
    ).toBe("2026-09-15");
  });
});
