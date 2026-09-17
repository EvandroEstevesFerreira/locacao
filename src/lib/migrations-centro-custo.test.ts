import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// As travas do centro de custo, cobradas contra as migrations.
//
// Departamento que aceita frente de serviço, avanço, orçamento ou fechamento
// mensal não estoura erro em lugar nenhum: grava, e o número aparece depois
// dentro de um relatório financeiro com cara de legítimo. É a mesma classe de
// falha silenciosa que `migrations-seguranca.test.ts` cobre para
// `security_invoker`, e por isso a guarda tem a mesma forma — varredura, sem
// lista de nomes a manter.

const DIR = join(process.cwd(), "supabase", "migrations");

function sqlDeTodas(): string {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(DIR, f), "utf8"))
    .join("\n");
}

const SQL = sqlDeTodas();

describe("as colunas do centro de custo existem", () => {
  it("cria o enum tipo_centro_custo", () => {
    expect(SQL).toMatch(/create type public\.tipo_centro_custo as enum/i);
  });

  it("acrescenta `tipo` com default 'obra'", () => {
    // O default é o que mantém todo o resto do sistema de pé sem tocar em nada:
    // toda linha existente continua obra. Sem ele, a coluna seria NOT NULL sem
    // valor e a migration falharia — ou, pior, exigiria backfill manual.
    expect(SQL).toMatch(
      /add column if not exists tipo\s+public\.tipo_centro_custo not null default 'obra'/i,
    );
  });

  it("acrescenta `pai_id` com on delete restrict", () => {
    // `cascade` aqui arrastaria os quatro setores junto com o departamento pai.
    // Excluir o Administrativo tem de FALHAR com mensagem.
    expect(SQL).toMatch(/add column if not exists pai_id uuid references public\.obra \(id\) on delete restrict/i);
  });
});

describe("as sete travas", () => {
  const travas: [string, RegExp][] = [
    ["obra não tem pai", /constraint obra_pai_so_departamento check/i],
    ["departamento não tem prazo", /constraint obra_departamento_sem_prazo check/i],
    ["departamento não pausa", /constraint obra_departamento_sem_pausa check/i],
    ["pai é departamento, de raiz, da mesma organização", /function public\.obra_centro_custo_valido/i],
    ["tipo é imutável", /nao pode ser alterado/i],
    ["departamento não recebe controle de obra", /function public\.exige_centro_custo_obra/i],
  ];

  it.each(travas)("cobre: %s", (_nome, padrao) => {
    expect(SQL).toMatch(padrao);
  });

  it("prende as QUATRO tabelas de controle de obra, não três", () => {
    // Uma tabela esquecida aqui é um departamento com fechamento mensal, e
    // nada na tela denuncia.
    for (const tabela of [
      "public.frente_obra",
      "public.avanco_obra",
      "public.orcamento_locacao",
      "public.fechamento_mensal",
    ]) {
      const t = tabela.replace(/[.]/g, "\\.");
      expect(SQL).toMatch(
        new RegExp(`create trigger \\w+\\s+before insert or update of obra_id on ${t}`, "i"),
      );
    }
  });

  it("usa UMA função para os quatro gatilhos", () => {
    // Quatro cópias divergem na primeira vez que alguém mexer em uma delas.
    const chamadas = SQL.match(/execute function public\.exige_centro_custo_obra\(\)/gi);
    expect(chamadas).toHaveLength(4);
    expect(SQL.match(/create or replace function public\.exige_centro_custo_obra/gi)).toHaveLength(1);
  });
});

describe("a conversão do 800 é defensiva", () => {
  const conversao = readFileSync(join(DIR, "0114_centro_de_custo.sql"), "utf8");

  it("aborta se encontrar mais de uma candidata", () => {
    // Converter a obra errada tira uma obra de verdade do avanço físico e do
    // fechamento, e o sintoma aparece semanas depois como relatório faltando
    // linha.
    expect(conversao).toMatch(/raise exception[\s\S]{0,200}converta a mao/i);
  });

  it("aborta se o 800 já tiver controle de obra gravado", () => {
    expect(conversao).toMatch(/Remova-os antes de converte-la em departamento/i);
  });

  it("não inventa código nenhum: só insere o que veio do mapa", () => {
    // A migration PASSOU a inserir departamentos — as 11 "frentes" da obra 800
    // que na verdade eram departamentos, descobertas rodando em produção. Mas
    // o invariante que interessa é outro e continua valendo: nenhum `codigo`
    // sai da cabeça da migration. Cada um vem de `tmp_promocao_800`, que um
    // humano preenche com o código do Mega/People.
    //
    // O teste antigo dizia "não insere nada" e era um proxy para isto. Virou
    // proxy errado quando a inserção passou a ser legítima; este cobra a
    // propriedade de verdade.
    const inserts = conversao.match(/insert into public\.obra[\s\S]*?;/gi) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    for (const ins of inserts) {
      expect(ins).toMatch(/from tmp_filhos_800/i);
    }
  });

  it("aborta se algum código do mapa estiver em branco", () => {
    // Sem isto a migration criaria departamento com `codigo` nulo — e o código
    // é justamente o que liga o centro de custo ao Mega e ao People.
    expect(conversao).toMatch(/Preencha o codigo \(Mega\/People\)/i);
  });

  it("aborta se alguma frente da 800 ficar fora do mapa", () => {
    // Frente sem par no mapa seria apagada sem virar nada: perda silenciosa de
    // cadastro, que é o pior desfecho possível aqui.
    expect(conversao).toMatch(/nao estao no mapa de promocao/i);
  });

  it("insere os filhos DEPOIS de o 800 virar departamento", () => {
    // O trigger do bloco 3 exige que o pai já seja departamento. Inverter a
    // ordem faz a migration recusar a si mesma.
    const posConversao = conversao.indexOf("5b. Os filhos entram");
    const posInsert = conversao.search(/insert into public\.obra[\s\S]*?from tmp_filhos_800/i);
    expect(posConversao).toBeGreaterThan(0);
    expect(posInsert).toBeGreaterThan(posConversao);
  });

  it("reabilita o trigger que desabilitou", () => {
    // Deixar o trigger desligado tornaria todas as travas do bloco 3 letra
    // morta em produção — e nada na tela denunciaria.
    expect(conversao).toMatch(/disable trigger trg_obra_centro_custo/i);
    expect(conversao).toMatch(/enable trigger trg_obra_centro_custo/i);
  });
});
