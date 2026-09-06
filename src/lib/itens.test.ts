import { describe, it, expect } from "vitest";
import { agruparPorTipo, type LinhaCatalogo } from "./itens";

function linha(over: Partial<LinhaCatalogo> = {}): LinhaCatalogo {
  return {
    id: crypto.randomUUID(),
    descricao: "Dell Latitude 3410",
    natureza: "equipamento",
    ativo: true,
    unidade: "un",
    categoriaNome: "TI",
    tipoNome: "NOTEBOOK",
    pecas: 1,
    emUso: 1,
    disponivel: 0,
    locadas: 0,
    ...over,
  };
}

describe("agruparPorTipo", () => {
  it("soma o parque de cada grupo", () => {
    const g = agruparPorTipo([
      linha({ pecas: 17, emUso: 15, disponivel: 2, locadas: 4 }),
      linha({ pecas: 12, emUso: 12, disponivel: 0 }),
      linha({ tipoNome: "DESKTOP", pecas: 9, emUso: 1, disponivel: 8 }),
    ]);

    expect(g.map((x) => x.rotulo)).toEqual(["NOTEBOOK", "DESKTOP"]);
    expect(g[0]).toMatchObject({
      modelos: 2,
      pecas: 29,
      emUso: 27,
      disponivel: 2,
      locadas: 4,
    });
    expect(g[1]).toMatchObject({ modelos: 1, pecas: 9, emUso: 1 });
  });

  it("o grupo com mais peças vem primeiro, não o com mais modelos", () => {
    // A pergunta que a tela responde é "onde está o meu parque". Cinco modelos
    // de uma peça cada não são maiores que um modelo de vinte.
    const g = agruparPorTipo([
      linha({ tipoNome: "ANDAIME", pecas: 20 }),
      ...Array.from({ length: 5 }, () => linha({ tipoNome: "FURADEIRA", pecas: 1 })),
    ]);
    expect(g[0].rotulo).toBe("ANDAIME");
    expect(g[1].modelos).toBe(5);
  });

  it("empate no parque desempata pelo nome", () => {
    // Sem desempate estável a ordem das seções mudaria a cada visita, e a tela
    // pareceria instável sem nada ter mudado.
    const g = agruparPorTipo([
      linha({ tipoNome: "SERVIDOR", pecas: 2 }),
      linha({ tipoNome: "DESKTOP", pecas: 2 }),
    ]);
    expect(g.map((x) => x.rotulo)).toEqual(["DESKTOP", "SERVIDOR"]);
  });

  it("item que não é equipamento é agrupado pela natureza, sem nota", () => {
    // Um saco de cimento não é NOTEBOOK nem ANDAIME. A falta de tipo aqui é
    // legítima, e marcá-la como lacuna mandaria alguém consertar o que está
    // certo.
    const g = agruparPorTipo([
      linha({
        natureza: "consumivel",
        tipoNome: null,
        descricao: "Cimento CP-II",
        pecas: 0,
      }),
    ]);
    expect(g[0].nota).toBeNull();
  });

  it("EQUIPAMENTO sem tipo é lacuna, e a nota diz a consequência", () => {
    const g = agruparPorTipo([linha({ tipoNome: null, pecas: 3 })]);
    expect(g[0].rotulo).toBe("Equipamento sem tipo");
    expect(g[0].nota).toContain("filtra por tipo");
  });

  it("a chave do grupo sobrevive a acento e espaço", () => {
    // Ela vira `key` de React e âncora de seção; com acento e espaço quebra de
    // um jeito que não estoura erro.
    const g = agruparPorTipo([linha({ tipoNome: "CAMINHÃO MUNCK" })]);
    expect(g[0].chave).toBe("caminh-o-munck");
  });

  it("lista vazia devolve nenhum grupo", () => {
    expect(agruparPorTipo([])).toEqual([]);
  });
});
