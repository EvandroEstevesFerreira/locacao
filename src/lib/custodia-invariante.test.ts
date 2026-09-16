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

/**
 * Os ARGUMENTOS de cada chamada de `abrirCustodia(`, por parênteses casados.
 *
 * Janela de tamanho fixo NÃO serve: `moverPecasDoTermo` tem as duas chamadas —
 * a da entrega, que amarra o termo, e a da devolução, que não pode amarrar —
 * a poucas linhas uma da outra. Qualquer janela generosa o bastante para
 * alcançar os campos de uma alcança os da outra, e a varredura acusaria a
 * inocente ou inocentaria a culpada.
 */
function chamadas(texto: string): string[] {
  const saida: string[] = [];
  const re = /abrirCustodia\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    let nivel = 0;
    const abre = m.index + m[0].length - 1;
    for (let i = abre; i < texto.length; i++) {
      const c = texto[i];
      if (c === "(") nivel++;
      else if (c === ")") {
        nivel--;
        if (nivel === 0) {
          saida.push(texto.slice(abre, i + 1));
          break;
        }
      }
    }
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

describe("devolução não pertence ao termo da entrega", () => {
  // A POSSE DE ALMOXARIFADO NUNCA NASCE AMARRADA A UM TERMO.
  //
  // `liberarPecas` abria a posse de almoxarifado passando o `termoId` do termo
  // que estava sendo ENCERRADO naquele instante. A posse nascia apontando para
  // o documento que diz o contrário dela, e o resultado foi a única anomalia do
  // banco: termo encerrado com posse aberta (peça 14L4594, TRM-2026-0040).
  // Medido em 16/09/2026: 1 posse de almoxarifado com termo em 144.
  //
  // A PRIMEIRA VERSÃO DESTA VARREDURA COBRAVA `liberarPecas` PELO NOME, e por
  // isso ficou verde com o buraco aberto: `moverPecasDoTermo(id, "devolucao")`
  // — o caminho do "Encerrar" e o do "Cancelar", que são os mais usados —
  // continuava passando `termoId`. Cobrar uma função pelo nome protege aquela
  // função; o que precisa de proteção é a INVARIANTE.
  //
  // Então a varredura não conhece nome nenhum: pega TODA chamada de
  // `abrirCustodia` em `src/`, em qualquer arquivo, e reprova a que abre posse
  // de almoxarifado carregando termo. Arquivo novo entra por existir.
  const todos = arquivos();

  it("nenhuma chamada abre posse de almoxarifado com termo", () => {
    const infratores: string[] = [];

    for (const caminho of todos) {
      const texto = readFileSync(caminho, "utf8");
      if (!texto.includes("abrirCustodia")) continue;
      for (const argumentos of chamadas(texto)) {
        const ehAlmoxarifado = /tipo:\s*["']almoxarifado["']/.test(argumentos);
        // `termoId: null` é explícito e honesto, e passa.
        const levaTermo = /\btermoId\b\s*:\s*(?!null\b)/.test(argumentos);
        if (ehAlmoxarifado && levaTermo) {
          infratores.push(caminho.replace(RAIZ, "src").replace(/\\/g, "/"));
        }
      }
    }

    expect(
      infratores,
      "Posse de ALMOXARIFADO nascendo amarrada a um termo. A peça volta ao " +
        "almoxarifado justamente quando o termo deixa de valer — encerrado ou " +
        "cancelado — e a posse aberta ficaria apontando para o documento que " +
        "diz o contrário dela (anomalia 14L4594 / TRM-2026-0040).\nSó a ENTREGA " +
        'amarra posse a termo. Na volta, `origem: "termo"` já diz por que a peça voltou.\n' +
        infratores.join("\n"),
    ).toEqual([]);
  });

  it("a varredura enxerga as chamadas que existem", () => {
    // Sem isto, um erro no extrator de argumentos deixaria o teste acima
    // passando por vacuidade — verde sem ter olhado para nada.
    const comChamada = todos.filter((c) =>
      readFileSync(c, "utf8").includes("abrirCustodia("),
    );
    expect(comChamada.length).toBeGreaterThanOrEqual(3);
  });
});
