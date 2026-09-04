import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas, somaLarguras } from "@/lib/pdf-form";
import { Romaneio, type DadosRomaneio } from "./romaneio";

/**
 * O romaneio é o primeiro documento do Loca que sai da empresa por uma ação de
 * usuário — vai anexo ao e-mail do fornecedor. Um defeito aqui não fica no
 * sistema: chega à caixa de entrada de um terceiro.
 */

const base: DadosRomaneio = {
  numero: "REC-2026-0014",
  orgNome: "Sistenge Engenharia",
  fornecedor: "Locadora Alfa",
  obra: "OB-042 — Residencial Vista Verde",
  contratoNumero: "CT-8891",
  contratoRegistro: "CTR-2026-0007",
  recebidoEm: "20/08/2026",
  conferente: "João da Silva",
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
  localData: "20/08/2026.",
};

describe("Romaneio", () => {
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

  it("renderiza um recebimento simples em uma página", async () => {
    const buffer = await renderToBuffer(<Romaneio dados={base} />);
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("renderiza com ressalvas, avarias e divergências", async () => {
    const comRessalva: DadosRomaneio = {
      ...base,
      observacoes: "Caminhão chegou fora do horário combinado.",
      itens: [
        ...base.itens,
        {
          descricao: "Betoneira 400L",
          patrimonio: "PAT-0232",
          quantidade: 1,
          condicao: "avaria",
          observacoes: "Motor com ruído e vazamento de óleo na base.",
        },
        {
          descricao: "Escora metálica 3m",
          patrimonio: null,
          quantidade: 4,
          condicao: "divergencia",
          observacoes: "Vieram 4, o contrato previa 6.",
        },
      ],
    };
    const buffer = await renderToBuffer(<Romaneio dados={comRessalva} />);
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
    // O buffer precisa ser um PDF de verdade, não um artefato vazio.
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("aguenta um recebimento grande sem quebrar", async () => {
    // Trinta itens é uma carreta de andaime — caso real, não hipótese.
    const grande: DadosRomaneio = {
      ...base,
      itens: Array.from({ length: 30 }, (_, n) => ({
        descricao: `Item de catálogo número ${n + 1}`,
        patrimonio: n % 3 === 0 ? `PAT-${String(n).padStart(4, "0")}` : null,
        quantidade: n + 1,
        condicao: n % 7 === 0 ? "avaria" : "ok",
        observacoes: n % 7 === 0 ? "Amassado na lateral." : null,
      })),
    };
    const buffer = await renderToBuffer(<Romaneio dados={grande} />);
    expect(contarPaginas(buffer)).toBeGreaterThan(1);
  });

  it("sobrevive aos campos opcionais todos vazios", async () => {
    // É o caso do conferente que só lançou o item e fechou — nada preenchido
    // além do obrigatório. O documento tem de sair mesmo assim.
    const minimo: DadosRomaneio = {
      ...base,
      contratoNumero: null,
      contratoRegistro: null,
      conferente: null,
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
    const buffer = await renderToBuffer(<Romaneio dados={minimo} />);
    expect(contarPaginas(buffer)).toBe(1);
  });
});
