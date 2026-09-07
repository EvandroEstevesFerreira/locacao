import { describe, it, expect } from "vitest";
import { podeReceberTermo, ehRegularizacao } from "./custodia";

const peca = (situacao: string, temPosseAberta = false) => ({
  situacao,
  temPosseAberta,
});

describe("podeReceberTermo", () => {
  it("peça disponível e sem posse pode receber", () => {
    expect(podeReceberTermo(peca("disponivel"))).toBe(true);
  });

  it("peça EM USO sem posse aberta também pode — é o caso das 95", () => {
    // A importação do inventário marcou `em_uso` a partir da planilha sem criar
    // termo. Sem esta regra elas ficavam presas: a matriz só admite chegar a
    // `em_uso` POR um termo, e sair dali por devolução NUM termo.
    expect(podeReceberTermo(peca("em_uso"))).toBe(true);
  });

  it("peça com posse aberta NÃO pode, esteja como estiver", () => {
    // É a proteção que o filtro antigo queria dar e mirava errado: dois termos
    // assinados sobre o mesmo patrimônio.
    expect(podeReceberTermo(peca("em_uso", true))).toBe(false);
    expect(podeReceberTermo(peca("disponivel", true))).toBe(false);
  });

  it("manutenção, baixada e perdida ficam de fora", () => {
    // Entregar a alguém uma peça que está na oficina ou dada como perdida é um
    // documento que nasce mentindo.
    expect(podeReceberTermo(peca("manutencao"))).toBe(false);
    expect(podeReceberTermo(peca("baixada"))).toBe(false);
    expect(podeReceberTermo(peca("perdida"))).toBe(false);
  });

  it("a posse vence a situação", () => {
    // A ordem das checagens importa: se a situação fosse consultada primeiro,
    // uma peça disponível com posse aberta passaria.
    expect(podeReceberTermo(peca("disponivel", true))).toBe(false);
  });
});

describe("ehRegularizacao", () => {
  it("em uso sem posse é regularização, não entrega nova", () => {
    // Muda o rótulo do botão, e o rótulo importa: "Entregar a funcionário" numa
    // máquina que já está com a pessoa há meses faria quem clica achar que está
    // fazendo outra coisa.
    expect(ehRegularizacao(peca("em_uso"))).toBe(true);
  });

  it("disponível é entrega nova", () => {
    expect(ehRegularizacao(peca("disponivel"))).toBe(false);
  });

  it("com posse aberta não é nem uma coisa nem outra", () => {
    // E nem chega a aparecer: `podeReceberTermo` já barrou.
    expect(ehRegularizacao(peca("em_uso", true))).toBe(false);
  });
});
