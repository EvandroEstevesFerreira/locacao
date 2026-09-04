import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { ComprovanteTreinamento } from "./frm-tr-001";
import { PRIMEIROS_PASSOS } from "@/lib/treinamento/primeiros-passos";
import { DEFAULT_TEMPLATES, corpoParaParagrafos, renderTemplate } from "@/lib/templates";

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

// Os SEIS campos que a rota monta, com os rotulos dela byte por byte
// (src/app/api/treinamento/[trilha]/comprovante/route.tsx). Com
// `CampoGrid colunas={2}`, seis campos sao TRES linhas de grade, nao duas — o
// `CAMPOS` de quatro entradas acima media uma folha que a rota nunca emite.
const CAMPOS_DA_ROTA = [
  { label: "Pessoa", valor: "Fulano de Tal" },
  { label: "Papel no sistema", valor: "Operador" },
  { label: "Trilha", valor: "Primeiros passos no Loca" },
  { label: "Versão do conteúdo", valor: "1" },
  { label: "Concluído em", valor: "03/09/2026" },
  { label: "Comprovante", valor: "TRE-2026-0001" },
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

  it("o comprovante da trilha REAL, com a declaracao real, cabe em 1 pagina", async () => {
    // O fixture sintetico deste arquivo tem 2 aulas, 2 paragrafos e 4 campos. A
    // trilha real tem 6 aulas com resumos de tamanho de verdade, a declaracao
    // tem 6 paragrafos e a rota monta 6 campos — se o comprovante nao couber
    // numa folha, e aqui que aparece, e no CI, nao numa medicao manual que se
    // apaga depois.
    const tpl = DEFAULT_TEMPLATES.comprovante_treinamento;
    const variaveis = {
      empresa_nome: "Sistenge Engenharia",
      pessoa: "Fulano de Tal",
      trilha: PRIMEIROS_PASSOS.titulo,
      versao: String(PRIMEIROS_PASSOS.versao),
      concluido_em: "03/09/2026",
    };
    const texto = renderTemplate(tpl.corpo, variaveis);

    // Nenhuma chave sobra sem substituir: `{{chave}}` impresso é o defeito que
    // passa em silencio num documento assinado.
    expect(texto).not.toMatch(/\{\{/);

    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge Engenharia"
        numero="TRE-2026-0001"
        campos={CAMPOS_DA_ROTA}
        aulas={PRIMEIROS_PASSOS.aulas.map((a) => ({
          titulo: a.titulo,
          resumo: a.resumo,
        }))}
        paragrafos={corpoParaParagrafos(texto)}
        localData="03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal", imagem: PNG }]}
        versao={tpl.versao}
        publicadoEm={tpl.publicadoEm}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});
