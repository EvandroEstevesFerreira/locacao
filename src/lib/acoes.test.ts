import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { erroDeEscrita, falha, primeiroErro } from "./acoes";

/**
 * O julgador de escrita concentra duas lições que custaram três correções em
 * versões diferentes. Ele precisa de teste próprio porque é o único lugar
 * onde "não afetou linha nenhuma" passa a ser tratado como falha — e um
 * `!data?.length` invertido por descuido devolveria "não foi excluído" em
 * TODA exclusão bem-sucedida do sistema.
 */
describe("erroDeEscrita", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("escrita que afetou uma linha deu certo", () => {
    expect(
      erroDeEscrita({ data: [{ id: "x" }], error: null }, {
        registro: "fornecedor",
        contexto: "teste",
      }),
    ).toBeNull();
  });

  it("zero linhas SEM erro é falha, e diz que nada mudou", () => {
    // O caso do `moverPeca`: RLS filtra a linha, PostgREST devolve
    // `error: null`, e a action dizia "movido" com a peça parada.
    const msg = erroDeEscrita({ data: [], error: null }, {
      registro: "reparo",
      contexto: "teste",
    });
    expect(msg).toContain("não foi excluído");
    expect(msg).toContain("permissão");
  });

  it("data nula também é zero linhas", () => {
    expect(
      erroDeEscrita({ data: null, error: null }, {
        registro: "anexo",
        contexto: "teste",
      }),
    ).not.toBeNull();
  });

  it("chave estrangeira violada explica que o registro já foi usado", () => {
    // O caso do `excluirItem`: item usado em peça, contrato ou movimento.
    const msg = erroDeEscrita({ data: null, error: { code: "23503" } }, {
      registro: "fornecedor",
      contexto: "teste",
      dica: "Deixe-o inativo para preservar o histórico.",
    });
    expect(msg).toContain("já foi usado");
    expect(msg).toContain("Deixe-o inativo");
  });

  it("sem dica, a mensagem de chave estrangeira não fica com espaço sobrando", () => {
    const msg = erroDeEscrita({ data: null, error: { code: "23503" } }, {
      registro: "anexo",
      contexto: "teste",
    });
    expect(msg).toBe(
      "Este anexo já foi usado por outros registros e não pode ser excluído.",
    );
  });

  it("em `salvar`, chave estrangeira é referência inválida, não uso", () => {
    // Sentido oposto: ao salvar, a FK violada significa que o registro
    // APONTADO não existe — dizer "já foi usado" mandaria a pessoa procurar
    // o problema no lugar errado.
    const msg = erroDeEscrita({ data: null, error: { code: "23503" } }, {
      registro: "lançamento",
      acao: "salvar",
      contexto: "teste",
    });
    expect(msg).toContain("não foi encontrado");
    expect(msg).not.toContain("já foi usado");
  });

  it("unicidade violada fala de dado repetido", () => {
    expect(
      erroDeEscrita({ data: null, error: { code: "23505" } }, {
        registro: "fornecedor",
        contexto: "teste",
      }),
    ).toContain("Já existe");
  });

  it("erro sem código conhecido cai na mensagem genérica da ação", () => {
    expect(
      erroDeEscrita({ data: null, error: { code: "XX000" } }, {
        registro: "reparo",
        acao: "salvar",
        contexto: "teste",
      }),
    ).toBe("Não foi possível salvar o reparo. Tente novamente.");
  });

  it("registra no log em toda falha, e em nenhum sucesso", () => {
    const log = vi.spyOn(console, "error");
    erroDeEscrita({ data: [{ id: "x" }], error: null }, {
      registro: "x",
      contexto: "ok",
    });
    expect(log).not.toHaveBeenCalled();

    erroDeEscrita({ data: [], error: null }, { registro: "x", contexto: "zero" });
    erroDeEscrita({ data: null, error: { code: "23503" } }, {
      registro: "x",
      contexto: "fk",
    });
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("falha e primeiroErro", () => {
  it("falha devolve o formato de erro do ActionResult", () => {
    expect(falha("deu ruim")).toEqual({ ok: false, erro: "deu ruim" });
  });

  it("primeiroErro devolve a primeira mensagem", () => {
    expect(primeiroErro([{ message: "a" }, { message: "b" }])).toBe("a");
  });

  it("primeiroErro cai no fallback com lista vazia", () => {
    expect(primeiroErro([])).toBe("Dados inválidos.");
    expect(primeiroErro([], "outro")).toBe("outro");
  });
});
