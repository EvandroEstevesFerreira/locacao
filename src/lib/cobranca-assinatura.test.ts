import { describe, expect, it } from "vitest";
import { deveCobrarAssinatura, INTERVALO_COBRANCA_DIAS } from "./termo";

const HOJE = "2026-09-09";
const pendente = {
  emitidoEm: "2026-09-01T10:00:00Z",
  canceladoEm: null,
  temAssinaturaFuncionario: false,
  ultimoAvisoEm: null,
};

describe("deveCobrarAssinatura", () => {
  it("termo emitido e sem assinatura, nunca avisado, cobra hoje", () => {
    expect(deveCobrarAssinatura(pendente, HOJE)).toBe(true);
  });

  it("termo NÃO emitido não se cobra — a assinatura vem na emissão", () => {
    // Antes de emitir, o link é mandado pela tela por quem opera. Cobrar
    // rascunho encheria a caixa do funcionário por um documento que talvez nem
    // seja emitido.
    expect(deveCobrarAssinatura({ ...pendente, emitidoEm: null }, HOJE)).toBe(false);
  });

  it("termo cancelado não se cobra", () => {
    expect(
      deveCobrarAssinatura({ ...pendente, canceladoEm: "2026-09-05T00:00:00Z" }, HOJE),
    ).toBe(false);
  });

  it("já assinado não se cobra", () => {
    expect(
      deveCobrarAssinatura({ ...pendente, temAssinaturaFuncionario: true }, HOJE),
    ).toBe(false);
  });

  it("avisado hoje não cobra de novo", () => {
    expect(deveCobrarAssinatura({ ...pendente, ultimoAvisoEm: HOJE }, HOJE)).toBe(false);
  });

  it("avisado há 2 dias ainda não cobra", () => {
    expect(
      deveCobrarAssinatura({ ...pendente, ultimoAvisoEm: "2026-09-07" }, HOJE),
    ).toBe(false);
  });

  it("avisado há 3 dias cobra — o intervalo é fechado no limite", () => {
    // Fechado no limite de propósito: o cron roda uma vez por dia, e "mais que
    // 3" empurraria todo aviso para o quarto dia.
    expect(
      deveCobrarAssinatura({ ...pendente, ultimoAvisoEm: "2026-09-06" }, HOJE),
    ).toBe(true);
  });

  it("o intervalo é o declarado, não um número solto no código", () => {
    expect(INTERVALO_COBRANCA_DIAS).toBe(3);
  });

  it("aviso com data futura não destrava a cobrança", () => {
    // Relógio errado ou dado importado. Sem esta guarda, uma data no futuro
    // daria diferença negativa e cobraria todo dia.
    expect(
      deveCobrarAssinatura({ ...pendente, ultimoAvisoEm: "2026-12-01" }, HOJE),
    ).toBe(false);
  });
});
