import { describe, it, expect } from "vitest";
import {
  SITUACOES,
  podeTransicionar,
  motivoBloqueio,
  transicoesManuais,
  transicoesDeDecisao,
  unidadeSchema,
  situacaoDaPosse,
  situacaoEhDeduzida,
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

  it("EM USO não pode ir para baixada nem perdida — nem por evento", () => {
    // É a linha que dá sentido a todas as outras: marcar "perdida" com a peça
    // em uso apagaria em silêncio o fato de alguém ter ASSINADO por ela.
    for (const destino of ["baixada", "perdida"] as const) {
      expect(podeTransicionar("em_uso", destino, "manual")).toBe(false);
      expect(podeTransicionar("em_uso", destino, "evento")).toBe(false);
    }
  });

  it("EM USO VAI para manutenção por evento — a máquina quebrou na obra", () => {
    // Depois da Task 3, `em_uso` também quer dizer "está em obra". Recusar
    // aqui obrigaria o almoxarife a passar pelo almoxarifado em dois passos
    // para mandar um compactador quebrado à oficina, e a mensagem que ele veria
    // falaria de encerrar um termo que não existe.
    expect(podeTransicionar("em_uso", "manutencao", "evento")).toBe(true);
    // À MÃO continua proibido: a situação não se digita.
    expect(podeTransicionar("em_uso", "manutencao", "manual")).toBe(false);
  });

  it("transição para a mesma situação é permitida — salvar sem mudar não é erro", () => {
    for (const s of SITUACOES) {
      expect(podeTransicionar(s, s, "manual")).toBe(true);
    }
  });

  it("manutenção VOLTA direto para em uso por evento — da oficina à obra", () => {
    // A peça consertada que volta para o canteiro é movimentação de verdade.
    // Obrigar a passar pelo almoxarifado antes registraria no livro uma parada
    // de zero dia que não houve, e a recusa que o usuário via falava de um
    // termo de responsabilidade que ele não tinha mencionado.
    expect(podeTransicionar("manutencao", "em_uso", "evento")).toBe(true);
    // À MÃO continua proibido: "em uso" não se digita.
    expect(podeTransicionar("manutencao", "em_uso", "manual")).toBe(false);
  });

  it("baixada e perdida não vão para lugar nenhum além de disponível", () => {
    for (const de of ["baixada", "perdida"] as const) {
      for (const para of ["em_uso", "manutencao"] as const) {
        expect(podeTransicionar(de, para, "manual")).toBe(false);
        expect(podeTransicionar(de, para, "evento")).toBe(false);
      }
    }
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

  it("diz o caminho de volta da peça baixada, e não fala de termo", () => {
    // A frase que aparecia era "«Em uso» é definido pelo termo de
    // responsabilidade" — sobre um termo que quem clicou não mencionou, e sem
    // nenhuma instrução que ele pudesse seguir.
    expect(motivoBloqueio("baixada", "em_uso")).toBe(
      "Esta peça está baixada. Traga-a de volta para “Disponível” no card “Situação da peça” antes de movimentá-la.",
    );
    expect(motivoBloqueio("perdida", "em_uso")).toBe(
      "Esta peça consta como perdida. Marque-a como “Disponível” no card “Situação da peça” antes de movimentá-la.",
    );
  });

  it("diz o caminho de volta da peça baixada, e não fala de termo", () => {
    // A frase que aparecia era "«Em uso» é definido pelo termo de
    // responsabilidade" — sobre um termo que quem clicou não mencionou, e sem
    // nenhuma instrução que ele pudesse seguir.
    expect(motivoBloqueio("baixada", "em_uso")).toBe(
      "Esta peça está baixada. Traga-a de volta para “Disponível” no card “Situação da peça” antes de movimentá-la.",
    );
    expect(motivoBloqueio("perdida", "em_uso")).toBe(
      "Esta peça consta como perdida. Marque-a como “Disponível” no card “Situação da peça” antes de movimentá-la.",
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

  it("manutenção oferece volta, baixa e perda", () => {
    expect(transicoesManuais("manutencao").sort()).toEqual(
      ["baixada", "disponivel", "manutencao", "perdida"].sort(),
    );
  });
});

describe("transicoesDeDecisao — o que o card de situação pode oferecer", () => {
  it("peça disponível não pode ser mandada para manutenção pelo card", () => {
    // Era o buraco que contradizia a fatia inteira: dois cliques e o cadastro
    // dizia "Em manutenção" com o livro dizendo "Almoxarifado central".
    // Manutenção é DEDUZIDA da posse no fornecedor, e quem a produz é o card
    // "Movimentar".
    expect(transicoesDeDecisao("disponivel").sort()).toEqual(
      ["baixada", "disponivel", "perdida"].sort(),
    );
  });

  it("de manutenção só saem as decisões — a volta é movimentação", () => {
    expect(transicoesDeDecisao("manutencao").sort()).toEqual(
      ["baixada", "manutencao", "perdida"].sort(),
    );
  });

  it("baixada e perdida mantêm a reversão para disponível", () => {
    // A exceção que a regra precisa ter: erro de digitação não se deduz de
    // posse nenhuma, e sem ela a peça baixada por engano ficaria presa.
    expect(transicoesDeDecisao("baixada").sort()).toEqual(
      ["baixada", "disponivel"].sort(),
    );
    expect(transicoesDeDecisao("perdida").sort()).toEqual(
      ["disponivel", "perdida"].sort(),
    );
  });

  it("nunca oferece uma situação deduzida como destino novo", () => {
    // SEM ISTO A REGRA ENVELHECE: uma transição manual nova para `em_uso` ou
    // `manutencao` entraria na matriz e voltaria a aparecer no card.
    for (const de of SITUACOES) {
      for (const para of transicoesDeDecisao(de)) {
        if (para === de) continue;
        const ehReversao = !situacaoEhDeduzida(de);
        expect(!situacaoEhDeduzida(para) || ehReversao).toBe(true);
      }
    }
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

describe("situacaoDaPosse", () => {
  it("sem posse aberta, a peça está disponível", () => {
    expect(situacaoDaPosse(null)).toBe("disponivel");
  });

  it("no almoxarifado a peça está disponível — é lá que ela espera", () => {
    expect(situacaoDaPosse("almoxarifado")).toBe("disponivel");
  });

  it("com pessoa ou em obra, está em uso", () => {
    expect(situacaoDaPosse("funcionario")).toBe("em_uso");
    expect(situacaoDaPosse("obra")).toBe("em_uso");
  });

  it("em fornecedor, está em manutenção", () => {
    // O destino se chama "Manutenção em fornecedor", e `moverPeca` já gravava
    // `manutencao` para ele desde antes desta função existir.
    expect(situacaoDaPosse("fornecedor")).toBe("manutencao");
  });
});

describe("situacaoEhDeduzida", () => {
  it("disponivel, em_uso e manutencao saem da posse", () => {
    expect(situacaoEhDeduzida("disponivel")).toBe(true);
    expect(situacaoEhDeduzida("em_uso")).toBe(true);
    expect(situacaoEhDeduzida("manutencao")).toBe(true);
  });

  it("baixada e perdida são decisão humana", () => {
    // Não se deduzem de posse nenhuma: uma peça baixada pode estar em qualquer
    // lugar, e uma perdida não está em lugar que se saiba.
    expect(situacaoEhDeduzida("baixada")).toBe(false);
    expect(situacaoEhDeduzida("perdida")).toBe(false);
  });

  it("cobre todas as situações que existem", () => {
    // SEM ISTO O TESTE ENVELHECE EM SILÊNCIO: uma situação nova entraria em
    // SITUACOES e ninguém decidiria se ela é deduzida ou escolhida.
    for (const s of SITUACOES) {
      expect(typeof situacaoEhDeduzida(s)).toBe("boolean");
    }
    expect(SITUACOES.length).toBe(5);
  });
});
