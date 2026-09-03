import { describe, it, expect } from "vitest";
import {
  TIPOS_DETENTOR,
  DETENTOR_INFO,
  descreverDetentor,
  diasDePosse,
  descreverPeriodo,
  montarLinhaDoTempo,
  moverPecaSchema,
  editarPecaSchema,
  type Posse,
} from "./custodia";

const UUID = "11111111-2222-4333-8444-555555555555";

function posse(over: Partial<Posse> = {}): Posse {
  return {
    id: UUID,
    tipo: "obra",
    obraRotulo: "800 — Administração",
    funcionarioNome: null,
    fornecedorNome: null,
    inicio: "2026-08-01",
    fim: null,
    origem: "manual",
    termoId: null,
    termoNumero: null,
    termoCancelado: false,
    observacoes: null,
    ...over,
  };
}

describe("DETENTOR_INFO", () => {
  it("cobre os quatro tipos, com rótulo acentuado", () => {
    for (const t of TIPOS_DETENTOR) {
      expect(DETENTOR_INFO[t].label.length).toBeGreaterThan(0);
    }
    expect(DETENTOR_INFO.almoxarifado.label).toBe("Almoxarifado central");
    expect(DETENTOR_INFO.fornecedor.label).toBe("Em manutenção");
  });
});

describe("descreverDetentor", () => {
  it("obra usa o rótulo da obra", () => {
    expect(descreverDetentor(posse())).toBe("800 — Administração");
  });

  it("almoxarifado não depende de vínculo nenhum", () => {
    expect(
      descreverDetentor(posse({ tipo: "almoxarifado", obraRotulo: null })),
    ).toBe("Almoxarifado central");
  });

  it("funcionário usa o nome", () => {
    expect(
      descreverDetentor(
        posse({ tipo: "funcionario", obraRotulo: null, funcionarioNome: "Fulano de Tal" }),
      ),
    ).toBe("Fulano de Tal");
  });

  it("fornecedor diz que é manutenção", () => {
    expect(
      descreverDetentor(
        posse({ tipo: "fornecedor", obraRotulo: null, fornecedorNome: "Mecânica Silva" }),
      ),
    ).toBe("Mecânica Silva (manutenção)");
  });

  it("vínculo apagado não vira string vazia", () => {
    // `on delete set null` nas três FK: apagar a obra não pode apagar a
    // história, e a tela não pode mostrar um espaço em branco no lugar dela.
    expect(descreverDetentor(posse({ obraRotulo: null }))).toBe("Obra não identificada");
  });
});

describe("diasDePosse", () => {
  it("posse fechada conta os dias de calendário", () => {
    expect(diasDePosse("2026-08-01", "2026-08-24", "2026-09-02")).toBe(23);
  });

  it("posse aberta conta até hoje", () => {
    expect(diasDePosse("2026-08-01", null, "2026-09-02")).toBe(32);
  });

  it("entrou e saiu no mesmo dia dá zero", () => {
    expect(diasDePosse("2026-09-02", "2026-09-02", "2026-09-02")).toBe(0);
  });

  it("atravessa a virada do ano sem erro de fuso", () => {
    // Aritmética em UTC: `inicio` e `fim` vêm de coluna `date`, não de instante.
    expect(diasDePosse("2025-12-31", "2026-01-01", "2026-09-02")).toBe(1);
  });

  it("fim anterior ao início nunca devolve negativo", () => {
    // O check do banco recusa, mas a leitura não pode produzir "-3 dias" se
    // algum dia entrar linha torta por outro caminho.
    expect(diasDePosse("2026-08-10", "2026-08-07", "2026-09-02")).toBe(0);
  });
});

describe("descreverPeriodo", () => {
  it("zero dia é 'menos de 1 dia', nunca '0 dias'", () => {
    // "0 dias" se lê como dado faltando. A peça esteve com alguém.
    expect(descreverPeriodo(0)).toBe("menos de 1 dia");
  });

  it("singular e plural de dia", () => {
    expect(descreverPeriodo(1)).toBe("1 dia");
    expect(descreverPeriodo(23)).toBe("23 dias");
  });

  it("a partir de um mês fala em meses", () => {
    expect(descreverPeriodo(30)).toBe("1 mês");
    expect(descreverPeriodo(75)).toBe("2 meses");
  });

  it("a partir de um ano fala em anos, com o resto em meses", () => {
    expect(descreverPeriodo(365)).toBe("1 ano");
    expect(descreverPeriodo(425)).toBe("1 ano e 2 meses");
    expect(descreverPeriodo(800)).toBe("2 anos e 2 meses");
  });
});

describe("montarLinhaDoTempo", () => {
  it("a posse aberta vem primeiro, e o resto da mais nova para a mais antiga", () => {
    const linha = montarLinhaDoTempo(
      [
        posse({ id: "a", inicio: "2026-06-01", fim: "2026-07-01" }),
        posse({ id: "b", inicio: "2026-08-01", fim: null }),
        posse({ id: "c", inicio: "2026-07-01", fim: "2026-08-01" }),
      ],
      "2026-09-02",
    );
    expect(linha.map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(linha[0].aberta).toBe(true);
  });

  it("calcula dias e período de cada posse", () => {
    const linha = montarLinhaDoTempo([posse({ inicio: "2026-08-01", fim: null })], "2026-09-02");
    expect(linha[0].dias).toBe(32);
    expect(linha[0].periodo).toBe("1 mês");
  });

  it("marca o período de termo cancelado", () => {
    // Documento anulado não some do histórico: "esteve com o Fulano" e "houve
    // um termo que não valeu" são fatos diferentes.
    const linha = montarLinhaDoTempo(
      [posse({ tipo: "funcionario", funcionarioNome: "Fulano", termoCancelado: true })],
      "2026-09-02",
    );
    expect(linha[0].anulada).toBe(true);
  });

  it("lista vazia devolve lista vazia, sem estourar", () => {
    expect(montarLinhaDoTempo([], "2026-09-02")).toEqual([]);
  });
});

describe("moverPecaSchema", () => {
  it("mover para obra exige a obra", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "obra",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Selecione a obra.");
  });

  it("mandar para manutenção exige o fornecedor", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "fornecedor",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Selecione o fornecedor.");
  });

  it("almoxarifado não exige vínculo nenhum", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "almoxarifado",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(true);
  });

  it("NÃO aceita mover para funcionário", () => {
    // Decisão de projeto no sistema de tipos: posse de pessoa nasce só por
    // termo assinado. Um caminho manual seria a segunda fonte de verdade.
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "funcionario",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("editarPecaSchema", () => {
  it("não tem obra nem situação", () => {
    // Editar não move. Um formulário de edição com `obra_id` dentro seria a
    // primeira porta a furar o livro de custódia.
    const chaves = Object.keys(editarPecaSchema.shape);
    expect(chaves).not.toContain("obra_id");
    expect(chaves).not.toContain("situacao");
  });

  it("aceita os campos de TI vazios", () => {
    const r = editarPecaSchema.safeParse({
      id: UUID,
      identificador: "PAT-0431",
      numero_serie: "",
      ano: "",
      estado: "",
      observacoes: "",
      imei: "",
      imei_2: "",
      linha_telefonica: "",
      operadora: "",
      service_tag: "",
      memoria_gb: "",
      configuracao: "",
    });
    expect(r.success).toBe(true);
  });

  it("recusa IMEI que não tenha 15 dígitos", () => {
    const r = editarPecaSchema.safeParse({
      id: UUID,
      identificador: "PAT-0431",
      numero_serie: "",
      ano: "",
      estado: "",
      observacoes: "",
      imei: "123",
      imei_2: "",
      linha_telefonica: "",
      operadora: "",
      service_tag: "",
      memoria_gb: "",
      configuracao: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("IMEI tem 15 dígitos.");
  });
});
