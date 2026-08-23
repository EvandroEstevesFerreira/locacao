import { describe, it, expect } from "vitest";
import {
  medidaDisciplinarSchema,
  entregaOcupanteSchema,
  fechamentoLimpezaSchema,
  tarefaLimpezaSchema,
  segundaFeiraDaSemana,
  rotuloSemana,
  AVALIACOES,
  FREQUENCIAS,
} from "./alojamento";
import { TAREFAS } from "./documentos/frm-rh-005";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

const medida = {
  ocupante_id: UUID_A,
  imovel_id: UUID_B,
  data: "2026-08-22",
  tipo: "escrita" as const,
  fato_descricao: "Descumpriu o horário de silêncio pela segunda vez no mês.",
};

describe("medidaDisciplinarSchema", () => {
  it("aceita uma advertência escrita completa", () => {
    expect(medidaDisciplinarSchema.safeParse(medida).success).toBe(true);
  });

  it("exige descrição do fato com substância", () => {
    const r = medidaDisciplinarSchema.safeParse({ ...medida, fato_descricao: "brigou" });
    expect(r.success).toBe(false);
  });

  it("recusa suspensão acima de 30 dias (CLT, art. 474)", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 31,
      suspensao_inicio: "2026-08-25",
    });
    expect(r.success).toBe(false);
  });

  it("aceita suspensão de 30 dias", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 30,
      suspensao_inicio: "2026-08-25",
    });
    expect(r.success).toBe(true);
  });

  it("suspensão sem data de início é recusada", () => {
    const r = medidaDisciplinarSchema.safeParse({
      ...medida,
      tipo: "suspensao",
      suspensao_dias: 3,
    });
    expect(r.success).toBe(false);
  });

  it("advertência verbal não exige dias de suspensão", () => {
    const r = medidaDisciplinarSchema.safeParse({ ...medida, tipo: "verbal" });
    expect(r.success).toBe(true);
  });

  it("campo de texto vazio vira null", () => {
    const r = medidaDisciplinarSchema.parse({ ...medida, fato_local: "  " });
    expect(r.fato_local).toBeNull();
  });
});

const entrega = {
  ocupante_id: UUID_A,
  imovel_id: UUID_B,
  tipo: "chaves" as const,
  entregue_em: "2026-08-01",
};

describe("entregaOcupanteSchema", () => {
  it("aceita uma entrega simples", () => {
    expect(entregaOcupanteSchema.safeParse(entrega).success).toBe(true);
  });

  it("exige ao menos uma das duas datas", () => {
    const r = entregaOcupanteSchema.safeParse({ ...entrega, entregue_em: "" });
    expect(r.success).toBe(false);
  });

  it("recusa devolução anterior à entrega", () => {
    const r = entregaOcupanteSchema.safeParse({
      ...entrega,
      devolvido_em: "2026-07-01",
      tratativa: "sem_ressalva",
    });
    expect(r.success).toBe(false);
  });

  it("devolução sem tratativa é recusada", () => {
    const r = entregaOcupanteSchema.safeParse({ ...entrega, devolvido_em: "2026-09-01" });
    expect(r.success).toBe(false);
  });

  it("devolução com tratativa passa", () => {
    const r = entregaOcupanteSchema.safeParse({
      ...entrega,
      devolvido_em: "2026-09-01",
      tratativa: "desgaste_natural",
    });
    expect(r.success).toBe(true);
  });
});

describe("segundaFeiraDaSemana", () => {
  it("uma segunda devolve ela mesma", () => {
    expect(segundaFeiraDaSemana("2026-08-17")).toBe("2026-08-17");
  });

  it("meio de semana recua até a segunda", () => {
    expect(segundaFeiraDaSemana("2026-08-20")).toBe("2026-08-17");
  });

  it("sábado pertence à semana que já começou", () => {
    expect(segundaFeiraDaSemana("2026-08-22")).toBe("2026-08-17");
  });

  it("DOMINGO recua seis dias, não avança um", () => {
    // O caso que quebra em quase toda implementação ingênua: getUTCDay() = 0.
    expect(segundaFeiraDaSemana("2026-08-23")).toBe("2026-08-17");
  });

  it("atravessa a virada de mês", () => {
    expect(segundaFeiraDaSemana("2026-09-02")).toBe("2026-08-31");
  });

  it("atravessa a virada de ano", () => {
    expect(segundaFeiraDaSemana("2027-01-01")).toBe("2026-12-28");
  });
});

describe("rotuloSemana", () => {
  it("mostra o intervalo de segunda a domingo", () => {
    expect(rotuloSemana("2026-08-17")).toBe("17/08 a 23/08");
  });

  it("atravessa a virada de mês", () => {
    expect(rotuloSemana("2026-08-31")).toBe("31/08 a 06/09");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Fechamento da semana e catálogo de tarefas
// ═══════════════════════════════════════════════════════════════════════════

describe("fechamentoLimpezaSchema", () => {
  it("aceita a semana ainda não conferida, com os três campos vazios", () => {
    const r = fechamentoLimpezaSchema.parse({
      id: UUID_A,
      imovel_id: UUID_B,
      auxiliar_nome: "",
      avaliacao: "",
      observacoes: "",
    });
    expect(r.auxiliar_nome).toBeNull();
    expect(r.avaliacao).toBeNull();
    expect(r.observacoes).toBeNull();
  });

  it("recusa avaliação fora das três do check do banco", () => {
    // O `check (avaliacao in (...))` da migration 0045 recusaria também, mas
    // como erro de banco: mensagem técnica no lugar da explicação.
    const r = fechamentoLimpezaSchema.safeParse({
      id: UUID_A,
      imovel_id: UUID_B,
      avaliacao: "excelente",
    });
    expect(r.success).toBe(false);
  });

  it("aceita as três avaliações previstas", () => {
    for (const a of AVALIACOES) {
      const r = fechamentoLimpezaSchema.parse({
        id: UUID_A,
        imovel_id: UUID_B,
        avaliacao: a,
      });
      expect(r.avaliacao).toBe(a);
    }
  });
});

describe("tarefaLimpezaSchema", () => {
  it("põe o ambiente em maiúsculas", () => {
    // Sem isto, "Banheiros" e "BANHEIROS" viram dois ambientes distintos e a
    // folha impressa sai com a mesma faixa repetida.
    const r = tarefaLimpezaSchema.parse({
      grupo: " Banheiros ",
      descricao: "Lavar piso com desinfetante",
      frequencia: "D",
    });
    expect(r.grupo).toBe("BANHEIROS");
  });

  it("ordem em branco vira 0 — o sinal de 'joga no fim do grupo'", () => {
    const r = tarefaLimpezaSchema.parse({
      grupo: "COZINHA",
      descricao: "Limpar fogão",
      frequencia: "S",
      ordem: "",
    });
    expect(r.ordem).toBe(0);
  });

  it("recusa frequência que a folha não sabe imprimir", () => {
    const r = tarefaLimpezaSchema.safeParse({
      grupo: "COZINHA",
      descricao: "Limpar fogão",
      frequencia: "Q",
    });
    expect(r.success).toBe(false);
  });
});

describe("catálogo embutido e o schema do catálogo", () => {
  it("as 44 tarefas do FRM-RH-005 passam pelo schema da tela", () => {
    // A semeadura insere o array embutido direto no banco. Se uma delas não
    // passasse pelo schema, ela existiria no catálogo e seria impossível
    // reeditá-la pela tela de Configurações — só apagando.
    for (const t of TAREFAS) {
      const r = tarefaLimpezaSchema.safeParse({
        grupo: t.grupo,
        descricao: t.descricao,
        frequencia: t.frequencia,
      });
      const detalhe = r.success ? "" : `${t.descricao}: ${r.error.issues[0].message}`;
      expect(r.success, detalhe).toBe(true);
    }
  });

  it("toda frequência embutida é uma das três do catálogo", () => {
    for (const t of TAREFAS) {
      expect(FREQUENCIAS).toContain(t.frequencia);
    }
  });
});
