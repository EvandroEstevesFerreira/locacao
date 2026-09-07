import { describe, it, expect } from "vitest";
import {
  estadoCertificado,
  venceEmProposto,
  exigenciasSchema,
  certificadoSchema,
  ESPECIES_CERTIFICADO,
  ESPECIE_INFO,
  ESTADO_CERTIFICADO_INFO,
  piorPorPeca,
  candidatosDeCertificado,
  type LinhaPendencia,
} from "./certificado";

describe("estadoCertificado", () => {
  it("ausente quando não há certificado nenhum", () => {
    // É o caso que a fatia existe para tornar visível: a exigência que
    // ninguém cumpriu nunca não tem data para comparar.
    expect(estadoCertificado(null, "2026-09-06")).toBe("ausente");
  });

  it("o dia do vencimento ainda vale", () => {
    // Um certificado que vence hoje vale hoje. Marcá-lo como vencido tiraria
    // de operação uma máquina que está legal — e faria a pessoa desconfiar do
    // sistema justamente no aviso que ela precisa levar a sério.
    expect(estadoCertificado("2026-09-06", "2026-09-06")).toBe("proximo");
  });

  it("vencido no dia seguinte", () => {
    expect(estadoCertificado("2026-09-05", "2026-09-06")).toBe("vencido");
  });

  it("próximo dentro da janela de aviso", () => {
    expect(estadoCertificado("2026-10-05", "2026-09-06", 30)).toBe("proximo");
  });

  it("em dia fora da janela de aviso", () => {
    expect(estadoCertificado("2026-10-07", "2026-09-06", 30)).toBe("em_dia");
  });

  it("a janela é parâmetro, não constante", () => {
    // A organização já configura os prazos em `config_alerta.dias_alerta`;
    // fixar 30 aqui faria a tela discordar do e-mail.
    expect(estadoCertificado("2026-09-20", "2026-09-06", 7)).toBe("em_dia");
    expect(estadoCertificado("2026-09-20", "2026-09-06", 60)).toBe("proximo");
  });

  it("compara datas ISO sem passar por fuso", () => {
    // A comparação é lexicográfica de `yyyy-mm-dd`, que é a mesma que a
    // cronológica. Virar `Date` traria de volta o bug de UTC que já cobrou um
    // dia extra de multa na 0.22.0.
    expect(estadoCertificado("2026-12-31", "2027-01-01")).toBe("vencido");
    expect(estadoCertificado("2027-01-01", "2026-12-31", 1)).toBe("proximo");
  });
});

describe("venceEmProposto", () => {
  it("soma a periodicidade em meses", () => {
    expect(venceEmProposto("2026-03-10", 12)).toBe("2027-03-10");
  });

  it("31 de janeiro mais um mês não vira 3 de março", () => {
    // `new Date(2026,0,31)` mais um mês, feito à mão, estoura para março.
    // Satura no último dia de fevereiro.
    expect(venceEmProposto("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("não atravessa o fuso", () => {
    // O erro clássico: `new Date("2026-03-10")` é meia-noite UTC, que em São
    // Paulo é dia 9. A proposta sairia um dia adiantada, todo dia.
    expect(venceEmProposto("2026-03-01", 12)).toBe("2027-03-01");
    expect(venceEmProposto("2026-01-01", 6)).toBe("2026-07-01");
  });

  it("sem periodicidade não propõe nada", () => {
    expect(venceEmProposto("2026-03-10", null)).toBeNull();
  });

  it("periodicidade zero ou negativa não propõe nada", () => {
    expect(venceEmProposto("2026-03-10", 0)).toBeNull();
    expect(venceEmProposto("2026-03-10", -12)).toBeNull();
  });

  it("data de emissão inválida não propõe nada", () => {
    expect(venceEmProposto("", 12)).toBeNull();
    expect(venceEmProposto("10/03/2026", 12)).toBeNull();
  });
});

describe("exigenciasSchema", () => {
  it("aceita uma lista bem formada", () => {
    const r = exigenciasSchema.safeParse([
      { especie: "inspecao_periodica", periodicidade_meses: 12 },
      { especie: "art", periodicidade_meses: null },
    ]);
    expect(r.success).toBe(true);
  });

  it("recusa a mesma espécie duas vezes", () => {
    // Duas linhas de PMOC no mesmo tipo fariam a view devolver a peça
    // duplicada, e o alerta sair em dobro.
    const r = exigenciasSchema.safeParse([
      { especie: "pmoc", periodicidade_meses: 12 },
      { especie: "pmoc", periodicidade_meses: 6 },
    ]);
    expect(r.success).toBe(false);
  });

  it("recusa espécie fora do vocabulário", () => {
    const r = exigenciasSchema.safeParse([
      { especie: "inspecao_do_chefe", periodicidade_meses: 12 },
    ]);
    expect(r.success).toBe(false);
  });

  it("é idempotente", () => {
    // `parse(parse(x))` tem de dar `parse(x)` — a varredura de schemas do
    // projeto exige, e um `transform` descuidado quebra isso em silêncio.
    const entrada = [{ especie: "pmoc", periodicidade_meses: "12" }];
    const uma = exigenciasSchema.parse(entrada);
    expect(exigenciasSchema.parse(uma)).toEqual(uma);
  });
});

describe("certificadoSchema", () => {
  const base = {
    unidade_id: "3f8b1c2e-9d4a-4c6b-8e1f-2a7d5c9b0e34",
    especie: "pmoc",
    emitido_em: "2026-03-10",
    vence_em: "2027-03-10",
    numero: "",
    responsavel: "",
    observacoes: "",
  };

  it("aceita o caso completo", () => {
    expect(certificadoSchema.safeParse(base).success).toBe(true);
  });

  it("exige o vencimento", () => {
    const r = certificadoSchema.safeParse({ ...base, vence_em: "" });
    expect(r.success).toBe(false);
  });

  it("dispensa a emissão", () => {
    // Laudo antigo às vezes chega só com a validade legível.
    const r = certificadoSchema.safeParse({ ...base, emitido_em: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.emitido_em).toBeNull();
  });

  it("recusa vencimento anterior à emissão", () => {
    // Mesma trava do banco. Aqui ela vira mensagem na tela em vez de erro 500.
    const r = certificadoSchema.safeParse({
      ...base,
      emitido_em: "2026-05-01",
      vence_em: "2026-04-01",
    });
    expect(r.success).toBe(false);
  });

  it("é idempotente", () => {
    const uma = certificadoSchema.parse(base);
    expect(certificadoSchema.parse(uma)).toEqual(uma);
  });
});

describe("vocabulário", () => {
  it("toda espécie tem rótulo e ajuda", () => {
    for (const e of ESPECIES_CERTIFICADO) {
      expect(ESPECIE_INFO[e].label.length).toBeGreaterThan(0);
      expect(ESPECIE_INFO[e].ajuda.length).toBeGreaterThan(0);
    }
  });

  it("todo estado tem rótulo", () => {
    for (const e of ["ausente", "vencido", "proximo", "em_dia"] as const) {
      expect(ESTADO_CERTIFICADO_INFO[e].label.length).toBeGreaterThan(0);
    }
  });
});

describe("piorPorPeca", () => {
  it("o selo da peça é o do problema mais grave", () => {
    // Uma PTA com a inspeção em dia e o teste de carga ausente não pode
    // aparecer como "em dia" — seria a tela dizendo que está tudo bem numa
    // máquina que não pode subir.
    const pior = piorPorPeca([
      { unidadeId: "pta", estado: "em_dia" as const },
      { unidadeId: "pta", estado: "ausente" as const },
      { unidadeId: "pta", estado: "proximo" as const },
    ]);
    expect(pior.get("pta")).toBe("ausente");
  });

  it("vencido perde para ausente", () => {
    const pior = piorPorPeca([
      { unidadeId: "x", estado: "vencido" as const },
      { unidadeId: "x", estado: "ausente" as const },
    ]);
    expect(pior.get("x")).toBe("ausente");
  });

  it("peça sem pendência não entra no mapa", () => {
    const pior = piorPorPeca([{ unidadeId: "a", estado: "em_dia" as const }]);
    expect(pior.has("b")).toBe(false);
    expect(pior.get("a")).toBe("em_dia");
  });
});

describe("candidatosDeCertificado", () => {
  const janela = { hoje: "2026-09-06", limite: "2026-10-06", mesRef: "2026-09-01" };
  const base: LinhaPendencia = {
    unidade_id: "u1",
    identificador: "PTA-0007",
    obra_id: "obra-1",
    modelo: "Genie GS-1932",
    tipo: "PTA",
    especie: "inspecao_periodica",
    certificado_id: "c1",
    vence_em: "2026-09-20",
  };

  it("o que vence dentro da janela referencia o CERTIFICADO", () => {
    // Renovado, o próximo certificado tem id novo — e é assim que a dedupe do
    // notificacao_log deixa o aviso sair de novo no ano seguinte. Referenciar a
    // peça faria o segundo aviso ser descartado como repetido, para sempre.
    const [c] = candidatosDeCertificado([base], janela);
    expect(c.tipo).toBe("certificado_vence");
    expect(c.referencia_id).toBe("c1");
    expect(c.dias).toBeNull();
    expect(c.categoria).toBe("Certificado — Inspeção periódica");
    expect(c.descricao).toBe("PTA-0007 — Genie GS-1932");
  });

  it("o ausente referencia a PEÇA e vem com marco fixo", () => {
    const [c] = candidatosDeCertificado(
      [{ ...base, vence_em: null, certificado_id: null }],
      janela,
    );
    expect(c.tipo).toBe("certificado_ausente:inspecao_periodica");
    expect(c.referencia_id).toBe("u1");
    expect(c.dias).toBe(0);
    expect(c.data_referencia).toBe("2026-09-01");
    expect(c.data).toBe("—");
  });

  it("duas exigências ausentes na mesma peça são dois avisos distintos", () => {
    // Com uma chave só, a dedupe do notificacao_log descartaria a segunda como
    // repetida — e a peça ficaria avisando de uma exigência e calada na outra.
    const cs = candidatosDeCertificado(
      [
        { ...base, vence_em: null, certificado_id: null, especie: "inspecao_periodica" },
        { ...base, vence_em: null, certificado_id: null, especie: "teste_carga" },
      ],
      janela,
    );
    expect(cs).toHaveLength(2);
    expect(new Set(cs.map((c) => c.tipo)).size).toBe(2);
  });

  it("fora da janela não vira candidato", () => {
    expect(candidatosDeCertificado([{ ...base, vence_em: "2027-01-01" }], janela)).toEqual([]);
  });

  it("o vencido não insiste por e-mail", () => {
    // Ele já foi avisado quando estava vencendo. Repetir todo dia até alguém
    // agir é como um alerta deixa de ser lido. A tela mostra; o e-mail não.
    expect(candidatosDeCertificado([{ ...base, vence_em: "2026-08-01" }], janela)).toEqual([]);
  });

  it("o dia de hoje ainda está na janela", () => {
    const cs = candidatosDeCertificado([{ ...base, vence_em: "2026-09-06" }], janela);
    expect(cs).toHaveLength(1);
  });

  it("peça sem obra não quebra o candidato", () => {
    // `equipamento_unidade.obra_id` é nulável: peça no estoque central.
    const [c] = candidatosDeCertificado([{ ...base, obra_id: null }], janela);
    expect(c.obra_id).toBeNull();
  });
});
