import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// As travas do contrato de serviço, cobradas contra as migrations.
//
// Mesma forma de `migrations-centro-custo.test.ts` e
// `migrations-seguranca.test.ts`: varredura do SQL, sem lista de nomes a
// manter. Ela prova que a trava está ESCRITA; só o banco prova que funciona —
// e é por isso que a Task 2 do plano manda exercitar a 0115 contra um Postgres
// descartável antes de fechar.

const DIR = join(process.cwd(), "supabase", "migrations");
const SQL = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(DIR, f), "utf8"))
  .join("\n");

describe("contrato de serviço", () => {
  it("guarda dinheiro em centavos, em bigint", () => {
    // `numeric` vira `number` no JavaScript, e R$ 3.500 ÷ 43 é exatamente a
    // divisão que perde centavo.
    expect(SQL).toMatch(/valor_unitario_centavos bigint not null/i);
  });

  it("NÃO tem obra_id — o serviço é rateado, não pertence a uma obra", () => {
    // Esta é a decisão central da spec. Em `contrato_locacao`, `obra_id` é NOT
    // NULL e essa garantia sustenta o escopo por obra de toda a tela de
    // contratos. Uma licença é rateada entre vários centros de custo; se um dia
    // alguém acrescentar `obra_id` aqui, é sinal de que o rateio virou
    // aproximação.
    const bloco = SQL.slice(
      SQL.indexOf("create table if not exists public.contrato_servico"),
      SQL.indexOf("create index if not exists idx_contrato_servico_org"),
    );
    expect(bloco).not.toMatch(/obra_id/);
  });

  it("impede a mesma pessoa em duas licenças ABERTAS do mesmo contrato", () => {
    // Sem a trava, a contagem de atribuídas passa das contratadas e
    // `ratearPorCabeca` levanta exceção — barulhento, mas tarde demais: o dado
    // já estaria gravado e a tela quebrada para todo mundo.
    //
    // Parcial em `removido_em is null` de propósito: a mesma pessoa PODE
    // receber a licença de novo depois de devolvê-la.
    expect(SQL).toMatch(
      /idx_atribuicao_servico_aberta[\s\S]{0,200}where removido_em is null/i,
    );
  });

  it("liga RLS nas duas tabelas", () => {
    expect(SQL).toMatch(
      /alter table public\.contrato_servico\s+enable row level security/i,
    );
    expect(SQL).toMatch(
      /alter table public\.atribuicao_servico enable row level security/i,
    );
  });

  it("escopa por organização, e diz por que não é por obra", () => {
    // Exceção consciente ao escopo por obra do resto do Loca. Um contrato
    // rateado entre seis centros de custo não pertence a nenhum: filtrá-lo por
    // vínculo mostraria metade do contrato para metade das pessoas, e o total
    // não fecharia para ninguém.
    expect(SQL).toMatch(/O ESCOPO E A ORGANIZACAO, NAO A OBRA/i);
    expect(SQL).toMatch(/create policy "contrato_servico_select"/i);
  });

  it("guarda a data de conferência — o número digitado envelhece", () => {
    // A atribuição é digitada à mão e VAI divergir do tenant em poucas semanas.
    // Um número errado de licenças ociosas é pior que nenhum, porque alguém
    // cancela assinatura em cima dele.
    expect(SQL).toMatch(/conferido_em\s+date/i);
  });

  it("recusa contrato de zero licenças e vigência invertida", () => {
    expect(SQL).toMatch(/quantidade\s+integer not null check \(quantidade > 0\)/i);
    expect(SQL).toMatch(/contrato_servico_periodo check \(data_fim is null or data_fim >= data_inicio\)/i);
  });
});
