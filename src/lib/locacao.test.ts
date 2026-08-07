import { describe, it, expect } from "vitest";
import {
  periodosEntre,
  periodosPorMes,
  custoLinhaLocado,
  hojeISOSaoPaulo,
  hojeSaoPaulo,
  dataDeISO,
  formatarData,
  formatarBRL,
} from "./locacao";

const d = (iso: string) => {
  const [a, m, dia] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, dia ?? 1);
};

describe("periodosEntre", () => {
  it("arredonda para cima sem pró-rata (período iniciado = cheio)", () => {
    // semanal, 8 dias (inclusivo = 8) → 2 períodos
    expect(periodosEntre("semanal", d("2026-01-01"), d("2026-01-08"))).toBe(2);
  });
  it("com pró-rata, proporcional aos dias", () => {
    const p = periodosEntre("semanal", d("2026-01-01"), d("2026-01-08"), true);
    expect(p).toBeCloseTo(8 / 7, 5);
  });
  it("mínimo de 1 dia", () => {
    expect(periodosEntre("diaria", d("2026-01-01"), d("2026-01-01"))).toBe(1);
  });
});

describe("periodosPorMes", () => {
  it("mensal = 1, semanal ~4,29, diária = 30", () => {
    expect(periodosPorMes("mensal")).toBe(1);
    expect(periodosPorMes("diaria")).toBe(30);
    expect(periodosPorMes("semanal")).toBeCloseTo(30 / 7, 5);
  });
});

describe("custoLinhaLocado — devoluções parciais", () => {
  const base = {
    valorUnitarioPeriodo: 100,
    cadencia: "mensal" as const,
    retirada: d("2026-01-01"),
    fim: d("2026-04-01"), // ~3 meses depois
  };

  it("sem devolução: cobra a quantidade cheia até o fim", () => {
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 10,
      devolucoes: [],
    });
    expect(saldo).toBe(10);
    // 91 dias inclusivos / 30 = 3.03 → ceil 4 períodos
    const periodos = Math.ceil((91 + 0) / 30);
    expect(custo).toBe(10 * 100 * periodos);
  });

  it("NÃO cobra quantidade cheia após devolução parcial (corrige o bug)", () => {
    // 10 unidades; devolve 6 em 01/02 (32 dias → 2 períodos), saldo 4 até 01/04.
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 10,
      devolucoes: [{ quantidade: 6, data: d("2026-02-01") }],
    });
    expect(saldo).toBe(4);
    const perDevolvido = Math.ceil((31 + 1) / 30); // 01/01→01/02 inclusivo = 32 → 2
    const perSaldo = Math.ceil((90 + 1) / 30); // 01/01→01/04 = 91 → 4
    expect(custo).toBe(6 * 100 * perDevolvido + 4 * 100 * perSaldo);
    // e é MENOR que cobrar tudo cheio até o fim
    expect(custo).toBeLessThan(10 * 100 * perSaldo);
  });

  it("totalmente devolvido: só cobra até as datas de devolução, saldo 0", () => {
    const { saldo, custo } = custoLinhaLocado({
      ...base,
      quantidade: 5,
      devolucoes: [
        { quantidade: 2, data: d("2026-01-15") },
        { quantidade: 3, data: d("2026-02-10") },
      ],
    });
    expect(saldo).toBe(0);
    const per1 = Math.ceil((14 + 1) / 30); // 15 dias → 1
    const per2 = Math.ceil((40 + 1) / 30); // 41 dias → 2
    expect(custo).toBe(2 * 100 * per1 + 3 * 100 * per2);
  });
});

describe("hojeISOSaoPaulo", () => {
  // O bug que estas asserções travam: 9 lugares do app calculavam "hoje" com
  // `new Date().toISOString().slice(0, 10)`, que devolve a data em UTC. Entre
  // 21h e a meia-noite em Brasília (BRT = UTC-3) isso é o dia SEGUINTE:
  // uma conta com vencimento hoje aparecia como vencida, o cálculo de multa e
  // juros contava um dia a mais, e os PDFs de contrato e termo saíam datados de
  // amanhã.
  it("às 21h de Brasília ainda é o mesmo dia (UTC já virou)", () => {
    // 2026-03-11T00:30:00Z = 2026-03-10 21:30 em São Paulo
    const base = new Date("2026-03-11T00:30:00Z");
    expect(base.toISOString().slice(0, 10)).toBe("2026-03-11"); // o bug
    expect(hojeISOSaoPaulo(base)).toBe("2026-03-10"); // o correto
  });

  it("logo depois da meia-noite de Brasília já é o dia novo", () => {
    // 2026-03-11T03:30:00Z = 2026-03-11 00:30 em São Paulo
    expect(hojeISOSaoPaulo(new Date("2026-03-11T03:30:00Z"))).toBe("2026-03-11");
  });

  it("ao meio-dia os dois fusos concordam", () => {
    const base = new Date("2026-03-11T15:00:00Z");
    expect(hojeISOSaoPaulo(base)).toBe(base.toISOString().slice(0, 10));
  });

  it("vira o ano no fuso certo", () => {
    // 2027-01-01T01:00:00Z = 2026-12-31 22:00 em São Paulo
    expect(hojeISOSaoPaulo(new Date("2027-01-01T01:00:00Z"))).toBe("2026-12-31");
  });
});

describe("formatarData", () => {
  it("formata uma coluna date sem deslocar o dia", () => {
    expect(formatarData("2026-03-10")).toBe("10/03/2026");
  });

  it("aceita timestamp completo em vez de devolver Invalid Date", () => {
    // dataDeISO faz split manual em "-", então "2026-03-10T12:00:00Z" produzia
    // Number("10T12:00:00Z") = NaN e a data saía inválida.
    expect(formatarData("2026-03-10T12:00:00Z")).toBe("10/03/2026");
  });

  it("um timestamp de 21h em Brasília mantém o dia local", () => {
    // 2026-03-11T00:30:00Z = 10/03 às 21:30 em São Paulo
    expect(formatarData("2026-03-11T00:30:00Z")).toBe("10/03/2026");
  });

  it("nulo vira travessão", () => {
    expect(formatarData(null)).toBe("—");
  });
});

describe("formatarBRL", () => {
  // ATENÇÃO: o Intl separa "R$" do número com espaço NÃO SEPARÁVEL (U+00A0),
  // não com espaço comum. Comparar com " " falha exibindo duas strings
  // visualmente idênticas — armadilha que já custou tempo aqui.
  const NBSP = " ";

  it("formata no padrão brasileiro", () => {
    expect(formatarBRL(1234.5)).toBe(`R$${NBSP}1.234,50`);
  });
  it("trata zero e NaN como zero", () => {
    expect(formatarBRL(0)).toBe(`R$${NBSP}0,00`);
    expect(formatarBRL(Number.NaN)).toBe(`R$${NBSP}0,00`);
  });
});

describe("hojeSaoPaulo", () => {
  // Segunda forma do mesmo bug de fuso. A primeira era
  // `new Date().toISOString().slice(0, 10)`; esta é passar `new Date()` cru para
  // funções que comparam DIA DE CALENDÁRIO com uma data vinda do banco
  // (`periodosEntre`, `differenceInCalendarDays`, `format(…, "yyyy-MM-dd")`).
  //
  // `new Date()` é um instante; as datas do banco chegam por `dataDeISO`, que
  // devolve meia-noite. O dia de calendário do instante é lido no fuso do
  // runtime, e o Vercel roda em UTC — então das 21h à meia-noite em Brasília o
  // instante já é do dia seguinte. Consequência direta: um período a mais no
  // custo de locação e um dia a mais em "dias em atraso".
  const vinteETresHoraEmBrasilia = new Date("2026-08-07T02:30:00Z");

  it("às 23h30 de Brasília ainda é o dia 6, não o 7 de UTC", () => {
    const h = hojeSaoPaulo(vinteETresHoraEmBrasilia);
    expect(h.getFullYear()).toBe(2026);
    expect(h.getMonth()).toBe(7); // agosto
    expect(h.getDate()).toBe(6);
  });

  it("devolve meia-noite, comparável com dataDeISO", () => {
    const h = hojeSaoPaulo(vinteETresHoraEmBrasilia);
    expect(h.getHours()).toBe(0);
    expect(h.getMinutes()).toBe(0);
    expect(h.getTime()).toBe(dataDeISO("2026-08-06").getTime());
  });

  it("não cobra um período extra: 6 dias de locação diária são 6, não 7", () => {
    const retirada = dataDeISO("2026-08-01");
    const dias = periodosEntre("diaria", retirada, hojeSaoPaulo(vinteETresHoraEmBrasilia));
    expect(dias).toBe(6);
  });

  it("de manhã não há divergência entre UTC e Brasília", () => {
    const manha = new Date("2026-08-07T13:00:00Z");
    expect(hojeSaoPaulo(manha).getTime()).toBe(dataDeISO("2026-08-07").getTime());
  });
});
