import { describe, expect, it } from "vitest";
import { donoDaPeca, linhasElegiveis, type LinhaEmAberto } from "./frota";

const linha = (n: string, forn: string | null = "A2 WORKS"): LinhaEmAberto => ({
  itemLocadoId: `il-${n}`,
  contratoId: `ct-${n}`,
  contratoNumero: n,
  fornecedorNome: forn,
});

describe("donoDaPeca", () => {
  it("sem contrato e sem provisório, não há dono a mostrar", () => {
    expect(donoDaPeca({ linhasEmAberto: [], fornecedorProvisorio: null })).toEqual({
      origem: "nenhum",
    });
  });

  it("sem contrato, o provisório aparece — e marcado como tal", () => {
    expect(
      donoDaPeca({ linhasEmAberto: [], fornecedorProvisorio: "CONEXAO MONTAGENS" }),
    ).toEqual({ origem: "provisorio", nome: "CONEXAO MONTAGENS" });
  });

  it("o contrato MANDA sobre o provisório", () => {
    // O defeito que esta função existe para impedir: duas fontes sobre quem é o
    // dono de um equipamento, divergindo em silêncio. Divergência sobre isso
    // aparece como cobrança errada.
    expect(
      donoDaPeca({
        linhasEmAberto: [linha("CT-2026-001")],
        fornecedorProvisorio: "CONEXAO MONTAGENS",
      }),
    ).toEqual({
      origem: "contrato",
      nome: "A2 WORKS",
      contratoId: "ct-CT-2026-001",
      contratoNumero: "CT-2026-001",
    });
  });

  it("duas linhas em aberto dão AMBÍGUO, e não a primeira", () => {
    // Não existe trava no banco impedindo isso (a 0049 criou índice comum, não
    // único). Escolher a primeira produziria tela plausível e errada.
    const r = donoDaPeca({
      linhasEmAberto: [linha("CT-A"), linha("CT-B", "OUTRA EMPRESA")],
      fornecedorProvisorio: null,
    });
    expect(r.origem).toBe("ambiguo");
    if (r.origem === "ambiguo") {
      expect(r.contratos.map((c) => c.contratoNumero)).toEqual(["CT-A", "CT-B"]);
    }
  });

  it("contrato sem fornecedor cadastrado não vira “dono desconhecido” calado", () => {
    const r = donoDaPeca({
      linhasEmAberto: [linha("CT-2026-001", null)],
      fornecedorProvisorio: null,
    });
    expect(r).toEqual({
      origem: "contrato-sem-fornecedor",
      contratoId: "ct-CT-2026-001",
      contratoNumero: "CT-2026-001",
    });
  });

  it("provisório em branco conta como ausente", () => {
    expect(donoDaPeca({ linhasEmAberto: [], fornecedorProvisorio: "   " })).toEqual({
      origem: "nenhum",
    });
  });
});

describe("linhasElegiveis", () => {
  const peca = { itemId: "item-thinkstation" };
  const base = {
    id: "il-1",
    contratoId: "ct-1",
    itemId: "item-thinkstation",
    status: "em_aberto" as const,
    unidadeId: null as string | null,
  };

  it("serve a linha do mesmo item, em aberto e sem peça", () => {
    expect(linhasElegiveis([base], peca).map((l) => l.id)).toEqual(["il-1"]);
  });

  it("recusa linha de OUTRO item do catálogo", () => {
    // Amarrar uma workstation à linha de uma betoneira faria o contrato cobrar
    // uma coisa e a frota mostrar outra.
    expect(linhasElegiveis([{ ...base, itemId: "item-betoneira" }], peca)).toEqual([]);
  });

  it("recusa linha já devolvida", () => {
    expect(linhasElegiveis([{ ...base, status: "devolvido" }], peca)).toEqual([]);
  });

  it("recusa linha que já tem peça vinculada", () => {
    expect(linhasElegiveis([{ ...base, unidadeId: "outra-peca" }], peca)).toEqual([]);
  });

  it("a linha da PRÓPRIA peça continua elegível — reamarrar não é erro", () => {
    expect(
      linhasElegiveis([{ ...base, unidadeId: "esta-peca" }], {
        ...peca,
        id: "esta-peca",
      }).map((l) => l.id),
    ).toEqual(["il-1"]);
  });
});
