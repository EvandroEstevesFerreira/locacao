import { describe, it, expect } from "vitest";
import { emailDerivado, confirmacaoDoEmail } from "./termo";

describe("emailDerivado", () => {
  it("usa primeiro nome e último sobrenome, sem acento e em minúsculas", () => {
    expect(emailDerivado("Marcio Oliveira")).toBe("marcio.oliveira@sistenge.com");
    expect(emailDerivado("João Lirio")).toBe("joao.lirio@sistenge.com");
    expect(emailDerivado("Jessica Mendonça")).toBe("jessica.mendonca@sistenge.com");
  });

  it("com nome do meio, pula o meio", () => {
    // "Brainer Patrick Melo Soares" tem quatro partes. O padrão da Sistenge é
    // primeiro + último, e inventar `brainer.patrick` seria escolher errado com
    // a mesma confiança.
    expect(emailDerivado("Brainer Patrick Melo Soares")).toBe(
      "brainer.soares@sistenge.com",
    );
  });

  it("já vindo em formato de login, normaliza", () => {
    // A planilha traz "Rodrigo.Ferreira" em vez do nome por extenso.
    expect(emailDerivado("Rodrigo.Ferreira")).toBe("rodrigo.ferreira@sistenge.com");
  });

  it("não deriva de nome com uma palavra só", () => {
    // "Lourival" não forma `nome.sobrenome`. Devolver `lourival.lourival` seria
    // inventar um endereço com cara de verdadeiro.
    expect(emailDerivado("Lourival")).toBeNull();
  });

  it("não deriva do que não é gente", () => {
    // A coluna USUÁRIOS da planilha de inventário mistura pessoa com estado da
    // máquina: "LIVRE - DATA CENTER", "Monitor 0109947", "Rack".
    expect(emailDerivado("")).toBeNull();
    expect(emailDerivado("   ")).toBeNull();
    expect(emailDerivado("Monitor 0109947")).toBeNull();
  });

  it("colapsa espaço repetido", () => {
    expect(emailDerivado("Maria   Kodama")).toBe("maria.kodama@sistenge.com");
  });
});

describe("confirmacaoDoEmail", () => {
  const derivado = { email: "andrea.marques@sistenge.com", confirmado: false };

  it("digitar um endereço diferente é confirmar", () => {
    // Quem apagou o palpite e escreveu outro endereço conferiu o endereço.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "a.marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(true);
  });

  it("salvar sem tocar no endereço derivado NÃO confirma", () => {
    // Este é o buraco que a regra fecha: alguém edita o CARGO da pessoa e o
    // formulário reenvia o e-mail derivado. Sem esta regra, o palpite viraria
    // "conferido" sem ninguém ter olhado para ele.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "andrea.marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(false);
  });

  it("marcar a caixa confirma o endereço derivado", () => {
    expect(
      confirmacaoDoEmail(derivado, {
        email: "andrea.marques@sistenge.com",
        marcouConfirmar: true,
      }),
    ).toBe(true);
  });

  it("endereço já confirmado continua confirmado ao salvar de novo", () => {
    expect(
      confirmacaoDoEmail(
        { email: "x@sistenge.com", confirmado: true },
        { email: "x@sistenge.com", marcouConfirmar: false },
      ),
    ).toBe(true);
  });

  it("apagar o e-mail zera a confirmação", () => {
    // Sem endereço não há o que confirmar, e deixar `true` faria o registro
    // dizer "conferido" sobre um campo vazio.
    expect(
      confirmacaoDoEmail(
        { email: "x@sistenge.com", confirmado: true },
        { email: null, marcouConfirmar: true },
      ),
    ).toBe(false);
  });

  it("caixa alta não conta como endereço diferente", () => {
    // O índice único é por `lower(email)`: para o banco são o mesmo endereço,
    // então trocar a caixa não é conferir.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "Andrea.Marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(false);
  });

  it("primeiro e-mail de quem não tinha nenhum já nasce confirmado", () => {
    // Ninguém adivinhou: alguém digitou.
    expect(
      confirmacaoDoEmail(
        { email: null, confirmado: false },
        { email: "novo@sistenge.com", marcouConfirmar: false },
      ),
    ).toBe(true);
  });
});
