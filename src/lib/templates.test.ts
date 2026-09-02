import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  corpoParaParagrafos,
  DEFAULT_TEMPLATES,
  DOCUMENTOS,
  documentosDoModulo,
} from "./templates";

describe("renderTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    expect(renderTemplate("Aluguel: {{aluguel}}", { aluguel: "R$ 1.900,00" })).toBe(
      "Aluguel: R$ 1.900,00",
    );
  });

  it("tolera espaços dentro das chaves", () => {
    expect(renderTemplate("{{ locador }}", { locador: "Fulano" })).toBe("Fulano");
  });

  it("variável desconhecida ou nula vira string vazia", () => {
    expect(renderTemplate("[{{x}}]", {})).toBe("[]");
    expect(renderTemplate("[{{x}}]", { x: null })).toBe("[]");
  });

  it("substitui múltiplas ocorrências", () => {
    expect(renderTemplate("{{a}}-{{a}}", { a: "1" })).toBe("1-1");
  });
});

describe("corpoParaParagrafos", () => {
  it("quebra por linha em branco e junta quebras simples", () => {
    const corpo = "Primeiro\nparágrafo.\n\nSegundo parágrafo.";
    expect(corpoParaParagrafos(corpo)).toEqual([
      "Primeiro parágrafo.",
      "Segundo parágrafo.",
    ]);
  });

  it("ignora parágrafos vazios", () => {
    expect(corpoParaParagrafos("A\n\n\n\nB\n\n")).toEqual(["A", "B"]);
  });
});

describe("DEFAULT_TEMPLATES", () => {
  it("o contrato de imóvel renderiza sem sobrar chaves quando há dados", () => {
    const vars = {
      locataria: "Sistenge",
      locador: "Fulano",
      imovel: "Casa 12 (Casa)",
      imovel_endereco: "Rua X",
      vigencia: "01/01 a 31/12",
      aluguel: "R$ 1.000",
      condominio: "R$ 0",
      iptu: "R$ 0",
      seguro_fianca: "R$ 0",
      total_mensal: "R$ 1.000",
      vencimento: "dia 1",
      indice_reajuste: "IGP-M",
      dados_bancarios: "Banco X",
    };
    const texto = renderTemplate(DEFAULT_TEMPLATES.contrato_imovel.corpo, vars);
    expect(texto).not.toMatch(/\{\{/);
  });
});

describe("catálogo de documentos", () => {
  it("todo documento declara módulo, categoria e preenchimento", () => {
    for (const d of DOCUMENTOS) {
      expect(d.modulo, `documento ${d.tipo}`).toBeTruthy();
      expect(d.categoria, `documento ${d.tipo}`).toBeTruthy();
      expect(["com_dados", "em_branco"]).toContain(d.preenchimento);
    }
  });

  it("filtra por módulo", () => {
    const imoveis = documentosDoModulo("imoveis");
    expect(imoveis.length).toBeGreaterThan(0);
    expect(imoveis.every((d) => d.modulo === "imoveis")).toBe(true);
  });

  it("todo tipo do catálogo tem template padrão", () => {
    for (const d of DOCUMENTOS) {
      expect(DEFAULT_TEMPLATES[d.tipo], `template de ${d.tipo}`).toBeTruthy();
    }
  });
});

describe("termo de compromisso (FRM-RH-001)", () => {
  const tpl = DEFAULT_TEMPLATES.termo_responsabilidade;

  it("o título é o do FRM-RH-001", () => {
    expect(tpl.titulo).toContain("COMPROMISSO");
  });

  it("cobre as regras que sustentam justa causa", () => {
    for (const termo of ["22h", "drogas", "CFTV", "armário", "cozinhar"]) {
      expect(tpl.corpo.toLowerCase()).toContain(termo.toLowerCase());
    }
  });

  it("declara o canal de denúncias exigido pela Lei 14.457/2022", () => {
    expect(tpl.corpo).toContain("sistenge-ouvidoria.vercel.app");
  });

  it("toda variável usada no corpo está declarada no catálogo", () => {
    const doc = DOCUMENTOS.find((d) => d.tipo === "termo_responsabilidade")!;
    const declaradas = new Set(doc.variaveis.map((v) => v.chave));
    const usadas = [...tpl.corpo.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map(
      (m) => m[1],
    );
    // Sem isto o teste passaria por vacuidade se o corpo perdesse as chaves.
    expect(usadas.length).toBeGreaterThan(0);
    for (const u of usadas) expect(declaradas, `variável {{${u}}}`).toContain(u);
  });

  it("declara as variáveis do bloco de identificação, ainda que a estrutura as preencha", () => {
    // Elas não aparecem no corpo — quem as desenha é o CampoGrid do FRM-RH-001.
    // Ficam declaradas para que o RH possa citá-las numa cláusula, se quiser.
    const doc = DOCUMENTOS.find((d) => d.tipo === "termo_responsabilidade")!;
    const chaves = doc.variaveis.map((v) => v.chave);
    for (const c of ["ocupante", "ocupante_cargo", "quarto", "armario", "obra"]) {
      expect(chaves).toContain(c);
    }
  });
});

describe("termo de equipamento (FRM-EQ-001)", () => {
  const tpl = DEFAULT_TEMPLATES.termo_equipamento;

  it("renderiza sem sobrar chaves quando há dados", () => {
    const texto = renderTemplate(tpl.corpo, { empresa_nome: "Sistenge" });
    expect(texto).not.toMatch(/\{\{/);
  });

  it("cita o art. 462 da CLT ao autorizar desconto por dano", () => {
    // O desconto em folha sem previsão expressa é nulo. Sem esta cláusula o
    // termo vira uma declaração de boas intenções: registra a entrega e não
    // sustenta a cobrança do equipamento quebrado por mau uso.
    expect(tpl.corpo).toContain("462");
    expect(tpl.corpo).toMatch(/desgaste natural/);
  });

  it("toda variável usada no corpo está declarada no catálogo", () => {
    const doc = DOCUMENTOS.find((d) => d.tipo === "termo_equipamento")!;
    const declaradas = new Set(doc.variaveis.map((v) => v.chave));
    const usadas = [...tpl.corpo.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map(
      (m) => m[1],
    );
    expect(usadas.length).toBeGreaterThan(0);
    for (const u of usadas) expect(declaradas, `variável {{${u}}}`).toContain(u);
  });

  it("pertence ao módulo de termos", () => {
    // É o que faz o documento aparecer em Configurações › Templates para quem
    // tem o módulo, e sumir para quem não tem — sem código novo de permissão.
    const tipos = documentosDoModulo("termos").map((d) => d.tipo);
    expect(tipos).toContain("termo_equipamento");
  });
});
