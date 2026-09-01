# Orçamento de locação por obra — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o terceiro percentual do pedido da diretoria — orçamento consumido — para o Loca cruzar prazo, avanço físico e consumo, e projetar estouro antes que ele aconteça.

**Architecture:** Uma migration (`orcamento_locacao` versionada + `orcamento_item`), um módulo puro `src/lib/orcamento.ts` com todo o cálculo e o schema, leitura em `src/lib/data/orcamento.ts`, uma action que revisa criando versão nova, e um bloco em `/obras/[id]` que passa a mostrar os três percentuais juntos.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), zod 4, react-hook-form, Tailwind v4 + Base UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-orcamento-locacao-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível.** Auditoria: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **"Hoje" é `hojeISOSaoPaulo()`** de `@/lib/locacao`. Nunca `new Date()` contra coluna `date`.
- **Schemas zod em `src/lib/<dominio>.ts`**, nunca em `actions.ts`.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **Todo `handleSubmit` leva a rede:** `handleSubmit(onSubmit, aoInvalidar(setErroServidor))`.
- **`createAdminClient()` só em cron.** Em `src/lib/data/` é sempre `createClient()`.
- **Dinheiro formatado por `formatarBRL`** de `@/lib/locacao`. Em teste, o Intl separa "R$" do número com espaço **não separável** (U+00A0).
- **Ritual antes de cada commit de tarefa:** `npm run typecheck && npm run lint && npm test && npm run build`
- **Versionamento nos três pontos** ao final: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`. É MINOR → **0.42.0**.
- **Migration:** a próxima livre. Hoje a última é `0050_avanco_obra.sql`, então esta é **0051**. Confirme com `ls supabase/migrations | tail -1`.
- **Aplicar migration:** a CLI do Supabase está inacessível nesta máquina. Use `apply_migration` do MCP, e `get_advisors` de segurança depois.

---

### Task 1: ✅ O cálculo puro — `src/lib/orcamento.ts`

**Files:**
- Create: `src/lib/orcamento.ts`
- Create: `src/lib/orcamento.test.ts`

**Interfaces:**
- Consumes: `idOpcional`, `textoOpcional` de `@/lib/campos`.
- Produces:
  - `percentualConsumido(orcado: number, realizado: number): number | null`
  - `projecaoFinal(consumido: number | null, fisico: number | null): number | null`
  - `estouroPrevisto(orcado: number, projecao: number | null): number | null`
  - `diagnostico(prazo: number | null, fisico: number | null, consumido: number | null): string`
  - `totalDetalhado(itens: { valor_previsto: number }[]): number`
  - `orcamentoSchema`, `OrcamentoInput`, `OrcamentoDados`

- [x] **Step 1: Escrever o teste que falha**

Criar `src/lib/orcamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  percentualConsumido,
  projecaoFinal,
  estouroPrevisto,
  diagnostico,
  totalDetalhado,
  orcamentoSchema,
} from "./orcamento";

describe("percentualConsumido", () => {
  it("calcula a fração do orçamento já comprometida", () => {
    expect(percentualConsumido(400000, 248000)).toBeCloseTo(62, 1);
  });

  it("devolve null com orçamento zero ou negativo — não divide por zero", () => {
    expect(percentualConsumido(0, 1000)).toBeNull();
    expect(percentualConsumido(-1, 1000)).toBeNull();
  });

  it("passa de 100 quando estourou — travar aqui esconderia o estouro", () => {
    expect(percentualConsumido(100000, 130000)).toBeCloseTo(130, 1);
  });

  it("é 0 sem nada realizado", () => {
    expect(percentualConsumido(400000, 0)).toBe(0);
  });
});

describe("projecaoFinal", () => {
  it("projeta pelo ritmo de consumo contra a entrega", () => {
    // O caso do desenho: 62% de orçamento com 31% de obra → 200%.
    expect(projecaoFinal(62, 31)).toBeCloseTo(200, 1);
  });

  it("obra eficiente projeta abaixo de 100%", () => {
    expect(projecaoFinal(30, 60)).toBeCloseTo(50, 1);
  });

  it("devolve null sem avanço físico — não há denominador", () => {
    expect(projecaoFinal(62, null)).toBeNull();
    expect(projecaoFinal(62, 0)).toBeNull();
  });

  it("devolve null sem consumo apurado", () => {
    expect(projecaoFinal(null, 31)).toBeNull();
  });
});

describe("estouroPrevisto", () => {
  it("é a diferença em reais acima do orçamento", () => {
    expect(estouroPrevisto(400000, 200)).toBe(400000);
  });

  it("é null quando a projeção fica dentro do orçamento", () => {
    expect(estouroPrevisto(400000, 90)).toBeNull();
    expect(estouroPrevisto(400000, 100)).toBeNull();
  });

  it("é null sem projeção", () => {
    expect(estouroPrevisto(400000, null)).toBeNull();
  });
});

describe("diagnostico", () => {
  it("acusa consumo mais rápido que a entrega", () => {
    expect(diagnostico(55, 31, 62)).toBe("Consumindo mais rápido que entrega.");
  });

  it("reconhece obra entregando mais que consome", () => {
    expect(diagnostico(55, 60, 30)).toBe("Entregando mais que consome.");
  });

  it("chama de alinhado o que está dentro da margem de 10 pontos", () => {
    // A margem existe para o veredito não oscilar por ruído de arredondamento.
    expect(diagnostico(55, 40, 45)).toBe("Consumo alinhado ao avanço.");
  });

  it("diz o que falta quando falta dado", () => {
    expect(diagnostico(55, null, 62)).toBe("Sem avanço físico lançado.");
    expect(diagnostico(55, 31, null)).toBe("Sem orçamento cadastrado.");
  });
});

describe("totalDetalhado", () => {
  it("soma os itens do orçamento", () => {
    expect(
      totalDetalhado([{ valor_previsto: 120000 }, { valor_previsto: 200000 }]),
    ).toBe(320000);
  });

  it("é 0 sem itens", () => {
    expect(totalDetalhado([])).toBe(0);
  });
});

describe("orcamentoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("aceita o id em branco que o input oculto manda", () => {
    const r = orcamentoSchema.safeParse({
      id: "",
      obra_id: UUID,
      valor_total: "400000",
      observacoes: "",
      itens: [],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBeNull();
      expect(r.data.valor_total).toBe(400000);
      expect(r.data.observacoes).toBeNull();
    }
  });

  it("recusa valor negativo", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "-1",
      itens: [],
    });
    expect(r.success).toBe(false);
  });

  it("aceita detalhamento por item", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [{ item_id: UUID, quantidade: "3", valor_previsto: "120000" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.itens[0].valor_previsto).toBe(120000);
  });

  it("recusa o mesmo item duas vezes — o banco tem unique e o erro seria cru", () => {
    const r = orcamentoSchema.safeParse({
      obra_id: UUID,
      valor_total: "400000",
      itens: [
        { item_id: UUID, valor_previsto: "1" },
        { item_id: UUID, valor_previsto: "2" },
      ],
    });
    expect(r.success).toBe(false);
  });
});
```

- [x] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/orcamento.test.ts`
Expected: FAIL — `Failed to resolve import "./orcamento"`.

- [x] **Step 3: Implementar `src/lib/orcamento.ts`**

```ts
// Orçamento de locação: o terceiro percentual, e o cruzamento dos três.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Prazo decorrido e avanço físico já existem (src/lib/avanco.ts). Faltava o
// consumo do orçamento, que é o que transforma dois números em diagnóstico:
//
//   consumido 62%  ÷  avanço 31%  =  2,0  →  200% do orçamento no fim
//
// "Consumi 62%" isolado não diz nada. Ao lado de "entreguei 31%", diz que a
// obra vai estourar o dobro — e é esse número que muda decisão de diretor.
//
// Tudo aqui é puro. O número que a diretoria vai ler tem de ser testável sem
// banco.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional, textoOpcional } from "@/lib/campos";

/**
 * Percentual do orçamento já comprometido.
 *
 * `null` com orçado ≤ 0: obra sem orçamento não tem percentual, e dividir por
 * zero daria `Infinity` — a tela mostraria "∞%".
 *
 * NÃO trava em 100 de propósito. Travar esconderia exatamente o que interessa:
 * uma obra em 130% precisa aparecer como 130%.
 */
export function percentualConsumido(orcado: number, realizado: number): number | null {
  if (!Number.isFinite(orcado) || orcado <= 0) return null;
  return (realizado / orcado) * 100;
}

/**
 * Quanto do orçamento a obra consumirá no ritmo atual, em percentual.
 *
 * A conta é uma regra de três: se 31% de obra custou 62% do orçamento, 100% de
 * obra custará 200%.
 *
 * `null` sem avanço físico — e é o caso mais importante desta função. Uma obra
 * em 0% que já gastou R$ 10.000 projetaria infinito, e "estouro de ∞" num
 * painel de diretoria destrói a confiança em tudo que está ao lado.
 */
export function projecaoFinal(
  consumido: number | null,
  fisico: number | null,
): number | null {
  if (consumido === null || fisico === null || fisico <= 0) return null;
  return (consumido / fisico) * 100;
}

/** Reais acima do orçamento na projeção. `null` quando não estoura. */
export function estouroPrevisto(orcado: number, projecao: number | null): number | null {
  if (projecao === null || projecao <= 100) return null;
  return orcado * ((projecao - 100) / 100);
}

/**
 * Margem, em pontos percentuais, para o veredito não oscilar.
 *
 * Sem ela, uma obra com 45% de consumo e 44% de avanço mudaria de diagnóstico a
 * cada semana por ruído de arredondamento — e diagnóstico que muda toda semana
 * deixa de ser lido.
 */
const MARGEM_PONTOS = 10;

/** O veredito legível do cruzamento dos três percentuais. */
export function diagnostico(
  prazo: number | null,
  fisico: number | null,
  consumido: number | null,
): string {
  // A ordem das faltas importa: dizer QUAL dado falta é o que faz a pessoa
  // saber o que preencher. "Dados insuficientes" não ensina nada.
  if (consumido === null) return "Sem orçamento cadastrado.";
  if (fisico === null) return "Sem avanço físico lançado.";

  if (consumido > fisico + MARGEM_PONTOS) return "Consumindo mais rápido que entrega.";
  if (consumido < fisico - MARGEM_PONTOS) return "Entregando mais que consome.";
  return "Consumo alinhado ao avanço.";
}

/** Soma do detalhamento, para a linha de divergência contra o total. */
export function totalDetalhado(itens: { valor_previsto: number }[]): number {
  return itens.reduce((soma, i) => soma + i.valor_previsto, 0);
}

// ── Schema ───────────────────────────────────────────────────────────────────

/** Dinheiro de formulário: aceita string com vírgula, número, e o próprio output. */
const dinheiro = (msg: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
    )
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: msg,
    })
    .transform((v) => (v === "" ? 0 : Number(v)));

export const orcamentoItemSchema = z.object({
  item_id: z.string().uuid("Selecione o item."),
  quantidade: dinheiro("Quantidade inválida."),
  valor_previsto: dinheiro("Valor previsto inválido."),
});

export const orcamentoSchema = z
  .object({
    id: idOpcional,
    obra_id: z.string().uuid("Selecione a obra."),
    valor_total: dinheiro("Informe o valor do orçamento."),
    observacoes: textoOpcional(500),
    itens: z.array(orcamentoItemSchema).default([]),
  })
  .superRefine((d, ctx) => {
    // O banco tem `unique (orcamento_id, item_id)`, e sem esta checagem o erro
    // chegaria cru na tela ("duplicate key value violates unique constraint").
    const vistos = new Set<string>();
    d.itens.forEach((i, idx) => {
      if (vistos.has(i.item_id)) {
        ctx.addIssue({
          code: "custom",
          path: ["itens", idx, "item_id"],
          message: "Este item já está no orçamento.",
        });
      }
      vistos.add(i.item_id);
    });
  });

export type OrcamentoInput = z.input<typeof orcamentoSchema>;
export type OrcamentoDados = z.output<typeof orcamentoSchema>;
```

- [x] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/orcamento.test.ts`
Expected: PASS

- [x] **Step 5: Registrar na varredura de schemas**

`MODULOS` de `src/lib/schemas-varredura.test.ts` é lista à mão. Acrescentar o
import junto dos outros e a entrada no mapa (ordem alfabética, depois de
`obra`):

```ts
import * as orcamento from "./orcamento";
```

```ts
  obra,
  orcamento,
  permissoes,
```

E a amostra mínima em `AMOSTRAS`:

```ts
  orcamentoSchema: { obra_id: UUID, valor_total: "400000" },
  orcamentoItemSchema: { item_id: UUID, valor_previsto: "120000" },
```

- [x] **Step 6: Rodar a varredura**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: PASS, incluindo `orcamento.orcamentoSchema aceita id em branco (cadastro novo)`.

- [x] **Step 7: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/orcamento.ts src/lib/orcamento.test.ts src/lib/schemas-varredura.test.ts
git commit -m "feat(orcamento): o cálculo puro de consumo, projeção e diagnóstico"
```

---

### Task 2: ✅ A migration (aplicada em produção)

**Files:**
- Create: `supabase/migrations/0051_orcamento_locacao.sql`

**Interfaces:**
- Consumes: `set_updated_at()`, `current_org_id()`, `current_papel()`, `is_member_of_obra(uuid)`, `pode_gerir_cadastros()` — as mesmas da 0050, todas confirmadas existentes.
- Produces: `public.orcamento_locacao`, `public.orcamento_item`.

- [x] **Step 1: Escrever a migration**

```sql
-- ============================================================================
-- Orçamento de locação por obra
-- (docs/superpowers/specs/2026-09-01-orcamento-locacao-design.md)
--
-- Fecha o terceiro percentual do pedido da diretoria. Nada aqui altera dado
-- existente: duas tabelas novas e suas policies.
-- ============================================================================

create table if not exists public.orcamento_locacao (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  obra_id      uuid not null references public.obra (id) on delete cascade,
  -- Revisão NUNCA sobrescreve: cria versão nova e aposenta a anterior. Se
  -- sobrescrevesse, o orçamento perseguiria o realizado — nunca haveria
  -- estouro, porque o alvo se move — e o desvio ficaria inexplicável.
  versao       int  not null default 1,
  vigente      boolean not null default true,
  valor_total  numeric(14,2) not null check (valor_total >= 0),
  observacoes  text,
  criado_por   uuid references public.perfil (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (obra_id, versao)
);

-- Um único vigente por obra. Índice PARCIAL, e não constraint, porque é o que
-- permite N versões aposentadas convivendo com uma vigente.
create unique index if not exists idx_orcamento_vigente
  on public.orcamento_locacao (obra_id) where vigente;

create index if not exists idx_orcamento_obra on public.orcamento_locacao (obra_id);
create index if not exists idx_orcamento_org  on public.orcamento_locacao (org_id);

drop trigger if exists trg_orcamento_updated_at on public.orcamento_locacao;
create trigger trg_orcamento_updated_at
  before update on public.orcamento_locacao
  for each row execute function public.set_updated_at();

create table if not exists public.orcamento_item (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  -- `cascade` porque item de orçamento não tem vida própria fora dele.
  orcamento_id   uuid not null references public.orcamento_locacao (id) on delete cascade,
  -- `restrict` porque apagar do catálogo um item que está orçado apagaria
  -- história: o orçamento passado deixaria de fazer sentido.
  item_id        uuid not null references public.item_catalogo (id) on delete restrict,
  quantidade     numeric(14,2),
  valor_previsto numeric(14,2) not null check (valor_previsto >= 0),
  created_at     timestamptz not null default now(),
  unique (orcamento_id, item_id)
);

create index if not exists idx_orcamento_item_orc on public.orcamento_item (orcamento_id);
create index if not exists idx_orcamento_item_org on public.orcamento_item (org_id);

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, no padrão da 0049/0050
-- ---------------------------------------------------------------------------
alter table public.orcamento_locacao enable row level security;
alter table public.orcamento_item    enable row level security;

drop policy if exists "orcamento_select" on public.orcamento_locacao;
create policy "orcamento_select" on public.orcamento_locacao
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.current_papel() in ('master', 'administrador', 'gestor')
      or public.is_member_of_obra(obra_id)
    )
  );

drop policy if exists "orcamento_write" on public.orcamento_locacao;
create policy "orcamento_write" on public.orcamento_locacao
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );

-- `orcamento_item` resolve a obra pelo orçamento PAI, e não por um `obra_id`
-- denormalizado que poderia divergir do pai em silêncio.
drop policy if exists "orcamento_item_select" on public.orcamento_item;
create policy "orcamento_item_select" on public.orcamento_item
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and exists (
      select 1 from public.orcamento_locacao o
      where o.id = orcamento_id
        and (
          public.current_papel() in ('master', 'administrador', 'gestor')
          or public.is_member_of_obra(o.obra_id)
        )
    )
  );

drop policy if exists "orcamento_item_write" on public.orcamento_item;
create policy "orcamento_item_write" on public.orcamento_item
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );
```

- [x] **Step 2: Validar executando, num Postgres descartável**

Antes de produção. Criar banco novo com stubs só do que a migration referencia
(`organizacao`, `obra`, `perfil`, `item_catalogo`, `set_updated_at`,
`current_org_id`, `current_papel`, `is_member_of_obra`,
`pode_gerir_cadastros`, o enum `papel_usuario`, o papel `authenticated`) e
aplicar com `psql -v ON_ERROR_STOP=1`.

Provar três comportamentos, não só que a migration roda:

1. dois orçamentos **vigentes** na mesma obra são recusados pelo índice parcial;
2. duas versões conviverem, uma vigente e outra não, é aceito;
3. o mesmo `item_id` duas vezes no mesmo orçamento é recusado.

- [x] **Step 3: Aplicar em produção**

Via `apply_migration` do MCP do Supabase, com `name: "orcamento_locacao"`. A CLI
está inacessível nesta máquina.

- [x] **Step 4: Conferir o que foi criado e a segurança**

`execute_sql` para contar colunas, policies, índices e triggers; e
`get_advisors` com `type: "security"` — não deve apontar nada nas duas tabelas
novas.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0051_orcamento_locacao.sql
git commit -m "feat(orcamento): migration do orçamento versionado por obra"
```

---

### Task 3: ✅ Leitura e gravação

**Files:**
- Create: `src/lib/data/orcamento.ts`
- Create: `src/app/(app)/obras/[id]/orcamento-actions.ts`

**Interfaces:**
- Consumes: `orcamentoSchema` de `@/lib/orcamento`.
- Produces:
  - `type OrcamentoObra = { id: string; versao: number; valor_total: number; observacoes: string | null; created_at: string; itens: ItemOrcado[] }`
  - `type ItemOrcado = { item_id: string; descricao: string; quantidade: number | null; valor_previsto: number }`
  - `type RealizadoObra = { comContrato: number; semContrato: number; pago: number }`
  - `orcamentoVigente(obraId: string): Promise<OrcamentoObra | null>`
  - `historicoOrcamento(obraId: string): Promise<{ versao: number; valor_total: number; created_at: string }[]>`
  - `realizadoLocacao(obraId: string): Promise<RealizadoObra>`
  - `salvarOrcamento(raw: unknown): Promise<ActionResult>`

- [x] **Step 1: A camada de leitura**

Criar `src/lib/data/orcamento.ts`:

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ItemOrcado = {
  item_id: string;
  descricao: string;
  quantidade: number | null;
  valor_previsto: number;
};

export type OrcamentoObra = {
  id: string;
  versao: number;
  valor_total: number;
  observacoes: string | null;
  created_at: string;
  itens: ItemOrcado[];
};

export type RealizadoObra = {
  /** Lançamentos COM contrato de locação — o realizado de verdade. */
  comContrato: number;
  /**
   * Lançamentos da obra SEM contrato vinculado.
   *
   * Existe para a tela poder confessar o dado faltante. Sem este número, um
   * "0% consumido" seria mentira por omissão: o dinheiro saiu, só não está
   * atribuído a contrato nenhum.
   */
  semContrato: number;
  /** Quanto já foi efetivamente pago, do que tem contrato. */
  pago: number;
};

/** O orçamento vigente da obra, com o detalhamento por item. */
export async function orcamentoVigente(obraId: string): Promise<OrcamentoObra | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orcamento_locacao")
    .select(
      "id, versao, valor_total, observacoes, created_at, orcamento_item(item_id, quantidade, valor_previsto, item:item_id(descricao))",
    )
    .eq("obra_id", obraId)
    .eq("vigente", true)
    .maybeSingle();

  if (error) {
    console.error("orcamentoVigente", error);
    return null;
  }
  if (!data) return null;

  type LinhaItem = {
    item_id: string;
    quantidade: string | number | null;
    valor_previsto: string | number;
    item: { descricao: string } | null;
  };

  return {
    id: data.id,
    versao: data.versao,
    // `numeric` do Postgres chega como string no PostgREST; sem Number() a
    // aritmética de percentual viraria concatenação de texto.
    valor_total: Number(data.valor_total),
    observacoes: data.observacoes,
    created_at: data.created_at,
    itens: ((data.orcamento_item ?? []) as unknown as LinhaItem[]).map((i) => ({
      item_id: i.item_id,
      descricao: i.item?.descricao ?? "(item removido)",
      quantidade: i.quantidade === null ? null : Number(i.quantidade),
      valor_previsto: Number(i.valor_previsto),
    })),
  };
}

/** Todas as versões, da mais recente para a mais antiga. */
export async function historicoOrcamento(
  obraId: string,
): Promise<{ versao: number; valor_total: number; created_at: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orcamento_locacao")
    .select("versao, valor_total, created_at")
    .eq("obra_id", obraId)
    .order("versao", { ascending: false });

  if (error || !data) {
    console.error("historicoOrcamento", error);
    return [];
  }
  return data.map((d) => ({
    versao: d.versao,
    valor_total: Number(d.valor_total),
    created_at: d.created_at,
  }));
}

/**
 * O realizado de locação da obra.
 *
 * `valor` e não `valor_pago`: orçamento é consumido quando o custo é INCORRIDO.
 * Tratar nota pendente como não consumida faria o percentual despencar todo mês
 * e subir na data do pagamento, sem nada ter mudado na obra.
 */
export async function realizadoLocacao(obraId: string): Promise<RealizadoObra> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lancamento_financeiro")
    .select("valor, valor_pago, contrato_id")
    .eq("obra_id", obraId)
    .is("deleted_at", null);

  if (error || !data) {
    console.error("realizadoLocacao", error);
    return { comContrato: 0, semContrato: 0, pago: 0 };
  }

  let comContrato = 0;
  let semContrato = 0;
  let pago = 0;
  for (const l of data) {
    const valor = Number(l.valor);
    if (l.contrato_id) {
      comContrato += valor;
      pago += Number(l.valor_pago ?? 0);
    } else {
      semContrato += valor;
    }
  }
  return { comContrato, semContrato, pago };
}
```

- [x] **Step 2: A action que revisa criando versão**

Criar `src/app/(app)/obras/[id]/orcamento-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { orcamentoSchema } from "@/lib/orcamento";

/**
 * Salva o orçamento de locação de uma obra.
 *
 * Já existe orçamento vigente? Então isto é uma REVISÃO: a versão anterior é
 * aposentada e uma nova nasce. Nunca sobrescreve — sem a linha de base, o
 * orçamento passaria a perseguir o realizado e o estouro ficaria inexplicável.
 */
export async function salvarOrcamento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para definir o orçamento da obra.");
  }

  const parsed = orcamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { obra_id, valor_total, observacoes, itens } = parsed.data;
  const supabase = await createClient();

  // A versão vigente atual, para saber o próximo número e aposentá-la.
  const { data: atual } = await supabase
    .from("orcamento_locacao")
    .select("id, versao")
    .eq("obra_id", obra_id)
    .eq("vigente", true)
    .maybeSingle();

  // O índice parcial `idx_orcamento_vigente` recusaria dois vigentes, então a
  // ordem importa: aposenta ANTES de inserir. Sem isto, o insert falha com erro
  // cru de unique.
  if (atual) {
    const { error } = await supabase
      .from("orcamento_locacao")
      .update({ vigente: false })
      .eq("id", atual.id);
    if (error) {
      console.error("salvarOrcamento/aposentar", error);
      return falha("Não foi possível salvar. Tente novamente.");
    }
  }

  const { data: novo, error } = await supabase
    .from("orcamento_locacao")
    .insert({
      org_id: perfil.org_id,
      obra_id,
      versao: (atual?.versao ?? 0) + 1,
      vigente: true,
      valor_total,
      observacoes,
      criado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error || !novo) {
    console.error("salvarOrcamento/inserir", error);
    return falha("Não foi possível salvar. Tente novamente.");
  }

  if (itens.length > 0) {
    const { error: erroItens } = await supabase.from("orcamento_item").insert(
      itens.map((i) => ({
        org_id: perfil.org_id,
        orcamento_id: novo.id,
        item_id: i.item_id,
        quantidade: i.quantidade || null,
        valor_previsto: i.valor_previsto,
      })),
    );
    if (erroItens) {
      console.error("salvarOrcamento/itens", erroItens);
      return falha("O orçamento foi salvo, mas o detalhamento por item falhou.");
    }
  }

  revalidatePath(`/obras/${obra_id}`);
  return { ok: true, id: novo.id };
}
```

- [x] **Step 3: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/data/orcamento.ts "src/app/(app)/obras/[id]/orcamento-actions.ts"
git commit -m "feat(orcamento): leitura do vigente e revisão por versão"
```

---

### Task 4: ✅ O bloco na obra e os três percentuais juntos

**Files:**
- Create: `src/app/(app)/obras/[id]/_components/bloco-orcamento.tsx`
- Create: `src/app/(app)/obras/[id]/_components/orcamento-form.tsx`
- Modify: `src/app/(app)/obras/[id]/_components/bloco-avanco.tsx`
- Modify: `src/app/(app)/obras/[id]/page.tsx`

**Interfaces:**
- Consumes: `percentualConsumido`, `projecaoFinal`, `estouroPrevisto`, `diagnostico`, `totalDetalhado` de `@/lib/orcamento`; `orcamentoVigente`, `historicoOrcamento`, `realizadoLocacao` de `@/lib/data/orcamento`; `percentualPrazo` de `@/lib/avanco`.
- Produces: `BlocoOrcamento`, `OrcamentoForm`.

- [x] **Step 1: O bloco de orçamento**

Server Component. Recebe obra, orçamento vigente, histórico, realizado e o
avanço físico atual. Mostra:

- **Orçado** (valor vigente, com a versão: "v2");
- **Realizado** (`comContrato`), e **pago** como detalhe;
- **% consumido**, ou "sem orçamento" quando não há;
- **Projeção final** e **estouro previsto**, ou "sem avanço lançado, não há projeção";
- **o diagnóstico** em destaque, vermelho quando é "Consumindo mais rápido que entrega.";
- **a linha de confissão**, quando `semContrato > 0`:

```tsx
{realizado.semContrato > 0 ? (
  <p className="text-xs text-muted-foreground">
    {formatarBRL(realizado.semContrato)} lançados nesta obra não estão
    vinculados a contrato e por isso não entram no realizado.
  </p>
) : null}
```

- **detalhamento por item** em tabela, com a linha de divergência quando
  `totalDetalhado(itens) !== valor_total`:

```tsx
Detalhado: {formatarBRL(detalhado)} de {formatarBRL(orcamento.valor_total)}
{diferenca > 0 ? ` · ${formatarBRL(diferenca)} sem detalhamento` : null}
```

- **histórico de versões** em lista recolhida, com data e valor.

Sem orçamento cadastrado o bloco não mostra zeros: mostra um `<p>` mudo e o
formulário.

- [x] **Step 2: O formulário**

`"use client"`, com `react-hook-form` + `zodResolver(orcamentoSchema)` — são ≥3
campos com validação cruzada (a checagem de item duplicado), o que justifica o
resolver. `useFieldArray` para o detalhamento por item, com um `<select>` do
catálogo (`NativeSelect`) por linha.

Obrigatório: `handleSubmit(onSubmit, aoInvalidar(setErroServidor))` e
`<FormError>{erroServidor}</FormError>`.

Quando já existe orçamento vigente, o botão diz **"Salvar como nova versão"** —
não "Salvar". A pessoa precisa saber que está criando revisão, não editando.

- [x] **Step 3: Os três percentuais no bloco de avanço**

Em `bloco-avanco.tsx`, aceitar `consumido: number | null` como prop e
acrescentar o quarto `<Numero>` na grade (que passa de `sm:grid-cols-4` para
`sm:grid-cols-5`), com o rótulo "Orçamento consumido".

É aqui que o pedido da diretoria aparece inteiro numa tela só.

- [x] **Step 4: Ligar na página**

Em `page.tsx`, buscar em paralelo `orcamentoVigente(id)`,
`historicoOrcamento(id)` e `realizadoLocacao(id)` junto do
`historicoAvanco(id)` que já existe, calcular o consumido e passar aos dois
blocos.

- [~] **Step 5: Conferir na tela** — pendente: exige login, que eu não tenho

`npm run dev`, abrir uma obra, cadastrar orçamento, conferir os números.
Depois salvar de novo com valor diferente e confirmar que **criou v2** e que o
histórico mostra as duas.

- [x] **Step 6: Auditoria de PT-BR, ritual e commit**

```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/obras/[id]" --include=*.tsx
npm run typecheck && npm run lint && npm test && npm run build
git add "src/app/(app)/obras/[id]"
git commit -m "feat(obras): bloco de orçamento e os três percentuais juntos"
```

---

### Task 5: ✅ Fechamento — versão e publicação

- [x] **Step 1: Bumpar os três pontos**

MINOR: da 0.41.0 para a **0.42.0**. `APP_VERSION` em `src/lib/changelog.ts`, um
`Release` no topo com texto voltado ao usuário, resumo em `CHANGELOG.md` e
`version` em `package.json`.

- [x] **Step 2: Ritual completo**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [x] **Step 3: Revisar o diff inteiro**

```bash
git diff main...HEAD --stat && git diff main...HEAD
```

- [x] **Step 4: Merge, ritual de novo, publicação**

```bash
git checkout main
git merge --no-ff feat/orcamento-locacao
npm run typecheck && npm run lint && npm test && npm run build
git push origin main
```

O ritual roda **de novo depois do merge**: resolução de conflito à mão é
exatamente onde entra quebra silenciosa, e foi o que pegou o campo `controle`
faltando num fixture quando as duas correções se encontraram na 0.40.0.

- [~] **Step 5: Conferir a publicação** — o rodapé da sidebar mostra a versão; pendente de conferência humana

O rodapé da sidebar mostra `Loca vX.Y.Z`. Sem a CLI da Vercel, é o jeito de
saber qual versão está no ar.
