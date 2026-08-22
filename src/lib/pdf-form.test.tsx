import { describe, it, expect } from "vitest";
import { renderToBuffer, Text } from "@react-pdf/renderer";
import {
  Documento,
  Secao,
  CampoGrid,
  Lista,
  OpcoesCheck,
  AreaTexto,
  Tabela,
  somaLarguras,
  CAIXA,
  contarPaginas,
  type Coluna,
  type LinhaTabela,
} from "./pdf-form";

describe("contarPaginas", () => {
  it("conta as páginas de um PDF renderizado", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-001" titulo="Documento de teste">
        <Secao n={1} titulo="Seção única">
          <Text>Conteúdo curto.</Text>
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("CampoGrid", () => {
  it("renderiza campo com valor e campo em branco sem estourar", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-002" titulo="Campos">
        <Secao n={1} titulo="Identificação">
          <CampoGrid
            colunas={2}
            campos={[
              { label: "Nome completo", valor: "Fulano de Tal" },
              { label: "RG / Órgão emissor" },
              { label: "CPF", valor: "000.000.000-00" },
              { label: "Contato de emergência" },
            ]}
          />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("primitivos de texto", () => {
  it("lista numerada, opções com linha e área de escrita cabem em 1 página", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-003" titulo="Texto">
        <Secao n={1} titulo="Regras">
          <Lista tipo="numerada" itens={["Primeira regra.", "Segunda regra."]} />
        </Secao>
        <Secao n={2} titulo="Tipo de medida">
          <OpcoesCheck
            opcoes={[
              { texto: "Advertência verbal" },
              { texto: "Suspensão — período:", linha: true },
            ]}
          />
        </Secao>
        <Secao n={3} titulo="Descrição">
          <AreaTexto linhas={4} />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

const COLUNAS_LIMPEZA: Coluna[] = [
  { titulo: "Tarefa", largura: 34 },
  { titulo: "Freq.", largura: 6, alinhar: "center" },
  { titulo: "Seg", largura: 7, alinhar: "center" },
  { titulo: "Ter", largura: 7, alinhar: "center" },
  { titulo: "Qua", largura: 7, alinhar: "center" },
  { titulo: "Qui", largura: 7, alinhar: "center" },
  { titulo: "Sex", largura: 7, alinhar: "center" },
  { titulo: "Sáb", largura: 7, alinhar: "center" },
  { titulo: "Dom", largura: 7, alinhar: "center" },
  { titulo: "Rubrica", largura: 11 },
];

describe("somaLarguras", () => {
  it("as colunas do checklist de limpeza somam 100%", () => {
    expect(somaLarguras(COLUNAS_LIMPEZA)).toBe(100);
  });

  it("as colunas de penalidades somam 100%", () => {
    expect(
      somaLarguras([
        { titulo: "Penalidade", largura: 30 },
        { titulo: "Como se aplica", largura: 70 },
      ]),
    ).toBe(100);
  });
});

describe("Tabela", () => {
  it("o grid de 45 tarefas em paisagem cabe em 2 páginas", async () => {
    const grupos = [
      "BANHEIROS",
      "COZINHA / REFEITÓRIO",
      "QUARTOS",
      "SALA",
      "LAVANDERIA",
    ];
    const linhas: LinhaTabela[] = [];
    for (const g of grupos) {
      linhas.push({ grupo: g });
      for (let i = 0; i < 9; i++) {
        linhas.push({
          celulas: [
            `Tarefa ${i + 1} do grupo ${g}, com descrição de tamanho realista`,
            "D",
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            "",
          ],
        });
      }
    }
    const buffer = await renderToBuffer(
      <Documento
        codigo="FRM-RH-005"
        titulo="Checklist semanal de limpeza"
        orientacao="landscape"
      >
        <Tabela colunas={COLUNAS_LIMPEZA} linhas={linhas} />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
  });
});
