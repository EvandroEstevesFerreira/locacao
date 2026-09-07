import { describe, it, expect } from "vitest";
import { agruparPorTipo, pendenciasDaLista } from "./frota-agrupamento";

const peca = (
  id: string,
  tipoNome: string | null,
  situacao = "em_uso",
  propriedade = "propria",
) => ({ id, tipoNome, situacao, propriedade });

describe("agruparPorTipo", () => {
  it("agrupa por tipo e conta situação e propriedade", () => {
    const g = agruparPorTipo([
      peca("a", "NOTEBOOK", "em_uso", "locada"),
      peca("b", "NOTEBOOK", "disponivel"),
      peca("c", "PTA", "em_uso", "locada"),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].rotulo).toBe("NOTEBOOK");
    expect(g[0].emUso).toBe(1);
    expect(g[0].disponivel).toBe(1);
    expect(g[0].locadas).toBe(1);
  });

  it("ordena pelo tamanho — onde está a massa do parque vem primeiro", () => {
    const g = agruparPorTipo([
      peca("a", "PTA"),
      peca("b", "NOTEBOOK"),
      peca("c", "NOTEBOOK"),
      peca("d", "NOTEBOOK"),
    ]);
    expect(g.map((x) => x.rotulo)).toEqual(["NOTEBOOK", "PTA"]);
  });

  it("empate desempata por nome, para a ordem não dançar entre carregamentos", () => {
    const g = agruparPorTipo([peca("a", "GERADOR"), peca("b", "BETONEIRA")]);
    expect(g.map((x) => x.rotulo)).toEqual(["BETONEIRA", "GERADOR"]);
  });

  it("o grupo sem tipo vai por último MESMO sendo o maior", () => {
    // É uma lacuna de cadastro, não uma família. Listá-lo no topo por ser
    // numeroso daria a ele a importância de um tipo de verdade.
    const g = agruparPorTipo([
      peca("a", null),
      peca("b", null),
      peca("c", null),
      peca("d", "PTA"),
    ]);
    expect(g.map((x) => x.rotulo)).toEqual(["PTA", "Equipamento sem tipo"]);
    expect(g[1].pecas).toHaveLength(3);
  });

  it("só o grupo lacuna tem nota, e ela diz a consequência", () => {
    const g = agruparPorTipo([peca("a", "PTA"), peca("b", null)]);
    expect(g[0].nota).toBeUndefined();
    expect(g[1].nota).toContain("filtra por tipo");
  });

  it("lista vazia devolve nenhum grupo", () => {
    expect(agruparPorTipo([])).toEqual([]);
  });
});

describe("pendenciasDaLista", () => {
  const base = "/frota?";

  it("conta em uso SEM responsável — o caso de hoje, 95 máquinas", () => {
    const r = pendenciasDaLista(
      [
        { id: "a", situacao: "em_uso" },
        { id: "b", situacao: "em_uso" },
      ],
      new Set(),
      new Map(),
      base,
    );
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain("2 peças");
    expect(r[0].href).toContain("pendencia=sem_responsavel");
  });

  it("peça DISPONÍVEL sem responsável não é pendência", () => {
    // Ninguém tem de assinar termo por uma máquina que está na prateleira —
    // contá-la aqui encheria a faixa de ruído e ensinaria a ignorá-la.
    const r = pendenciasDaLista(
      [{ id: "a", situacao: "disponivel" }],
      new Set(),
      new Map(),
      base,
    );
    expect(r).toEqual([]);
  });

  it("certificado ausente e vencido contam; próximo e em dia não", () => {
    const r = pendenciasDaLista(
      [
        { id: "a", situacao: "em_uso" },
        { id: "b", situacao: "em_uso" },
        { id: "c", situacao: "em_uso" },
        { id: "d", situacao: "em_uso" },
      ],
      new Set(["a", "b", "c", "d"]),
      new Map([
        ["a", "ausente" as const],
        ["b", "vencido" as const],
        ["c", "proximo" as const],
        ["d", "em_dia" as const],
      ]),
      base,
    );
    expect(r).toHaveLength(1);
    expect(r[0].texto).toContain("2 peças");
  });

  it("singular quando é uma só", () => {
    const r = pendenciasDaLista(
      [{ id: "a", situacao: "em_uso" }],
      new Set(),
      new Map(),
      base,
    );
    expect(r[0].texto).toBe("1 peça está em uso sem termo assinado");
  });

  it("sem pendência devolve vazio, para a faixa SUMIR", () => {
    // E não "tudo em ordem": faixa permanente vira moldura, e deixa de ser
    // lida justamente no dia em que tem conteúdo.
    const r = pendenciasDaLista(
      [{ id: "a", situacao: "em_uso" }],
      new Set(["a"]),
      new Map([["a", "em_dia" as const]]),
      base,
    );
    expect(r).toEqual([]);
  });

  it("as duas pendências convivem", () => {
    const r = pendenciasDaLista(
      [
        { id: "a", situacao: "em_uso" },
        { id: "b", situacao: "em_uso" },
      ],
      new Set(["b"]),
      new Map([["b", "vencido" as const]]),
      base,
    );
    expect(r.map((x) => x.chave)).toEqual(["sem_responsavel", "certificado"]);
  });
});

describe("pendência quando a custódia não pôde ser lida", () => {
  it("null omite a pendência em vez de marcar a frota inteira", () => {
    // Um erro na consulta de custódia devolvendo conjunto vazio diria “ninguém
    // assinou nada” e acenderia a faixa para 128 peças. A faixa só é lida
    // enquanto não dá alarme falso.
    const r = pendenciasDaLista(
      [
        { id: "a", situacao: "em_uso" },
        { id: "b", situacao: "em_uso" },
      ],
      null,
      new Map(),
      "/frota?",
    );
    expect(r).toEqual([]);
  });
});
