import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Varredura das migrations, sem lista de nomes a manter.
//
// A primeira view do projeto (`termo_equipamento_situacao`, migration 0056)
// nasceu com `security_invoker` desligado, que é o padrão do Postgres 15+: ela
// executava com os privilégios do DONO, e não de quem consulta. Como o dono
// ignora RLS, qualquer usuário autenticado podia ler pela view a situação de
// todo termo de TODAS as organizações — o mesmo tipo de furo que o AGENTS.md
// descreve para o `createAdminClient()`, por outra porta. Nada estoura erro
// quando isso acontece; foi o advisor do Supabase que apontou.
//
// Este teste é o que faz a próxima view nascer certa: quem criar uma sem a
// opção reprova aqui, e não seis meses depois num relatório de auditoria.

const DIR = join(process.cwd(), "supabase", "migrations");

function migrations(): { nome: string; sql: string }[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((nome) => ({ nome, sql: readFileSync(join(DIR, nome), "utf8") }));
}

/** Nomes de view criados em `create [or replace] view public.<nome>`. */
function viewsCriadas(sql: string): string[] {
  const re = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z0-9_]+)/gi;
  return [...sql.matchAll(re)].map((m) => m[1]);
}

describe("migrations — segurança", () => {
  const todas = migrations();

  it("existe migration para varrer", () => {
    // Sem isto o arquivo passaria por vacuidade se o diretório mudasse de lugar.
    expect(todas.length).toBeGreaterThan(50);
  });

  it("toda view declara security_invoker = on", () => {
    const sqlCompleto = todas.map((m) => m.sql).join("\n");
    const criadas = new Set(todas.flatMap((m) => viewsCriadas(m.sql)));

    // A varredura só vale se houver view; hoje há uma.
    expect(criadas.size).toBeGreaterThan(0);

    for (const view of criadas) {
      const re = new RegExp(
        `alter\\s+view\\s+(?:public\\.)?${view}\\s+set\\s*\\(\\s*security_invoker\\s*=\\s*on`,
        "i",
      );
      const inline = new RegExp(
        `create\\s+(?:or\\s+replace\\s+)?view\\s+(?:public\\.)?${view}\\s+with\\s*\\(\\s*security_invoker\\s*=\\s*on`,
        "i",
      );
      expect(
        re.test(sqlCompleto) || inline.test(sqlCompleto),
        `a view ${view} não declara security_invoker = on — ela ignoraria a RLS de quem consulta`,
      ).toBe(true);
    }
  });

  it("nenhuma migration desliga RLS de tabela da aplicação", () => {
    // `disable row level security` num tenant único não dá erro nenhum e abre
    // a tabela para todo mundo. Se algum dia precisar, precisa ser deliberado.
    for (const m of todas) {
      expect(
        /disable\s+row\s+level\s+security/i.test(m.sql),
        `${m.nome} desliga RLS`,
      ).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// As funções que o linter aponta e que NÃO podem ser fechadas
// ═══════════════════════════════════════════════════════════════════════════
//
// O advisor do Supabase lista 14 funções `security definer` alcançáveis pelo
// papel `anon`, e vai continuar listando. As migrations 0089 e 0090 explicam por
// quê, mas explicação em comentário é lida por quem abre o arquivo — e quem vai
// "resolver o apontamento" abre o painel do Supabase, não a migration.
//
// Este teste é a guarda que falta. Ele reprova a migration que tentar revogar
// `EXECUTE` das funções abaixo, com a razão no corpo da mensagem.
//
// DOIS GRUPOS, e os dois quebram coisas diferentes:
//
//   Helpers de RLS — `current_org_id` é chamada em 136 policies, `pode_operar`
//   em 43. Policy roda com o privilégio de QUEM CONSULTA: sem o EXECUTE, toda
//   requisição anônima estoura. Não há requisição anônima no app autenticado,
//   mas há na página `/assinar/[token]`.
//
//   Página de assinatura — `termo_do_link`, `conferir_cpf_do_link` e
//   `assinar_termo_por_link` são chamadas com a CHAVE ANÔNIMA de propósito: é
//   assim que o funcionário assina o termo pelo celular sem ter login no Loca.
//   Fechá-las mata a assinatura à distância inteira.
const INTOCAVEIS_RLS = [
  "current_org_id",
  "current_papel",
  "is_master",
  "pode_operar",
  "pode_financeiro",
  "pode_gerir_cadastros",
  "has_obra_access",
  "has_imovel_access",
  "has_contrato_access",
  "has_termo_access",
  "is_member_of_obra",
  "obra_do_contrato",
];

const INTOCAVEIS_ASSINATURA = [
  "termo_do_link",
  "conferir_cpf_do_link",
  "assinar_termo_por_link",
];

describe("migrations — o que não se revoga", () => {
  const sqlCompleto = migrations()
    .map((m) => m.sql)
    .join("\n")
    .toLowerCase();

  /**
   * Um `revoke ... on function <nome>(` em qualquer migration.
   *
   * Sem expressão regular de propósito: a versão com regex precisava de quatro
   * escapes, e eles se perderam na primeira escrita deste arquivo — o teste
   * quebrou com "Unterminated group" em vez de reprovar o que devia. Uma guarda
   * que falha por erro de sintaxe não guarda nada.
   *
   * O parêntese no fim é o que torna a busca exata: `.soft_delete(` não casa
   * com `.soft_delete_devolucao(`.
   */
  function revogada(nome: string): boolean {
    return sqlCompleto
      .split(";")
      .some(
        (cmd) =>
          cmd.includes("revoke") &&
          cmd.includes("on function") &&
          (cmd.includes("." + nome + "(") ||
            cmd.includes("." + nome + " (") ||
            cmd.includes(" " + nome + "(") ||
            cmd.includes(" " + nome + " (")),
      );
  }

  /**
   * Um `grant execute on function <nome>( ... to ... anon` em alguma migration.
   *
   * O invariante das funções da página de assinatura NÃO é “ninguém revoga” — a
   * 0077 revoga de `public` e concede a `anon` logo em seguida, que é o padrão
   * correto de endurecimento. A primeira versão desta guarda olhava só o revoke
   * e reprovou as três, sendo que estavam certas.
   *
   * O que precisa ser verdade é o FIM: elas têm de acabar alcançáveis pelo anon.
   */
  function concedidaAoAnon(nome: string): boolean {
    return sqlCompleto
      .split(";")
      .some(
        (cmd) =>
          cmd.includes("grant") &&
          cmd.includes("on function") &&
          cmd.includes("anon") &&
          (cmd.includes("." + nome + "(") ||
            cmd.includes("." + nome + " (") ||
            cmd.includes(" " + nome + "(") ||
            cmd.includes(" " + nome + " (")),
      );
  }

  it.each(INTOCAVEIS_RLS)(
    "nenhuma migration revoga EXECUTE de %s — é avaliada dentro das policies",
    (nome) => {
      expect(
        revogada(nome),
        `\`${nome}\` é chamada dentro de policies de RLS, que rodam com o ` +
          `privilégio de quem consulta. Revogar o EXECUTE faria toda requisição ` +
          `anônima estourar — e há uma página pública neste sistema: ` +
          `/assinar/[token]. O apontamento do linter é conhecido e aceito; ` +
          `ver o cabeçalho da migration 0089.`,
      ).toBe(false);
    },
  );

  it.each(INTOCAVEIS_ASSINATURA)(
    "%s continua concedida ao anon — é a página de assinatura",
    (nome) => {
      expect(
        concedidaAoAnon(nome),
        `\`${nome}\` é chamada com a CHAVE ANÔNIMA de propósito: é assim que o ` +
          `funcionário assina o termo pelo celular sem ter login no Loca. ` +
          `Sem o grant, a assinatura à distância inteira para de funcionar.`,
      ).toBe(true);
    },
  );

  it("a varredura enxerga os revokes que EXISTEM", () => {
    // Sem isto o bloco passaria por vacuidade se a expressão parasse de casar —
    // e uma guarda que nunca reprova é uma guarda que não existe.
    expect(revogada("soft_delete")).toBe(true);
    expect(revogada("registrar_auditoria")).toBe(true);
    expect(concedidaAoAnon("termo_do_link")).toBe(true);
    // E não enxerga o que não existe: `current_org_id` nunca foi concedida
    // explicitamente ao anon — ela chega lá pelo grant que o Postgres dá a
    // PUBLIC, que é justamente o que ninguém deve revogar.
    expect(concedidaAoAnon("current_org_id")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A policy `for all` que deixa o excluído reaparecer
// ═══════════════════════════════════════════════════════════════════════════
//
// O PADRÃO QUE ESTAVA ERRADO EM OITO TABELAS, e que eu copiei para uma nona ao
// criar `certificado_equipamento`:
//
//   create policy x_select on t for select using (org = ... and deleted_at is null);
//   create policy x_write  on t for all    using (org = ... and pode_operar());
//
// `for all` INCLUI SELECT, e policies permissivas são OR'd. Quem passa por
// `pode_operar()` lê pela segunda porta e enxerga o que foi excluído. Provado
// contra a produção em 07/09/2026: duas linhas, uma com `deleted_at`, e a
// consulta devolveu as duas.
//
// A migration 0091 corrigiu as nove. Este teste é o que impede a décima —
// porque o padrão errado é o mais natural de escrever, e foi assim que ele se
// espalhou.
//
// A varredura é sobre o TEXTO das migrations, então ela não sabe quais tabelas
// têm `deleted_at`. Em vez de manter uma lista, procura o par: um `for all` e
// um `deleted_at` na MESMA migration indicam tabela com exclusão suave — e aí
// o `for all` precisa mencionar `deleted_at` também.
describe("migrations — policy `for all` e exclusão suave", () => {
  const todas = migrations();

  // A CORREÇÃO É A FRONTEIRA. As migrations anteriores a esta CRIARAM o padrão
  // errado, e o arquivo delas é histórico: não se reescreve migration aplicada.
  // A 0091 consertou as nove policies no banco com `alter policy`.
  //
  // Então o invariante não é “nenhum arquivo contém o padrão” — é “nenhuma
  // migration NOVA o introduz”. A fronteira é o próprio nome do conserto, e não
  // um número solto: se ele mudar de lugar, o teste reclama em vez de silenciar.
  const CONSERTO = "0091_write_policy_esconde_apagados.sql";

  /** Blocos `create policy ... for all ... using (...)` de uma migration. */
  function politicasForAll(sql: string): string[] {
    return sql
      .split(/create\s+policy/i)
      .slice(1)
      .map((bloco) => bloco.split(";")[0])
      .filter((bloco) => /\bfor\s+all\b/i.test(bloco));
  }

  it("a migration que serve de fronteira existe", () => {
    // Sem isto, renomear o conserto faria a varredura começar do zero — e um
    // teste que passa a olhar tudo desde 2026-07 volta a reprovar história.
    expect(todas.some((m) => m.nome === CONSERTO)).toBe(true);
  });

  it("nenhuma migration NOVA cria `for all` que ignora deleted_at", () => {
    const posteriores = todas.filter((m) => m.nome > CONSERTO);
    const faltando: string[] = [];

    for (const m of posteriores) {
      // A migration fala de exclusão suave? Se não, o `for all` dali não tem o
      // que esconder — é tabela sem `deleted_at`.
      if (!/deleted_at/i.test(m.sql)) continue;

      for (const bloco of politicasForAll(m.sql)) {
        // Policy criada por `format()` dentro de `do 148691`: o nome é `%I` e o
        // corpo não dá para ler por texto. Fica de fora em vez de dar falso
        // positivo.
        if (bloco.includes("%I")) continue;
        if (!/deleted_at/i.test(bloco)) {
          faltando.push(m.nome + ": " + (bloco.trim().split(/\s+/)[0] ?? "?"));
        }
      }
    }

    expect(
      faltando,
      "policy `for all` inclui SELECT, e policies permissivas são OR'd: sem " +
        "`deleted_at is null` no `using`, quem passa pelo teste de papel " +
        "enxerga o que foi excluído. Ponha a condição no `using` — e NUNCA no " +
        "`with check`, que abortaria a própria exclusão (incidente da 0.19.4).",
    ).toEqual([]);
  });

  it("a varredura enxerga policies `for all` que EXISTEM", () => {
    // Sem isto o bloco passaria por vacuidade se a quebra por `create policy`
    // parasse de casar. Conta em TODAS as migrations, e não só nas novas.
    const total = todas.reduce((n, m) => n + politicasForAll(m.sql).length, 0);
    expect(total).toBeGreaterThan(5);
  });
});
