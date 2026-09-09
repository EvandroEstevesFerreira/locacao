import { describe, expect, it } from "vitest";
import { TIPO_ANEXO_VISTORIA, tipoAnexoValido } from "./vistoria";

describe("tipoAnexoValido", () => {
  it("deixa passar os tipos que a coluna aceita", () => {
    expect(tipoAnexoValido("protocolo")).toBe("protocolo");
    expect(tipoAnexoValido("os")).toBe("os");
    expect(tipoAnexoValido("outro")).toBe("outro");
  });

  it("qualquer outra coisa cai em “outro”, e não vai crua para o banco", () => {
    // A coluna tem `check (tipo in (...))`. Valor de fora chegaria ao Postgres,
    // seria recusado, e o usuário veria "não ficou registrado" sem saber por
    // quê — depois de o arquivo já ter subido para o Storage.
    expect(tipoAnexoValido("nota-fiscal")).toBe("outro");
    expect(tipoAnexoValido("")).toBe("outro");
    expect(tipoAnexoValido(undefined)).toBe("outro");
  });

  it("não confia em maiúscula nem em espaço da borda", () => {
    expect(tipoAnexoValido(" Protocolo ")).toBe("protocolo");
    expect(tipoAnexoValido("OS")).toBe("os");
  });

  it("todo tipo aceito tem rótulo para a tela", () => {
    // Sem isto, acrescentar um tipo no check do banco e esquecer o rótulo
    // deixaria a linha aparecer em branco na lista.
    for (const t of Object.keys(TIPO_ANEXO_VISTORIA)) {
      expect(TIPO_ANEXO_VISTORIA[t as keyof typeof TIPO_ANEXO_VISTORIA]).toBeTruthy();
    }
    expect(Object.keys(TIPO_ANEXO_VISTORIA).sort()).toEqual(["os", "outro", "protocolo"]);
  });
});
