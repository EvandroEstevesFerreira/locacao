import { describe, it, expect } from "vitest";
import { TRILHAS, trilhaPorChave } from "./index";

/**
 * VARREDURA DE INTEGRIDADE DO CONTEÚDO — sem lista de nomes a manter.
 *
 * Ela varre `TRILHAS` e exige as propriedades de toda trilha, hoje e nas ondas
 * seguintes. Conteúdo é o que mais vai crescer nesta parte do sistema: 13
 * módulos, 4 papéis, dezenas de aulas. Um `correta` fora do intervalo ou uma
 * pergunta apontando para aula que não existe passa pelo typecheck e quebra na
 * cara do usuário no meio do questionário.
 */
describe("integridade do conteúdo de treinamento", () => {
  it("existe trilha para varrer", () => {
    // Sem esta trava, apagar TRILHAS transformaria a varredura num teste vazio.
    expect(TRILHAS.length).toBeGreaterThan(0);
  });

  it("a chave de cada trilha é única", () => {
    const chaves = TRILHAS.map((t) => t.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("a chave de cada trilha serve como slug de rota", () => {
    for (const t of TRILHAS) {
      expect(t.chave, `trilha ${t.chave}`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  for (const t of TRILHAS) {
    describe(`trilha ${t.chave}`, () => {
      it("tem título, resumo e versão", () => {
        expect(t.titulo.length).toBeGreaterThan(0);
        expect(t.resumo.length).toBeGreaterThan(0);
        expect(t.versao).toBeGreaterThanOrEqual(1);
      });

      it("tem pelo menos uma aula, e id de aula é único", () => {
        expect(t.aulas.length).toBeGreaterThan(0);
        const ids = t.aulas.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("toda aula tem passos, e todo passo diz o que tem de acontecer", () => {
        for (const a of t.aulas) {
          expect(a.passos.length, `aula ${a.id}`).toBeGreaterThan(0);
          for (const p of a.passos) {
            expect(p.onde.length, `aula ${a.id}`).toBeGreaterThan(0);
            expect(p.acao.length, `aula ${a.id}`).toBeGreaterThan(0);
            // `esperado` é o que separa treinamento de passeio guiado.
            expect(p.esperado.length, `aula ${a.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("toda aula declara ao menos uma rota, para o manual poder indexá-la", () => {
        for (const a of t.aulas) {
          expect(a.rotas.length, `aula ${a.id}`).toBeGreaterThan(0);
          for (const r of a.rotas) {
            expect(r.length, `aula ${a.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("`desdeVersao` de toda aula está entre 1 e a versão da trilha", () => {
        for (const a of t.aulas) {
          expect(a.desdeVersao, `aula ${a.id}`).toBeGreaterThanOrEqual(1);
          expect(a.desdeVersao, `aula ${a.id}`).toBeLessThanOrEqual(t.versao);
        }
      });

      it("tem entre 3 e 5 perguntas", () => {
        // Três a cinco é decisão de projeto: vinte perguntas é o que faz
        // ninguém terminar a trilha.
        expect(t.perguntas.length).toBeGreaterThanOrEqual(3);
        expect(t.perguntas.length).toBeLessThanOrEqual(5);
      });

      it("id de pergunta é único", () => {
        const ids = t.perguntas.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("toda pergunta tem quatro alternativas e `correta` no intervalo", () => {
        for (const p of t.perguntas) {
          expect(p.alternativas.length, `pergunta ${p.id}`).toBe(4);
          // Inteiro, e não só dentro do intervalo: `correta: 1.5` passa pelas
          // duas comparações abaixo e nunca casa com a resposta escolhida, que
          // o `respostasSchema` exige inteira. A trilha ficaria IMPOSSÍVEL de
          // concluir e a pessoa só veria "não confere" para sempre.
          expect(Number.isInteger(p.correta), `pergunta ${p.id}`).toBe(true);
          expect(p.correta, `pergunta ${p.id}`).toBeGreaterThanOrEqual(0);
          expect(p.correta, `pergunta ${p.id}`).toBeLessThan(p.alternativas.length);
          for (const alt of p.alternativas) {
            expect(alt.length, `pergunta ${p.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("toda pergunta aponta para uma aula que existe", () => {
        const ids = new Set(t.aulas.map((a) => a.id));
        for (const p of t.perguntas) {
          expect(ids, `pergunta ${p.id} aponta para aula inexistente`).toContain(
            p.aula,
          );
        }
      });

      it("toda pergunta explica o porquê da resposta", () => {
        for (const p of t.perguntas) {
          // Errar e não saber por que só ensina a chutar melhor.
          expect(p.porque.length, `pergunta ${p.id}`).toBeGreaterThan(20);
        }
      });
    });
  }

  it("trilhaPorChave encontra o que existe e devolve undefined para o resto", () => {
    expect(trilhaPorChave("primeiros-passos")?.chave).toBe("primeiros-passos");
    expect(trilhaPorChave("nao-existe")).toBeUndefined();
  });
});
