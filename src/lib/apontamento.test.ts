import { describe, it, expect } from "vitest";
import {
  faltaAteRevisao,
  usoDesdeRevisao,
  estadoRevisao,
  apontamentoSchema,
} from "./apontamento";

describe("usoDesdeRevisao", () => {
  // A entrada é o histórico da peça, do mais RECENTE para o mais antigo — a
  // mesma ordem em que `listarApontamentosDaPeca` devolve.
  it("soma só o que veio DEPOIS da última revisão", () => {
    expect(
      usoDesdeRevisao([
        { horas: 40, revisao: false },
        { horas: 30, revisao: false },
        { horas: 12, revisao: true },  // ← revisão feita nesta leitura
        { horas: 90, revisao: false },
        { horas: 80, revisao: false },
      ]),
    ).toBe(70);
  });

  it("a leitura DA revisão não entra na conta", () => {
    // As 12 h daquele período foram trabalhadas ANTES da revisão — o óleo
    // trocado naquele dia já as cobriu.
    expect(usoDesdeRevisao([{ horas: 12, revisao: true }])).toBe(0);
  });

  it("sem revisão nenhuma, soma o histórico inteiro", () => {
    // É honesto: o sistema conta as horas que ELE conhece. Uma peça
    // recém-cadastrada não tem apontamento, então soma zero e não nasce vencida
    // — que era exatamente o defeito de usar a leitura do mostrador.
    expect(usoDesdeRevisao([{ horas: 40, revisao: false }, { horas: 30, revisao: false }])).toBe(70);
  });

  it("peça sem apontamento devolve null, e não zero", () => {
    // Zero afirmaria "rodou zero hora desde a revisão", que é diferente de "não
    // sabemos se rodou". A tela precisa separar as duas.
    expect(usoDesdeRevisao([])).toBeNull();
  });

  it("só a revisão MAIS RECENTE conta", () => {
    expect(
      usoDesdeRevisao([
        { horas: 10, revisao: false },
        { horas: 20, revisao: true },
        { horas: 30, revisao: true },
        { horas: 40, revisao: false },
      ]),
    ).toBe(10);
  });
});

describe("faltaAteRevisao", () => {
  it("conta a partir da última revisão, não do mostrador", () => {
    // A ARMADILHA QUE ISTO CONSERTA: a conta antiga era
    // `intervalo - leituraAtual`, então um gerador com o horímetro em 1.200 e
    // intervalo de 250 aparecia vencido em 950 h — e continuava assim depois de
    // revisado, para sempre.
    expect(faltaAteRevisao(240, 250)).toBe(10);
  });

  it("devolve NEGATIVO quando venceu, e o negativo é a informação", () => {
    // "Passou 30 h do intervalo" é o que faz alguém agir. Truncar em zero diria
    // só "chegou a hora" e esconderia há quanto tempo passou.
    expect(faltaAteRevisao(280, 250)).toBe(-30);
  });

  it("devolve null quando o tipo não tem intervalo", () => {
    // É o caso da maioria: só faz sentido onde o fabricante publica o número.
    expect(faltaAteRevisao(240, null)).toBeNull();
    expect(faltaAteRevisao(240, 0)).toBeNull();
  });

  it("devolve null quando a peça nunca foi apontada", () => {
    // Sem leitura não há conta. Zero aqui diria "revisão vencida" para toda
    // máquina que ninguém apontou ainda — um alarme falso no primeiro dia.
    expect(faltaAteRevisao(null, 250)).toBeNull();
  });

  it("máquina recém-revisada tem o intervalo inteiro pela frente", () => {
    expect(faltaAteRevisao(0, 250)).toBe(250);
  });
});

describe("estadoRevisao", () => {
  it("avisa a 10% do intervalo, não num número fixo de horas", () => {
    // 25 h de antecedência é muito para um intervalo de 50 e pouco para um de
    // 500. A proporção resolve os dois.
    expect(estadoRevisao(25, 250)).toBe("proxima");
    expect(estadoRevisao(26, 250)).toBe("em_dia");
    expect(estadoRevisao(5, 50)).toBe("proxima");
    expect(estadoRevisao(6, 50)).toBe("em_dia");
  });

  it("vencida tem precedência sobre próxima", () => {
    expect(estadoRevisao(-1, 250)).toBe("vencida");
    expect(estadoRevisao(0, 250)).toBe("proxima");
  });

  it("sem intervalo não é 'em dia' — é 'sem intervalo'", () => {
    // A distinção importa na tela: "em dia" afirma algo que ninguém verificou.
    expect(estadoRevisao(null, null)).toBe("sem_intervalo");
    expect(estadoRevisao(10, null)).toBe("sem_intervalo");
  });

  it("tipo COM intervalo e peça sem leitura é 'sem leitura', não 'sem intervalo'", () => {
    // A PTA que acabou de ser cadastrada tem intervalo de 250 h definido no
    // tipo. Dizer "sem intervalo definido" nela seria o sistema mentindo sobre
    // a própria configuração — e mandando a pessoa procurar um campo que já
    // está preenchido.
    expect(estadoRevisao(null, 250)).toBe("sem_leitura");
  });
});

describe("apontamentoSchema", () => {
  const base = { unidade_id: "11111111-1111-4111-8111-111111111111", data: "2026-09-05" };

  it("aceita leitura com vírgula decimal", () => {
    // O horímetro mostra 1.234,5 e o teclado é brasileiro.
    const r = apontamentoSchema.safeParse({ ...base, leitura: "1234.5" });
    expect(r.success && r.data.leitura).toBe(1234.5);
  });

  it("aceita leitura zero", () => {
    // Horímetro novo marca zero. Recusar obrigaria a inventar 0,1.
    expect(apontamentoSchema.safeParse({ ...base, leitura: "0" }).success).toBe(true);
  });

  it("recusa leitura negativa", () => {
    expect(apontamentoSchema.safeParse({ ...base, leitura: "-5" }).success).toBe(false);
  });

  it("recusa leitura absurda", () => {
    // Dígito a mais na digitação. Sem o teto, uma leitura de 12.340.000 viraria
    // um "faltam -12 milhões de horas" que nenhuma tela sabe mostrar.
    expect(
      apontamentoSchema.safeParse({ ...base, leitura: "99999999" }).success,
    ).toBe(false);
  });

  it("recusa data fora do formato ISO", () => {
    const r = apontamentoSchema.safeParse({
      ...base,
      data: "05/09/2026",
      leitura: "10",
    });
    expect(r.success).toBe(false);
  });

  it("`reiniciado` nasce falso", () => {
    const r = apontamentoSchema.safeParse({ ...base, leitura: "10" });
    expect(r.success && r.data.reiniciado).toBe(false);
  });
});
