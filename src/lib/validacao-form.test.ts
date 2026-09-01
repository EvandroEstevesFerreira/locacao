import { describe, it, expect } from "vitest";
import { primeiraMensagemDeErro, aoInvalidar } from "./validacao-form";

describe("primeiraMensagemDeErro", () => {
  it("acha a mensagem de um campo simples", () => {
    expect(
      primeiraMensagemDeErro({
        descricao: { type: "too_small", message: "Informe a descrição do item." },
      }),
    ).toBe("Informe a descrição do item.");
  });

  it("acha a mensagem de um campo que o form não renderiza — o caso da 0.39.1", () => {
    expect(
      primeiraMensagemDeErro({
        id: { type: "custom", message: "Registro inválido. Recarregue a página." },
      }),
    ).toBe("Registro inválido. Recarregue a página.");
  });

  it("desce em campo aninhado e em lista", () => {
    expect(
      primeiraMensagemDeErro({ obras: [undefined, { nome: { message: "Selecione." } }] }),
    ).toBe("Selecione.");
  });

  it("não entra no `ref`, que é nó do DOM", () => {
    // Sem a trava, a recursão sai andando pela árvore da página — e um nó do
    // DOM tem ciclo (parentNode/childNodes), então isso não termina.
    const ciclico: Record<string, unknown> = { message: "texto de dentro do DOM" };
    ciclico.parentNode = ciclico;
    expect(primeiraMensagemDeErro({ nome: { type: "required", ref: ciclico } })).toBeNull();
  });

  it("ignora mensagem vazia e devolve null quando não há nenhuma", () => {
    expect(primeiraMensagemDeErro({ nome: { type: "required", message: "  " } })).toBeNull();
    expect(primeiraMensagemDeErro({})).toBeNull();
    expect(primeiraMensagemDeErro(undefined)).toBeNull();
  });
});

describe("aoInvalidar", () => {
  it("entrega a mensagem encontrada", () => {
    let visto: string | null = null;
    aoInvalidar((m) => (visto = m))({ nome: { message: "Informe o nome." } });
    expect(visto).toBe("Informe o nome.");
  });

  it("nunca deixa o formulário mudo, mesmo sem mensagem", () => {
    let visto: string | null = null;
    aoInvalidar((m) => (visto = m))({ nome: { type: "required" } });
    expect(visto).toBe("Revise os campos do formulário e tente de novo.");
  });
});
