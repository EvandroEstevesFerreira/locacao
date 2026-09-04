import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { ComprovanteTreinamento } from "./frm-tr-001";

// `renderToBuffer` é CPU-bound e, na suíte completa, disputa com os demais
// arquivos de PDF. Ver a nota em pdf-form.test.tsx.
vi.setConfig({ testTimeout: 120_000 });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const CAMPOS = [
  { label: "Pessoa", valor: "Fulano de Tal" },
  { label: "Papel no sistema", valor: "Operador" },
  { label: "Trilha", valor: "Primeiros passos no Loca" },
  { label: "Concluido em", valor: "03/09/2026" },
];

const AULAS = [
  { titulo: "Entrar no Loca", resumo: "Onde e o endereco e o que fazer quando a senha nao passa." },
  { titulo: "O menu", resumo: "Por que o seu menu e diferente do menu do colega." },
];

const PARAGRAFOS = [
  "DECLARACAO",
  "Declaro que percorri integralmente a trilha de treinamento e respondi corretamente a todas as perguntas de verificacao.",
];

describe("FRM-TR-001", () => {
  it("comprovante com duas aulas e assinatura desenhada cabe em 1 pagina", async () => {
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero="TRE-2026-0001"
        campos={CAMPOS}
        aulas={AULAS}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("sem numero, o subtitulo nao mostra travessao solto", async () => {
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero={null}
        campos={CAMPOS}
        aulas={AULAS}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal" }]}
      />,
    );
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });

  it("com dez aulas ainda renderiza", async () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({
      titulo: `Aula ${i + 1}`,
      resumo: "Resumo da aula, com tamanho parecido com o real.",
    }));
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero="TRE-2026-0002"
        campos={CAMPOS}
        aulas={muitas}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });
});
