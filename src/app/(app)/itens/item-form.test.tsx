// @vitest-environment jsdom
//
// O teste que reproduz o defeito da 0.39.1 pelo SINTOMA, não pelo schema.
//
// `schemas-varredura.test.ts` prova a propriedade do schema ("aceita id em
// branco"), mas isso é uma dedução: quem manda o `""` é o react-hook-form, e
// comportamento de biblioteca de terceiro uma atualização pode mudar de novo.
// Este teste monta o formulário de verdade, digita a descrição, aperta Salvar e
// exige que a action seja CHAMADA — exatamente o que o usuário reportou não
// acontecer, e que nenhum teste puro consegue ver.
//
// É o único teste com DOM do projeto (daí o `@vitest-environment jsdom` no
// topo, com o resto da suíte seguindo em `node`), e é de propósito.
import { describe, it, expect, vi, afterEach } from "vitest";
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = "11111111-1111-4111-8111-111111111111";

// A assinatura é explícita para que `mock.calls[0][0]` exista no tipo.
const salvarItem = vi.fn<(raw: unknown) => Promise<{ ok: true; id: string }>>(
  async () => ({ ok: true, id: UUID }),
);

vi.mock("./actions", () => ({ salvarItem }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// O botão Cancelar é um <Link>, que fora do Next dispara update fora do act().
vi.mock("next/link", () => ({
  default: ({ href, ...p }: { href: string }) => <a href={href} {...p} />,
}));

const { ItemForm } = await import("./item-form");

/** Digitar de verdade: o React só enxerga a mudança pelo setter nativo. */
function digitar(el: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Desmontar entre os casos não é higiene opcional: o nwsapi do jsdom resolve
// seletor de id por `document.getElementById` e depois confere a contenção, de
// modo que um host esquecido no documento faz `host.querySelector("#descricao")`
// do caso seguinte devolver null.
let atual: { root: Root; host: HTMLElement } | null = null;

afterEach(async () => {
  if (!atual) return;
  const { root, host } = atual;
  atual = null;
  await React.act(async () => root.unmount());
  host.remove();
});

async function montar(item?: React.ComponentProps<typeof ItemForm>["item"]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  atual = { root, host };

  await React.act(async () => {
    root.render(<ItemForm item={item} />);
  });
  return host;
}

async function salvar(host: HTMLElement) {
  await React.act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function montarESalvar(item?: React.ComponentProps<typeof ItemForm>["item"]) {
  const host = await montar(item);
  await React.act(async () => {
    digitar(host.querySelector<HTMLInputElement>("#descricao")!, "Betoneira 400L");
  });
  await salvar(host);
  return host;
}

describe("ItemForm", () => {
  it("cadastro novo chega na action apesar do id em branco do input oculto", async () => {
    salvarItem.mockClear();
    const host = await montarESalvar();

    // A prova de que o cenário é o certo: o input oculto manda mesmo "".
    expect(host.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe("");

    expect(salvarItem).toHaveBeenCalledTimes(1);
    expect(salvarItem.mock.calls[0][0]).toMatchObject({
      id: null,
      tipo: "equipamento",
      descricao: "Betoneira 400L",
      ativo: true,
    });
  });

  // A rede de `aoInvalidar`: reprovar a validação NUNCA pode ser silencioso.
  it("reprovação da validação aparece na tela, e não só embaixo do campo", async () => {
    salvarItem.mockClear();
    const host = await montar();
    await salvar(host);

    expect(salvarItem).not.toHaveBeenCalled();

    // Embaixo do campo (o que sempre houve) E no bloco acima dos botões (novo).
    const alerta = host.querySelector('[role="alert"]');
    expect(alerta?.textContent).toBe("Informe a descrição do item.");
  });

  it("edição chega na action com o id do item", async () => {
    salvarItem.mockClear();
    await montarESalvar({
      id: UUID,
      tipo: "equipamento",
      descricao: "Betoneira 300L",
      unidade: null,
      ativo: true,
    });

    expect(salvarItem).toHaveBeenCalledTimes(1);
    expect(salvarItem.mock.calls[0][0]).toMatchObject({
      id: UUID,
      descricao: "Betoneira 400L",
    });
  });
});
