import { describe, it, expect } from "vitest";
import { renderToBuffer, Text } from "@react-pdf/renderer";
import {
  Documento,
  Secao,
  CampoGrid,
  Lista,
  OpcoesCheck,
  AreaTexto,
  contarPaginas,
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
