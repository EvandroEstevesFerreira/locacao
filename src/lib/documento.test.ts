import { describe, it, expect } from "vitest";

import {
  normalizarDocumento,
  formatarDocumento,
  tipoDeDocumento,
  documentoValido,
} from "./documento";

/**
 * CPF ou CNPJ, no mesmo campo.
 *
 * Locador de imóvel é quase sempre pessoa física — dos 21 do Loca, um punhado
 * é imobiliária. Dois campos separados obrigariam quem cadastra a escolher
 * antes de digitar, e a escolha errada trava o cadastro por nada: o próprio
 * número diz o que ele é.
 */

// CPFs válidos de teste (dígitos conferidos), não de pessoas reais.
const CPF_OK = "529.982.247-25";
const CNPJ_OK = "49.329.618/0001-99"; // Sistenge, do guia do Mega

describe("normalizarDocumento", () => {
  it("tira a máscara", () => {
    expect(normalizarDocumento(CPF_OK)).toBe("52998224725");
    expect(normalizarDocumento(CNPJ_OK)).toBe("49329618000199");
  });

  it("aguenta vazio e nulo", () => {
    expect(normalizarDocumento("")).toBe("");
    expect(normalizarDocumento(null)).toBe("");
  });
});

describe("tipoDeDocumento", () => {
  it("11 dígitos é CPF, 14 é CNPJ", () => {
    expect(tipoDeDocumento(CPF_OK)).toBe("cpf");
    expect(tipoDeDocumento(CNPJ_OK)).toBe("cnpj");
  });

  it("qualquer outro tamanho é indefinido", () => {
    expect(tipoDeDocumento("123")).toBeNull();
    expect(tipoDeDocumento("")).toBeNull();
  });
});

describe("documentoValido", () => {
  it("aceita CPF e CNPJ corretos", () => {
    expect(documentoValido(CPF_OK)).toBe(true);
    expect(documentoValido(CNPJ_OK)).toBe(true);
  });

  // O DÍGITO VERIFICADOR É O QUE SEPARA "digitado" de "conferido". Sem ele, um
  // CPF trocado num dígito entra no cadastro e vai buscar no Mega o agente de
  // outra pessoa — e a tela mostra o pagamento de um terceiro como se fosse
  // deste imóvel.
  it("recusa CPF com dígito verificador errado", () => {
    expect(documentoValido("529.982.247-26")).toBe(false);
    expect(documentoValido("111.111.111-11")).toBe(false);
  });

  it("recusa CNPJ com dígito verificador errado", () => {
    expect(documentoValido("49.329.618/0001-98")).toBe(false);
  });

  it("recusa tamanho que não é de CPF nem de CNPJ", () => {
    expect(documentoValido("5299822472")).toBe(false);
    expect(documentoValido("")).toBe(false);
  });
});

describe("formatarDocumento", () => {
  it("põe a máscara certa para cada tipo", () => {
    expect(formatarDocumento(CPF_OK)).toBe("529.982.247-25");
    expect(formatarDocumento(CNPJ_OK)).toBe("49.329.618/0001-99");
  });

  // Máscara progressiva: o campo é usado enquanto se digita, e travar a
  // formatação até completar 11 dígitos faz o cursor pular.
  it("formata parcialmente enquanto se digita", () => {
    expect(formatarDocumento("529982")).toBe("529.982");
  });

  // ATÉ 11 DÍGITOS, NÃO DÁ PARA SABER QUAL É. "4932961800" tem 10 e é um CPF
  // pela metade tanto quanto um CNPJ pela metade — a máscara de CPF é o palpite
  // certo porque é o caso comum (locador é quase sempre pessoa física), e ela
  // se corrige sozinha no 12º dígito. Adivinhar CNPJ antes disso poria barra e
  // ponto no lugar errado em todo CPF digitado.
  it("assume CPF enquanto o tamanho ainda cabe em CPF, e vira CNPJ ao passar", () => {
    expect(formatarDocumento("4932961800")).toBe("493.296.180-0");
    expect(formatarDocumento("493296180001")).toBe("49.329.618/0001");
  });

  it("devolve vazio para vazio", () => {
    expect(formatarDocumento("")).toBe("");
  });
});
