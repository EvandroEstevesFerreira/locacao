import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Varredura: NINGUÉM abre custódia de funcionário sem termo.
//
// O BANCO já proíbe, na migration 0059:
//
//   check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null))
//
// com o motivo escrito ao lado: "posse de funcionário só nasce por termo
// assinado. No BANCO, e não só na tela: a tela pode estar velha, e o valor do
// termo é justamente ser a única fonte de verdade sobre quem respondeu pelo
// equipamento". `moverPeca` respeita isso desde sempre — `custodia.ts` registra
// que "funcionario NÃO está entre os destinos".
//
// POR QUE ISTO EXISTE MESMO ASSIM. O mutirão de custódia da 0.97.0 chamou
// `abrirCustodia` com `tipo: "funcionario"` e `origem: "manual"`. Typecheck,
// lint, 1255 testes e build passaram todos: o tipo `AberturaCustodia` aceita a
// combinação, e a recusa só aparece no `check` do Postgres. Em produção, as 88
// confirmações falharam uma a uma com "Não foi possível registrar a posse da
// peça" — sem dizer por quê, porque o insert é genérico.
//
// Esta varredura move a reprovação para antes do deploy.

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

/** Cada chamada de `abrirCustodia(`, com o trecho que carrega os argumentos. */
function chamadas(texto: string): string[] {
  const saida: string[] = [];
  const re = /abrirCustodia\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    // Janela generosa: o objeto de argumentos deste projeto tem comentários
    // longos entre os campos, e cortar curto deixaria o `origem` fora.
    saida.push(texto.slice(m.index, m.index + 1200));
  }
  return saida;
}

describe("custódia de funcionário exige termo", () => {
  const todos = arquivos();

  it("existe código para varrer", () => {
    expect(todos.length).toBeGreaterThan(100);
  });

  it("nenhuma chamada abre posse de funcionário com origem manual", () => {
    const infratores: string[] = [];

    for (const caminho of todos) {
      const texto = readFileSync(caminho, "utf8");
      if (!texto.includes("abrirCustodia")) continue;
      for (const trecho of chamadas(texto)) {
        const ehFuncionario = /tipo:\s*["']funcionario["']/.test(trecho);
        const ehManual = /origem:\s*["']manual["']/.test(trecho);
        if (ehFuncionario && ehManual) {
          infratores.push(caminho.replace(RAIZ, "src").replace(/\\/g, "/"));
        }
      }
    }

    expect(
      infratores,
      `Posse de FUNCIONÁRIO com origem "manual". O check custodia_funcionario_exige_termo (migration 0059) recusa isso no banco, e a mensagem que chega ao usuário não diz por quê.\nQuem está com a peça se registra EMITINDO O TERMO, que cria a posse por 'moverPecasDoTermo' com origem 'termo'.\n${infratores.join("\n")}`,
    ).toEqual([]);
  });
});
