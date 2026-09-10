import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Varredura: ninguém volta a ler `contato_nome` / `contato_telefone`.
//
// A migration 0104 moveu o contato do fornecedor para a tabela
// `fornecedor_contato`. As duas colunas antigas CONTINUAM no banco de
// propósito: derrubá-las junto com a migration quebraria a produção na janela
// entre aplicar o SQL e publicar o código — quatro telas as liam.
//
// É o padrão expandir-e-contrair, e o risco dele é a fase do meio: coluna que
// existe, tem dado, e não é mais atualizada. Quem a ler daqui em diante recebe
// o valor congelado no dia da migração, sem nada indicar que está velho.
//
// Esta varredura é o que segura a fase do meio até a migration que derruba as
// colunas. Quando ela vier, este arquivo pode ir junto.

const RAIZ = join(process.cwd(), "src");

function arquivos(dir = RAIZ, achados: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados);
    else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe("contato do fornecedor", () => {
  const todos = arquivos();

  it("existe código para varrer", () => {
    expect(todos.length).toBeGreaterThan(100);
  });

  it("nenhum arquivo lê as colunas superadas", () => {
    const infratores = todos
      .filter((caminho) => {
        const texto = readFileSync(caminho, "utf8");
        // Mira no USO COMO COLUNA, e não em qualquer ocorrência do nome:
        //   `f.contato_nome`        -> acesso a propriedade
        //   `contato_nome, ...`     -> dentro da string de um select
        //   `contato_telefone"`     -> fim da string de um select
        // Assim ficam de fora o `id` de HTML (`contato_nome_${i}`, seguido de
        // "_") e as menções em comentário, que são justamente onde a decisão
        // está documentada.
        return /(\.contato_(nome|telefone))|(contato_(nome|telefone)\s*[:,"'])/.test(
          texto,
        );
      })
      .map((c) => c.replace(RAIZ, "src").replace(/\\/g, "/"));

    expect(
      infratores,
      `\`contato_nome\` e \`contato_telefone\` foram superadas pela tabela fornecedor_contato (migration 0104) e não são mais atualizadas. Quem as ler recebe o valor congelado no dia da migração.\nUse \`fornecedor_contato\` — na listagem, o \`contatoPrincipal\` já vem achatado.\n${infratores.join("\n")}`,
    ).toEqual([]);
  });

  it("`contato_email` continua permitido — é a caixa da empresa", () => {
    // O oposto do caso acima, e por isso está aqui: `contato_email` NÃO foi
    // superado. É o destinatário do romaneio e do termo de devolução, e seis
    // pontos do código dependem dele. Sem este caso, alguém lendo o teste
    // acima concluiria que os três campos morreram juntos.
    const usam = todos.filter((c) =>
      readFileSync(c, "utf8").includes("contato_email"),
    );
    expect(usam.length).toBeGreaterThan(0);
  });
});
