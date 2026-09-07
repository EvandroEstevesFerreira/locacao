import { describe, it, expect } from "vitest";
import { pessoaPeopleSchema, type PessoaPeople } from "./contrato";
import {
  ehAtivo,
  resolverObra,
  normalizarEmail,
  mapearPessoa,
  proximoCursor,
  semRepetidas,
  precisaVarreduraCompleta,
  ausentesNaVarredura,
} from "./mapeamento";

const ORG = "aaaaaaaa-1111-4222-8333-444444444444";
const AGORA = "2026-09-07T13:00:00.000Z";

/** O exemplo LITERAL do contrato, copiado do documento do People. */
const EXEMPLO = {
  id: "3f9c1e2a-7b44-4d18-9a05-2c6e8f1b0d33",
  nome: "Fulano de Tal Silva",
  cpf: "12345678901",
  matricula: "4066",
  cargo: "Eletricista",
  email: "fulano@sistenge.com",
  telefone: "11987654321",
  vinculo: "clt",
  situacao: "ativo",
  admissao: "2025-03-10",
  desligamento: null,
  centro_custo: { codigo: "605", nome: "Unimed Maceió" },
  atualizado_em: "2026-09-06T14:22:31.412Z",
};

function pessoa(over: Partial<PessoaPeople> = {}): PessoaPeople {
  return { ...(EXEMPLO as PessoaPeople), ...over };
}

const DE_PARA = new Map([["605", "obra-unimed"], ["691", "obra-outra"]]);

describe("o contrato", () => {
  it("aceita o exemplo do documento tal como está escrito", () => {
    // Se este teste quebrar, o contrato mudou e o documento é a fonte.
    expect(pessoaPeopleSchema.safeParse(EXEMPLO).success).toBe(true);
  });

  it("aceita nulo em tudo que o contrato admite nulo", () => {
    const magra = pessoaPeopleSchema.safeParse({
      ...EXEMPLO,
      cpf: null,
      matricula: null,
      cargo: null,
      email: null,
      telefone: null,
      admissao: null,
      desligamento: null,
      centro_custo: null,
    });
    expect(magra.success).toBe(true);
  });

  it("recusa vínculo e situação fora dos enums", () => {
    expect(pessoaPeopleSchema.safeParse({ ...EXEMPLO, vinculo: "terceiro" }).success)
      .toBe(false);
    expect(pessoaPeopleSchema.safeParse({ ...EXEMPLO, situacao: "ferias" }).success)
      .toBe(false);
  });

  it("recusa campo OMITIDO, e não só nulo", () => {
    // O contrato promete `null` explícito, nunca ausência. Aceitar o campo
    // faltando esconderia exatamente a mudança de payload que a validação
    // existe para pegar.
    const semCpf: Record<string, unknown> = { ...EXEMPLO };
    delete semCpf.cpf;
    expect(pessoaPeopleSchema.safeParse(semCpf).success).toBe(false);
  });
});

describe("ehAtivo", () => {
  it("afastado conta como ativo", () => {
    // Quem está de licença continua respondendo pelo notebook que levou para
    // casa. Virar `false` o tiraria da lista de quem pode receber termo.
    expect(ehAtivo("afastado")).toBe(true);
    expect(ehAtivo("ativo")).toBe(true);
  });

  it("desligado não", () => {
    expect(ehAtivo("desligado")).toBe(false);
  });
});

describe("resolverObra", () => {
  it("casa pelo código do centro de resultado", () => {
    expect(resolverObra({ codigo: "605" }, DE_PARA)).toBe("obra-unimed");
  });

  it("código sem de-para vira NULO, nunca um chute", () => {
    // Chutar por semelhança colocaria equipamento na obra errada, e o erro só
    // apareceria numa cobrança.
    expect(resolverObra({ codigo: "999" }, DE_PARA)).toBeNull();
  });

  it("sem centro de custo, nulo", () => {
    expect(resolverObra(null, DE_PARA)).toBeNull();
  });

  it("ignora espaço em volta do código", () => {
    expect(resolverObra({ codigo: " 605 " }, DE_PARA)).toBe("obra-unimed");
  });
});

describe("normalizarEmail", () => {
  it("baixa a caixa, porque o índice único compara por lower()", () => {
    expect(normalizarEmail("Fulano@Sistenge.com")).toBe("fulano@sistenge.com");
  });

  it("string vazia vira nulo", () => {
    // O índice de e-mail é parcial para permitir muitas pessoas sem endereço.
    // Dois `""` colidiriam nele.
    expect(normalizarEmail("")).toBeNull();
    expect(normalizarEmail("   ")).toBeNull();
  });

  it("nulo continua nulo", () => {
    expect(normalizarEmail(null)).toBeNull();
  });
});

describe("mapearPessoa", () => {
  it("NÃO ESCREVE NENHUMA COLUNA DE CNH", () => {
    // A regra mais fácil de quebrar por descuido, e a que apaga dado que só
    // existe no Loca: o People não guarda CNH em coluna nenhuma. Um upsert
    // montado a partir da pessoa inteira zeraria as três em silêncio, e
    // ninguém notaria até perguntarem quem pode dirigir o caminhão.
    const linha = mapearPessoa(pessoa(), ORG, DE_PARA, AGORA);
    for (const proibida of ["cnh", "cnh_categoria", "cnh_validade"]) {
      expect(Object.keys(linha)).not.toContain(proibida);
    }
  });

  it("traduz o exemplo do contrato campo a campo", () => {
    const linha = mapearPessoa(pessoa(), ORG, DE_PARA, AGORA);
    expect(linha).toEqual({
      org_id: ORG,
      people_id: "3f9c1e2a-7b44-4d18-9a05-2c6e8f1b0d33",
      nome: "Fulano de Tal Silva",
      cpf: "12345678901",
      matricula: "4066",
      cargo: "Eletricista",
      telefone: "11987654321",
      email: "fulano@sistenge.com",
      email_confirmado: true,
      situacao_people: "ativo",
      ativo: true,
      obra_id: "obra-unimed",
      sincronizado_em: AGORA,
    });
  });

  it("e-mail do People é confirmado; ausência não tem o que confirmar", () => {
    expect(mapearPessoa(pessoa(), ORG, DE_PARA, AGORA).email_confirmado).toBe(true);

    const semEmail = mapearPessoa(pessoa({ email: null }), ORG, DE_PARA, AGORA);
    expect(semEmail.email).toBeNull();
    expect(semEmail.email_confirmado).toBe(false);
  });

  it("desligado grava a situação crua e ativo = false", () => {
    const linha = mapearPessoa(
      pessoa({ situacao: "desligado", desligamento: "2026-03-02" }),
      ORG,
      DE_PARA,
      AGORA,
    );
    expect(linha.ativo).toBe(false);
    expect(linha.situacao_people).toBe("desligado");
  });

  it("afastado é ativo = true com a situação crua preservada", () => {
    // A distinção que o booleano sozinho perderia: de quem se cobra a devolução
    // hoje.
    const linha = mapearPessoa(pessoa({ situacao: "afastado" }), ORG, DE_PARA, AGORA);
    expect(linha.ativo).toBe(true);
    expect(linha.situacao_people).toBe("afastado");
  });

  it("aguenta a pessoa mais magra que o contrato admite", () => {
    const linha = mapearPessoa(
      pessoa({
        cpf: null,
        matricula: null,
        cargo: null,
        email: null,
        telefone: null,
        centro_custo: null,
      }),
      ORG,
      DE_PARA,
      AGORA,
    );
    expect(linha.nome).toBe("Fulano de Tal Silva");
    expect(linha.obra_id).toBeNull();
    expect(linha.ativo).toBe(true);
  });
});

describe("proximoCursor", () => {
  it("pega o maior atualizado_em do lote", () => {
    const r = proximoCursor(
      [
        { atualizado_em: "2026-09-01T10:00:00.000Z" },
        { atualizado_em: "2026-09-06T14:22:31.412Z" },
        { atualizado_em: "2026-09-03T08:00:00.000Z" },
      ],
      null,
    );
    expect(r).toBe("2026-09-06T14:22:31.412Z");
  });

  it("LOTE VAZIO NÃO ZERA O CURSOR", () => {
    // Uma rodada sem novidade é o caso normal do delta. Zerar aqui faria a
    // rodada seguinte varrer as 483 de novo, todo dia.
    expect(proximoCursor([], "2026-09-06T14:22:31.412Z")).toBe(
      "2026-09-06T14:22:31.412Z",
    );
  });

  it("nunca anda para trás", () => {
    const r = proximoCursor(
      [{ atualizado_em: "2026-09-01T10:00:00.000Z" }],
      "2026-09-06T14:22:31.412Z",
    );
    expect(r).toBe("2026-09-06T14:22:31.412Z");
  });

  it("primeira carga, sem cursor anterior e sem lote, continua nula", () => {
    expect(proximoCursor([], null)).toBeNull();
  });
});

describe("semRepetidas", () => {
  it("uma pessoa repetida no lote vira uma linha só, a mais recente", () => {
    // O contrato avisa que isso acontece: o People falha para o lado de
    // repetir. Sem esta passagem o Postgres recusaria o upsert inteiro com
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" — e a
    // rodada morreria por causa de quem mudou de cargo na hora errada.
    const r = semRepetidas([
      pessoa({ cargo: "Eletricista", atualizado_em: "2026-09-06T14:00:00.000Z" }),
      pessoa({ cargo: "Encarregado", atualizado_em: "2026-09-06T15:00:00.000Z" }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].cargo).toBe("Encarregado");
  });

  it("dois cadastros DIFERENTES da mesma pessoa passam os dois", () => {
    // Cinco pessoas têm dois cadastros no People por um bug de import, e há
    // recontratação, que é dois vínculos legítimos. `people_id` diferentes são
    // duas linhas — mesclar aqui inventaria uma decisão que é do People.
    const r = semRepetidas([
      pessoa({ id: "11111111-1111-4111-8111-111111111111" }),
      pessoa({ id: "22222222-2222-4222-8222-222222222222" }),
    ]);
    expect(r).toHaveLength(2);
  });

  it("lote vazio devolve vazio", () => {
    expect(semRepetidas([])).toEqual([]);
  });
});

describe("precisaVarreduraCompleta", () => {
  const AGORA = "2026-09-07T12:00:00.000Z";

  it("nunca varrida: varre", () => {
    // A primeira rodada é completa por natureza — não há cursor de onde partir.
    expect(precisaVarreduraCompleta(null, AGORA)).toBe(true);
  });

  it("varrida ontem: não varre", () => {
    expect(precisaVarreduraCompleta("2026-09-06T12:00:00.000Z", AGORA)).toBe(false);
  });

  it("varrida há 7 dias: varre", () => {
    expect(precisaVarreduraCompleta("2026-08-31T12:00:00.000Z", AGORA)).toBe(true);
  });

  it("data ilegível cai para varrer", () => {
    // Errar para o lado de conferir demais custa cinco requisições; para o
    // outro lado, custa não notar que alguém sumiu.
    expect(precisaVarreduraCompleta("nao-e-data", AGORA)).toBe(true);
  });
});

describe("ausentesNaVarredura", () => {
  it("aponta quem estava vinculado e não veio", () => {
    expect(ausentesNaVarredura(["a", "b", "c"], ["a", "c"])).toEqual(["b"]);
  });

  it("todos vieram: ninguém ausente", () => {
    expect(ausentesNaVarredura(["a", "b"], ["a", "b", "z"])).toEqual([]);
  });

  it("sem vínculo nenhum, nada a apontar", () => {
    expect(ausentesNaVarredura([], ["a", "b"])).toEqual([]);
  });

  it("varredura vazia acusa TODOS os vinculados", () => {
    // Comportamento correto e por isso mesmo perigoso: é a razão de só a
    // varredura COMPLETA poder marcar ausência. Vinda de um delta, uma resposta
    // vazia — que é o caso normal — acusaria a base inteira.
    expect(ausentesNaVarredura(["a", "b"], [])).toEqual(["a", "b"]);
  });
});
