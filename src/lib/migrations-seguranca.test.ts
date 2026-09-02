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
