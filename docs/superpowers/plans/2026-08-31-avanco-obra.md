# Período da obra e avanço físico semanal — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar período à obra e avanço físico semanal, para o Loca cruzar "% de prazo decorrido" com "% de avanço físico" e diagnosticar atraso — os dois primeiros dos três percentuais que a diretoria pediu.

**Architecture:** Uma migration (datas em `obra` + tabela `avanco_obra` com `unique (obra_id, semana)`), um módulo puro `src/lib/avanco.ts` com todo o cálculo e o schema, uma camada de leitura em `src/lib/data/avanco.ts`, uma tela de lançamento em lote `/avanco`, um bloco no detalhe da obra, e um e-mail semanal no cron.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), zod 4, react-hook-form, Tailwind v4 + Base UI, Vitest, Resend.

**Spec:** `docs/superpowers/specs/2026-08-31-avanco-obra-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível** — rótulo, placeholder, toast, erro, e-mail. Auditoria antes de fechar: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **"Hoje" é `hojeISOSaoPaulo()`**, de `@/lib/locacao`. **Nunca `new Date()`** quando a data for comparada com coluna `date`.
- **Schemas zod moram em `src/lib/<dominio>.ts`**, nunca dentro de `actions.ts` — arquivo `"use server"` não é importável por componente cliente.
- **Server action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **Todo `handleSubmit` leva a rede:** `handleSubmit(onSubmit, aoInvalidar(setErroServidor))`.
- **`createAdminClient()` só no cron.** Em `src/lib/data/` é sempre `createClient()`.
- **Leitura em `src/lib/data/` abre com `import "server-only"`** e devolve tipos planos.
- **Ritual de fechamento**, obrigatório antes de cada commit de tarefa: `npm run typecheck && npm run lint && npm test && npm run build`
- **Versionamento nos três pontos** ao final: `src/lib/changelog.ts` (`APP_VERSION` + `Release`), `CHANGELOG.md`, `package.json`.
- **Número da migration:** o próximo livre no momento da execução. Hoje a última é `0049_recebimento_equipamento.sql`, então esta é **0050**. Confirme com `ls supabase/migrations | tail -1` antes de criar.

---

### Task 1: O cálculo puro — `src/lib/avanco.ts` ✅ CONCLUÍDA (4a3cc62)

Primeiro porque é o coração e não depende de banco nenhum. Tudo aqui é função pura, então é TDD de verdade.

**Files:**
- Create: `src/lib/avanco.ts`
- Create: `src/lib/avanco.test.ts`

**Interfaces:**
- Consumes: `hojeISOSaoPaulo`, `ehDataISO` de `@/lib/locacao`; `idOpcional`, `textoOpcional` de `@/lib/campos`.
- Produces:
  - `segundaDaSemana(iso: string): string`
  - `diasEntre(aISO: string, bISO: string): number`
  - `percentualPrazo(obra: PeriodoObra, hojeISO: string): number | null`
  - `desvio(prazo: number | null, fisico: number | null): number | null`
  - `semanasSemLancamento(ultimaSemana: string | null, hojeISO: string): number | null`
  - `previsaoTermino(avancos: PontoAvanco[], hojeISO: string): string | null`
  - `type PeriodoObra = { data_inicio: string | null; data_fim_prevista: string | null }`
  - `type PontoAvanco = { semana: string; percentual: number }`
  - `avancoSchema`, `AvancoInput`, `AvancoDados`

- [x] **Step 1: Escrever o teste que falha**

Criar `src/lib/avanco.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  segundaDaSemana,
  diasEntre,
  percentualPrazo,
  desvio,
  semanasSemLancamento,
  previsaoTermino,
  avancoSchema,
} from "./avanco";

describe("segundaDaSemana", () => {
  // Canoniza qualquer dia para a segunda-feira daquela semana. É o que faz o
  // `unique (obra_id, semana)` significar "um lançamento por semana".
  it("devolve a própria data quando já é segunda", () => {
    expect(segundaDaSemana("2026-08-31")).toBe("2026-08-31"); // segunda
  });

  it("recua de qualquer dia da semana para a segunda anterior", () => {
    expect(segundaDaSemana("2026-09-01")).toBe("2026-08-31"); // terça
    expect(segundaDaSemana("2026-09-02")).toBe("2026-08-31"); // quarta
    expect(segundaDaSemana("2026-09-05")).toBe("2026-08-31"); // sábado
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    // O caso que quase toda implementação erra: getDay() do domingo é 0.
    expect(segundaDaSemana("2026-09-06")).toBe("2026-08-31");
  });

  it("atravessa virada de mês e de ano", () => {
    expect(segundaDaSemana("2026-01-01")).toBe("2025-12-29");
  });
});

describe("diasEntre", () => {
  it("conta dias de calendário", () => {
    expect(diasEntre("2026-08-01", "2026-08-31")).toBe(30);
    expect(diasEntre("2026-08-31", "2026-08-01")).toBe(-30);
    expect(diasEntre("2026-08-31", "2026-08-31")).toBe(0);
  });

  it("não perde dia no horário de verão nem na virada de ano", () => {
    expect(diasEntre("2025-12-29", "2026-01-05")).toBe(7);
  });
});

describe("percentualPrazo", () => {
  const obra = { data_inicio: "2026-01-01", data_fim_prevista: "2026-12-31" };

  it("devolve null quando falta qualquer uma das datas", () => {
    expect(percentualPrazo({ data_inicio: null, data_fim_prevista: "2026-12-31" }, "2026-06-01")).toBeNull();
    expect(percentualPrazo({ data_inicio: "2026-01-01", data_fim_prevista: null }, "2026-06-01")).toBeNull();
  });

  it("calcula a fração do período decorrida", () => {
    // 2026-01-01 a 2026-12-31 = 364 dias. Em 2026-07-02 passaram 182.
    expect(percentualPrazo(obra, "2026-07-02")).toBeCloseTo(50, 1);
  });

  it("trava em 0 e em 100 fora do período", () => {
    expect(percentualPrazo(obra, "2025-06-01")).toBe(0);
    expect(percentualPrazo(obra, "2027-06-01")).toBe(100);
  });

  it("obra de um dia não divide por zero", () => {
    const umDia = { data_inicio: "2026-05-10", data_fim_prevista: "2026-05-10" };
    expect(percentualPrazo(umDia, "2026-05-09")).toBe(0);
    expect(percentualPrazo(umDia, "2026-05-10")).toBe(100);
  });
});

describe("desvio", () => {
  it("é positivo quando o prazo corre mais rápido que a obra", () => {
    expect(desvio(55, 31)).toBe(24);
  });

  it("é negativo quando a obra está adiantada", () => {
    expect(desvio(30, 45)).toBe(-15);
  });

  it("é null quando não há prazo ou não há avanço", () => {
    expect(desvio(null, 31)).toBeNull();
    expect(desvio(55, null)).toBeNull();
  });
});

describe("semanasSemLancamento", () => {
  it("é null quando a obra nunca teve lançamento", () => {
    expect(semanasSemLancamento(null, "2026-08-31")).toBeNull();
  });

  it("é 0 quando o último lançamento é o desta semana", () => {
    expect(semanasSemLancamento("2026-08-31", "2026-09-02")).toBe(0);
  });

  it("conta as semanas desde o último lançamento", () => {
    expect(semanasSemLancamento("2026-08-10", "2026-08-31")).toBe(3);
  });
});

describe("previsaoTermino", () => {
  it("projeta pelo ritmo das últimas semanas com lançamento", () => {
    const avancos = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 35 },
      { semana: "2026-08-17", percentual: 30 },
      { semana: "2026-08-10", percentual: 25 },
    ];
    // 15 pontos em 3 semanas = 5 pontos/semana. Faltam 60 → 12 semanas.
    expect(previsaoTermino(avancos, "2026-08-31")).toBe("2026-11-23");
  });

  it("devolve null com ritmo zero — obra parada não projeta", () => {
    const parada = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 40 },
    ];
    expect(previsaoTermino(parada, "2026-08-31")).toBeNull();
  });

  it("devolve null com ritmo negativo — correção para baixo não é projeção", () => {
    const corrigida = [
      { semana: "2026-08-31", percentual: 30 },
      { semana: "2026-08-24", percentual: 40 },
    ];
    expect(previsaoTermino(corrigida, "2026-08-31")).toBeNull();
  });

  it("devolve null com menos de dois pontos", () => {
    expect(previsaoTermino([{ semana: "2026-08-31", percentual: 40 }], "2026-08-31")).toBeNull();
    expect(previsaoTermino([], "2026-08-31")).toBeNull();
  });

  it("ignora semanas antigas além das quatro mais recentes", () => {
    const avancos = [
      { semana: "2026-08-31", percentual: 40 },
      { semana: "2026-08-24", percentual: 35 },
      { semana: "2026-08-17", percentual: 30 },
      { semana: "2026-08-10", percentual: 25 },
      // Esta é ruído antigo: se entrasse na conta, o ritmo mudaria.
      { semana: "2026-01-05", percentual: 0 },
    ];
    expect(previsaoTermino(avancos, "2026-08-31")).toBe("2026-11-23");
  });

  it("obra em 100% termina na própria semana do último lançamento", () => {
    const pronta = [
      { semana: "2026-08-31", percentual: 100 },
      { semana: "2026-08-24", percentual: 90 },
    ];
    expect(previsaoTermino(pronta, "2026-08-31")).toBe("2026-08-31");
  });
});

describe("avancoSchema", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";

  it("aceita o id em branco que o input oculto manda", () => {
    const r = avancoSchema.safeParse({
      id: "",
      obra_id: UUID,
      semana: "2026-08-31",
      percentual: "34",
      observacoes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.id).toBeNull();
      expect(r.data.percentual).toBe(34);
      expect(r.data.observacoes).toBeNull();
    }
  });

  it("recusa percentual fora de 0 a 100", () => {
    const base = { obra_id: UUID, semana: "2026-08-31", observacoes: "" };
    expect(avancoSchema.safeParse({ ...base, percentual: "-1" }).success).toBe(false);
    expect(avancoSchema.safeParse({ ...base, percentual: "101" }).success).toBe(false);
  });

  it("recusa semana que não é data ISO", () => {
    const r = avancoSchema.safeParse({
      obra_id: UUID,
      semana: "31/08/2026",
      percentual: "34",
      observacoes: "",
    });
    expect(r.success).toBe(false);
  });
});
```

- [x] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/avanco.test.ts`
Expected: FAIL — `Failed to resolve import "./avanco"`.

- [x] **Step 3: Implementar `src/lib/avanco.ts`**

```ts
// Avanço físico da obra e prazo decorrido — TUDO puro, sem I/O.
//
// Este módulo existe para que o cálculo que a diretoria vai ler seja testável
// sem banco. A regra de negócio inteira mora aqui; `data/avanco.ts` só busca
// linhas e as telas só formatam.

import { z } from "zod";
import { ehDataISO } from "@/lib/locacao";
import { idOpcional, textoOpcional } from "@/lib/campos";

export type PeriodoObra = {
  data_inicio: string | null;
  data_fim_prevista: string | null;
};

export type PontoAvanco = { semana: string; percentual: number };

/**
 * Aritmética de data em UTC, de propósito.
 *
 * Os valores aqui são 'yyyy-mm-dd' vindos de coluna `date` — dia de calendário,
 * não instante. Fazer a conta em horário local faria o horário de verão comer
 * ou inventar um dia. `Date.UTC` não tem horário de verão.
 */
function paraUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function deUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DIA_MS = 86_400_000;

/** Dias de calendário de `a` até `b`. Negativo se `b` for antes de `a`. */
export function diasEntre(aISO: string, bISO: string): number {
  return Math.round((paraUTC(bISO).getTime() - paraUTC(aISO).getTime()) / DIA_MS);
}

function somarDias(iso: string, dias: number): string {
  return deUTC(new Date(paraUTC(iso).getTime() + dias * DIA_MS));
}

/**
 * A segunda-feira da semana daquela data.
 *
 * Canonizar aqui é o que dá sentido ao `unique (obra_id, semana)`: lançar
 * qualquer dia da semana grava na mesma linha, então relançar é upsert e
 * corrigir um número errado é natural.
 */
export function segundaDaSemana(iso: string): string {
  const d = paraUTC(iso);
  const diaSemana = d.getUTCDay(); // 0 = domingo
  // Domingo é o fim da semana que começou na segunda anterior, não o começo de
  // uma nova. Sem este ajuste, todo domingo cairia na semana seguinte.
  const recuo = diaSemana === 0 ? 6 : diaSemana - 1;
  return somarDias(iso, -recuo);
}

function travar(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/**
 * Percentual do prazo já decorrido, de 0 a 100.
 *
 * `null` quando falta qualquer uma das datas: obra sem período cadastrado não
 * tem curva de prazo, e inventar uma seria pior que não mostrar nada.
 */
export function percentualPrazo(obra: PeriodoObra, hojeISO: string): number | null {
  const { data_inicio: inicio, data_fim_prevista: fim } = obra;
  if (!inicio || !fim) return null;

  const total = diasEntre(inicio, fim);
  // Obra de um dia: não há denominador, mas a resposta é óbvia.
  if (total <= 0) return diasEntre(inicio, hojeISO) >= 0 ? 100 : 0;

  return travar((diasEntre(inicio, hojeISO) / total) * 100);
}

/** Pontos percentuais de atraso. Positivo = prazo correu mais que a obra. */
export function desvio(prazo: number | null, fisico: number | null): number | null {
  if (prazo === null || fisico === null) return null;
  return prazo - fisico;
}

/** Semanas inteiras desde o último lançamento. `null` se nunca houve um. */
export function semanasSemLancamento(
  ultimaSemana: string | null,
  hojeISO: string,
): number | null {
  if (!ultimaSemana) return null;
  const dias = diasEntre(segundaDaSemana(ultimaSemana), segundaDaSemana(hojeISO));
  return Math.max(0, Math.round(dias / 7));
}

/** Quantos pontos de avanço entram no cálculo de ritmo. */
const JANELA_RITMO = 4;

/**
 * Data estimada de término, pelo ritmo das últimas semanas COM lançamento.
 *
 * Devolve `null` — e a tela diz "ritmo insuficiente para projetar" — quando o
 * ritmo é zero ou negativo. Obra parada dividiria por zero, e correção para
 * baixo projetaria uma data no passado. "Término em 2183" destrói a confiança
 * no painel inteiro; não responder é honesto.
 *
 * A janela é de lançamentos, não de semanas de calendário: semana não informada
 * não pode virar ritmo zero, senão a projeção mente para pior exatamente quando
 * o dado está faltando.
 */
export function previsaoTermino(
  avancos: PontoAvanco[],
  hojeISO: string,
): string | null {
  const ordenados = [...avancos]
    .sort((a, b) => (a.semana < b.semana ? 1 : a.semana > b.semana ? -1 : 0))
    .slice(0, JANELA_RITMO);
  if (ordenados.length < 2) return null;

  const recente = ordenados[0];
  const antigo = ordenados[ordenados.length - 1];

  if (recente.percentual >= 100) return recente.semana;

  const semanas = diasEntre(antigo.semana, recente.semana) / 7;
  if (semanas <= 0) return null;

  const ritmo = (recente.percentual - antigo.percentual) / semanas;
  if (ritmo <= 0) return null;

  const semanasRestantes = Math.ceil((100 - recente.percentual) / ritmo);
  return somarDias(hojeISO, semanasRestantes * 7);
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Mora aqui, e não em `avanco/actions.ts`, porque arquivo "use server" não
// atravessa para o cliente e o formulário precisa do schema.

export const avancoSchema = z.object({
  id: idOpcional,
  obra_id: z.string().uuid("Selecione a obra."),
  semana: z.string().refine(ehDataISO, "Semana inválida."),
  percentual: z.coerce
    .number()
    .min(0, "O avanço vai de 0 a 100.")
    .max(100, "O avanço vai de 0 a 100."),
  observacoes: textoOpcional(300),
});

export type AvancoInput = z.input<typeof avancoSchema>;
export type AvancoDados = z.output<typeof avancoSchema>;
```

- [x] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/avanco.test.ts`
Expected: PASS — 20 testes.

- [x] **Step 5: Registrar o módulo na varredura de schemas**

`MODULOS` de `src/lib/schemas-varredura.test.ts` é **lista à mão** — schema novo não entra sozinho.

Em `src/lib/schemas-varredura.test.ts`, acrescentar o import junto dos outros:

```ts
import * as avanco from "./avanco";
```

Acrescentar ao mapa `MODULOS` (ordem alfabética, antes de `config`):

```ts
const MODULOS: Record<string, Record<string, unknown>> = {
  alojamento,
  avanco,
  config,
  // …o resto fica como está
};
```

E a amostra mínima em `AMOSTRAS`:

```ts
  avancoSchema: { obra_id: UUID, semana: "2026-08-31", percentual: "34" },
```

- [x] **Step 6: Rodar a varredura**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: PASS, incluindo `avanco.avancoSchema aceita id em branco (cadastro novo)`.

- [x] **Step 7: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/avanco.ts src/lib/avanco.test.ts src/lib/schemas-varredura.test.ts
git commit -m "feat(avanco): o cálculo puro de prazo, avanço e ritmo"
```

---

### Task 2: A migration ⚠️ PARCIAL — arquivo pronto, não aplicado

**Files:**
- Create: `supabase/migrations/0050_avanco_obra.sql` (confirme o número com `ls supabase/migrations | tail -1`)

**Interfaces:**
- Consumes: `public.set_updated_at()`, `public.current_org_id()`, `public.is_member_of_obra(uuid)`, `public.pode_gerir_cadastros()` — todas já existentes.
  Os papéis reais são `master`/`administrador`/`gestor`/`operador`; `admin` e
  `gestor` como escritos antes na policy NÃO existiam.
- Produces: colunas `obra.data_inicio`, `obra.data_fim_prevista`, `obra.data_fim_real`; tabela `public.avanco_obra`.

- [x] **Step 1: Escrever a migration**

```sql
-- ============================================================================
-- Período da obra e avanço físico semanal
-- (docs/superpowers/specs/2026-08-31-avanco-obra-design.md)
--
-- Primeira fatia do controle orçamentário pedido pela diretoria. Entrega dois
-- dos três percentuais — prazo decorrido e avanço físico — sem tocar em
-- dinheiro. O terceiro (orçamento consumido) vem nas fatias B, C e D.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Período da obra
-- ---------------------------------------------------------------------------
-- Nulo é legítimo: nenhuma obra cadastrada tem período hoje, e obra sem
-- `data_fim_prevista` simplesmente não tem "% de prazo decorrido". Tornar
-- obrigatório quebraria todas as obras existentes.
alter table public.obra
  add column if not exists data_inicio       date,
  add column if not exists data_fim_prevista date,
  add column if not exists data_fim_real     date;

alter table public.obra
  drop constraint if exists obra_periodo_coerente;
alter table public.obra
  add constraint obra_periodo_coerente check (
    data_inicio is null or data_fim_prevista is null
    or data_fim_prevista >= data_inicio
  );

comment on column public.obra.data_fim_real is
  'Preenchida no encerramento. Enquanto nula, a obra corre contra data_fim_prevista.';

-- ---------------------------------------------------------------------------
-- Avanço físico
-- ---------------------------------------------------------------------------
create table if not exists public.avanco_obra (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  obra_id       uuid not null references public.obra (id) on delete cascade,
  -- SEMPRE a segunda-feira da semana, canonizada por `segundaDaSemana()` em
  -- src/lib/avanco.ts. É o que faz o unique abaixo significar "um lançamento
  -- por semana", e é o que torna relançar um upsert em vez de duplicata.
  semana        date not null,
  -- Acumulado, de 0 a 100 ("estamos em 34% da obra"). Acumulado e não
  -- incremental porque se autocorrige: semana esquecida não corrompe o total.
  percentual    numeric(5,2) not null check (percentual between 0 and 100),
  observacoes   text,
  -- Quem DIGITOU, que é o administrativo — não é o responsável pela obra.
  -- A distinção importa no dia em que o número for contestado.
  informado_por uuid references public.perfil (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (obra_id, semana)
);

create index if not exists idx_avanco_obra on public.avanco_obra (obra_id, semana desc);
create index if not exists idx_avanco_org  on public.avanco_obra (org_id);

drop trigger if exists trg_avanco_obra_updated_at on public.avanco_obra;
create trigger trg_avanco_obra_updated_at
  before update on public.avanco_obra
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, como o resto do Loca
-- ---------------------------------------------------------------------------
-- Diferente da exceção que a fatia de frota abre para `equipamento_unidade`:
-- lá existe a justificativa de "preciso ver onde está a betoneira da outra
-- obra". Aqui não existe — avanço de obra alheia não serve a ninguém.
alter table public.avanco_obra enable row level security;

create policy "avanco_select" on public.avanco_obra
  for select to authenticated
  using (org_id = public.current_org_id() and public.has_obra_access(obra_id));

create policy "avanco_write" on public.avanco_obra
  for all to authenticated
  using (
    org_id = public.current_org_id()
    and public.has_obra_access(obra_id)
    and public.current_papel() in ('master', 'admin', 'gestor')
  )
  with check (
    org_id = public.current_org_id()
    and public.has_obra_access(obra_id)
    and public.current_papel() in ('master', 'admin', 'gestor')
  );
```

- [x] **Step 2: Conferir os papéis contra o que existe** — PEGOU DOIS ERROS DO PLANO

O `check` de papel acima precisa bater com os valores reais do enum. Rode e compare:

```bash
grep -rn "current_papel() in" supabase/migrations/0011_fase7_rbac_4_perfis.sql | head -5
```

Se os nomes forem outros, corrija a policy para os nomes reais **antes** de aplicar. Papel errado numa policy não dá erro: só nega tudo em silêncio.

- [ ] **Step 3: Aplicar** — ⛔ BLOQUEADO, aguardando autorização do usuário para tocar o banco de produção

```bash
supabase db push --dry-run < /dev/null   # deve listar SÓ a 0050
supabase db push < /dev/null
```

- [~] **Step 4: Provar a RLS no Postgres local** — feita a validação ESTRUTURAL num banco descartável (a migration executa; constraints, unique/upsert e policies conferidos). A prova COMPORTAMENTAL da RLS com dois usuários exige o scaffold completo do Supabase local e fica pendente

Confirme, com dois usuários de organizações diferentes, que `select * from avanco_obra` de uma organização não devolve linha da outra, e que um usuário sem linha em `obra_usuario` não lê o avanço daquela obra. Sem esta prova, a policy é só uma intenção.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/0050_avanco_obra.sql
git commit -m "feat(avanco): migration do período da obra e do avanço semanal"
```

---

### Task 3: As três datas no cadastro da obra

**Files:**
- Modify: `src/lib/obra.ts`
- Modify: `src/app/(app)/obras/obra-form.tsx`
- Create: `src/lib/obra.test.ts`

**Interfaces:**
- Consumes: `dataOpcional` de `@/lib/campos`.
- Produces: `obraSchema` com `data_inicio`, `data_fim_prevista`, `data_fim_real` (todos `string | null` na saída).

`src/app/(app)/obras/actions.ts` **não muda**: ele faz `const { id, ...dados } = parsed.data` e passa `dados` inteiro para o insert/update, então as colunas novas fluem sozinhas.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/obra.test.ts` — o módulo ainda não tinha teste próprio, e pendurar teste de obra dentro de `avanco.test.ts` esconderia isso:

```ts
import { describe, it, expect } from "vitest";
import { obraSchema } from "./obra";

describe("obraSchema — período", () => {
  const base = {
    codigo: "OB-01",
    nome: "Obra",
    status: "ativa" as const,
    destinatarios_alerta: [],
  };

  it("aceita obra sem período — é o estado de toda obra já cadastrada", () => {
    const r = obraSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.data_inicio).toBeNull();
  });

  it("recusa fim previsto anterior ao início", () => {
    const r = obraSchema.safeParse({
      ...base,
      data_inicio: "2026-06-01",
      data_fim_prevista: "2026-05-01",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["data_fim_prevista"]);
    }
  });

  it("aceita fim igual ao início — obra de um dia", () => {
    const r = obraSchema.safeParse({
      ...base,
      data_inicio: "2026-06-01",
      data_fim_prevista: "2026-06-01",
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lib/obra.test.ts`
Expected: FAIL — `data_inicio` não existe no tipo de saída.

- [ ] **Step 3: Acrescentar as datas ao schema**

Em `src/lib/obra.ts`, trocar o import de campos para incluir `dataOpcional`:

```ts
import { idOpcional, dataOpcional, textoOpcional as textoOpcionalCampo } from "@/lib/campos";
```

E o schema passa a ser:

```ts
export const obraSchema = z
  .object({
    // `id` presente = edição; em branco = criação (o <input hidden> do form
    // manda `""`, e é por isso que o campo é `idOpcional`).
    id: idOpcional,
    codigo: z.string().trim().min(1, "Informe o código da obra.").max(50),
    nome: z.string().trim().min(1, "Informe o nome da obra.").max(200),
    endereco: textoOpcional(300),
    responsavel: textoOpcional(200),
    centro_custo: textoOpcional(100),
    status: z.enum(STATUS_OBRA),
    destinatarios_alerta: emailsOpcionais,
    // O período é o denominador do "% de prazo decorrido". Opcional porque
    // nenhuma obra cadastrada tem estas datas, e exigir quebraria todas.
    data_inicio: dataOpcional,
    data_fim_prevista: dataOpcional,
    data_fim_real: dataOpcional,
  })
  .superRefine((d, ctx) => {
    if (d.data_inicio && d.data_fim_prevista && d.data_fim_prevista < d.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim_prevista"],
        message: "O fim previsto não pode ser anterior ao início.",
      });
    }
  });
```

Comparar `'yyyy-mm-dd'` como string funciona e é de propósito: o formato é ordenável lexicograficamente, então não há conversão de data — nem fuso — no caminho.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/obra.test.ts`
Expected: PASS

- [ ] **Step 5: Os campos no formulário**

Em `src/app/(app)/obras/obra-form.tsx`, acrescentar aos `defaultValues`:

```ts
      data_inicio: obra?.data_inicio ?? "",
      data_fim_prevista: obra?.data_fim_prevista ?? "",
      data_fim_real: obra?.data_fim_real ?? "",
```

E o bloco de campos, depois do campo de status:

```tsx
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio">Início da obra</Label>
          <Input id="data_inicio" type="date" disabled={pendente} {...register("data_inicio")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_fim_prevista">Fim previsto</Label>
          <Input
            id="data_fim_prevista"
            type="date"
            aria-invalid={!!errors.data_fim_prevista}
            disabled={pendente}
            {...register("data_fim_prevista")}
          />
          {errors.data_fim_prevista ? (
            <p className="text-xs text-destructive">{errors.data_fim_prevista.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_fim_real">
            Fim real <span className="font-normal text-muted-foreground">(no encerramento)</span>
          </Label>
          <Input id="data_fim_real" type="date" disabled={pendente} {...register("data_fim_real")} />
        </div>
      </div>
```

Também atualizar o `type Obra` do componente para incluir os três campos como `string | null`.

- [ ] **Step 6: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/obra.ts src/lib/obra.test.ts "src/app/(app)/obras/obra-form.tsx"
git commit -m "feat(obras): período da obra no cadastro"
```

---

### Task 4: Leitura e a tela `/avanco` em lote

O centro da entrega. É esta tela que faz o dado existir.

**Files:**
- Create: `src/lib/data/avanco.ts`
- Create: `src/app/(app)/avanco/page.tsx`
- Create: `src/app/(app)/avanco/actions.ts`
- Create: `src/app/(app)/avanco/_components/lancamento-semanal.tsx`
- Modify: `src/lib/modulos.ts`
- Modify: `src/lib/nav.ts`

**Interfaces:**
- Consumes: `segundaDaSemana`, `avancoSchema`, `percentualPrazo`, `desvio` de `@/lib/avanco`; `hojeISOSaoPaulo` de `@/lib/locacao`; `aoInvalidar` de `@/lib/validacao-form`.
- Produces:
  - `listarObrasComAvanco(semanaISO: string): Promise<ObraAvanco[]>` em `src/lib/data/avanco.ts`
  - `type ObraAvanco = { id: string; codigo: string; nome: string; data_inicio: string | null; data_fim_prevista: string | null; semanaAtual: number | null; semanaAnterior: number | null }`
  - `salvarAvancos(raw: unknown): Promise<ActionResult>` em `src/app/(app)/avanco/actions.ts`

- [ ] **Step 1: A camada de leitura**

Criar `src/lib/data/avanco.ts`:

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { segundaDaSemana } from "@/lib/avanco";

export type ObraAvanco = {
  id: string;
  codigo: string;
  nome: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  /** Percentual já lançado nesta semana, ou null se ainda não lançaram. */
  semanaAtual: number | null;
  /** O da semana anterior, mostrado como referência de quem digita. */
  semanaAnterior: number | null;
};

/**
 * Obras ativas com o avanço desta semana e o da anterior.
 *
 * Erro em leitura de lista devolve vazio e registra — a tela mostra o estado
 * vazio em vez de quebrar. (Regra diferente da de agregado que gera documento,
 * que precisa lançar.)
 */
export async function listarObrasComAvanco(semanaISO: string): Promise<ObraAvanco[]> {
  const semana = segundaDaSemana(semanaISO);
  const anterior = segundaDaSemana(
    new Date(new Date(`${semana}T00:00:00Z`).getTime() - 7 * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );

  const supabase = await createClient();

  const { data: obras, error } = await supabase
    .from("obra")
    .select("id, codigo, nome, data_inicio, data_fim_prevista")
    .eq("status", "ativa")
    .is("deleted_at", null)
    .order("codigo");

  if (error || !obras) {
    console.error("listarObrasComAvanco", error);
    return [];
  }

  const { data: avancos } = await supabase
    .from("avanco_obra")
    .select("obra_id, semana, percentual")
    .in("semana", [semana, anterior]);

  const porObra = new Map<string, { atual: number | null; anterior: number | null }>();
  for (const a of avancos ?? []) {
    const atualObra = porObra.get(a.obra_id) ?? { atual: null, anterior: null };
    if (a.semana === semana) atualObra.atual = Number(a.percentual);
    if (a.semana === anterior) atualObra.anterior = Number(a.percentual);
    porObra.set(a.obra_id, atualObra);
  }

  return obras.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    nome: o.nome,
    data_inicio: o.data_inicio,
    data_fim_prevista: o.data_fim_prevista,
    semanaAtual: porObra.get(o.id)?.atual ?? null,
    semanaAnterior: porObra.get(o.id)?.anterior ?? null,
  }));
}
```

- [ ] **Step 2: A action de gravação em lote**

Criar `src/app/(app)/avanco/actions.ts`:

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { avancoSchema } from "@/lib/avanco";

// Só as linhas que o usuário realmente preencheu chegam aqui; a tela filtra as
// vazias antes de enviar.
const loteSchema = z.object({
  linhas: z.array(avancoSchema).min(1, "Informe ao menos um avanço."),
});

export async function salvarAvancos(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para lançar o avanço das obras.");
  }

  const parsed = loteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();

  // `onConflict` no par (obra_id, semana) é o que torna relançar uma CORREÇÃO
  // em vez de uma duplicata — e é por isso que a semana é canonizada na
  // segunda-feira antes de chegar aqui.
  const { error } = await supabase.from("avanco_obra").upsert(
    parsed.data.linhas.map((l) => ({
      org_id: perfil.org_id,
      obra_id: l.obra_id,
      semana: l.semana,
      percentual: l.percentual,
      observacoes: l.observacoes,
      informado_por: perfil.id,
    })),
    { onConflict: "obra_id,semana" },
  );

  if (error) {
    console.error("salvarAvancos", error);
    return falha("Não foi possível salvar. Tente novamente.");
  }

  revalidatePath("/avanco");
  revalidatePath("/obras");
  return { ok: true };
}
```

Confirme o nome do campo do id do perfil (`perfil.id`) contra `src/lib/auth.ts` antes de rodar; se for outro, use o real.

- [ ] **Step 3: A tela em lote**

Criar `src/app/(app)/avanco/_components/lancamento-semanal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ObraAvanco } from "@/lib/data/avanco";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarAvancos } from "../actions";

type Linha = { percentual: string; observacoes: string };
type Form = { linhas: Linha[] };

export function LancamentoSemanal({
  obras,
  semana,
}: {
  obras: ObraAvanco[];
  semana: string;
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const { register, handleSubmit } = useForm<Form>({
    defaultValues: {
      linhas: obras.map((o) => ({
        percentual: o.semanaAtual === null ? "" : String(o.semanaAtual),
        observacoes: "",
      })),
    },
  });

  function onSubmit(valores: Form) {
    setErroServidor(null);

    // Linha em branco é DESCARTADA, não vira lançamento zero. Sem isso, abrir a
    // tela e salvar registraria "0% de avanço" em toda obra não preenchida —
    // e, como o avanço é acumulado, isso apagaria o progresso real da obra.
    const linhas = valores.linhas
      .map((l, i) => ({ ...l, obra: obras[i] }))
      .filter((l) => l.percentual.trim() !== "")
      .map((l) => ({
        obra_id: l.obra.id,
        semana,
        percentual: l.percentual,
        observacoes: l.observacoes,
      }));

    if (linhas.length === 0) {
      setErroServidor("Informe o avanço de ao menos uma obra.");
      return;
    }

    startTransition(async () => {
      const r = await salvarAvancos({ linhas });
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(
        linhas.length === 1 ? "Avanço lançado." : `${linhas.length} avanços lançados.`,
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-4"
    >
      <div className="divide-y rounded-md border">
        {obras.map((o, i) => (
          <div key={o.id} className="grid items-center gap-3 p-3 sm:grid-cols-[1fr_7rem_7rem_1fr]">
            <div>
              <p className="text-sm font-medium">
                {o.codigo} · {o.nome}
              </p>
              {o.semanaAtual === null ? (
                <p className="text-xs text-destructive">Sem lançamento nesta semana</p>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              Anterior: {o.semanaAnterior === null ? "—" : `${o.semanaAnterior}%`}
            </p>

            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="%"
              aria-label={`Avanço de ${o.codigo}`}
              disabled={pendente}
              {...register(`linhas.${i}.percentual`)}
            />

            <Input
              placeholder="Observação (opcional)"
              aria-label={`Observação de ${o.codigo}`}
              disabled={pendente}
              {...register(`linhas.${i}.observacoes`)}
            />
          </div>
        ))}
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar avanços"}
        </Button>
      </div>
    </form>
  );
}
```

Requisitos que o código acima já satisfaz, e que a revisão deve conferir:

- uma linha por obra, com código, nome, `%` da semana anterior em texto e um `<Input type="number" min={0} max={100} step="0.01">` para o `%` desta semana;
- linha sem valor preenchido é **descartada** antes de enviar — não vira lançamento zero;
- obra sem lançamento nesta semana recebe destaque visual (`text-destructive` no rótulo da linha ou badge "sem lançamento");
- um único botão "Salvar avanços" no fim;
- `toast.success("Avanços lançados.")` e `router.refresh()` no sucesso.

E `src/app/(app)/avanco/page.tsx` como Server Component: chama `hojeISOSaoPaulo()`, passa `segundaDaSemana(hoje)` para `listarObrasComAvanco`, e renderiza o componente com `PageHeader` no padrão das outras telas. `EmptyState` quando não há obra ativa.

- [ ] **Step 4: Registrar o módulo e a navegação**

Em `src/lib/modulos.ts`, acrescentar `"avanco"` ao tipo `ModuloKey` e ao array `MODULOS`:

```ts
  { chave: "avanco", label: "Avanço", href: "/avanco" },
```

Em `src/lib/nav.ts`, acrescentar `"trending-up"` ao tipo `NavIconName` e o item, depois de Obras:

```ts
  { label: "Avanço", href: "/avanco", icon: "trending-up", modulo: "avanco" },
```

E mapear o ícone novo em `src/components/layout/nav-icon.tsx`. **Sem isso a rota nasce invisível** para quem não é master, e o sintoma é 404 sem explicação.

- [ ] **Step 5: Conferir na tela**

Rode `npm run dev`, abra `/avanco`, lance duas obras, recarregue e confirme que os valores voltam. Depois relance uma delas com número diferente e confirme que **corrigiu** em vez de duplicar.

- [ ] **Step 6: Auditoria de PT-BR, ritual e commit**

```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/avanco" --include=*.tsx
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/data/avanco.ts "src/app/(app)/avanco" src/lib/modulos.ts src/lib/nav.ts src/components/layout/nav-icon.tsx
git commit -m "feat(avanco): tela de lançamento semanal em lote"
```

---

### Task 5: O bloco de avanço no detalhe da obra

**Files:**
- Create: `src/app/(app)/obras/[id]/_components/bloco-avanco.tsx`
- Modify: `src/app/(app)/obras/[id]/page.tsx`
- Modify: `src/lib/data/avanco.ts`

**Interfaces:**
- Consumes: `percentualPrazo`, `desvio`, `previsaoTermino` de `@/lib/avanco`.
- Produces: `historicoAvanco(obraId: string, limite?: number): Promise<PontoAvanco[]>` em `src/lib/data/avanco.ts`.

- [ ] **Step 1: A leitura do histórico**

Acrescentar em `src/lib/data/avanco.ts`:

```ts
import type { PontoAvanco } from "@/lib/avanco";

/** As últimas semanas lançadas de uma obra, da mais recente para a mais antiga. */
export async function historicoAvanco(
  obraId: string,
  limite = 8,
): Promise<PontoAvanco[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avanco_obra")
    .select("semana, percentual")
    .eq("obra_id", obraId)
    .order("semana", { ascending: false })
    .limit(limite);

  if (error || !data) {
    console.error("historicoAvanco", error);
    return [];
  }
  return data.map((d) => ({ semana: d.semana, percentual: Number(d.percentual) }));
}
```

- [ ] **Step 2: O bloco**

Criar `src/app/(app)/obras/[id]/_components/bloco-avanco.tsx` (Server Component). Recebe a obra e o histórico, e mostra:

- **Avanço físico**: o percentual mais recente, ou `EmptyState` mudo (`<p>`) quando não há lançamento;
- **Prazo decorrido**: `percentualPrazo(obra, hojeISOSaoPaulo())`, ou "período não informado" quando `null`;
- **Desvio**: `desvio(prazo, fisico)` em pontos, com o texto "X pontos de atraso" ou "X pontos adiantada";
- **Previsão de término**: `previsaoTermino(historico, hojeISOSaoPaulo())` formatado por `formatarData`, contra `data_fim_prevista`. Quando `null`, o texto é exatamente **"Ritmo insuficiente para projetar."** — não invente uma data;
- as últimas 8 semanas, com `formatarData(semana)` e o percentual.

- [ ] **Step 3: Ligar na página**

Em `src/app/(app)/obras/[id]/page.tsx`, buscar `historicoAvanco(id)` junto das outras leituras e renderizar o bloco entre os cards existentes, seguindo o espaçamento das seções vizinhas.

- [ ] **Step 4: Conferir na tela**

Abra uma obra com lançamentos e confirme os quatro números. Depois abra uma obra **sem período** e confirme que não aparece "NaN%" nem "Invalid Date" em lugar nenhum.

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add "src/app/(app)/obras/[id]" src/lib/data/avanco.ts
git commit -m "feat(obras): bloco de avanço no detalhe da obra"
```

---

### Task 6: O e-mail semanal e o cron

**Files:**
- Create: `src/lib/emails/avanco.ts`
- Create: `src/app/api/cron/avanco/route.ts`
- Modify: `src/lib/emails/catalogo.ts`
- Modify: `vercel.json`
- Modify: `src/lib/data/avanco.ts`

**Interfaces:**
- Consumes: o layout e o `Documento` de `src/lib/emails/`, o padrão de dedup da 0016, `percentualPrazo`, `desvio`, `previsaoTermino`.
- Produces: `emailAvancoSemanal(dados: ResumoObra[]): { assunto: string; html: string; texto: string }`.

- [ ] **Step 1: Ler os dois precedentes antes de escrever**

```bash
sed -n '1,80p' src/app/api/cron/vencimentos/route.ts
sed -n '1,60p' src/lib/emails/relatorio.ts
```

O e-mail novo **não inventa desenho**: usa o mesmo layout, cabeçalho e rodapé. E o cron copia o padrão de dedup e de autenticação do cron que já existe — inclusive a verificação do segredo de cron.

- [ ] **Step 2: O conteúdo**

Por obra, para os endereços de `obra.destinatarios_alerta`:

```
Obra Ipiranga · semana de 25/08
  Prazo decorrido ....... 55%
  Avanço físico ......... 31%
  Desvio ................ 24 pontos de atraso
  Previsão de término ... 23/11/2026  (previsto: 15/09/2026)
  Itens locados em aberto: 14
```

E, num bloco separado ao fim, a **cobrança**: obras ativas sem lançamento nesta semana, nominalmente, cada uma com há quantas semanas está sem número — é aqui que `semanasSemLancamento(ultimaSemana, hojeISO)` da Task 1 é consumida:

```
Sem lançamento nesta semana:
  OB-03 Residencial Aurora — 3 semanas sem informação
  OB-07 Galpão Norte — 1 semana sem informação
```

O e-mail que cobra é o que mantém o cadastro vivo. Obra que nunca teve lançamento aparece como "nunca informada" — a função devolve `null`.

Versão em texto simples junto do HTML — é o padrão da 0.38.0 e reduz spam.

- [ ] **Step 3: Registrar no catálogo**

Acrescentar a entrada em `src/lib/emails/catalogo.ts` com `id: "avanco-obra"` e `titulo: "Avanço semanal da obra"`, seguindo exatamente a forma das outras entradas, e conferir que a galeria (`galeria.test.ts`) continua passando.

- [ ] **Step 4: O cron**

`src/app/api/cron/avanco/route.ts` usa `createAdminClient()` — é o único lugar onde isso é permitido, porque roda sem sessão de usuário e não há RLS a respeitar. Deve respeitar o **modo de teste de e-mail** da 0.38.0: se estiver ligado, nenhum destinatário real recebe.

Em `vercel.json`, acrescentar o agendamento de segunda-feira de manhã:

```json
    {
      "path": "/api/cron/avanco",
      "schedule": "20 8 * * 1"
    }
```

08:20 na segunda, depois dos dois crons existentes (08:00 e 08:10), para não competir por execução.

- [ ] **Step 5: Provar sem mandar e-mail de verdade**

Ligue o modo de teste, chame a rota do cron localmente e confirme no log que o conteúdo saiu com os percentuais certos e que nenhum endereço real foi usado.

- [ ] **Step 6: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/emails/avanco.ts src/lib/emails/catalogo.ts src/app/api/cron/avanco vercel.json src/lib/data/avanco.ts
git commit -m "feat(avanco): e-mail semanal de prazo contra avanço"
```

---

### Task 7: Fechamento — versão e publicação

**Files:**
- Modify: `src/lib/changelog.ts`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Bumpar os três pontos**

É funcionalidade nova sem quebra de compatibilidade: **MINOR**. Da 0.40.0 para a **0.41.0**.

Em `src/lib/changelog.ts`, `APP_VERSION = "0.41.0"` e um `Release` no topo, com texto voltado ao usuário e sem jargão:

```ts
  {
    versao: "0.41.0",
    data: "<data da execução, yyyy-mm-dd>",
    titulo: "Avanço da obra, semana a semana",
    mudancas: [
      { tipo: "novo", texto: "A obra passa a ter início e fim previsto, e o sistema calcula sozinho quanto do prazo já correu." },
      { tipo: "novo", texto: "Tela de Avanço: uma linha por obra, todas na mesma página, para lançar o percentual da semana de uma vez só. Relançar corrige o número, não duplica." },
      { tipo: "novo", texto: "O detalhe da obra mostra avanço, prazo, quantos pontos ela está atrasada e uma previsão de término pelo ritmo das últimas semanas." },
      { tipo: "novo", texto: "E-mail semanal para os responsáveis da obra, com prazo contra avanço — e a lista de obras que ficaram sem lançamento na semana." },
    ],
  },
```

Replicar o resumo em `CHANGELOG.md` (Keep a Changelog) e igualar `package.json`.

- [ ] **Step 2: Ritual completo**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

- [ ] **Step 3: Revisar o diff inteiro**

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

- [ ] **Step 4: Commit, merge e publicação**

```bash
git add -A
git commit -m "chore(release): 0.41.0 — avanço da obra"
git checkout main
git merge --no-ff feat/avanco-obra
npm run typecheck && npm run lint && npm test && npm run build
git push origin main
```

O ritual roda **de novo depois do merge**: resolução de conflito à mão é exatamente onde entra quebra silenciosa, e foi o que pegou o campo `controle` faltando no fixture quando as duas correções se encontraram na 0.40.0.

- [ ] **Step 5: Conferir a publicação**

A Vercel publica sozinha no push. Confirme que a versão em `/novidades` é a 0.41.0 — se for uma anterior, o deploy republicou commit velho (ver o histórico de incidente com o botão de variável de ambiente).
