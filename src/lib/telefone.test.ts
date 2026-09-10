import { describe, expect, it } from "vitest";
import { formatarTelefone, normalizarTelefone } from "./telefone";

describe("formatarTelefone", () => {
  it("13 dígitos com DDI: o caso do cadastro atual", () => {
    expect(formatarTelefone("5511980765016")).toBe("+55 (11) 98076-5016");
  });

  it("11 dígitos sem DDI assume +55", () => {
    // Dois dos três telefones cadastrados estão assim.
    expect(formatarTelefone("11 95914-0002")).toBe("+55 (11) 95914-0002");
    expect(formatarTelefone("11959140002")).toBe("+55 (11) 95914-0002");
  });

  it("fixo de 8 dígitos sai com 4+4, e não 5+3", () => {
    expect(formatarTelefone("1134567890")).toBe("+55 (11) 3456-7890");
    expect(formatarTelefone("551134567890")).toBe("+55 (11) 3456-7890");
  });

  it("ida e volta: já formatado continua igual", () => {
    expect(formatarTelefone("+55 (11) 94707-1104")).toBe("+55 (11) 94707-1104");
  });

  it("vazio é ausência, não string vazia", () => {
    expect(formatarTelefone(null)).toBe(null);
    expect(formatarTelefone("")).toBe(null);
    expect(formatarTelefone("   ")).toBe(null);
  });

  it("o que NÃO é telefone brasileiro volta como foi digitado", () => {
    // Não invento máscara sobre dado que não entendi. "Ramal 22" virando
    // "+55 (2) 2" seria pior que exibir estranho: seria exibir errado.
    expect(formatarTelefone("ramal 22")).toBe("ramal 22");
    expect(formatarTelefone("351912345678")).toBe("351912345678");
    expect(formatarTelefone("123")).toBe("123");
  });
});

describe("normalizarTelefone", () => {
  it("guarda só dígitos, com o DDI", () => {
    expect(normalizarTelefone("+55 (11) 94707-1104")).toBe("5511947071104");
    expect(normalizarTelefone("11 95914-0002")).toBe("5511959140002");
    expect(normalizarTelefone("1134567890")).toBe("551134567890");
  });

  it("idempotente: normalizar o normalizado não muda", () => {
    const uma = normalizarTelefone("11 95914-0002");
    expect(normalizarTelefone(uma)).toBe(uma);
  });

  it("normalizar → formatar → normalizar dá o mesmo", () => {
    const n = normalizarTelefone("5511980765016");
    expect(normalizarTelefone(formatarTelefone(n))).toBe(n);
  });

  it("o que não reconhece, preserva como veio — sem perder informação", () => {
    expect(normalizarTelefone("ramal 22")).toBe("ramal 22");
    expect(normalizarTelefone(null)).toBe(null);
    expect(normalizarTelefone("")).toBe(null);
  });
});
