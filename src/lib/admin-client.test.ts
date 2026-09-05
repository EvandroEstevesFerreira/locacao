import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VARREDURA DO CLIENT ADMIN — a regra mais cara do projeto, agora com trava
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * O AGENTS.md diz: `createAdminClient()` NUNCA toca tabela da aplicação. O que
 * ele bypassa é a RLS, e é a RLS que sustenta o isolamento por organização e o
 * escopo por obra. Um `.from(...)` com client admin faz todo tenant ver tudo,
 * em silêncio, e nenhum teste funcional percebe — a tela funciona
 * perfeitamente, só que para dados que não deveriam estar ali.
 *
 * A regra existia escrita e foi violada mesmo assim: `sincronizarObras`
 * escrevia em `obra_usuario` com service role desde que o controle de acesso
 * por obra foi criado, e só apareceu numa varredura manual na 0.57.1. O fluxo
 * de EDIÇÃO usava o client normal; era só a criação que furava — o que mostra
 * que ninguém decidiu isso, foi descuido.
 *
 * Regra escrita não impede nada. Esta varredura impede.
 *
 * Ela segue a VARIÁVEL: acha o que foi atribuído de `createAdminClient()` e
 * procura `.from(` nela, inclusive quando a chamada quebra em várias linhas —
 * que é como o caso real estava escrito, e é por isso que um grep simples
 * nunca o teria achado.
 */

/**
 * Onde o client admin PODE tocar tabela da aplicação, e QUAIS tabelas.
 *
 * A exceção é por arquivo E por tabela, de propósito. Fosse só por arquivo,
 * `usuarios/actions.ts` viraria uma zona franca: o `obra_usuario` que esta
 * varredura existe para impedir poderia voltar exatamente ali, no arquivo onde
 * ele estava, e nada acusaria.
 *
 * Toda entrada precisa de justificativa. Se um dia uma linha aqui deixar de
 * ser verdade, o resultado é vazamento entre organizações — em silêncio.
 */
const PERMITIDOS: Record<string, { tabelas: string[] | "*"; motivo: string }> = {
  "app/api/cron/avanco/route.ts": {
    tabelas: "*",
    motivo: "cron roda sem sessão de usuário; não há RLS a respeitar",
  },
  "app/api/cron/indicadores/route.ts": {
    tabelas: "*",
    motivo: "cron roda sem sessão de usuário; não há RLS a respeitar",
  },
  "app/api/cron/relatorio-email/route.tsx": {
    tabelas: "*",
    motivo: "cron roda sem sessão de usuário; não há RLS a respeitar",
  },
  "app/api/cron/vencimentos/route.ts": {
    tabelas: "*",
    motivo: "cron roda sem sessão de usuário; não há RLS a respeitar",
  },
  "app/(app)/usuarios/actions.ts": {
    tabelas: ["perfil"],
    motivo:
      "bootstrap do perfil recém-criado: o trigger handle_new_user o cria " +
      "com org_id NULO, então nenhuma policy escopada por organização o " +
      "alcança. SÓ `perfil` — `obra_usuario` usa o client normal, e foi " +
      "justamente ele que ficou anos escrevendo com service role.",
  },
};

const RAIZ = path.join(process.cwd(), "src");

function arquivosFonte(dir: string): string[] {
  const saida: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      saida.push(...arquivosFonte(p));
    } else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) {
      saida.push(p);
    }
  }
  return saida;
}

/** Caminho relativo com barra normal, para bater com as chaves de PERMITIDOS. */
function relativo(p: string): string {
  return path.relative(RAIZ, p).split(path.sep).join("/");
}

/** As variáveis que receberam um client admin neste arquivo. */
function variaveisAdmin(fonte: string): string[] {
  const nomes = new Set<string>();
  const re =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)(?:\s*:[^=;]+)?\s*=\s*(?:await\s+)?createAdminClient\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) nomes.add(m[1]);
  return [...nomes];
}

/** Tabelas que a variável toca via `.from("x")`, atravessando quebras de linha. */
function tabelasTocadas(fonte: string, nomeVar: string): string[] {
  const re = new RegExp(
    `\\b${nomeVar}\\s*(?:\\r?\\n\\s*)?\\.\\s*from\\s*\\(\\s*["'\`]([^"'\`]+)`,
    "g",
  );
  const achadas: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) achadas.push(m[1]);
  return achadas;
}

describe("varredura do client admin", () => {
  const arquivos = arquivosFonte(RAIZ);

  it("achou arquivos para varrer", () => {
    // Sem esta trava, mudar a estrutura de pastas transformaria a varredura
    // num teste vazio que passa sempre.
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("achou o próprio createAdminClient — a varredura procura a coisa certa", () => {
    // Se o nome da função mudar, os regex acima param de casar e o teste
    // passaria sem varrer nada. Esta é a prova de que ele ainda mira o alvo.
    const comAdmin = arquivos.filter((p) =>
      /=\s*(?:await\s+)?createAdminClient\s*\(/.test(fs.readFileSync(p, "utf8")),
    );
    expect(comAdmin.length).toBeGreaterThan(0);
  });

  it("nenhum client admin toca tabela da aplicação fora dos casos declarados", () => {
    const infracoes: string[] = [];

    for (const arquivo of arquivos) {
      const fonte = fs.readFileSync(arquivo, "utf8");
      const vars = variaveisAdmin(fonte);
      if (vars.length === 0) continue;

      const rel = relativo(arquivo);
      const permitido = PERMITIDOS[rel];

      for (const v of vars) {
        for (const tabela of tabelasTocadas(fonte, v)) {
          if (permitido) {
            if (permitido.tabelas === "*") continue;
            if (permitido.tabelas.includes(tabela)) continue;
          }
          infracoes.push(`${rel}: ${v}.from("${tabela}")`);
        }
      }
    }

    expect(
      infracoes,
      "Client admin escrevendo/lendo tabela da aplicação. Ele BYPASSA a RLS, " +
        "e é a RLS que separa uma organização da outra — o vazamento é " +
        "silencioso e nenhum teste funcional pega.\n" +
        "Use `createClient()`. Se a exceção for consciente (cron, bootstrap " +
        "de linha sem org), declare em PERMITIDOS com o motivo:\n  " +
        infracoes.join("\n  "),
    ).toEqual([]);
  });

  it("toda exceção declarada existe — lista morta engana", () => {
    const inexistentes = Object.keys(PERMITIDOS).filter(
      (rel) => !fs.existsSync(path.join(RAIZ, rel)),
    );
    expect(
      inexistentes,
      `Em PERMITIDOS mas não existe mais: ${inexistentes.join(", ")}`,
    ).toEqual([]);
  });

  it("toda exceção declarada ainda usa o client admin — se não usa, some da lista", () => {
    // Exceção que não é mais exercida vira permissão esquecida: no dia em que
    // alguém reintroduzir um `.from` ali, a varredura fica calada.
    const semUso = Object.keys(PERMITIDOS).filter((rel) => {
      const fonte = fs.readFileSync(path.join(RAIZ, rel), "utf8");
      return variaveisAdmin(fonte).length === 0;
    });
    expect(
      semUso,
      "Exceção declarada que não usa mais client admin — remova de " +
        `PERMITIDOS: ${semUso.join(", ")}`,
    ).toEqual([]);
  });

  it("toda tabela liberada nominalmente ainda é tocada — permissão a mais é furo", () => {
    const sobrando: string[] = [];
    for (const [rel, permitido] of Object.entries(PERMITIDOS)) {
      if (permitido.tabelas === "*") continue;
      const fonte = fs.readFileSync(path.join(RAIZ, rel), "utf8");
      const tocadas = new Set(
        variaveisAdmin(fonte).flatMap((v) => tabelasTocadas(fonte, v)),
      );
      for (const t of permitido.tabelas) {
        if (!tocadas.has(t)) sobrando.push(`${rel}: "${t}"`);
      }
    }
    expect(
      sobrando,
      "Tabela liberada em PERMITIDOS que ninguém toca mais. Tirar da lista " +
        `fecha a porta antes que alguém volte a passar por ela: ${sobrando.join(", ")}`,
    ).toEqual([]);
  });

  it("a detecção enxerga a chamada quebrada em linhas — foi assim que o caso real passou", () => {
    const fonte = [
      "const admin = createAdminClient();",
      "await admin",
      '  .from("obra_usuario")',
      '  .delete()',
      '  .eq("perfil_id", id);',
    ].join("\n");
    expect(variaveisAdmin(fonte)).toEqual(["admin"]);
    expect(tabelasTocadas(fonte, "admin")).toEqual(["obra_usuario"]);
  });

  it("a detecção não confunde o client normal com o admin", () => {
    const fonte = [
      "const supabase = await createClient();",
      'await supabase.from("obra_usuario").delete();',
    ].join("\n");
    expect(variaveisAdmin(fonte)).toEqual([]);
  });
});
