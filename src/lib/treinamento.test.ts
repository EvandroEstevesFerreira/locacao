import { describe, it, expect } from "vitest";
import {
  trilhasDoUsuario,
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  corrigir,
  aprovado,
  resumirPendencias,
  manualPorRota,
  respostasSchema,
  SITUACAO_TRILHA_INFO,
  type Conclusao,
} from "./treinamento";
import { PRIMEIROS_PASSOS } from "./treinamento/primeiros-passos";
import type { Trilha } from "./treinamento/tipos";

function conclusao(over: Partial<Conclusao> = {}): Conclusao {
  return {
    trilha: "primeiros-passos",
    versao: 1,
    concluidoEm: "2026-09-03T12:00:00.000Z",
    acertos: 4,
    totalPerguntas: 4,
    numeroRegistro: "TRE-2026-0001",
    ...over,
  };
}

/** Trilha sintética, para exercitar as regras sem depender do conteúdo real. */
function trilha(over: Partial<Trilha> = {}): Trilha {
  return {
    chave: "teste",
    titulo: "Trilha de teste",
    resumo: "Resumo.",
    modulo: null,
    papeis: [],
    versao: 1,
    aulas: [
      {
        id: "a1",
        titulo: "Aula 1",
        resumo: "R.",
        rotas: ["/x"],
        desdeVersao: 1,
        passos: [{ onde: "/x", acao: "Faça.", esperado: "Acontece." }],
      },
    ],
    perguntas: [
      {
        id: "p1",
        enunciado: "E?",
        alternativas: ["a", "b", "c", "d"],
        correta: 1,
        porque: "Porque sim, e esta explicação passa de vinte caracteres.",
        aula: "a1",
      },
    ],
    ...over,
  };
}

describe("SITUACAO_TRILHA_INFO", () => {
  it("cobre as três situações, com rótulo acentuado", () => {
    expect(SITUACAO_TRILHA_INFO.nao_iniciada.label).toBe("Não iniciada");
    expect(SITUACAO_TRILHA_INFO.concluida.label).toBe("Concluída");
    expect(SITUACAO_TRILHA_INFO.desatualizada.label).toBe("Atualização pendente");
  });
});

describe("trilhasDoUsuario", () => {
  it("trilha sem módulo aparece para todo mundo", () => {
    const r = trilhasDoUsuario("operador", [], false);
    expect(r.map((t) => t.chave)).toContain("primeiros-passos");
  });

  it("master vê tudo, mesmo com lista de módulos vazia", () => {
    // `moduloLiberado` já decide isso; aqui garantimos que a regra não foi
    // redecidida com outro resultado.
    const r = trilhasDoUsuario("master", [], true);
    expect(r.length).toBeGreaterThan(0);
  });

  it("sem papel não devolve trilha nenhuma", () => {
    // Sessão inválida não é "usuário com acesso total".
    expect(trilhasDoUsuario(undefined, null, false)).toEqual([]);
  });
});

describe("situacaoDaTrilha e versaoConcluida", () => {
  const t = trilha({ chave: "teste", versao: 2 });

  it("sem conclusão é não iniciada", () => {
    expect(situacaoDaTrilha(t, [])).toBe("nao_iniciada");
    expect(versaoConcluida(t, [])).toBeNull();
  });

  it("conclusão na versão vigente é concluída", () => {
    const c = [conclusao({ trilha: "teste", versao: 2 })];
    expect(situacaoDaTrilha(t, c)).toBe("concluida");
    expect(versaoConcluida(t, c)).toBe(2);
  });

  it("conclusão em versão anterior é atualização pendente", () => {
    const c = [conclusao({ trilha: "teste", versao: 1 })];
    expect(situacaoDaTrilha(t, c)).toBe("desatualizada");
    expect(versaoConcluida(t, c)).toBe(1);
  });

  it("com várias conclusões, vale a versão mais alta", () => {
    const c = [
      conclusao({ trilha: "teste", versao: 1 }),
      conclusao({ trilha: "teste", versao: 2 }),
    ];
    expect(versaoConcluida(t, c)).toBe(2);
    expect(situacaoDaTrilha(t, c)).toBe("concluida");
  });

  it("conclusão de outra trilha é ignorada", () => {
    const c = [conclusao({ trilha: "outra", versao: 2 })];
    expect(situacaoDaTrilha(t, c)).toBe("nao_iniciada");
  });
});

describe("aulasQueMudaram", () => {
  const t = trilha({
    versao: 3,
    aulas: [
      { id: "a1", titulo: "A1", resumo: "R", rotas: ["/x"], desdeVersao: 1, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
      { id: "a2", titulo: "A2", resumo: "R", rotas: ["/x"], desdeVersao: 2, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
      { id: "a3", titulo: "A3", resumo: "R", rotas: ["/x"], desdeVersao: 3, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
    ],
  });

  it("quem nunca concluiu vê todas como novas", () => {
    expect(aulasQueMudaram(t, null).map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("quem concluiu a v1 só precisa das que mudaram depois", () => {
    expect(aulasQueMudaram(t, 1).map((a) => a.id)).toEqual(["a2", "a3"]);
  });

  it("quem concluiu a versão vigente não tem nada a reler", () => {
    expect(aulasQueMudaram(t, 3)).toEqual([]);
  });
});

describe("corrigir e aprovado", () => {
  const t = trilha({
    perguntas: [
      { id: "p1", enunciado: "E1", alternativas: ["a", "b", "c", "d"], correta: 1, porque: "Explicação com mais de vinte caracteres.", aula: "a1" },
      { id: "p2", enunciado: "E2", alternativas: ["a", "b", "c", "d"], correta: 3, porque: "Outra explicação com mais de vinte caracteres.", aula: "a1" },
    ],
  });

  it("acertar tudo aprova", () => {
    const c = corrigir(t, { p1: 1, p2: 3 });
    expect(c.acertos).toBe(2);
    expect(c.total).toBe(2);
    expect(c.erradas).toEqual([]);
    expect(aprovado(c)).toBe(true);
  });

  it("errar uma reprova, e diz qual e o que a pessoa marcou", () => {
    // Aprovação só com 100%: com três a cinco perguntas, nota de corte menor
    // significa "pode errar uma" — e a que a pessoa erra é a que ela precisava.
    const c = corrigir(t, { p1: 0, p2: 3 });
    expect(c.acertos).toBe(1);
    expect(aprovado(c)).toBe(false);
    expect(c.erradas).toHaveLength(1);
    expect(c.erradas[0].pergunta.id).toBe("p1");
    expect(c.erradas[0].escolhida).toBe(0);
  });

  it("pergunta sem resposta conta como errada, com escolhida nula", () => {
    const c = corrigir(t, { p1: 1 });
    expect(c.acertos).toBe(1);
    expect(aprovado(c)).toBe(false);
    expect(c.erradas[0].pergunta.id).toBe("p2");
    expect(c.erradas[0].escolhida).toBeNull();
  });

  it("resposta de pergunta que não existe é ignorada", () => {
    const c = corrigir(t, { p1: 1, p2: 3, pX: 0 });
    expect(c.total).toBe(2);
    expect(aprovado(c)).toBe(true);
  });

  it("trilha sem pergunta nunca aprova", () => {
    // Guarda contra aprovação por vacuidade: 0 de 0 não é 100%.
    const vazia = trilha({ perguntas: [] });
    expect(aprovado(corrigir(vazia, {}))).toBe(false);
  });
});

describe("resumirPendencias", () => {
  const usuarios = [
    { perfilId: "u1", nome: "Fulano de Tal", papel: "operador" as const, modulos: [] as string[], isMaster: false },
    { perfilId: "u2", nome: "Ciclana", papel: "administrador" as const, modulos: null, isMaster: false },
  ];

  it("conta concluídas e lista as pendentes por pessoa", () => {
    const r = resumirPendencias(usuarios, [
      { ...conclusao(), perfilId: "u1" },
    ]);
    const u1 = r.find((l) => l.perfilId === "u1")!;
    const u2 = r.find((l) => l.perfilId === "u2")!;
    expect(u1.concluidas).toBe(1);
    expect(u1.pendentes).toEqual([]);
    expect(u2.concluidas).toBe(0);
    expect(u2.pendentes).toContain("Primeiros passos no Loca");
  });

  it("quem tem mais pendência vem primeiro", () => {
    // O painel existe para cobrar; quem está em dia no topo esconderia o que
    // interessa.
    const r = resumirPendencias(usuarios, [{ ...conclusao(), perfilId: "u1" }]);
    expect(r[0].perfilId).toBe("u2");
  });

  it("lista vazia devolve lista vazia", () => {
    expect(resumirPendencias([], [])).toEqual([]);
  });
});

describe("manualPorRota", () => {
  it("agrupa as aulas por rota, e a rota aparece uma só vez", () => {
    const idx = manualPorRota();
    const rotas = idx.map((r) => r.rota);
    expect(new Set(rotas).size).toBe(rotas.length);
    expect(rotas).toContain("/obras");
  });

  it("uma aula que cobre várias rotas aparece em todas", () => {
    const idx = manualPorRota();
    const comFiltros = idx.filter((r) =>
      r.aulas.some((a) => a.aula.id === "filtros"),
    );
    // A aula `filtros` declara seis rotas de propósito: aprender uma lista é
    // aprender todas.
    expect(comFiltros.length).toBeGreaterThan(1);
  });

  it("as rotas saem em ordem alfabética", () => {
    const rotas = manualPorRota().map((r) => r.rota);
    expect(rotas).toEqual([...rotas].sort());
  });
});

describe("respostasSchema", () => {
  it("aceita o mapa de respostas", () => {
    const r = respostasSchema.safeParse({
      trilha: "primeiros-passos",
      respostas: { "pq-menu": 1 },
    });
    expect(r.success).toBe(true);
  });

  it("recusa trilha vazia", () => {
    const r = respostasSchema.safeParse({ trilha: "", respostas: {} });
    expect(r.success).toBe(false);
  });

  it("recusa índice de alternativa que não é inteiro no intervalo", () => {
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: -1 } }).success).toBe(false);
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: 4 } }).success).toBe(false);
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: 1.5 } }).success).toBe(false);
  });

  it("aceita o próprio output de volta", () => {
    // A propriedade que a varredura de schemas exige de todo schema do projeto.
    const primeiro = respostasSchema.parse({ trilha: "t", respostas: { p: 0 } });
    expect(respostasSchema.parse(primeiro)).toEqual(primeiro);
  });
});

describe("o conteúdo real de primeiros passos", () => {
  it("tem as seis aulas previstas, na ordem", () => {
    expect(PRIMEIROS_PASSOS.aulas.map((a) => a.id)).toEqual([
      "entrar",
      "trocar-senha",
      "menu",
      "achar-obra",
      "filtros",
      "novidades-e-acesso",
    ]);
  });

  it("acertar as quatro perguntas aprova", () => {
    const respostas = Object.fromEntries(
      PRIMEIROS_PASSOS.perguntas.map((p) => [p.id, p.correta]),
    );
    expect(aprovado(corrigir(PRIMEIROS_PASSOS, respostas))).toBe(true);
  });
});
