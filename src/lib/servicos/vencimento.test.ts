import { describe, it, expect } from "vitest";
import { fraseDoAviso, servicosParaAvisar } from "./vencimento";

function s(over: Partial<Parameters<typeof servicosParaAvisar>[0][number]> = {}) {
  return {
    id: "1",
    nome: "Microsoft 365",
    data_fim: "2026-10-01" as string | null,
    renova_automaticamente: true,
    ...over,
  };
}

describe("fraseDoAviso", () => {
  it("renovação automática pede decisão de CANCELAR, não de renovar", () => {
    // As duas frases pedem ações opostas. Trocá-las empurra a pessoa para o
    // lado errado: ela lê "vence", não faz nada, e a assinatura se renova.
    expect(fraseDoAviso({ nome: "M365", renovaAutomaticamente: true })).toMatch(
      /renova automaticamente/i,
    );
  });

  it("sem renovação automática, o aviso fala de vencimento", () => {
    expect(fraseDoAviso({ nome: "M365", renovaAutomaticamente: false })).toMatch(
      /vence/i,
    );
  });

  it("a frase não confunde os dois casos", () => {
    const auto = fraseDoAviso({ nome: "X", renovaAutomaticamente: true });
    const manual = fraseDoAviso({ nome: "X", renovaAutomaticamente: false });
    expect(auto).not.toBe(manual);
  });
});

describe("servicosParaAvisar", () => {
  it("inclui quem vence dentro da janela", () => {
    expect(
      servicosParaAvisar([s({ data_fim: "2026-10-01" })], "2026-09-17", "2026-10-17"),
    ).toHaveLength(1);
  });

  it("vigência indeterminada NÃO gera alerta de renovação", () => {
    // Não há data para avisar. Inventar uma faria o aviso disparar para
    // sempre, todo dia, sobre um contrato que não tem prazo — e um alarme que
    // toca sempre é um alarme que se aprende a ignorar.
    expect(
      servicosParaAvisar([s({ data_fim: null })], "2026-09-17", "2026-10-17"),
    ).toEqual([]);
  });

  it("não avisa sobre o que já venceu", () => {
    expect(
      servicosParaAvisar([s({ data_fim: "2026-08-01" })], "2026-09-17", "2026-10-17"),
    ).toEqual([]);
  });

  it("não avisa sobre o que vence depois da janela", () => {
    expect(
      servicosParaAvisar([s({ data_fim: "2027-01-01" })], "2026-09-17", "2026-10-17"),
    ).toEqual([]);
  });

  it("inclui as bordas da janela", () => {
    const hoje = servicosParaAvisar([s({ data_fim: "2026-09-17" })], "2026-09-17", "2026-10-17");
    const limite = servicosParaAvisar([s({ data_fim: "2026-10-17" })], "2026-09-17", "2026-10-17");
    expect(hoje).toHaveLength(1);
    expect(limite).toHaveLength(1);
  });
});
