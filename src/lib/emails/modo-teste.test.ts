import { describe, expect, it } from "vitest";
import {
  aplicarModoTeste,
  emTeste,
  estadoEnvio,
  lerDestinoTeste,
  type EstadoEnvio,
} from "./modo-teste";
import type { EmailPronto } from "./templates";

const email: EmailPronto = {
  assunto: "Loca · Avisos de vencimento — Vista Verde",
  html: "<p>corpo</p>",
  texto: "corpo",
};

const REAIS = ["mestre@obra.com.br", "almox@obra.com.br", "eng@obra.com.br"];
// Genéricos de propósito: os endereços reais de teste vivem em
// EMAIL_TESTE_DESTINO, não no repositório. Endereço pessoal commitado fica lá
// para sempre, e no dia do lançamento ninguém lembra de tirar.
const TESTE = ["caixa-a@exemplo.com", "caixa-b@exemplo.com"];

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe("estadoEnvio", () => {
  it("sem a variável, o envio é normal", () => {
    expect(estadoEnvio(env({}))).toEqual({ modo: "normal" });
  });

  it("aceita as formas de ligar que uma pessoa realmente digita", () => {
    for (const v of ["1", "true", "TRUE", "sim", "on", " 1 "]) {
      const e = estadoEnvio(env({ EMAIL_MODO_TESTE: v, EMAIL_TESTE_DESTINO: TESTE[0] }));
      expect(e.modo, `valor ${JSON.stringify(v)}`).toBe("teste");
    }
  });

  it("ligado sem destino BLOQUEIA — nunca cai para os reais", () => {
    // É a regra mais importante do arquivo. Se um erro de digitação em
    // EMAIL_TESTE_DESTINO fizesse o envio voltar ao normal, a trava causaria
    // exatamente o acidente que ela existe para impedir.
    const e = estadoEnvio(env({ EMAIL_MODO_TESTE: "1" }));
    expect(e.modo).toBe("bloqueado");
  });

  it("destino só com lixo também bloqueia", () => {
    const e = estadoEnvio(env({ EMAIL_MODO_TESTE: "1", EMAIL_TESTE_DESTINO: "sem-arroba" }));
    expect(e.modo).toBe("bloqueado");
  });
});

describe("lerDestinoTeste", () => {
  it("aceita linha, vírgula e ponto-e-vírgula", () => {
    expect(lerDestinoTeste("a@x.com\nb@x.com, c@x.com; d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
  });

  it("normaliza caixa e remove repetidos", () => {
    expect(lerDestinoTeste("Caixa.A@Exemplo.com, caixa.a@exemplo.com")).toEqual([
      "caixa.a@exemplo.com",
    ]);
  });

  it("vazio e indefinido dão lista vazia", () => {
    expect(lerDestinoTeste(undefined)).toEqual([]);
    expect(lerDestinoTeste("  ")).toEqual([]);
  });
});

describe("aplicarModoTeste", () => {
  const normal: EstadoEnvio = { modo: "normal" };
  const teste: EstadoEnvio = { modo: "teste", destino: TESTE };

  it("desligada, não toca em nada", () => {
    const r = aplicarModoTeste(REAIS, email, normal);
    expect(r.destinatarios).toEqual(REAIS);
    expect(r.email).toEqual(email);
    expect(r.desviadoDe).toBeUndefined();
  });

  it("ligada, NENHUM destinatário real sobrevive", () => {
    const r = aplicarModoTeste(REAIS, email, teste);
    expect(r.destinatarios).toEqual(TESTE);
    for (const real of REAIS) {
      expect(r.destinatarios).not.toContain(real);
    }
  });

  it("registra no assunto quem teria recebido", () => {
    const r = aplicarModoTeste(REAIS, email, teste);
    expect(r.email.assunto).toBe(
      "[TESTE → mestre@obra.com.br, almox@obra.com.br +1] " +
        "Loca · Avisos de vencimento — Vista Verde",
    );
  });

  it("com um destinatário só, não inventa contagem", () => {
    const r = aplicarModoTeste(["mestre@obra.com.br"], email, teste);
    expect(r.email.assunto).toContain("[TESTE → mestre@obra.com.br]");
    expect(r.email.assunto).not.toContain("+");
  });

  it("NÃO altera o corpo — é ele que está sendo avaliado", () => {
    const r = aplicarModoTeste(REAIS, email, teste);
    expect(r.email.html).toBe(email.html);
    expect(r.email.texto).toBe(email.texto);
  });

  it("bloqueada, lança em vez de enviar", () => {
    const bloqueado: EstadoEnvio = { modo: "bloqueado", motivo: "sem destino" };
    expect(() => aplicarModoTeste(REAIS, email, bloqueado)).toThrow("sem destino");
  });
});

describe("emTeste", () => {
  it("é verdadeiro em teste e em bloqueado, falso em normal", () => {
    expect(emTeste({ modo: "normal" })).toBe(false);
    expect(emTeste({ modo: "teste", destino: TESTE })).toBe(true);
    expect(emTeste({ modo: "bloqueado", motivo: "x" })).toBe(true);
  });
});
