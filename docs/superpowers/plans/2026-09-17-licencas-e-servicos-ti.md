# Licenças e serviços de TI — Plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar este plano task a task. Os
> passos usam caixa de seleção (`- [ ]`) para acompanhamento.

**Goal:** dar ao Loca o controle das assinaturas e serviços recorrentes de TI —
quanto custam, quem usa, quanto está ocioso e quando renovam — com o custo
rateado pelos centros de custo que a v0.117.0 criou.

**Architecture:** tabela própria `contrato_servico` (nunca discriminador em
`contrato_locacao`, cujo `obra_id` é NOT NULL e sustenta o escopo por obra de
todo o sistema), atribuição pessoa a pessoa em `atribuicao_servico`, e rateio
**calculado** por função pura — nunca gravado, porque rateio congelado diverge
da atribuição no primeiro desligamento.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, zod,
react-hook-form, Vitest, Tailwind v4, Base UI.

**Spec:** [`docs/superpowers/specs/2026-09-17-licencas-e-servicos-ti-design.md`](../specs/2026-09-17-licencas-e-servicos-ti-design.md)

**Worktree:** `C:\Projetos_Sistenge\Loca-ti`, branch `feat/licencas-ti`,
a partir da `main` em `ee87350` (v0.117.0).

## Global Constraints

Valem para **todas** as tasks. Vêm do `AGENTS.md` e da spec.

- **PT-BR acentuado na primeira escrita** em toda string visível ao usuário.
  Não acentuar identificador, chave de enum, chave de banco, `name=`/`id=`/
  `key=`, slug de rota, nem saída de `console`.
- **Dinheiro em centavos, `bigint`.** `numeric` vira `number` no JavaScript, e
  R$ 3.500 ÷ 43 é exatamente a divisão que perde centavo.
- **`import "server-only"`** no topo de todo arquivo em `src/lib/data/`.
- **`createClient()`, nunca `createAdminClient()`** em tabela da aplicação.
- **Toda view nasce com `security_invoker = on`.** Coberto por
  `src/lib/migrations-seguranca.test.ts`.
- **Exclusão por `supabase.rpc("soft_delete", …)`**, e `data !== true` é falha.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **"Hoje" é `hojeISOSaoPaulo()`**, nunca `new Date()`, em qualquer comparação
  com coluna `date`.
- **Ritual de fechamento** ao fim de cada task:
  `npm run typecheck && npm run lint && npm test`.
- **Enums que já existem e devem ser reusados:** `cadencia_cobranca`
  (`diaria|semanal|quinzenal|mensal`), `status_contrato`
  (`ativo|encerrado|cancelado`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/0115_contrato_de_servico.sql` | as duas tabelas, o enum de categoria, RLS e índices |
| `src/lib/servicos/rateio.ts` | **função pura** do rateio por cabeça e das ociosas |
| `src/lib/servicos/rateio.test.ts` | testes do rateio, incluindo o centavo que sobra |
| `src/lib/servicos.ts` | rótulos e schemas zod do domínio (client-safe) |
| `src/lib/data/servicos.ts` | leitura (`import "server-only"`) |
| `src/app/(app)/servicos/page.tsx` | lista |
| `src/app/(app)/servicos/[id]/page.tsx` | ficha, atribuições e rateio |
| `src/app/(app)/servicos/actions.ts` | escrita |
| `src/app/(app)/servicos/servico-form.tsx` | formulário |
| `src/lib/nav.ts`, `src/lib/modulos.ts` | módulo `servicos`, grupo "TI" |
| `src/app/api/cron/vencimentos/route.ts` | o alerta de renovação, no cron que já existe |

---

### Task 1: O rateio, puro e testado

Primeiro porque é onde mora o único cálculo difícil, e ele não precisa de banco
nenhum para ser provado.

**Files:**
- Create: `src/lib/servicos/rateio.ts`
- Test: `src/lib/servicos/rateio.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export type Atribuicao = { funcionarioId: string; centroCustoId: string | null };
  export type FatiaRateio = { centroCustoId: string | null; pessoas: number; centavos: number };
  export type Rateio = {
    porCentroCusto: FatiaRateio[];
    ociosas: { quantidade: number; centavos: number };
    totalCentavos: number;
  };
  export function ratearPorCabeca(
    totalCentavos: number,
    quantidade: number,
    atribuicoes: Atribuicao[],
  ): Rateio;
  ```

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { ratearPorCabeca, type Atribuicao } from "./rateio";

function pessoas(centro: string | null, n: number): Atribuicao[] {
  return Array.from({ length: n }, (_, i) => ({
    funcionarioId: `${centro ?? "sem"}-${i}`,
    centroCustoId: centro,
  }));
}

describe("ratearPorCabeca", () => {
  it("divide igual quando a conta fecha", () => {
    const r = ratearPorCabeca(30000, 3, [...pessoas("rh", 1), ...pessoas("eng", 2)]);
    expect(r.porCentroCusto).toEqual([
      { centroCustoId: "eng", pessoas: 2, centavos: 20000 },
      { centroCustoId: "rh", pessoas: 1, centavos: 10000 },
    ]);
    expect(r.ociosas).toEqual({ quantidade: 0, centavos: 0 });
  });

  it("a soma das partes é EXATAMENTE o total, mesmo quando não fecha", () => {
    // R$ 3.500,00 entre 43 pessoas: 350000/43 = 8139,53... centavos.
    // Um centavo perdido por mês é o erro que só aparece conferindo contra o Mega.
    const r = ratearPorCabeca(350000, 50, [
      ...pessoas("rh", 8),
      ...pessoas("eng", 21),
      ...pessoas("fin", 6),
      ...pessoas("obra605", 8),
    ]);
    const soma =
      r.porCentroCusto.reduce((a, f) => a + f.centavos, 0) + r.ociosas.centavos;
    expect(soma).toBe(350000);
  });

  it("a licença ociosa fica visível e sem dono", () => {
    // 50 contratadas, 43 atribuídas: as 7 restantes NÃO são distribuídas entre
    // todos. Distribuí-las é como ninguém jamais cancela assinatura nenhuma.
    const r = ratearPorCabeca(350000, 50, pessoas("rh", 43));
    expect(r.ociosas.quantidade).toBe(7);
    expect(r.ociosas.centavos).toBeGreaterThan(0);
  });

  it("o resto vai para a maior fatia, não para a primeira", () => {
    // 100 centavos, 3 pessoas: 33/33/33 sobra 1. Ele vai para quem tem mais
    // gente; empate desempata pelo id, para o resultado ser estável entre
    // renders e não dançar na tela.
    const r = ratearPorCabeca(100, 3, [...pessoas("a", 1), ...pessoas("b", 2)]);
    const b = r.porCentroCusto.find((f) => f.centroCustoId === "b");
    expect(b?.centavos).toBe(67);
  });

  it("pessoa sem centro de custo vira uma fatia própria, e não some", () => {
    // `funcionario.obra_id` é nulável. Somir com ela faria o total não fechar.
    const r = ratearPorCabeca(20000, 2, [...pessoas("rh", 1), ...pessoas(null, 1)]);
    expect(r.porCentroCusto.some((f) => f.centroCustoId === null)).toBe(true);
  });

  it("contrato sem nenhuma atribuição é 100% ocioso", () => {
    const r = ratearPorCabeca(350000, 50, []);
    expect(r.ociosas).toEqual({ quantidade: 50, centavos: 350000 });
    expect(r.porCentroCusto).toEqual([]);
  });

  it("recusa mais atribuições que licenças contratadas", () => {
    // 3 atribuídas para 2 contratadas é erro de cadastro, não arredondamento.
    expect(() => ratearPorCabeca(20000, 2, pessoas("rh", 3))).toThrow(/contratada/i);
  });
});
```

- [ ] **Passo 2: rodar e confirmar que falha**

Run: `npx vitest run src/lib/servicos/rateio.test.ts`
Esperado: FAIL — `Failed to resolve import "./rateio"`.

- [ ] **Passo 3: implementar**

```ts
// Rateio de serviço recorrente por cabeça atribuída — função pura.
//
// O rateio é CALCULADO, nunca gravado: uma tabela de rateio congelado
// divergiria da atribuição no primeiro desligamento, e a divergência num custo
// mensal aparece como número que ninguém consegue explicar.

export type Atribuicao = { funcionarioId: string; centroCustoId: string | null };
export type FatiaRateio = { centroCustoId: string | null; pessoas: number; centavos: number };
export type Rateio = {
  porCentroCusto: FatiaRateio[];
  ociosas: { quantidade: number; centavos: number };
  totalCentavos: number;
};

export function ratearPorCabeca(
  totalCentavos: number,
  quantidade: number,
  atribuicoes: Atribuicao[],
): Rateio {
  if (atribuicoes.length > quantidade) {
    throw new Error(
      `Há ${atribuicoes.length} atribuições para ${quantidade} licenças contratadas.`,
    );
  }

  const ociosasQtd = quantidade - atribuicoes.length;
  // O valor de UMA licença é a unidade do rateio. Dividir o total pelas
  // atribuídas faria a licença ociosa sumir dentro do custo de quem usa.
  const porLicenca = Math.floor(totalCentavos / quantidade);

  const contagem = new Map<string | null, number>();
  for (const a of atribuicoes) {
    contagem.set(a.centroCustoId, (contagem.get(a.centroCustoId) ?? 0) + 1);
  }

  const fatias: FatiaRateio[] = [...contagem.entries()]
    .map(([centroCustoId, pessoas]) => ({
      centroCustoId,
      pessoas,
      centavos: pessoas * porLicenca,
    }))
    // Maior primeiro; empate pelo id, para o resultado não dançar entre renders.
    .sort((a, b) => b.pessoas - a.pessoas || String(a.centroCustoId).localeCompare(String(b.centroCustoId)));

  const ociosas = { quantidade: ociosasQtd, centavos: ociosasQtd * porLicenca };

  // O que a divisão inteira deixou para trás vai para a MAIOR fatia — ou para
  // as ociosas, se não houver fatia. A soma tem de bater com o total ao
  // centavo: um centavo por mês é o erro que só aparece conferindo com o Mega.
  const distribuido = fatias.reduce((a, f) => a + f.centavos, 0) + ociosas.centavos;
  const resto = totalCentavos - distribuido;
  if (resto !== 0) {
    if (fatias.length > 0) fatias[0].centavos += resto;
    else ociosas.centavos += resto;
  }

  return { porCentroCusto: fatias, ociosas, totalCentavos };
}
```

- [ ] **Passo 4: rodar e confirmar que passa**

Run: `npx vitest run src/lib/servicos/rateio.test.ts`
Esperado: PASS, 7 testes.

- [ ] **Passo 5: commitar**

```bash
git add src/lib/servicos/rateio.ts src/lib/servicos/rateio.test.ts
git commit -m "feat(servicos): o rateio por cabeca, puro e com o centavo que sobra"
```

---

### Task 2: A migration

**Files:**
- Create: `supabase/migrations/0115_contrato_de_servico.sql`
- Test: `src/lib/migrations-servicos.test.ts`

**Interfaces:**
- Consumes: `public.obra` (com `tipo`, da 0114), `public.fornecedor`,
  `public.funcionario`, `cadencia_cobranca`, `status_contrato`.
- Produces: as tabelas `contrato_servico` e `atribuicao_servico`, e o enum
  `categoria_servico` (`licenca|conectividade|seguranca|outro`).

- [ ] **Passo 1: escrever a migration**

```sql
-- ============================================================================
-- Contratos de servico recorrente de TI e a atribuicao por pessoa
-- (docs/superpowers/specs/2026-09-17-licencas-e-servicos-ti-design.md)
-- ============================================================================
--
-- TABELA PROPRIA, e nao um `tipo` em `contrato_locacao`. La `obra_id` e NOT
-- NULL porque todo contrato de locacao pertence a UMA obra, e essa garantia
-- sustenta o escopo por obra de toda a tela de contratos. Uma licenca nao
-- pertence a um centro de custo: ela e rateada entre varios. Afrouxar aquela
-- coluna para caber esta linha enfraqueceria a garantia de todo o resto.
--
-- Repare que e a decisao OPOSTA a da 0114, e pelo MESMO criterio: qual das
-- formas deixa a RLS com um caminho so.

create type public.categoria_servico as enum
  ('licenca', 'conectividade', 'seguranca', 'outro');

create table if not exists public.contrato_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  fornecedor_id  uuid not null references public.fornecedor (id) on delete restrict,
  nome           text not null,
  categoria      public.categoria_servico not null default 'licenca',
  quantidade     integer not null check (quantidade > 0),
  -- Centavos em bigint, como a 0105 fez para o valor contratado: `numeric`
  -- vira `number` no JavaScript, e R$ 3.500 / 43 e a divisao que perde centavo.
  valor_unitario_centavos bigint not null check (valor_unitario_centavos >= 0),
  cadencia       public.cadencia_cobranca not null default 'mensal',
  data_inicio    date not null,
  data_fim       date,
  renova_automaticamente boolean not null default true,
  -- A data em que alguem conferiu a lista contra o provedor. Obrigatoria, e
  -- nao enfeite: o numero de atribuidas VAI divergir do tenant em poucas
  -- semanas, e um numero errado de ociosas e pior que nenhum -- alguem cancela
  -- assinatura em cima dele.
  conferido_em   date,
  status         public.status_contrato not null default 'ativo',
  observacoes    text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint contrato_servico_periodo check (data_fim is null or data_fim >= data_inicio)
);

create index if not exists idx_contrato_servico_org on public.contrato_servico (org_id);
create index if not exists idx_contrato_servico_fornecedor on public.contrato_servico (fornecedor_id);
create index if not exists idx_contrato_servico_fim
  on public.contrato_servico (data_fim) where data_fim is not null;

create trigger trg_contrato_servico_updated_at
  before update on public.contrato_servico
  for each row execute function public.set_updated_at();

create table if not exists public.atribuicao_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  contrato_id    uuid not null references public.contrato_servico (id) on delete cascade,
  funcionario_id uuid not null references public.funcionario (id) on delete restrict,
  atribuido_em   date not null,
  removido_em    date,
  created_at     timestamptz not null default now(),
  constraint atribuicao_servico_periodo check (removido_em is null or removido_em >= atribuido_em)
);

-- A mesma pessoa nao ocupa duas licencas do mesmo contrato ao mesmo tempo.
-- Sem isto, a contagem de atribuidas passa das contratadas e o rateio levanta
-- excecao -- barulhento, mas tarde demais, com o dado ja gravado.
create unique index if not exists idx_atribuicao_servico_aberta
  on public.atribuicao_servico (contrato_id, funcionario_id)
  where removido_em is null;

create index if not exists idx_atribuicao_servico_contrato
  on public.atribuicao_servico (contrato_id) where removido_em is null;

alter table public.contrato_servico   enable row level security;
alter table public.atribuicao_servico enable row level security;

-- ESCOPO E A ORGANIZACAO, NAO A OBRA -- e isto e excecao consciente.
-- Um contrato rateado entre seis centros de custo nao pertence a nenhum:
-- filtra-lo por vinculo mostraria metade do contrato para metade das pessoas,
-- e o total nao fecharia para ninguem. Mesmo desenho de `fornecedor`.
create policy "contrato_servico_select" on public.contrato_servico
  for select to authenticated
  using (org_id = public.current_org_id() and deleted_at is null);

create policy "contrato_servico_manage" on public.contrato_servico
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "atribuicao_servico_select" on public.atribuicao_servico
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "atribuicao_servico_manage" on public.atribuicao_servico
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());
```

- [ ] **Passo 2: escrever a guarda, e vê-la falhar antes da migration existir**

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const SQL = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(DIR, f), "utf8"))
  .join("\n");

describe("contrato de servico", () => {
  it("guarda dinheiro em centavos, em bigint", () => {
    // `numeric` vira `number` no JavaScript e R$ 3.500 / 43 perde centavo.
    expect(SQL).toMatch(/valor_unitario_centavos bigint not null/i);
  });

  it("NAO tem obra_id — o servico é rateado, não pertence a uma obra", () => {
    const bloco = SQL.slice(
      SQL.indexOf("create table if not exists public.contrato_servico"),
      SQL.indexOf("create index if not exists idx_contrato_servico_org"),
    );
    expect(bloco).not.toMatch(/obra_id/);
  });

  it("impede a mesma pessoa em duas licenças abertas do mesmo contrato", () => {
    expect(SQL).toMatch(/idx_atribuicao_servico_aberta[\s\S]{0,200}where removido_em is null/i);
  });

  it("liga RLS nas duas tabelas", () => {
    expect(SQL).toMatch(/alter table public\.contrato_servico\s+enable row level security/i);
    expect(SQL).toMatch(/alter table public\.atribuicao_servico enable row level security/i);
  });
});
```

Run: `npx vitest run src/lib/migrations-servicos.test.ts`
Esperado: FAIL nos quatro, antes de a migration existir; PASS depois.

- [ ] **Passo 3: validar contra Postgres de verdade**

A varredura prova que a trava está **escrita**; só o banco prova que ela
**funciona**. Foi assim que a 0114 revelou que uma mensagem imprimia UUID em
vez de nome.

```bash
docker run -d --name loca-ti-pg -e POSTGRES_PASSWORD=pg postgres:15 && sleep 6
# aplicar 0001..0115 num esqueleto, ou um esqueleto mínimo com organizacao,
# fornecedor, funcionario e os dois enums; depois:
#   - inserir contrato com quantidade 0        -> deve RECUSAR (check)
#   - inserir data_fim < data_inicio           -> deve RECUSAR (check)
#   - atribuir a mesma pessoa duas vezes aberta-> deve RECUSAR (índice único)
#   - remover a primeira e atribuir de novo    -> deve PASSAR
docker rm -f loca-ti-pg
```

- [ ] **Passo 4: commitar**

```bash
git add supabase/migrations/0115_contrato_de_servico.sql src/lib/migrations-servicos.test.ts
git commit -m "feat(servicos): as duas tabelas, o escopo por organizacao e o porque"
```

---

### Task 3: Domínio e leitura

**Files:**
- Create: `src/lib/servicos.ts`, `src/lib/data/servicos.ts`
- Test: `src/lib/servicos.test.ts`

**Interfaces:**
- Consumes: `ratearPorCabeca` (Task 1), as tabelas (Task 2).
- Produces:
  ```ts
  // src/lib/servicos.ts
  export const CATEGORIA_SERVICO: readonly ["licenca","conectividade","seguranca","outro"];
  export type CategoriaServico = (typeof CATEGORIA_SERVICO)[number];
  export const CATEGORIA_SERVICO_INFO: Record<CategoriaServico, { label: string }>;
  export const servicoSchema: z.ZodType<...>;
  export type ServicoDados = z.output<typeof servicoSchema>;
  export function conferenciaVencida(conferidoEm: string | null, hojeISO: string): boolean;

  // src/lib/data/servicos.ts
  export type ServicoListItem = {
    id: string; nome: string; categoria: CategoriaServico;
    quantidade: number; atribuidas: number;
    valorMensalCentavos: number; conferido_em: string | null; status: string;
  };
  export function listarServicos(p: ListaParams, categoria?: CategoriaServico): Promise<Pagina<ServicoListItem>>;
  export function obterServico(id: string): Promise<ServicoDetalhe | null>;
  ```

- [ ] **Passo 1: escrever o teste de `conferenciaVencida`**

```ts
import { describe, it, expect } from "vitest";
import { conferenciaVencida, servicoSchema } from "./servicos";

describe("conferenciaVencida", () => {
  it("é verdadeira quando passou de 90 dias", () => {
    expect(conferenciaVencida("2026-06-01", "2026-09-17")).toBe(true);
  });
  it("é falsa dentro dos 90 dias", () => {
    expect(conferenciaVencida("2026-09-01", "2026-09-17")).toBe(false);
  });
  it("nunca conferido conta como vencido — é o pior caso, não o neutro", () => {
    expect(conferenciaVencida(null, "2026-09-17")).toBe(true);
  });
});

describe("servicoSchema", () => {
  it("aceita o próprio output na segunda passagem (idempotência)", () => {
    // A action re-valida o que recebe, e o que ela recebe é o OUTPUT deste
    // schema — o zodResolver já transformou no cliente. É o defeito que já
    // voltou três vezes neste repositório (ver src/lib/obra.ts).
    const entrada = {
      nome: "Microsoft 365", categoria: "licenca", fornecedor_id: crypto.randomUUID(),
      quantidade: "50", valor_unitario: "70,00", cadencia: "mensal",
      data_inicio: "2026-01-01", data_fim: "", observacoes: "",
    };
    const um = servicoSchema.parse(entrada);
    expect(() => servicoSchema.parse(um)).not.toThrow();
  });

  it("recusa quantidade zero — não existe contrato de zero licenças", () => {
    expect(servicoSchema.safeParse({ ...validoMinimo(), quantidade: "0" }).success).toBe(false);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar.** Run: `npx vitest run src/lib/servicos.test.ts`

- [ ] **Passo 3: implementar `src/lib/servicos.ts`**

Espelhar `src/lib/obra.ts`: `textoOpcional` e `dataOpcional` de `@/lib/campos`,
`z.union([z.string(), z.null()])` nos opcionais **pela idempotência**, e
`conferenciaVencida` comparando `'yyyy-mm-dd'` como string — o formato é
ordenável lexicograficamente, então não há conversão de data nem fuso no meio.

- [ ] **Passo 4: implementar `src/lib/data/servicos.ts`**

`import "server-only"` no topo. `listarServicos` devolve a contagem de
atribuídas abertas por contrato numa consulta só (`atribuicao_servico!inner`
**não** serve — mudaria a cardinalidade; use uma view com
`security_invoker = on` ou um `count` agregado). Erro em lista: `console.error`
e devolve vazio. Erro em detalhe: devolve `null`, e a página chama `notFound()`.

- [ ] **Passo 5: rodar tudo e commitar**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/servicos.ts src/lib/servicos.test.ts src/lib/data/servicos.ts
git commit -m "feat(servicos): dominio, schema idempotente e a camada de leitura"
```

---

### Task 4: A lista e o módulo

**Files:**
- Create: `src/app/(app)/servicos/page.tsx`, `src/app/(app)/servicos/loading.tsx`
- Modify: `src/lib/modulos.ts`, `src/lib/nav.ts`

**Interfaces:**
- Consumes: `listarServicos` (Task 3).
- Produces: a rota `/servicos` e a chave de módulo `servicos`.

- [ ] **Passo 1: registrar o módulo ANTES da página**

`modulos.test.ts` reprova toda rota de primeiro nível sem módulo, e com razão:
o middleware só checa permissão quando `moduloDaRota` devolve algo, então uma
rota órfã deixa **qualquer usuário autenticado** entrar. Foi o que reprovou a
primeira tentativa de `/centros-custo` na v0.117.0.

```ts
// src/lib/modulos.ts — acrescentar à lista MODULOS
{ grupo: "TI", chave: "servicos", label: "Serviços e licenças", href: "/servicos" },
```

```ts
// src/lib/nav.ts — acrescentar
{ label: "Serviços e licenças", href: "/servicos", icon: "key-round", modulo: "servicos", grupo: "TI" },
```

- [ ] **Passo 2: a página, com `pagina-lista`**

`largura-de-pagina.test.ts` exige que toda página declare o papel com
`pagina-lista`, `pagina-form` ou `pagina-leitura`. Usar `ListFilters` +
`ListSearch` + `SelectFilter` por categoria e status. `EmptyState` quando não
há registro; `<TableCell colSpan>` quando há filtro ativo.

Colunas: Nome, Categoria, Contratadas, Em uso, Ociosas, Valor mensal, Conferido
em. A coluna **Ociosas** ganha destaque quando > 0, e **Conferido em** fica em
`text-destructive` quando `conferenciaVencida`.

- [ ] **Passo 3: rodar `npm test` e ver as duas guardas passarem**

- [ ] **Passo 4: commitar**

```bash
git add src/app/\(app\)/servicos src/lib/modulos.ts src/lib/nav.ts
git commit -m "feat(servicos): a lista, e o modulo antes da rota"
```

---

### Task 5: Ficha, atribuições e o rateio na tela

**Files:**
- Create: `src/app/(app)/servicos/[id]/page.tsx`,
  `src/app/(app)/servicos/actions.ts`,
  `src/app/(app)/servicos/servico-form.tsx`,
  `src/app/(app)/servicos/[id]/_components/bloco-atribuicoes.tsx`,
  `src/app/(app)/servicos/[id]/_components/bloco-rateio.tsx`

**Interfaces:**
- Consumes: `obterServico` (Task 3), `ratearPorCabeca` (Task 1).
- Produces: `salvarServico`, `atribuirLicenca`, `removerAtribuicao`,
  `marcarConferido` — todas devolvendo `ActionResult` de `@/lib/acoes`.

- [ ] **Passo 1: o formulário**

`react-hook-form` + `zodResolver`: são mais de 3 campos com validação cruzada
(`data_fim >= data_inicio`), então é o caso em que ele se justifica.
**`useWatch({ control, name })`, nunca `watch()`** — `watch` devolve função nova
a cada render, o React Compiler desiste de memoizar o componente inteiro e o
lint acusa `react-hooks/incompatible-library`.

- [ ] **Passo 2: as actions**

Cada uma **ou** redireciona **ou** devolve `ActionResult` — nunca as duas, pois
`redirect()` lança `NEXT_REDIRECT` e mata todo código depois do `await` no
cliente. Exclusão por `supabase.rpc("soft_delete", …)`, tratando
`data !== true` como falha. `revalidatePath("/servicos")`.

`atribuirLicenca` **confere a lotação contra o banco**, não contra o formulário:
o centro de custo do rateio é o `funcionario.obra_id`, e ele muda sem passar por
esta tela.

- [ ] **Passo 3: o bloco de rateio**

Chama `ratearPorCabeca` com o valor do período e as atribuições abertas. A linha
de **ociosas em destaque** é o ponto da tela inteira: é o número em cima do qual
alguém decide cancelar assinatura. Formatar com `formatarBRL` de
`@/lib/locacao.ts` — e, ao comparar moeda formatada em teste, lembrar que o
Intl separa "R$" do número com espaço **não separável** (U+00A0).

- [ ] **Passo 4: ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/app/\(app\)/servicos
git commit -m "feat(servicos): a ficha, a atribuicao por pessoa e o rateio na tela"
```

---

### Task 6: O alerta de renovação, no cron que já existe

**Files:**
- Modify: `src/app/api/cron/vencimentos/route.ts`
- Test: `src/lib/vencimentos.test.ts` (ou o teste existente do cron)

**Interfaces:**
- Consumes: `contrato_servico` (Task 2).
- Produces: nada que outra task consuma.

- [ ] **Passo 1: o teste da frase**

```ts
it("renovação automática pede decisão de CANCELAR, não de renovar", () => {
  // Vencimento cobra renovação; renovação automática cobra o oposto. Trocar as
  // duas frases empurra a pessoa para o lado errado — ela não faz nada e a
  // assinatura renova sozinha.
  expect(fraseDoAviso({ renovaAutomaticamente: true, dias: 30 }))
    .toMatch(/renova automaticamente/i);
  expect(fraseDoAviso({ renovaAutomaticamente: false, dias: 30 }))
    .toMatch(/vence/i);
});

it("contrato de vigência indeterminada não gera alerta de renovação", () => {
  // Não há data. O que ele gera é o aviso de conferência vencida.
  expect(candidatos([{ dataFim: null, renovaAutomaticamente: true }])).toEqual([]);
});
```

- [ ] **Passo 2: implementar dentro do cron existente**

**Não criar cron novo.** Um segundo cron de aviso é a segunda cópia que
diverge, e as duas mandariam e-mail com regras diferentes sobre a mesma data.
Reusar o escalonamento 30 → 15 → 3 e o `notificacao_log`, que já impede aviso
repetido.

`maxDuration` já é 60; a consulta nova é uma só, por organização.

- [ ] **Passo 3: ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/app/api/cron/vencimentos/route.ts src/lib/vencimentos.test.ts
git commit -m "feat(servicos): o aviso de renovacao, no cron que ja existe"
```

---

### Task 7: Versão e fechamento

- [ ] **Passo 1: bumpar nos três pontos**

`APP_VERSION` em `src/lib/changelog.ts`, um `Release` novo no topo de
`CHANGELOG`, o resumo em `CHANGELOG.md` e o `version` do `package.json`.

**O número sai do que estiver na `main` na hora** — não fixe "0.118.0" aqui. A
branch `feat/busca-global` está em andamento em paralelo e mira o mesmo
intervalo; quem mergear depois lê a `main` e bumpa a partir dali. Duas entradas
de changelog sob o mesmo número não geram conflito no git — geram a tela
Novidades mostrando duas coisas diferentes.

- [ ] **Passo 2: auditoria de acentuação**

```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx
```

- [ ] **Passo 3: ritual completo**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Passo 4: atualizar o "Estado da implementação" da spec e commitar**

---

## Auto-revisão deste plano

**Cobertura da spec.** Os três blocos confirmados têm task: contrato recorrente
com rateio (1, 2, 3, 5), alerta de renovação (6), contratadas x em uso (2, 3,
4, 5). As quatro decisões travadas na spec aparecem: sem termo de custódia e
fora de `equipamento_unidade` (não há task que os toque, por construção); o
rateio não escreve no Mega (nenhuma task chama o ERP); o alerta usa o cron
existente (Task 6, explícito).

**Placeholders.** Nenhum "TBD". Task 3 passos 4 e Task 4 passo 2 descrevem
comportamento em prosa em vez de código completo — são telas e consulta que
seguem padrão já estabelecido no repositório, e os arquivos-modelo estão
nomeados (`src/lib/obra.ts`, `src/lib/data/obras.ts`, a lista de obras).

**Consistência de tipos.** `ratearPorCabeca(totalCentavos, quantidade,
atribuicoes)` tem a mesma assinatura na Task 1 e na Task 5.
`centroCustoId` é `string | null` em todas as ocorrências.
`conferido_em` é `date` no banco e `string | null` no TypeScript, consistente
entre as Tasks 2, 3 e 4.

**Uma lacuna conhecida, deixada de propósito:** a Task 3 diz que a contagem de
atribuídas por contrato não pode sair de um `!inner` (muda cardinalidade) e
sugere view com `security_invoker = on` ou `count` agregado, sem escolher. A
escolha depende de medir a consulta, e chutar aqui seria pior que decidir com o
plano na mão — mas a armadilha está nomeada, que é o que evita o erro.
