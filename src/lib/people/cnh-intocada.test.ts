import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ═══════════════════════════════════════════════════════════════════════════
// A CNH é do Loca, e a sincronização nunca a toca
// ═══════════════════════════════════════════════════════════════════════════
//
// O People NÃO GUARDA CNH — não existe coluna para categoria nem validade em
// tabela nenhuma lá. `cnh`, `cnh_categoria` e `cnh_validade` (migration 0086)
// são o único dado de pessoa que continua sendo do Loca depois da integração.
//
// O QUE ESTE TESTE IMPEDE. Alguém acrescenta um campo ao mapeamento, ou troca o
// `upsert` por um objeto montado a partir da pessoa inteira, e as três colunas
// vão a nulo em 483 linhas. Nada quebra, nada avisa — e o estrago só aparece
// quando perguntarem quem pode dirigir o caminhão, meses depois, sem ninguém
// ligar uma coisa à outra.
//
// O tipo `LinhaFuncionario` já fecha a porta pelo TypeScript. Esta varredura
// fecha a janela: pega escrita montada dinamicamente, que o tipo não vê.

const RAIZ_PEOPLE = join(process.cwd(), "src", "lib", "people");
const COLUNAS_DO_LOCA = ["cnh", "cnh_categoria", "cnh_validade"];

function arquivosDe(dir: string): { nome: string; texto: string }[] {
  const saida: { nome: string; texto: string }[] = [];
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDe(caminho));
    else if (/\.tsx?$/.test(entrada) && !entrada.includes(".test.")) {
      saida.push({ nome: entrada, texto: readFileSync(caminho, "utf8") });
    }
  }
  return saida;
}

/** Tira comentários: o aviso "nunca escreva cnh" não é uma escrita de cnh. */
function semComentarios(texto: string): string {
  return texto
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

describe("a integração com o People nunca escreve CNH", () => {
  const arquivos = arquivosDe(RAIZ_PEOPLE);

  it("a varredura encontra os arquivos da integração", () => {
    // Vacuity: se a pasta mudar de lugar, a lista fica vazia e o teste passaria
    // sem olhar nada.
    const nomes = arquivos.map((a) => a.nome);
    expect(nomes).toContain("mapeamento.ts");
    expect(nomes).toContain("servidor.ts");
    expect(nomes).toContain("cliente.ts");
  });

  it("nenhum arquivo da integração menciona coluna de CNH em código", () => {
    const problemas: string[] = [];

    for (const a of arquivos) {
      const codigo = semComentarios(a.texto);
      for (const coluna of COLUNAS_DO_LOCA) {
        // Palavra inteira: `cnh_categoria` não pode contar como `cnh`, e nada
        // que apenas contenha as letras deve alarmar.
        const re = new RegExp(`\\b${coluna}\\b`);
        if (re.test(codigo)) problemas.push(`${a.nome}: cita \`${coluna}\``);
      }
    }

    expect(
      problemas,
      "O People não guarda CNH em coluna nenhuma. `cnh`, `cnh_categoria` e " +
        "`cnh_validade` são do Loca, e uma escrita a partir da integração as " +
        "zeraria em silêncio — o estrago só apareceria quando alguém " +
        "perguntasse quem pode dirigir o caminhão. Se o People passar a " +
        "entregar CNH, isto vira uma decisão, não um descuido: mude o " +
        "contrato, a spec e este teste, nessa ordem.",
    ).toEqual([]);
  });
});
