import { describe, it, expect } from "vitest";
import {
  moduloDaRota,
  moduloLiberado,
  normalizarModulos,
} from "./modulos";

describe("moduloDaRota", () => {
  it("mapeia a rota base e as subrotas para o módulo", () => {
    expect(moduloDaRota("/imoveis")).toBe("imoveis");
    expect(moduloDaRota("/imoveis/123")).toBe("imoveis");
    expect(moduloDaRota("/imoveis/123/editar")).toBe("imoveis");
    expect(moduloDaRota("/financeiro")).toBe("financeiro");
  });

  it("retorna null para rotas não moduláveis", () => {
    expect(moduloDaRota("/")).toBeNull();
    expect(moduloDaRota("/perfil")).toBeNull();
    expect(moduloDaRota("/usuarios")).toBeNull();
    expect(moduloDaRota("/configuracoes")).toBeNull();
  });

  it("não confunde prefixos parecidos", () => {
    // "/obras" não deve casar com uma hipotética "/obras-arquivadas"
    expect(moduloDaRota("/obras-arquivadas")).toBeNull();
  });
});

describe("moduloLiberado", () => {
  it("master sempre acessa, mesmo com whitelist restrita", () => {
    expect(moduloLiberado([], true, "imoveis")).toBe(true);
    expect(moduloLiberado(["obras"], true, "financeiro")).toBe(true);
  });

  it("null = acesso a todos (retrocompatível)", () => {
    expect(moduloLiberado(null, false, "imoveis")).toBe(true);
    expect(moduloLiberado(undefined, false, "financeiro")).toBe(true);
  });

  it("whitelist restringe aos módulos presentes", () => {
    expect(moduloLiberado(["imoveis", "financeiro"], false, "imoveis")).toBe(true);
    expect(moduloLiberado(["imoveis"], false, "financeiro")).toBe(false);
    expect(moduloLiberado([], false, "obras")).toBe(false);
  });
});

describe("normalizarModulos", () => {
  it("mantém apenas chaves de módulo válidas", () => {
    expect(normalizarModulos(["imoveis", "hack", "financeiro", ""])).toEqual([
      "imoveis",
      "financeiro",
    ]);
  });
});
