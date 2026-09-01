import { describe, it, expect } from "vitest";
import {
  SITUACOES,
  podeTransicionar,
  motivoBloqueio,
  transicoesManuais,
  unidadeSchema,
} from "./frota";

describe("podeTransicionar — a matriz inteira", () => {
  it("disponível → em uso é SÓ por evento, nunca à mão", () => {
    // O termo assinado é o evento. À mão, marcar "em uso" registraria posse
    // sem ninguém ter assinado por ela.
    expect(podeTransicionar("disponivel", "em_uso", "manual")).toBe(false);
    expect(podeTransicionar("disponivel", "em_uso", "evento")).toBe(true);
  });

  it("em uso → disponível é SÓ por evento", () => {
    expect(podeTransicionar("em_uso", "disponivel", "manual")).toBe(false);
    expect(podeTransicionar("em_uso", "disponivel", "evento")).toBe(true);
  });

  it("disponível → manutenção, baixada e perdida são à mão", () => {
    expect(podeTransicionar("disponivel", "manutencao", "manual")).toBe(true);
    expect(podeTransicionar("disponivel", "baixada", "manual")).toBe(true);
    expect(podeTransicionar("disponivel", "perdida", "manual")).toBe(true);
  });

  it("manutenção volta para disponível ou é baixada", () => {
    expect(podeTransicionar("manutencao", "disponivel", "manual")).toBe(true);
    expect(podeTransicionar("manutencao", "baixada", "manual")).toBe(true);
  });

  it("baixada e perdida podem voltar a disponível — reversão de erro", () => {
    expect(podeTransicionar("baixada", "disponivel", "manual")).toBe(true);
    expect(podeTransicionar("perdida", "disponivel", "manual")).toBe(true);
  });

  it("EM USO não pode ir para manutenção, baixada nem perdida — nem por evento", () => {
    // É a linha que dá sentido a todas as outras: marcar "perdida" com a peça
    // em uso apagaria em silêncio o fato de alguém ter ASSINADO por ela.
    for (const destino of ["manutencao", "baixada", "perdida"] as const) {
      expect(podeTransicionar("em_uso", destino, "manual")).toBe(false);
      expect(podeTransicionar("em_uso", destino, "evento")).toBe(false);
    }
  });

  it("transição para a mesma situação é permitida — salvar sem mudar não é erro", () => {
    for (const s of SITUACOES) {
      expect(podeTransicionar(s, s, "manual")).toBe(true);
    }
  });

  it("manutenção não pula direto para em uso", () => {
    // Peça em manutenção precisa passar por disponível: é onde alguém confere
    // que ela voltou inteira.
    expect(podeTransicionar("manutencao", "em_uso", "evento")).toBe(false);
    expect(podeTransicionar("manutencao", "em_uso", "manual")).toBe(false);
  });
});

describe("motivoBloqueio", () => {
  it("explica a linha que bloqueia peça em uso", () => {
    expect(motivoBloqueio("em_uso", "baixada")).toBe(
      "A peça está em uso. Encerre o termo de responsabilidade antes de baixá-la.",
    );
  });

  it("explica que em uso depende de evento", () => {
    expect(motivoBloqueio("disponivel", "em_uso")).toBe(
      "“Em uso” é definido pelo termo de responsabilidade, não à mão.",
    );
  });

  it("é null quando a transição é permitida", () => {
    expect(motivoBloqueio("disponivel", "manutencao")).toBeNull();
  });
});

describe("transicoesManuais", () => {
  it("lista só os destinos que o formulário pode oferecer", () => {
    expect(transicoesManuais("disponivel").sort()).toEqual(
      ["baixada", "disponivel", "manutencao", "perdida"].sort(),
    );
  });

  it("peça em uso não oferece nenhuma mudança manual além de si mesma", () => {
    expect(transicoesManuais("em_uso")).toEqual(["em_uso"]);
  });

  it("manutenção oferece volta e baixa", () => {
    expect(transicoesManuais("manutencao").sort()).toEqual(
      ["baixada", "disponivel", "manutencao"].sort(),
    );
  });
});

describe("unidadeSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("aceita o mínimo: item e patrimônio", () => {
    const r = unidadeSchema.safeParse({
      item_id: UUID,
      identificador: "PAT-0431",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Nenhum campo novo é obrigatório: peça vale a pena com patrimônio só.
      expect(r.data.propriedade).toBe("locada");
      expect(r.data.situacao).toBe("disponivel");
      expect(r.data.obra_id).toBeNull();
      expect(r.data.numero_serie).toBeNull();
      expect(r.data.ano).toBeNull();
      expect(r.data.estado).toBeNull();
    }
  });

  it("string vazia vira NULL — 'sem observação' não é observação vazia", () => {
    const r = unidadeSchema.safeParse({
      item_id: UUID,
      identificador: "PAT-1",
      observacoes: "",
      numero_serie: "",
      obra_id: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.observacoes).toBeNull();
      expect(r.data.numero_serie).toBeNull();
      expect(r.data.obra_id).toBeNull();
    }
  });

  it("recusa patrimônio em branco", () => {
    expect(
      unidadeSchema.safeParse({ item_id: UUID, identificador: "  " }).success,
    ).toBe(false);
  });

  it("recusa ano fora da faixa do check do banco", () => {
    const base = { item_id: UUID, identificador: "PAT-1" };
    expect(unidadeSchema.safeParse({ ...base, ano: "1949" }).success).toBe(false);
    expect(unidadeSchema.safeParse({ ...base, ano: "2101" }).success).toBe(false);
    expect(unidadeSchema.safeParse({ ...base, ano: "2026" }).success).toBe(true);
  });

  it("recusa situação e propriedade fora do check", () => {
    const base = { item_id: UUID, identificador: "PAT-1" };
    expect(unidadeSchema.safeParse({ ...base, situacao: "sumida" }).success).toBe(false);
    expect(unidadeSchema.safeParse({ ...base, propriedade: "alugada" }).success).toBe(
      false,
    );
  });

  it("aceita o próprio output — a action revalida o que o resolver transformou", () => {
    const primeira = unidadeSchema.parse({
      item_id: UUID,
      identificador: "PAT-0431",
      obra_id: UUID,
      ano: "2026",
      estado: "bom",
    });
    const r = unidadeSchema.safeParse(primeira);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(primeira);
  });
});
