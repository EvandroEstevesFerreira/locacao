import { describe, expect, it } from "vitest";
import { validarTrilhas, type Trilha, type Modulo } from "./tipos";
import { TRILHA_0 } from "./trilha-0";
import { TRILHA_A } from "./trilha-a";

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

// ---------------------------------------------------------------------------
// Cobertura por trilha
// ---------------------------------------------------------------------------

describe("TRILHA_0", () => {
  it("é válida sozinha, exceto pela contagem total", () => {
    const problemas = validarTrilhas([TRILHA_0]);
    expect(problemas.filter((p) => !p.includes("esperado 18"))).toEqual([]);
  });

  it("tem os seis módulos previstos, nesta ordem", () => {
    expect(TRILHA_0.modulos.map((m) => m.id)).toEqual([
      "visao-geral",
      "primeiro-acesso",
      "perfis",
      "obras",
      "fornecedores",
      "financeiro-relatorios",
    ]);
  });

  it("diz que são doze relatórios — o manual antigo dizia outro número", () => {
    const m = TRILHA_0.modulos.find((x) => x.id === "financeiro-relatorios")!;
    const texto = [m.problema, ...m.caminho, m.exemplo].join(" ");
    expect(texto).toMatch(/doze|12/);
  });

  it("desfaz a confusão entre competência e vencimento", () => {
    // É o erro de lançamento mais comum, e o que estraga o custo da obra nos
    // dois meses. Se o módulo deixar de explicar isso, o teste cai.
    const m = TRILHA_0.modulos.find((x) => x.id === "financeiro-relatorios")!;
    const texto = [m.problema, ...m.caminho, ...m.perguntas.map((p) => p.comentario)]
      .join(" ")
      .toLowerCase();
    expect(texto).toContain("competência");
    expect(texto).toContain("vencimento");
  });

  it("o fio condutor começa aqui", () => {
    const texto = TRILHA_0.modulos.map((m) => m.exemplo).join(" ");
    expect(texto).toContain("Alto da Serra");
    expect(texto).toContain("Bandeirantes");
  });
});

describe("TRILHA_A", () => {
  it("é válida sozinha, exceto pela contagem total", () => {
    const problemas = validarTrilhas([TRILHA_A]);
    expect(problemas.filter((p) => !p.includes("esperado 18"))).toEqual([]);
  });

  it("tem os seis módulos previstos, nesta ordem", () => {
    expect(TRILHA_A.modulos.map((m) => m.id)).toEqual([
      "itens",
      "contrato-fornecedor",
      "recebimento",
      "vistoria-retirada",
      "devolucao",
      "avarias",
    ]);
  });

  it("o recebimento cobre o que a 0.39.0 entregou", () => {
    const m = TRILHA_A.modulos.find((x) => x.id === "recebimento")!;
    const texto = [m.problema, ...m.caminho, m.exemplo].join(" ").toLowerCase();
    for (const assunto of ["patrimônio", "nota", "fora do contrato", "data"]) {
      expect(texto, `recebimento deve falar de ${assunto}`).toContain(assunto);
    }
  });

  it("NÃO promete o e-mail ao fornecedor, que ainda não existe", () => {
    // O texto de ajuda do próprio sistema diz que o recebimento fechado é
    // "comunicado ao fornecedor" — e não é: a fase 1a não entregou o envio. O
    // treinamento não repete isso.
    const m = TRILHA_A.modulos.find((x) => x.id === "recebimento")!;
    const texto = [...m.caminho, ...m.perguntas.map((p) => p.comentario)].join(" ");
    expect(texto).toMatch(/ainda não existe|não é automático/);
  });

  it("o fio condutor atravessa a trilha", () => {
    const texto = TRILHA_A.modulos.map((m) => m.exemplo).join(" ");
    expect(texto).toContain("BT-4412");
    expect(texto).toContain("Bandeirantes");
  });

  it("nenhum módulo está marcado em construção", () => {
    // O recibo de ferramenta não é módulo: é aviso ao fim da trilha (gerar.ts).
    expect(TRILHA_A.modulos.filter((m) => m.emConstrucao)).toEqual([]);
  });
});
