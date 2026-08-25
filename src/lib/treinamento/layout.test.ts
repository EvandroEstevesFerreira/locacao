import { describe, expect, it } from "vitest";
import {
  CORES_PERMITIDAS,
  CSS,
  JS,
  navTrilhas,
  secaoModulo,
  PERFIL_LABEL,
} from "./layout";
import * as marca from "@/lib/brand-colors";
import type { Modulo } from "./tipos";

const m: Modulo = {
  id: "obras",
  numero: 4,
  titulo: "Obras",
  perfis: ["administrador", "gestor"],
  problema: "Sem obra, nenhum custo tem dono.",
  caminho: ["Abrir Obras.", "Clicar em Nova obra."],
  exemplo: "A Torre B nasce aqui.",
  exercicios: ["Cadastre uma obra de teste."],
  perguntas: [
    {
      enunciado: "Por que quase toda tela filtra por obra?",
      alternativas: ["Porque a obra é o centro de custo", "Por acaso"],
      correta: 0,
      comentario: "A obra é o centro de custo: todo gasto precisa de um dono.",
    },
  ],
};

describe("paleta", () => {
  it("toda cor de brand-colors está permitida", () => {
    // Sem predicado de tipo: brand-colors exporta literais, e um predicado
    // `v is string` não é atribuível a uma união de literais.
    const daMarca = Object.values(marca).filter((v) => v.startsWith("#"));
    expect(daMarca.length).toBeGreaterThan(10);
    for (const c of daMarca) {
      expect(CORES_PERMITIDAS.map((x) => x.toUpperCase())).toContain(c.toUpperCase());
    }
  });

  it("o vermelho ERRADO é proibido", () => {
    // #cf2927 divergiu da paleta e ainda vive em apresentacao-loca.html.
    expect(CORES_PERMITIDAS.join(" ").toLowerCase()).not.toContain("#cf2927");
    expect(CSS.toLowerCase()).not.toContain("#cf2927");
  });

  it("o CSS não usa nenhuma cor fora da lista permitida", () => {
    const usadas = [...CSS.matchAll(/#[0-9a-fA-F]{6}/g)].map((x) => x[0].toUpperCase());
    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
  });
});

describe("progresso no navegador", () => {
  it("nenhum acesso a localStorage fora de try/catch", () => {
    // Em janela privada e em captura de miniatura o acessor LANÇA. Sem o
    // try/catch a página quebra inteira em vez de abrir sem progresso salvo.
    const semTry = JS.replace(/try\s*\{[\s\S]*?\}\s*catch\s*\([\s\S]*?\}/g, "");
    expect(semTry).not.toContain("localStorage");
  });
});

describe("o JS e o HTML falam a mesma língua", () => {
  // O ambiente do vitest é `node`, sem DOM: não há como exercitar o
  // comportamento do JS. Mas dá para checar ESTATICAMENTE que ele não consulta
  // nada que o layout jamais emite — que foi exatamente o primeiro bug daqui: o
  // progresso buscava `.modulo[data-trilha=...]` e `secaoModulo` nunca escreveu
  // esse atributo, então a barra ficava travada em 0% para sempre.
  // O layout produz DUAS partes: a seção de módulo e o índice. A terceira — a
  // casca da trilha, com a barra de progresso — é montada por `gerar.ts`, e é
  // `gerar.test.ts` que repete esta checagem sobre a página inteira, sem
  // isenção nenhuma.
  const html =
    secaoModulo(m, null) +
    navTrilhas([
      { id: "fundacao", numero: 0, titulo: "Fundação", subtitulo: "s", modulos: [m] },
    ]);

  it("todo atributo data-* que o JS lê existe no HTML gerado", () => {
    const lidos = [
      ...JS.matchAll(/getAttribute\("(data-[a-z-]+)"\)/g),
      ...JS.matchAll(/\[(data-[a-z-]+)=/g),
    ].map((x) => x[1]);

    // `data-trilha` está na barra de progresso, que `gerar.ts` monta.
    const daCasca = new Set(["data-trilha"]);

    for (const attr of new Set(lidos)) {
      if (daCasca.has(attr)) continue;
      expect(html, `o JS lê ${attr}, que o HTML não emite`).toContain(attr);
    }
  });

  it("toda classe que o JS consulta existe no HTML gerado", () => {
    const classes = [...JS.matchAll(/querySelector(?:All)?\('?"?\.([a-z-]+)/g)].map(
      (x) => x[1],
    );
    for (const c of new Set(classes)) {
      expect(html, `o JS consulta .${c}, que o HTML não emite`).toContain(
        `class="${c}`,
      );
    }
  });

  it("não busca módulo por atributo de trilha — busca pelo ancestral", () => {
    // A correção do bug. Se alguém voltar ao seletor por atributo, o teste cai.
    expect(JS).not.toContain('.modulo[data-trilha');
    expect(JS).toContain('getElementById("trilha-"');
  });
});

describe("sem dependência externa", () => {
  it("o CSS não busca font nem imagem de fora", () => {
    expect(CSS).not.toMatch(/@import|https?:\/\//);
  });
});

describe("secaoModulo", () => {
  it("marca para quem é o módulo", () => {
    const html = secaoModulo(m, null);
    expect(html).toContain(PERFIL_LABEL.administrador);
    expect(html).toContain(PERFIL_LABEL.gestor);
    expect(html).not.toContain(PERFIL_LABEL.operador);
  });

  it("usa o id do módulo como âncora", () => {
    expect(secaoModulo(m, null)).toContain('id="obras"');
  });

  it("traz os cinco blocos", () => {
    const html = secaoModulo(m, null);
    for (const rotulo of [
      "O problema",
      "O caminho",
      "No exemplo",
      "Faça você",
      "Confira",
    ]) {
      expect(html, `falta o bloco ${rotulo}`).toContain(rotulo);
    }
  });

  it("embute o diagrama e a legenda quando recebe um", () => {
    const html = secaoModulo(m, {
      titulo: "Anatomia de uma tela de lista",
      legenda: "Todas as listas do Loca repetem esta estrutura.",
      svg: '<svg role="img"></svg>',
    });
    expect(html).toContain("<svg");
    expect(html).toContain("<figcaption>");
    expect(html).toContain("Todas as listas do Loca repetem esta estrutura.");
    expect(secaoModulo(m, null)).not.toContain("<svg");
    expect(secaoModulo(m, null)).not.toContain("<figure>");
  });

  it("guarda a resposta correta em atributo de dado, não em texto visível", () => {
    // O JS lê daqui. Se ficasse no texto, a resposta apareceria na tela.
    expect(secaoModulo(m, null)).toContain('data-correta="0"');
  });

  it("escapa dado que quebraria a marcação", () => {
    const perigoso: Modulo = {
      ...m,
      titulo: "Itens & Contratos <Locação>",
      exemplo: 'A obra "Torre B" & anexos',
    };
    const html = secaoModulo(perigoso, null);
    expect(html).toContain("Itens &amp; Contratos &lt;Locação&gt;");
    expect(html).not.toContain("<Locação>");
  });

  it("não deixa buraco de dado", () => {
    expect(secaoModulo(m, null)).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
});
