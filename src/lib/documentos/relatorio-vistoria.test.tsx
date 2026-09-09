// O TEXTO do relatório de vistoria.
//
// Existe pelo mesmo motivo que `inspecionar.tsx`: contar páginas e conferir que
// o buffer começa com "%PDF-" já deixou passar dois defeitos que estavam no
// texto, não na forma. Aqui se verifica o que ESTÁ ESCRITO — o rótulo da
// empresa locadora e os dizeres do cabeçalho.

import { describe, expect, it } from "vitest";
import { contemTexto } from "./inspecionar";
import { DocumentoVistoria, type VistoriaPdf } from "@/lib/pdf";

const base: VistoriaPdf = {
  contratoLinha: "Contrato CT-2026-002 · 691",
  contexto: "Devolução de 1 un. de Lenovo ThinkStation P360",
  tipoLabel: "Devolução",
  data: "09/09/2026",
  responsavel: "—",
  avariasCusto: "R$ 0,00",
  avarias: [],
  fotos: [],
  empresaAssinado: false,
  geradoEm: "09/09/2026",
};

describe("relatório de vistoria", () => {
  it("o cabeçalho diz SISTENGE · LOCAÇÕES", () => {
    expect(contemTexto(<DocumentoVistoria v={base} />, "SISTENGE · LOCAÇÕES")).toBe(
      true,
    );
  });

  it("e não diz mais “DE OBRA”", () => {
    // O texto antigo era "SISTENGE · LOCAÇÕES DE OBRA". Sem este caso, a
    // asserção acima passaria com o texto velho, porque ele CONTÉM o novo.
    expect(contemTexto(<DocumentoVistoria v={base} />, "DE OBRA")).toBe(false);
  });

  it("mostra a empresa locadora quando o contrato tem fornecedor", () => {
    const v = { ...base, fornecedor: "A2 WORKS COMERCIO E SERVICOS LTDA" };
    expect(contemTexto(<DocumentoVistoria v={v} />, "Empresa locadora")).toBe(true);
    expect(contemTexto(<DocumentoVistoria v={v} />, "A2 WORKS COMERCIO E SERVICOS LTDA")).toBe(
      true,
    );
  });

  it("sem fornecedor, não imprime o rótulo vazio", () => {
    // Rótulo com valor em branco num documento que vale como prova sugere dado
    // perdido. Melhor a seção não existir.
    expect(contemTexto(<DocumentoVistoria v={base} />, "Empresa locadora")).toBe(
      false,
    );
  });
});
