import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { TermoEquipamento, type ItemTermoDoc } from "./frm-eq-001";

// Mesmo motivo dos outros testes de documento: `renderToBuffer` e CPU-bound e,
// na suite completa, disputa com os demais arquivos em paralelo. Ver a nota em
// pdf-form.test.tsx.
vi.setConfig({ testTimeout: 120_000 });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const CAMPOS = [
  { label: "Funcionario", valor: "Fulano de Tal" },
  { label: "CPF", valor: "111.222.333-44" },
  { label: "Obra", valor: "OB-042 Residencial Alto da Serra" },
  { label: "Data da entrega", valor: "02/09/2026" },
];

const PARAGRAFOS = [
  "DECLARACAO",
  "Declaro ter recebido os equipamentos relacionados neste termo, em perfeitas condicoes de uso, comprometendo-me a zelar por sua conservacao.",
  "— Responsabilizo-me por danos decorrentes de mau uso, negligencia ou extravio.",
  "— Comprometo-me a devolver os equipamentos no prazo previsto ou quando solicitado.",
];

function item(over: Partial<ItemTermoDoc> = {}): ItemTermoDoc {
  return {
    descricao: "Betoneira 400L",
    patrimonio: "PAT-0431",
    quantidade: "1",
    estadoEntrega: "Bom",
    ...over,
  };
}

describe("FRM-EQ-001", () => {
  it("termo com 3 itens e assinatura desenhada cabe em 1 pagina", async () => {
    const buffer = await renderToBuffer(
      <TermoEquipamento
        orgNome="Sistenge Engenharia"
        numero="TRM-2026-0001"
        campos={CAMPOS}
        itens={[
          item(),
          item({ descricao: "Furadeira de impacto", patrimonio: "PAT-0512" }),
          item({ descricao: "Capacete", patrimonio: null, quantidade: "2" }),
        ]}
        paragrafos={PARAGRAFOS}
        localData="Sao Paulo, 2 de setembro de 2026."
        assinantes={[
          {
            papel: "Funcionario",
            nome: "Fulano de Tal",
            imagem: PNG,
            detalhe: "Assinado em 02/09/2026 as 09:15 — IP 187.0.0.1",
          },
          { papel: "Sistenge Engenharia", nome: "Beltrano", imagem: PNG },
        ]}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("a devolucao e COLUNA do mesmo documento, nao um segundo papel", async () => {
    // Quem confere a volta precisa ver, na mesma linha, em que estado a peca
    // saiu e em que estado voltou. Dois papeis obrigariam a comparar duas
    // folhas, que e onde a divergencia se perde.
    const buffer = await renderToBuffer(
      <TermoEquipamento
        orgNome="Sistenge Engenharia"
        numero="TRM-2026-0002"
        campos={CAMPOS}
        itens={[
          item({ dataDevolucao: "20/09/2026", estadoDevolucao: "Com avaria" }),
          item({ descricao: "Capacete", patrimonio: null }),
        ]}
        paragrafos={PARAGRAFOS}
        localData="Sao Paulo, 20 de setembro de 2026."
        assinantes={[{ papel: "Funcionario", nome: "Fulano", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("rascunho sem numero nao quebra o cabecalho", async () => {
    const buffer = await renderToBuffer(
      <TermoEquipamento
        orgNome="Sistenge Engenharia"
        numero={null}
        campos={CAMPOS}
        itens={[item()]}
        paragrafos={PARAGRAFOS}
        localData="Sao Paulo, 2 de setembro de 2026."
        assinantes={[{ papel: "Funcionario", nome: "Fulano", imagem: null }]}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("25 itens cabem em 2 paginas", async () => {
    // O limite real de uma entrega de almoxarifado num dia de mobilizacao.
    const buffer = await renderToBuffer(
      <TermoEquipamento
        orgNome="Sistenge Engenharia"
        numero="TRM-2026-0003"
        campos={CAMPOS}
        itens={Array.from({ length: 25 }, (_, i) =>
          item({ descricao: `Equipamento ${i + 1}`, patrimonio: `PAT-${1000 + i}` }),
        )}
        paragrafos={PARAGRAFOS}
        localData="Sao Paulo, 2 de setembro de 2026."
        assinantes={[{ papel: "Funcionario", nome: "Fulano", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
  });
});
