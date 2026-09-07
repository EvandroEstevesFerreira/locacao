import { describe, it, expect } from "vitest";
import { precisaConferencia } from "./termo";

const f = (
  nome: string,
  email: string | null,
  email_confirmado = false,
) => ({ nome, email, email_confirmado });

describe("precisaConferencia", () => {
  it("endereço DEDUZIDO do nome e não confirmado precisa de olho", () => {
    // É o caso das 97: o importador derivou nome.sobrenome@sistenge.com e
    // ninguém olhou ainda.
    expect(precisaConferencia(f("Elaine Silva", "elaine.silva@sistenge.com"))).toBe(
      true,
    );
  });

  it("já confirmado não aparece", () => {
    expect(
      precisaConferencia(f("Elaine Silva", "elaine.silva@sistenge.com", true)),
    ).toBe(false);
  });

  it("sem endereço não há o que conferir", () => {
    // São 21 pessoas assim entre as 118 — mostrá-las na tela seria pedir para
    // conferir o vazio.
    expect(precisaConferencia(f("Wagner Vieira", null))).toBe(false);
  });

  it("endereço DIGITADO não aparece — digitar já é conferir", () => {
    // Quem apagou o palpite e escreveu outro endereço, conferiu. Listar essa
    // pessoa encheria a tela de linhas em que não há nada a fazer.
    expect(
      precisaConferencia(f("Elaine Silva", "elaine.rodrigues@sistenge.com")),
    ).toBe(false);
  });

  it("caixa diferente ainda é o mesmo endereço", () => {
    // O índice único do banco é por `lower(email)`: trocar a caixa não torna o
    // endereço outro, então não vira "digitado à mão".
    expect(precisaConferencia(f("Elaine Silva", "Elaine.Silva@Sistenge.com"))).toBe(
      true,
    );
  });

  it("nome do qual não se deriva endereço nenhum não aparece", () => {
    // Nome de uma palavra só: a derivação devolve null, e sem dedução não há
    // dedução a conferir. O endereço, se existe, foi digitado.
    expect(precisaConferencia(f("Madonna", "madonna@sistenge.com"))).toBe(false);
  });

  it("acento no nome não impede o reconhecimento", () => {
    // "João Lírio" deriva "joao.lirio@sistenge.com". Comparar sem tirar acento
    // faria a pessoa parecer que digitou o endereço — e ela sumiria da tela que
    // deveria cobrá-la.
    expect(precisaConferencia(f("João Lírio", "joao.lirio@sistenge.com"))).toBe(
      true,
    );
  });

  it("nome do meio não entra: é primeiro e ÚLTIMO", () => {
    expect(
      precisaConferencia(f("Ana Paula Ferreira", "ana.ferreira@sistenge.com")),
    ).toBe(true);
    expect(
      precisaConferencia(f("Ana Paula Ferreira", "ana.paula@sistenge.com")),
    ).toBe(false);
  });

  it("string vazia é tratada como ausência", () => {
    expect(precisaConferencia(f("Elaine Silva", ""))).toBe(false);
  });
});
