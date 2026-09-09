// Teste-guarda: TODO documento em PDF do Loca desenha a marca.
//
// O Manual de Identidade Visual 2026 pede a marca em toda a comunicação, e um
// romaneio que vai ao fornecedor ou um relatório de vistoria que vira anexo de
// contrato são comunicação. A varredura manual respondia "quem tem logo hoje";
// este teste responde "quem tem logo sempre" -- foi assim que se descobriu que
// `DocumentoVistoria` era o único sem, e é assim que o próximo documento não
// nasce sem.
//
// Cobre os PRIMITIVOS DE TOPO, e não os ~14 documentos concretos, porque é onde
// o cabeçalho mora: `Documento` (pdf-form) serve os doze formulários e termos,
// e os três de `pdf.tsx` servem o resto. Documento novo que não passe por um
// destes quatro é justamente o caso que este arquivo precisa crescer para pegar.

import { describe, expect, it } from "vitest";
import { temLogo } from "./inspecionar";
import {
  DocumentoRelatorio,
  DocumentoTexto,
  DocumentoVistoria,
  type VistoriaPdf,
} from "@/lib/pdf";
import { Documento } from "@/lib/pdf-form";
import type { Relatorio } from "@/lib/relatorios";

const vistoria: VistoriaPdf = {
  contratoLinha: "Contrato CT-2026-001 · 800",
  tipoLabel: "Entrada (retirada)",
  data: "03/10/2025",
  responsavel: "—",
  avariasCusto: "R$ 0,00",
  avarias: [],
  fotos: [],
  empresaAssinado: false,
  geradoEm: "09/09/2026",
};

const relatorio: Relatorio = {
  titulo: "Custo por obra",
  colunas: [
    { key: "obra", label: "Obra", tipo: "texto" },
    { key: "custo", label: "Custo", tipo: "moeda" },
  ],
  linhas: [{ obra: "800", custo: 1234.5 }],
};

describe("a marca em todo documento", () => {
  it("DocumentoVistoria desenha a marca", () => {
    expect(temLogo(<DocumentoVistoria v={vistoria} />)).toBe(true);
  });

  it("DocumentoTexto desenha a marca", () => {
    expect(
      temLogo(
        <DocumentoTexto
          orgNome="Sistenge"
          eyebrow="Locações de obra"
          titulo="Termo"
          infos={[{ label: "Obra", valor: "800" }]}
          paragrafos={["Corpo do termo."]}
          assinaturas={[{ nome: "Evandro", papel: "Supervisor" }]}
          localData="São Paulo, 9 de setembro de 2026."
        />,
      ),
    ).toBe(true);
  });

  it("DocumentoRelatorio desenha a marca", () => {
    expect(temLogo(<DocumentoRelatorio relatorio={relatorio} />)).toBe(true);
  });

  it("Documento (formulários e termos) desenha a marca", () => {
    expect(
      temLogo(
        <Documento codigo="FRM-EQ-001" titulo="Romaneio">
          <></>
        </Documento>,
      ),
    ).toBe(true);
  });

  it("e o detector NÃO passa de graça: árvore sem marca dá false", () => {
    expect(temLogo(<DocumentoTexto
      orgNome="Sistenge"
      eyebrow="x"
      titulo="x"
      infos={[]}
      paragrafos={[]}
      assinaturas={[]}
      localData="x"
    />)).toBe(true);
    expect(temLogo(<div><span>sem marca aqui</span></div>)).toBe(false);
  });
});
