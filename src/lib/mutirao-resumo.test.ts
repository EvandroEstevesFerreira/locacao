import { describe, expect, it } from "vitest";
import { resumoDoMutirao } from "./frota";

describe("resumoDoMutirao", () => {
  it("tudo certo: conta os termos e diz que as vias saíram", () => {
    expect(
      resumoDoMutirao({ emitidos: 9, jaTinhamDono: 0, falhas: [], avisos: [] }),
    ).toBe("9 termos emitidos · vias enviadas para a caixa de teste.");
  });

  it("NÃO afirma que a via saiu quando houve aviso de envio", () => {
    // O defeito de 09/09/2026: 142 termos emitidos, ZERO e-mails enviados, e a
    // tela dizendo "os e-mails foram para a caixa de teste". A afirmação vinha
    // de `emitidos.length > 0`, que não tem relação com envio.
    const r = resumoDoMutirao({
      emitidos: 9,
      jaTinhamDono: 0,
      falhas: [],
      avisos: ["Termo emitido. A via por e-mail não saiu: Fulano não tem e-mail cadastrado."],
    });
    expect(r).not.toContain("vias enviadas");
    expect(r).toContain("1 sem e-mail");
    expect(r).toContain("não tem e-mail cadastrado");
  });

  it("conta as peças ignoradas por já terem dono", () => {
    const r = resumoDoMutirao({
      emitidos: 3,
      jaTinhamDono: 9,
      falhas: [],
      avisos: [],
    });
    expect(r).toContain("9 já tinham dono");
  });

  it("mostra a primeira falha, com a contagem", () => {
    const r = resumoDoMutirao({
      emitidos: 2,
      jaTinhamDono: 0,
      falhas: ["Peça não encontrada.", "Outro erro."],
      avisos: [],
    });
    expect(r).toContain("2 falharam");
    expect(r).toContain("Peça não encontrada.");
    expect(r).not.toContain("Outro erro.");
  });

  it("singular quando é um termo só", () => {
    expect(
      resumoDoMutirao({ emitidos: 1, jaTinhamDono: 0, falhas: [], avisos: [] }),
    ).toContain("1 termo emitido");
  });

  it("zero emitidos não anuncia envio nenhum", () => {
    const r = resumoDoMutirao({ emitidos: 0, jaTinhamDono: 4, falhas: [], avisos: [] });
    expect(r).not.toContain("vias enviadas");
  });
});
