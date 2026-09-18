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
    ["grupo não tem pai — ele é o topo", /constraint obra_grupo_sem_pai check/i],
    ["departamento não tem prazo", /constraint obra_departamento_sem_prazo check/i],
    ["departamento não pausa", /constraint obra_departamento_sem_pausa check/i],
    ["pai é grupo, de raiz, da mesma organização", /function public\.obra_centro_custo_valido/i],
    ["o pai tem de ser um grupo", /pai tem de ser um grupo/i],
    ["o projeto e o centro de custo do Mega são campos SEPARADOS",
      /add column if not exists mega_projeto[\s\S]{0,80}add column if not exists mega_centro_custo/i],
    ["nenhuma das duas colunas do Mega é única",
      /create index if not exists idx_obra_mega_projeto[\s\S]{0,400}create index if not exists idx_obra_mega_centro_custo/i],
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

  it("as 11 frentes viram 6 departamentos, não 11 — o índice único exige", () => {
    // `801` cobre Engenharia, Suprimentos e Projetos; `803` cobre Comercial e
    // Orçamentos. Onze linhas disputariam o mesmo `codigo` e bateriam em
    // `idx_obra_codigo` (unique desde a 0001) NO MEIO da migration, depois de
    // as frentes já terem sido apagadas.
    expect(conversao).toMatch(/select distinct[\s\S]{0,120}t\.codigo_adp as codigo/i);
  });

  it("a trava de código em branco continua de pé", () => {
    // Planejamento e SMS chegaram sem centro de custo definido, a migration
    // abortou nomeando as duas, e o dono do processo respondeu 801. A trava
    // FICA: qualquer frente nova sem código aborta do mesmo jeito. Ela não é
    // um andaime da primeira rodada — é a regra.
    expect(conversao).toMatch(/nao tem centro de custo da ADP definido/i);
    expect(conversao).toMatch(/aparece num rateio/i);
  });

  it("o 686 continua obra: no Mega ele é custo DIRETO, do grupo 21", () => {
    // Ele esteve na lista de conversão e saiu. A primeira resposta foi que era
    // departamento; a estrutura do Mega mostrou que é irmão das obras, não dos
    // departamentos. Converter teria tirado dele prazo, avanço e fechamento.
    const conversoes = conversao.slice(
      conversao.indexOf("select * from (values"),
      conversao.indexOf("loop"),
    );
    expect(conversoes).not.toMatch(/'686'/);
    expect(conversao).toMatch(/codigo in \('686'\)/);
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
      // Ou vem do mapa preenchido à mão (`tmp_filhos_800`), ou são os três
      // grupos do Mega, cujos códigos (38, 20, 21) estão literalmente na
      // estrutura que o dono do processo descreveu — não inventados aqui.
      expect(ins).toMatch(/from tmp_filhos_800|'38', 'Sistenge'/i);
    }
  });

  it("aborta se algum código do mapa estiver em branco", () => {
    // Sem isto a migration criaria departamento com `codigo` nulo — e o código
    // é justamente o que liga o centro de custo ao Mega e ao People.
    expect(conversao).toMatch(/nao tem centro de custo da ADP definido/i);
  });

  it("aborta se alguma frente da 800 ficar fora do mapa", () => {
    // Frente sem par no mapa seria apagada sem virar nada: perda silenciosa de
    // cadastro, que é o pior desfecho possível aqui.
    expect(conversao).toMatch(/nao estao no mapa de promocao/i);
  });

  it("insere os filhos DEPOIS de os grupos existirem", () => {
    // O trigger do bloco 3 exige que o pai já seja um grupo. Inverter a ordem
    // faz a migration recusar a si mesma.
    const posConversao = conversao.indexOf("5b. A arvore se monta");
    // `indexOf` e não regex com `[\s\S]*?`: o coringa atravessa blocos e casava
    // com o insert dos grupos, muito antes, dando um falso verde invertido.
    const posInsert = conversao.indexOf("'departamento', v_38");
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
