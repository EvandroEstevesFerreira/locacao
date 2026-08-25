import { describe, expect, it } from "vitest";
import { validarTrilhas, type Trilha, type Modulo } from "./tipos";

const modulo = (id: string, numero: number): Modulo => ({
  id,
  numero,
  titulo: `Módulo ${numero}`,
  perfis: ["operador"],
  problema: "A dor real.",
  caminho: ["Abrir a tela.", "Preencher.", "Salvar."],
  exemplo: "Na Torre B, isto acontece.",
  exercicios: ["Faça isto no Loca.", "Confira aquilo."],
  perguntas: [
    {
      enunciado: "Qual é a competência de uma despesa?",
      alternativas: ["O mês a que ela pertence", "O dia do pagamento"],
      correta: 0,
      comentario:
        "A competência é o mês a que a despesa pertence; o vencimento é quando ela é paga.",
    },
  ],
});

const trilha = (id: Trilha["id"], numero: Trilha["numero"], qtd: number): Trilha => ({
  id,
  numero,
  titulo: `Trilha ${numero}`,
  subtitulo: "Subtítulo.",
  modulos: Array.from({ length: qtd }, (_, i) => modulo(`${id}-${i + 1}`, i + 1)),
});

const completas = (): Trilha[] => [
  trilha("fundacao", 0, 6),
  trilha("ferramentas", 1, 6),
  trilha("imoveis", 2, 6),
];

describe("validarTrilhas", () => {
  it("aceita as três trilhas completas", () => {
    expect(validarTrilhas(completas())).toEqual([]);
  });

  it("acusa id de módulo repetido — é o que quebraria o link interno", () => {
    const t = completas();
    t[1].modulos[0].id = t[0].modulos[0].id;
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("id de módulo repetido"),
    );
  });

  it("acusa módulo sem perfil — sem isso ninguém sabe para quem é", () => {
    const t = completas();
    t[0].modulos[2].perfis = [];
    expect(validarTrilhas(t)).toContainEqual(expect.stringContaining("sem perfil"));
  });

  it("acusa pergunta cujo índice da correta não existe", () => {
    const t = completas();
    t[0].modulos[0].perguntas[0].correta = 5;
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("alternativa correta inexistente"),
    );
  });

  it("acusa pergunta sem comentário — 'errado' sozinho não ensina", () => {
    const t = completas();
    t[0].modulos[1].perguntas[0].comentario = "  ";
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("sem comentário"),
    );
  });

  it("acusa contagem diferente de 18 módulos", () => {
    const t = completas();
    t[2].modulos.pop();
    expect(validarTrilhas(t)).toContainEqual(expect.stringContaining("17 módulos"));
  });

  it("acusa numeração fora de sequência dentro da trilha", () => {
    const t = completas();
    t[1].modulos[3].numero = 9;
    expect(validarTrilhas(t)).toContainEqual(expect.stringContaining("numeração"));
  });
});
