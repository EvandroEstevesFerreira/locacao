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

  it("só a posse de FUNCIONÁRIO pode carregar termo", () => {
    const infratores: string[] = [];

    for (const caminho of todos) {
      const texto = readFileSync(caminho, "utf8");
      if (!texto.includes("abrirCustodia")) continue;
      for (const argumentos of chamadas(texto)) {
        // `termoId: null` é explícito e honesto, e passa.
        const levaTermo = /\btermoId\b\s*:\s*(?!null\b)/.test(argumentos);
        if (!levaTermo) continue;
        // A REGRA É PELO LADO DE CÁ, e não "reprove quem for almoxarifado".
        //
        // A versão anterior procurava `tipo: "almoxarifado"` literal e por isso
        // tinha um buraco justamente no arquivo que esta onda mais mexeu:
        // `movimentarPeca` passa `tipo: posseFinal`, uma variável que vale
        // "almoxarifado" em dois dos quatro destinos. Acrescentar `termoId` ali
        // deixaria o teste verde.
        //
        // Invertida, a regra não depende de adivinhar o valor: só a ENTREGA
        // amarra posse a termo, e entrega é posse de funcionário, escrita
        // literalmente (o check `custodia_funcionario_exige_termo` cobra o par).
        // Qualquer outro `tipo` — literal ou calculado — com termo é infração.
        const ehFuncionarioLiteral = /tipo:\s*["']funcionario["']/.test(argumentos);
        if (!ehFuncionarioLiteral) {
          infratores.push(caminho.replace(RAIZ, "src").replace(/\\/g, "/"));
        }
      }
    }

    expect(
      infratores,
      "Posse que NÃO é de funcionário nascendo amarrada a um termo. A peça " +
        "volta ao almoxarifado justamente quando o termo deixa de valer — " +
        "encerrado ou cancelado — e a posse aberta ficaria apontando para o " +
        "documento que diz o contrário dela (anomalia 14L4594 / TRM-2026-0040).\n" +
        'Só a ENTREGA amarra posse a termo. Na volta, `origem: "termo"` já diz ' +
        "por que a peça voltou.\n" +
        infratores.join("\n"),
    ).toEqual([]);
  });

  it("o extrator realmente extrai — a varredura não passa por vacuidade", () => {
    // CONTAR ARQUIVOS NÃO SERVE: um extrator quebrado devolvendo `[]` deixaria
    // o teste acima verde, e a contagem de arquivos que mencionam o nome
    // continuaria igual. Então conta-se o que o extrator DEVOLVEU, e exige-se
    // que cada trecho tenha o formato de uma chamada de verdade.
    const extraidas = todos.flatMap((c) => chamadas(readFileSync(c, "utf8")));
    expect(extraidas.length).toBeGreaterThanOrEqual(3);
    for (const a of extraidas) {
      expect(a.startsWith("(")).toBe(true);
      expect(a.endsWith(")")).toBe(true);
      // Vale para a definição da função e para toda chamada dela.
      expect(a).toContain("supabase");
    }
    // As CHAMADAS, sem a assinatura da própria função: são elas que a regra
    // acima precisa ter visto.
    const invocacoes = extraidas.filter((a) => a.includes("unidadeId"));
    expect(invocacoes.length).toBeGreaterThanOrEqual(3);
    // Pelo menos uma amarra termo (a entrega) e pelo menos uma não (a volta):
    // sem os dois lados, a regra acima não teria sido exercida.
    const comTermo = extraidas.filter((a) => /\btermoId\b/.test(a));
    expect(comTermo.length).toBeGreaterThanOrEqual(1);
    expect(extraidas.length - comTermo.length).toBeGreaterThanOrEqual(1);
  });
});
