import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas, somaLarguras } from "@/lib/pdf-form";
import { TermoDevolucao, type DadosTermoDevolucao } from "./termo-devolucao";
import { textoDe, contemTexto } from "./inspecionar";

// `renderToBuffer` é CPU-bound e, na suíte completa, disputa com os demais
// arquivos de documento em paralelo. Ver a nota em pdf-form.test.tsx.
vi.setConfig({ testTimeout: 120_000 });

/**
 * O termo de devolução sai da empresa por ação de usuário — vai anexo ao e-mail
 * do fornecedor. Um defeito aqui não fica no sistema: chega à caixa de entrada
 * de um terceiro, e é sobre este papel que a cobrança de reposição é discutida.
 *
 * Metade destes casos LÊ o documento em vez de contar páginas. Contar página
 * foi o que deixou passar o rodapé "Recursos Humanos" num romaneio de
 * fornecedor e a fusão de listas de 0.58.1.
 */

const base: DadosTermoDevolucao = {
  numero: "DEV-2026-0009",
  orgNome: "Sistenge Engenharia",
  fornecedor: "Locadora Alfa",
  obra: "OB-042 — Residencial Vista Verde",
  contratoNumero: "CT-8891",
  contratoRegistro: "CTR-2026-0007",
  devolvidoEm: "05/09/2026",
  responsavel: "João da Silva",
  notaFornecedor: "NF 12345",
  observacoes: null,
  itens: [
    {
      descricao: "Betoneira 400L",
      patrimonio: "PAT-0231",
      quantidade: 1,
      condicao: "ok",
      observacoes: null,
    },
    {
      descricao: "Andaime 1,5m",
      patrimonio: null,
      quantidade: 12,
      condicao: "ok",
      observacoes: null,
    },
  ],
  localData: "05/09/2026.",
};

describe("TermoDevolucao — o que está escrito", () => {
  it("o título diz DEVOLUÇÃO, não recebimento", () => {
    // O termo nasceu como cópia do romaneio. Trocar os dados e esquecer o
    // título produziria um documento que diz "Romaneio de recebimento" com a
    // lista do que VOLTOU — e o fornecedor leria como uma segunda entrega.
    const doc = <TermoDevolucao dados={base} />;
    expect(contemTexto(doc, "Termo de devolução de equipamento")).toBe(true);
    expect(contemTexto(doc, "Romaneio de recebimento")).toBe(false);
    expect(contemTexto(doc, "Itens devolvidos")).toBe(true);
  });

  it("o rodapé é o de locações, não o de Recursos Humanos", () => {
    // O DEFEITO QUE ESTE CASO GUARDA: o primitivo `Documento` já teve
    // "Recursos Humanos" cravado no rodapé, e o romaneio saiu com ele para o
    // fornecedor. Só apareceu quando alguém abriu o PDF e leu.
    const doc = <TermoDevolucao dados={base} />;
    expect(contemTexto(doc, "controle de locações")).toBe(true);
    expect(contemTexto(doc, "Recursos Humanos")).toBe(false);
  });

  it("o número do registro aparece no documento", () => {
    // É por ele que a obra e o fornecedor vão se referir a esta devolução.
    expect(contemTexto(<TermoDevolucao dados={base} />, "DEV-2026-0009")).toBe(true);
  });

  it("os dois números do contrato aparecem", () => {
    // O nosso identifica o registro; o deles é o que o fornecedor tem no
    // próprio sistema. Perder um dos dois obriga a uma ligação.
    const doc = <TermoDevolucao dados={base} />;
    expect(contemTexto(doc, "CTR-2026-0007")).toBe(true);
    expect(contemTexto(doc, "CT-8891")).toBe(true);
  });

  it("as condições saem em português, não como chave de banco", () => {
    const comAvaria: DadosTermoDevolucao = {
      ...base,
      itens: [
        { ...base.itens[0], condicao: "avaria", observacoes: "Mangote rompido." },
        { ...base.itens[1], condicao: "faltante", observacoes: "Extraviado na frente 3." },
      ],
    };
    const doc = <TermoDevolucao dados={comAvaria} />;
    const texto = textoDe(doc);
    expect(contemTexto(doc, "Com avaria")).toBe(true);
    expect(contemTexto(doc, "Não devolvido")).toBe(true);
    // As chaves cruas não podem vazar para o papel do fornecedor.
    expect(texto).not.toMatch(/\bfaltante\b/);
  });

  it("as ressalvas aparecem em seção própria, com a descrição do dano", () => {
    // Enterrar a ressalva numa célula da tabela é como ela passa despercebida
    // até virar discussão de fatura. A seção separada é o ponto do documento.
    const comAvaria: DadosTermoDevolucao = {
      ...base,
      itens: [
        base.itens[0],
        {
          descricao: "Vibrador de imersão",
          patrimonio: "VI-0087",
          quantidade: 1,
          condicao: "avaria",
          observacoes: "Mangote rompido a 40 cm do cabeçote.",
        },
      ],
    };
    const doc = <TermoDevolucao dados={comAvaria} />;
    expect(contemTexto(doc, "Ressalvas da devolução")).toBe(true);
    expect(contemTexto(doc, "Mangote rompido a 40 cm do cabeçote")).toBe(true);
    expect(contemTexto(doc, "VI-0087")).toBe(true);
  });

  it("sem ressalva, a seção de ressalvas não existe", () => {
    // Uma seção "Ressalvas" vazia num documento assinado convida a pergunta
    // "o que ficou faltando aqui?".
    expect(contemTexto(<TermoDevolucao dados={base} />, "Ressalvas da devolução")).toBe(
      false,
    );
  });

  it("as assinaturas nomeiam os dois lados corretamente", () => {
    const doc = <TermoDevolucao dados={base} />;
    // Quem entrega é a obra; quem recebe é o fornecedor. Invertido, o documento
    // diria que a Sistenge recebeu o próprio equipamento de volta.
    expect(contemTexto(doc, "Entregue por — obra")).toBe(true);
    expect(contemTexto(doc, "Recebido por — Locadora Alfa")).toBe(true);
  });

  it("não sobra placeholder nem undefined no texto", () => {
    const texto = textoDe(<TermoDevolucao dados={base} />);
    expect(texto).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
});

describe("TermoDevolucao — a forma", () => {
  it("as colunas somam 100% da largura", () => {
    // Tabela cujas colunas não somam 100 desalinha em silêncio, e o erro só
    // aparece impresso — na mão do fornecedor.
    expect(
      somaLarguras([
        { titulo: "Item", largura: 44 },
        { titulo: "Patrimônio / série", largura: 20 },
        { titulo: "Qtd.", largura: 8, alinhar: "center" },
        { titulo: "Condição", largura: 14 },
        { titulo: "Observações", largura: 14 },
      ]),
    ).toBe(100);
  });

  it("uma devolução simples cabe em uma página", async () => {
    const buffer = await renderToBuffer(<TermoDevolucao dados={base} />);
    expect(contarPaginas(buffer)).toBe(1);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("aguenta uma devolução grande sem quebrar", async () => {
    // Trinta itens é uma carreta de andaime voltando — caso real, não hipótese.
    const grande: DadosTermoDevolucao = {
      ...base,
      itens: Array.from({ length: 30 }, (_, n) => ({
        descricao: `Item de catálogo número ${n + 1}`,
        patrimonio: n % 3 === 0 ? `PAT-${String(n).padStart(4, "0")}` : null,
        quantidade: n + 1,
        condicao: n % 7 === 0 ? "avaria" : "ok",
        observacoes: n % 7 === 0 ? "Amassado na lateral." : null,
      })),
    };
    const buffer = await renderToBuffer(<TermoDevolucao dados={grande} />);
    expect(contarPaginas(buffer)).toBeGreaterThan(1);
  });

  it("sobrevive aos campos opcionais todos vazios", async () => {
    // É o caso de quem só lançou o item e fechou — nada preenchido além do
    // obrigatório. O documento tem de sair mesmo assim.
    const minimo: DadosTermoDevolucao = {
      ...base,
      contratoNumero: null,
      contratoRegistro: null,
      responsavel: null,
      notaFornecedor: null,
      observacoes: null,
      itens: [
        {
          descricao: "Andaime 1,5m",
          patrimonio: null,
          quantidade: 1,
          condicao: "ok",
          observacoes: null,
        },
      ],
    };
    const buffer = await renderToBuffer(<TermoDevolucao dados={minimo} />);
    expect(contarPaginas(buffer)).toBe(1);
  });
});
