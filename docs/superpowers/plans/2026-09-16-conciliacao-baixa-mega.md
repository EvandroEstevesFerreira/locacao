# Conciliação da baixa com o Mega — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dado um título já quitado no Mega, o Loca propõe em qual lançamento financeiro dar baixa, e alguém do financeiro confirma ou recusa com um clique.

**Architecture:** o cron diário, depois de espelhar `mega_titulo`, calcula casamentos **parcela ↔ lançamento** (1↔1 por competência) e faz upsert de sugestões em `mega_conciliacao`. Uma tela em `/financeiro/conciliacao` lê a fila sob RLS. Confirmar chama uma server action que **reaproveita o `darBaixa` que já existe** e marca a sugestão como confirmada. O cron nunca escreve em `lancamento_financeiro`.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, zod, vitest, Base UI/shadcn "base-nova".

**Spec:** `docs/superpowers/specs/2026-09-16-conciliacao-baixa-mega-design.md` — leia antes da Task 1. O plano argumenta a partir dela.

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário.** Auditoria antes de fechar: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **"Hoje" é sempre `hojeISOSaoPaulo()`** de `src/lib/locacao.ts`, nunca `new Date()`, para qualquer data comparada com coluna `date`.
- **`createAdminClient()` só no cron.** Leitura em `src/lib/data/` e actions usam `createClient()`.
- **Toda view nasce com `security_invoker = on`.** (Não há view neste plano; se acrescentar uma, a regra vale.)
- **Exclusão sempre por `supabase.rpc("soft_delete", ...)`**, tratando `data !== true` como erro. (Não há exclusão neste plano.)
- **Retorno de action é `ActionResult`** de `src/lib/acoes.ts`. Uma action ou redireciona, ou devolve `ActionResult` — nunca as duas.
- **Schemas zod moram em `src/lib/<dominio>.ts`**, não dentro de `actions.ts`.
- **Papel que pode mexer em dinheiro:** `master` e `administrador` (`podeGerenciarFinanceiro` em `src/lib/permissoes.ts`). O enum é `papel_usuario`; **não** existem os papéis `admin`/`financeiro` que a migration 0008 citava.
- **Ritual de fechamento:** `npm run typecheck && npm run lint && npm test && npm run build`.
- **Versionamento nos três pontos** (`src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`) — Task 7.
- Ao comparar moeda formatada em teste, o Intl separa "R$" do número com espaço **não separável** (U+00A0).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `supabase/migrations/0111_conciliacao_da_baixa.sql` | tabela `mega_conciliacao`, índices, RLS |
| `src/lib/mega/conciliacao.ts` | **puro.** Dado títulos + lançamentos, devolve as sugestões. Sem Supabase. |
| `src/lib/mega/conciliacao.test.ts` | testes do cálculo |
| `src/lib/mega/conciliacao-servidor.ts` | busca os dados, chama o puro, faz upsert. `import "server-only"`. |
| `src/lib/mega/espelho-nao-da-baixa.test.ts` | **modificar:** a varredura passa a cobrar só o cron |
| `src/app/api/cron/mega/route.ts` | **modificar:** chama `conciliarOrg` após o espelho |
| `src/lib/data/conciliacao.ts` | leitura da fila para a tela. `import "server-only"`. |
| `src/lib/conciliacao.ts` | schemas zod (`confirmarSchema`, `recusarSchema`) |
| `src/app/(app)/financeiro/conciliacao/page.tsx` | a tela da fila |
| `src/app/(app)/financeiro/conciliacao/actions.ts` | `confirmarSugestao`, `recusarSugestao`, `desfazerRecusa` |
| `src/app/(app)/financeiro/conciliacao/_components/linha-sugestao.tsx` | uma linha da fila, com os botões |

O cálculo é separado do acesso ao banco pelo mesmo motivo de `espelho.ts`: a regra de casamento é inventada por nós, e regra inventada por nós precisa de teste em memória.

---

### Task 1: a tabela `mega_conciliacao`

**Files:**
- Create: `supabase/migrations/0111_conciliacao_da_baixa.sql`
- Test: `src/lib/migrations-seguranca.test.ts` (já existe; só tem de continuar passando)

**Interfaces:**
- Consumes: nada.
- Produces: a tabela `public.mega_conciliacao` com as colunas `id, org_id, mega_titulo_id, lancamento_id, confianca, motivo, status, decidido_por, decidido_em, created_at, updated_at`. Os enums `public.confianca_conciliacao` (`alta | media | baixa`) e `public.status_conciliacao` (`sugerida | confirmada | recusada`).

- [ ] **Step 1: escrever a migration**

```sql
-- ============================================================================
-- v0.113.0 — A fila de conciliação da baixa
-- ============================================================================
--
-- O Mega diz o que foi pago; o Loca diz o que foi contratado. Esta tabela é o
-- lugar onde as duas afirmações se encontram — e onde um humano decide se elas
-- falam do mesmo dinheiro.
--
-- ELA NÃO DÁ BAIXA. Quem escreve em `lancamento_financeiro` é a server action
-- de confirmação, com sessão de usuário. O cron só propõe.
--
-- POR QUE UMA TABELA, E NÃO CÁLCULO NA HORA: para guardar o "não". Fila só
-- funciona se esvaziar. Sem onde registrar a recusa, o título que o financeiro
-- examinou e descartou reaparece amanhã, e depois de amanhã — até ninguém mais
-- abrir a tela. A tabela existe para a recusa; o resto é consequência.

create type public.confianca_conciliacao as enum ('alta', 'media', 'baixa');
create type public.status_conciliacao as enum ('sugerida', 'confirmada', 'recusada');

create table public.mega_conciliacao (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,

  -- `cascade`: sugestão sobre um título que sumiu do espelho não tem sentido.
  mega_titulo_id uuid not null references public.mega_titulo (id) on delete cascade,

  -- NULO É UM ESTADO LEGÍTIMO: "o Mega pagou isto e o Loca não tem lançamento
  -- correspondente". É informação, não ausência de dado — e é justamente o caso
  -- que faz alguém cadastrar o que faltava.
  lancamento_id  uuid references public.lancamento_financeiro (id) on delete cascade,

  confianca      public.confianca_conciliacao not null,

  -- TEXTO PARA HUMANO, não código. Quem confirma precisa saber por que o
  -- sistema propôs aquilo: "documento 42824001 bate com a NF do lançamento;
  -- valor idêntico". Um enum de motivo obrigaria a tela a traduzir, e a
  -- tradução envelhece longe da regra.
  motivo         text not null,

  status         public.status_conciliacao not null default 'sugerida',
  decidido_por   uuid references public.perfil (id) on delete set null,
  decidido_em    timestamptz,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- UM TÍTULO, UMA DECISÃO VIVA. Sem isto o cron acrescentaria uma sugestão nova
-- a cada rodada e a fila cresceria sozinha, com a mesma proposta repetida.
-- É este índice que o `onConflict` do upsert do cron nomeia.
create unique index uq_mega_conciliacao_titulo
  on public.mega_conciliacao (org_id, mega_titulo_id);

-- UM LANÇAMENTO NÃO RECEBE DUAS BAIXAS. Parcial: só vale entre as confirmadas,
-- porque duas sugestões podem legitimamente disputar o mesmo lançamento — quem
-- desempata é o humano, e depois disso a disputa acabou.
create unique index uq_mega_conciliacao_lancamento_confirmado
  on public.mega_conciliacao (org_id, lancamento_id)
  where status = 'confirmada' and lancamento_id is not null;

create index idx_mega_conciliacao_org_status
  on public.mega_conciliacao (org_id, status);

create trigger trg_mega_conciliacao_updated_at
  before update on public.mega_conciliacao
  for each row execute function public.set_updated_at();

alter table public.mega_conciliacao enable row level security;

-- LEITURA para quem vê dinheiro.
create policy "mega_conciliacao_select" on public.mega_conciliacao
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

-- ESCRITA DO USUÁRIO É SÓ UPDATE, e é de propósito: quem CRIA sugestão é o
-- cron, com service role. Sem policy de INSERT, ninguém inventa uma sugestão
-- pela API para depois "confirmá-la" e forjar uma baixa.
create policy "mega_conciliacao_update" on public.mega_conciliacao
  for update to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  )
  with check (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

comment on table public.mega_conciliacao is
  'Fila de conciliação: o casamento proposto entre um título quitado do Mega e '
  'um lançamento do Loca. O cron propõe; o usuário confirma ou recusa. A baixa '
  'em si é escrita pela server action, nunca por aqui.';
```

- [ ] **Step 2: rodar a guarda de segurança das migrations**

Run: `npx vitest run src/lib/migrations-seguranca.test.ts`
Expected: PASS. Essa varredura cobra `security_invoker = on` em toda view; esta migration não cria view, então ela passa sem mudança. Se falhar, leia a mensagem — ela nomeia a linha.

- [ ] **Step 3: rodar a suíte inteira**

Run: `npm test`
Expected: PASS, 1418 testes (o número cresce nas tasks seguintes).

- [ ] **Step 4: commit**

```bash
git add supabase/migrations/0111_conciliacao_da_baixa.sql
git commit -m "feat(mega): a tabela da fila de conciliacao"
```

---

### Task 2: o cálculo do casamento (puro)

**Files:**
- Create: `src/lib/mega/conciliacao.ts`
- Test: `src/lib/mega/conciliacao.test.ts`

**Interfaces:**
- Consumes: `dataDePagamento` e `vencimentoEfetivo` de `./vencimento`.
- Produces:

```ts
export type TituloQuitado = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  data_vencimento: string;
  data_prorrogado: string | null;
  valor_parcela: number;
  saldo_atual: number;
};

export type LancamentoAberto = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  competencia: string;   // "YYYY-MM-DD", sempre dia 1
  valor: number;
  nf_numero: string | null;
  status: "pendente" | "pago";
};

export type Sugestao = {
  mega_titulo_id: string;
  lancamento_id: string | null;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
};

export function competenciaDoTitulo(t: Pick<TituloQuitado, "data_vencimento" | "data_prorrogado">): string;
export function documentoConfiavel(tipo: string, numero: string): boolean;
export function sugerirConciliacao(args: {
  titulos: TituloQuitado[];
  lancamentos: LancamentoAberto[];
}): Sugestao[];
```

- [ ] **Step 1: escrever os testes que devem falhar**

```ts
import { describe, it, expect } from "vitest";
import {
  competenciaDoTitulo,
  documentoConfiavel,
  sugerirConciliacao,
  type TituloQuitado,
  type LancamentoAberto,
} from "./conciliacao";

const titulo = (over: Partial<TituloQuitado> = {}): TituloQuitado => ({
  id: "t1",
  fornecedor_id: "f1",
  imovel_id: null,
  tipo_documento: "NF",
  numero_documento: "42824001",
  data_vencimento: "2026-08-15",
  data_prorrogado: "2026-08-15",
  valor_parcela: 2038.53,
  saldo_atual: 0,
  ...over,
});

const lancamento = (over: Partial<LancamentoAberto> = {}): LancamentoAberto => ({
  id: "l1",
  fornecedor_id: "f1",
  imovel_id: null,
  competencia: "2026-08-01",
  valor: 2038.53,
  nf_numero: "42824001",
  status: "pendente",
  ...over,
});

describe("competenciaDoTitulo", () => {
  it("usa a PRORROGADA, não o vencimento original", () => {
    // Prorrogar de 03/12 para 31/03 muda o mês. Ler o vencimento original aqui
    // casaria o pagamento com a competência errada.
    expect(
      competenciaDoTitulo({ data_vencimento: "2024-12-03", data_prorrogado: "2025-03-31" }),
    ).toBe("2025-03-01");
  });

  it("cai no vencimento quando não há prorrogação", () => {
    expect(
      competenciaDoTitulo({ data_vencimento: "2026-08-15", data_prorrogado: null }),
    ).toBe("2026-08-01");
  });
});

describe("documentoConfiavel", () => {
  it("confia em NF com número longo", () => {
    expect(documentoConfiavel("NF", "42824001")).toBe(true);
  });

  it("não confia em RECIBO, nem com número longo", () => {
    // Medido: 92 genéricos em 94 RECIBOs. O tipo manda, não o formato.
    expect(documentoConfiavel("RECIBO", "42824001")).toBe(false);
  });

  it("não confia em número de 1 a 3 dígitos, nem em NF", () => {
    // "1", "2", "3" é o lançador numerando à mão.
    expect(documentoConfiavel("NF", "3")).toBe(false);
    expect(documentoConfiavel("NF", "123")).toBe(false);
  });

  it("não confia em documento vazio", () => {
    expect(documentoConfiavel("NF", "")).toBe(false);
  });
});

describe("sugerirConciliacao", () => {
  it("ignora título em aberto", () => {
    // Saldo > 0 não tem baixa a propor: a prorrogada dele é previsão.
    const r = sugerirConciliacao({
      titulos: [titulo({ saldo_atual: 100 })],
      lancamentos: [lancamento()],
    });
    expect(r).toEqual([]);
  });

  it("ignora lançamento já pago", () => {
    const r = sugerirConciliacao({
      titulos: [titulo()],
      lancamentos: [lancamento({ status: "pago" })],
    });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBeNull();
  });

  it("casa agente + competência + valor, com documento fiscal batendo: confiança alta", () => {
    const r = sugerirConciliacao({ titulos: [titulo()], lancamentos: [lancamento()] });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].confianca).toBe("alta");
    expect(r[0].motivo).toContain("42824001");
  });

  it("propõe mesmo com valor diferente, e diz a diferença", () => {
    // Multa e juros são exatamente o que faz o valor divergir. Esconder a
    // divergência esconde a multa.
    const r = sugerirConciliacao({
      titulos: [titulo({ valor_parcela: 2038.53 })],
      lancamentos: [lancamento({ valor: 2000, nf_numero: "42824001" })],
    });
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].motivo).toContain("38,53");
  });

  it("aluguel sem documento útil casa por agente + competência, com confiança média", () => {
    const r = sugerirConciliacao({
      titulos: [
        titulo({
          fornecedor_id: null,
          imovel_id: "i1",
          tipo_documento: "RECIBO",
          numero_documento: "3",
          valor_parcela: 2000,
        }),
      ],
      lancamentos: [
        lancamento({ fornecedor_id: null, imovel_id: "i1", valor: 2000, nf_numero: null }),
      ],
    });
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].confianca).toBe("media");
  });

  it("o bloco de aluguel casa parcela a parcela, não documento a documento", () => {
    // O MESMO documento em 3 parcelas mensais. Casar por documento quitaria o
    // contrato inteiro com a primeira; casar por parcela dá 3 casamentos.
    const base = {
      fornecedor_id: null,
      imovel_id: "i1",
      tipo_documento: "RECIBO",
      numero_documento: "1",
      valor_parcela: 2000,
    };
    const r = sugerirConciliacao({
      titulos: [
        titulo({ ...base, id: "t1", data_vencimento: "2026-07-10", data_prorrogado: "2026-07-10" }),
        titulo({ ...base, id: "t2", data_vencimento: "2026-08-10", data_prorrogado: "2026-08-10" }),
        titulo({ ...base, id: "t3", data_vencimento: "2026-09-10", data_prorrogado: "2026-09-10" }),
      ],
      lancamentos: [
        lancamento({ id: "l7", fornecedor_id: null, imovel_id: "i1", competencia: "2026-07-01", valor: 2000, nf_numero: null }),
        lancamento({ id: "l8", fornecedor_id: null, imovel_id: "i1", competencia: "2026-08-01", valor: 2000, nf_numero: null }),
        lancamento({ id: "l9", fornecedor_id: null, imovel_id: "i1", competencia: "2026-09-01", valor: 2000, nf_numero: null }),
      ],
    });
    expect(r.map((s) => [s.mega_titulo_id, s.lancamento_id])).toEqual([
      ["t1", "l7"],
      ["t2", "l8"],
      ["t3", "l9"],
    ]);
  });

  it("nunca reusa o mesmo lançamento em duas sugestões", () => {
    // Duas parcelas na mesma competência com o mesmo valor: a segunda fica sem
    // casamento em vez de duplicar a baixa.
    const r = sugerirConciliacao({
      titulos: [titulo({ id: "t1" }), titulo({ id: "t2" })],
      lancamentos: [lancamento({ id: "l1" })],
    });
    const usados = r.map((s) => s.lancamento_id).filter(Boolean);
    expect(usados).toEqual(["l1"]);
    expect(r.find((s) => s.lancamento_id === null)).toBeDefined();
  });

  it("título de agente sem vínculo no Loca não casa com nada", () => {
    // NUNCA resolver agente por nome ou por valor: medido em 10/09/2026, 3 de 8
    // candidatos por valor+dia eram falsos.
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: null, imovel_id: null })],
      lancamentos: [lancamento()],
    });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBeNull();
    expect(r[0].confianca).toBe("baixa");
  });

  it("não casa entre agentes diferentes", () => {
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: "f1" })],
      lancamentos: [lancamento({ fornecedor_id: "f2" })],
    });
    expect(r[0].lancamento_id).toBeNull();
  });

  it("não casa fornecedor com imóvel de mesmo id", () => {
    // `fornecedor_id` e `imovel_id` vêm de tabelas diferentes; um uuid igual
    // seria coincidência, mas o casamento tem de comparar o TIPO do dono.
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: "x", imovel_id: null })],
      lancamentos: [lancamento({ fornecedor_id: null, imovel_id: "x" })],
    });
    expect(r[0].lancamento_id).toBeNull();
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/mega/conciliacao.test.ts`
Expected: FAIL — `Failed to resolve import "./conciliacao"`.

- [ ] **Step 3: implementar**

```ts
import { vencimentoEfetivo } from "./vencimento";
import { formatarBRL } from "@/lib/locacao";

/**
 * O casamento entre o que o Mega pagou e o que o Loca deve.
 *
 * Puro de propósito, como `espelho.ts`: a regra de casamento é invenção nossa,
 * e invenção nossa precisa de teste em memória.
 *
 * ELE NÃO DÁ BAIXA. Devolve SUGESTÕES, que um humano confirma. A assimetria é
 * o motivo: sugestão errada é recusada em dois segundos; baixa errada vira um
 * contrato quitado que ninguém cobra, e só aparece quando o fornecedor liga.
 */

export type TituloQuitado = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  data_vencimento: string;
  data_prorrogado: string | null;
  valor_parcela: number;
  saldo_atual: number;
};

export type LancamentoAberto = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  /** Sempre dia 1 do mês de referência, como a coluna `competencia` guarda. */
  competencia: string;
  valor: number;
  nf_numero: string | null;
  status: "pendente" | "pago";
};

export type Sugestao = {
  mega_titulo_id: string;
  lancamento_id: string | null;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
};

/** Tipos de documento em que o número É a nota. Medido sobre 465 títulos. */
const TIPOS_FISCAIS = new Set(["NF", "NFE", "NFS", "NFSE", "FATURA"]);

/**
 * A competência do título: o mês do vencimento EFETIVO.
 *
 * A prorrogada, nunca a original. Prorrogar de 03/12/2024 para 31/03/2025 muda
 * o mês, e casar pela original jogaria o pagamento na competência errada.
 */
export function competenciaDoTitulo(t: {
  data_vencimento: string;
  data_prorrogado: string | null;
}): string {
  const efetivo = vencimentoEfetivo({
    dataVencimento: t.data_vencimento,
    dataProrrogado: t.data_prorrogado,
  });
  return `${efetivo.slice(0, 7)}-01`;
}

/**
 * Dá para acreditar neste número de documento?
 *
 * DUAS PORTAS, e as duas têm de abrir. O tipo manda: em `NF` o campo é a nota
 * (9 genéricos em 183); em `RECIBO` não é (92 de 94), nem em `CONTRATO` (7 de
 * 7) ou `ALUGUEL` (20 de 22). E 1 a 3 dígitos é o lançador numerando à mão —
 * "1", "2", "3" — mesmo sob um tipo fiscal.
 */
export function documentoConfiavel(tipo: string, numero: string): boolean {
  const n = numero.trim();
  if (n.length === 0 || n.length <= 3) return false;
  return TIPOS_FISCAIS.has(tipo.trim().toUpperCase());
}

/** O dono do título/lançamento, com o TIPO junto: "f:uuid" ou "i:uuid". */
function agente(x: { fornecedor_id: string | null; imovel_id: string | null }): string | null {
  if (x.fornecedor_id) return `f:${x.fornecedor_id}`;
  if (x.imovel_id) return `i:${x.imovel_id}`;
  return null;
}

function mesmoValor(a: number, b: number): boolean {
  // Um centavo de folga: os dois lados são numeric(14,2), mas passam por float
  // no caminho até aqui.
  return Math.abs(a - b) < 0.005;
}

export function sugerirConciliacao({
  titulos,
  lancamentos,
}: {
  titulos: TituloQuitado[];
  lancamentos: LancamentoAberto[];
}): Sugestao[] {
  // SÓ TÍTULO QUITADO. Em aberto, a prorrogada é previsão, não pagamento.
  const quitados = titulos.filter((t) => t.saldo_atual === 0);

  // Índice por agente+competência. O lançamento já pago fica de fora: ele não
  // precisa de baixa, e propor uma seria pedir para alguém confirmar o já feito.
  const porChave = new Map<string, LancamentoAberto[]>();
  for (const l of lancamentos) {
    if (l.status === "pago") continue;
    const ag = agente(l);
    if (!ag) continue;
    const chave = `${ag}|${l.competencia}`;
    const lista = porChave.get(chave);
    if (lista) lista.push(l);
    else porChave.set(chave, [l]);
  }

  // UM LANÇAMENTO SÓ RECEBE UMA SUGESTÃO. Duas parcelas idênticas na mesma
  // competência existem (e são raras); deixar a segunda sem casamento é o erro
  // barato. Casar as duas no mesmo lançamento proporia baixa dupla.
  const usados = new Set<string>();
  const sugestoes: Sugestao[] = [];

  // Ordem estável: o documento confiável escolhe primeiro. Sem isto, um título
  // com evidência forte poderia perder o lançamento para um vizinho fraco só
  // por vir depois na lista.
  const ordenados = [...quitados].sort((a, b) => {
    const fa = documentoConfiavel(a.tipo_documento, a.numero_documento) ? 0 : 1;
    const fb = documentoConfiavel(b.tipo_documento, b.numero_documento) ? 0 : 1;
    return fa - fb;
  });

  for (const t of ordenados) {
    const ag = agente(t);
    if (!ag) {
      // AGENTE SEM VÍNCULO NÃO GERA CASAMENTO, e não é omissão: resolver agente
      // por nome ou por valor errou 3 de 8 em 10/09/2026. Alguém preenche o
      // `codigo_mega` e a rodada seguinte resolve.
      sugestoes.push({
        mega_titulo_id: t.id,
        lancamento_id: null,
        confianca: "baixa",
        motivo:
          "O título não está vinculado a nenhum fornecedor ou imóvel do Loca. " +
          "Preencha o código do Mega no cadastro para o sistema propor o casamento.",
      });
      continue;
    }

    const competencia = competenciaDoTitulo(t);
    const candidatos = (porChave.get(`${ag}|${competencia}`) ?? []).filter(
      (l) => !usados.has(l.id),
    );

    const fiscal = documentoConfiavel(t.tipo_documento, t.numero_documento);
    const porDocumento = fiscal
      ? candidatos.find((l) => (l.nf_numero ?? "").trim() === t.numero_documento.trim())
      : undefined;
    const porValor = candidatos.find((l) => mesmoValor(l.valor, t.valor_parcela));
    const escolhido = porDocumento ?? porValor ?? candidatos[0];

    if (!escolhido) {
      sugestoes.push({
        mega_titulo_id: t.id,
        lancamento_id: null,
        confianca: "baixa",
        motivo: `Nenhum lançamento em aberto para este agente na competência ${competencia.slice(0, 7)}.`,
      });
      continue;
    }

    usados.add(escolhido.id);

    const razoes: string[] = [`Competência ${competencia.slice(0, 7)}.`];
    if (porDocumento) razoes.push(`Documento ${t.numero_documento} bate com a NF do lançamento.`);
    const diferenca = t.valor_parcela - escolhido.valor;
    if (mesmoValor(t.valor_parcela, escolhido.valor)) {
      razoes.push("Valor idêntico.");
    } else {
      // A DIFERENÇA É O QUE INTERESSA. Ela é a multa, o juro ou o desconto — e
      // é por isso que ela vai escrita no motivo, não escondida.
      razoes.push(
        `O Loca esperava ${formatarBRL(escolhido.valor)} e o Mega pagou ` +
          `${formatarBRL(t.valor_parcela)} — diferença de ${formatarBRL(Math.abs(diferenca))}.`,
      );
    }

    const confianca: Sugestao["confianca"] = porDocumento
      ? "alta"
      : mesmoValor(t.valor_parcela, escolhido.valor)
        ? "media"
        : "baixa";

    sugestoes.push({
      mega_titulo_id: t.id,
      lancamento_id: escolhido.id,
      confianca,
      motivo: razoes.join(" "),
    });
  }

  return sugestoes;
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/mega/conciliacao.test.ts`
Expected: PASS, 15 testes.

Se o teste da diferença falhar comparando `"38,53"`, lembre que `formatarBRL` produz `R$ 38,53` com espaço **não separável** — o `toContain("38,53")` do teste evita o problema de propósito; não troque por igualdade com `"R$ 38,53"`.

- [ ] **Step 5: commit**

```bash
git add src/lib/mega/conciliacao.ts src/lib/mega/conciliacao.test.ts
git commit -m "feat(mega): o calculo do casamento parcela x lancamento"
```

---

### Task 3: gravar as sugestões, e a varredura que muda de forma

**Files:**
- Create: `src/lib/mega/conciliacao-servidor.ts`
- Modify: `src/lib/mega/espelho-nao-da-baixa.test.ts`
- Modify: `src/app/api/cron/mega/route.ts`

**Interfaces:**
- Consumes: `sugerirConciliacao`, `TituloQuitado`, `LancamentoAberto` da Task 2.
- Produces: `export async function conciliarOrg(supabase: SupabaseClient, orgId: string): Promise<{ sugestoes: number }>`

- [ ] **Step 1: reescrever a varredura primeiro**

A promessa muda de "nenhum arquivo do Mega menciona `lancamento_financeiro`" para "**o cron** não escreve em `lancamento_financeiro`". Substitua o segundo `it` do primeiro `describe` em `src/lib/mega/espelho-nao-da-baixa.test.ts` por:

```ts
  // A PROMESSA ESTREITOU NA v0.113.0, E CONTINUA SENDO A QUE IMPORTA.
  // Antes: nenhum arquivo do Mega mencionava `lancamento_financeiro`. Agora a
  // conciliação existe, e ela LÊ os lançamentos para propor o casamento. O que
  // segue proibido é o cron ESCREVER neles: quem escreve é a server action de
  // confirmação, com sessão de usuário e com um humano tendo clicado.
  //
  // Sem esta varredura, alguém "otimiza" a confirmação daqui a seis meses
  // movendo a escrita para dentro do cron, e a fila humana vira baixa
  // automática sem ninguém ter decidido isso.
  it("nenhum arquivo do Mega escreve em lancamento_financeiro", () => {
    const ESCRITAS = ["insert(", "update(", "upsert(", "delete("];
    for (const { caminho, conteudo } of arquivosDoMega()) {
      const linhas = conteudo.split("\n");
      linhas.forEach((linha, i) => {
        if (!linha.includes("lancamento_financeiro")) return;
        // A menção é o `.from("lancamento_financeiro")`; o verbo vem depois,
        // na mesma linha ou nas próximas — o PostgREST encadeia.
        const janela = linhas.slice(i, i + 4).join("\n");
        for (const verbo of ESCRITAS) {
          expect(
            janela.includes(verbo),
            `${caminho}:${i + 1} escreve em lancamento_financeiro com ${verbo} — ` +
              "o cron PROPÕE, quem dá baixa é a server action de confirmação, " +
              "com sessão de usuário. Ver a spec de 2026-09-16.",
          ).toBe(false);
        }
      });
    }
  });
```

- [ ] **Step 2: rodar a varredura e ver passar (ainda sem o servidor)**

Run: `npx vitest run src/lib/mega/espelho-nao-da-baixa.test.ts`
Expected: PASS. Nenhum arquivo menciona `lancamento_financeiro` ainda, então a varredura passa por vacuidade **na segunda asserção** — mas a primeira (`a varredura encontra os arquivos que deveria`) continua provando que ela achou os arquivos. O Step 4 é que a exercita de verdade.

- [ ] **Step 3: escrever `conciliacao-servidor.ts`**

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import {
  sugerirConciliacao,
  type LancamentoAberto,
  type TituloQuitado,
} from "./conciliacao";

/**
 * Calcula e grava as sugestões de baixa de uma organização.
 *
 * Recebe o `supabase` de quem chama (o cron, com service role), seguindo a
 * regra do AGENTS.md para escrita compartilhada.
 *
 * ESTE ARQUIVO LÊ `lancamento_financeiro` E NUNCA O ESCREVE. A leitura é o que
 * permite propor; a escrita é da server action de confirmação, que roda com
 * sessão de usuário depois de alguém clicar. Há varredura cobrando isto em
 * `espelho-nao-da-baixa.test.ts`.
 */
export async function conciliarOrg(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ sugestoes: number }> {
  const [tit, lanc, decididas] = await Promise.all([
    supabase
      .from("mega_titulo")
      .select(
        "id, fornecedor_id, imovel_id, tipo_documento, numero_documento, " +
          "data_vencimento, data_prorrogado, valor_parcela, saldo_atual",
      )
      .eq("org_id", orgId)
      .eq("saldo_atual", 0),
    supabase
      .from("lancamento_financeiro")
      .select("id, contrato_id, contrato_imovel_id, competencia, valor, nf_numero, status")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .eq("status", "pendente"),
    // JÁ DECIDIDAS NÃO VOLTAM PARA A FILA. É para isto que a tabela existe: um
    // upsert cego reabriria como "sugerida" tudo que alguém já recusou, e a
    // fila nunca esvaziaria.
    supabase
      .from("mega_conciliacao")
      .select("mega_titulo_id")
      .eq("org_id", orgId)
      .neq("status", "sugerida"),
  ]);

  if (tit.error) throw new Error(tit.error.message);
  if (lanc.error) throw new Error(lanc.error.message);
  if (decididas.error) throw new Error(decididas.error.message);

  const fechados = new Set((decididas.data ?? []).map((d) => d.mega_titulo_id as string));
  const titulos = ((tit.data ?? []) as TituloQuitado[]).filter((t) => !fechados.has(t.id));

  // O lançamento aponta para o CONTRATO, não para o agente. O dono vem de lá —
  // e é por isso que o select acima traz os dois ids de contrato.
  const lancamentos = await comAgente(supabase, orgId, lanc.data ?? []);

  const sugestoes = sugerirConciliacao({ titulos, lancamentos });
  if (sugestoes.length === 0) return { sugestoes: 0 };

  const { error } = await supabase.from("mega_conciliacao").upsert(
    sugestoes.map((s) => ({ org_id: orgId, ...s, status: "sugerida" as const })),
    { onConflict: "org_id,mega_titulo_id" },
  );
  if (error) throw new Error(error.message);

  logger.info("conciliacao: sugestões gravadas", { org_id: orgId, total: sugestoes.length });
  return { sugestoes: sugestoes.length };
}

type LinhaLancamento = {
  id: string;
  contrato_id: string | null;
  contrato_imovel_id: string | null;
  competencia: string;
  valor: number;
  nf_numero: string | null;
  status: "pendente" | "pago";
};

/** Resolve fornecedor/imóvel de cada lançamento a partir do contrato dele. */
async function comAgente(
  supabase: SupabaseClient,
  orgId: string,
  linhas: LinhaLancamento[],
): Promise<LancamentoAberto[]> {
  const [contratos, imoveis] = await Promise.all([
    supabase.from("contrato_locacao").select("id, fornecedor_id").eq("org_id", orgId),
    supabase.from("contrato_imovel").select("id, imovel_id").eq("org_id", orgId),
  ]);
  if (contratos.error) throw new Error(contratos.error.message);
  if (imoveis.error) throw new Error(imoveis.error.message);

  const fornPorContrato = new Map(
    (contratos.data ?? []).map((c) => [c.id as string, c.fornecedor_id as string | null]),
  );
  const imovPorContrato = new Map(
    (imoveis.data ?? []).map((c) => [c.id as string, c.imovel_id as string | null]),
  );

  return linhas.map((l) => ({
    id: l.id,
    fornecedor_id: l.contrato_id ? (fornPorContrato.get(l.contrato_id) ?? null) : null,
    imovel_id: l.contrato_imovel_id ? (imovPorContrato.get(l.contrato_imovel_id) ?? null) : null,
    competencia: l.competencia,
    valor: Number(l.valor),
    nf_numero: l.nf_numero,
    status: l.status,
  }));
}
```

- [ ] **Step 4: rodar a varredura de novo — agora ela tem o que examinar**

Run: `npx vitest run src/lib/mega/espelho-nao-da-baixa.test.ts`
Expected: PASS. O arquivo novo menciona `lancamento_financeiro` num `.select(`, e nenhum dos quatro verbos de escrita aparece na janela de 4 linhas.

Para provar que a varredura não passa por vacuidade: troque temporariamente o `.select(` de `lancamento_financeiro` por `.update(`, rode de novo e confirme que **FALHA** citando o arquivo e a linha. Depois desfaça.

- [ ] **Step 5: ligar no cron**

Em `src/app/api/cron/mega/route.ts`, acrescente o import e a chamada dentro do `try` do laço, logo depois de `sincronizarContratos`:

```ts
import { conciliarOrg } from "@/lib/mega/conciliacao-servidor";
```

```ts
      // A conciliação vem DEPOIS do espelho, e não em paralelo: ela lê
      // `mega_titulo`, então precisa da rodada do dia já gravada.
      // Ela PROPÕE; a baixa é da server action de confirmação.
      const conciliacao = await conciliarOrg(supabase, org_id);
```

E inclua `conciliacao.sugestoes` no objeto que a rota já empurra em `resultado`, junto de `resumo` e `contratos`.

Atualize também o comentário de cabeçalho da rota: onde ele diz "ESTA ROTA NÃO DÁ BAIXA EM NADA. Ela só copia para o espelho o que o Mega respondeu", troque por "ESTA ROTA NÃO DÁ BAIXA EM NADA. Ela copia o espelho e PROPÕE casamentos em `mega_conciliacao`; quem escreve em `lancamento_financeiro` é a server action de confirmação, com sessão de usuário."

- [ ] **Step 6: ritual e commit**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tudo PASS.

```bash
git add src/lib/mega/conciliacao-servidor.ts src/lib/mega/espelho-nao-da-baixa.test.ts "src/app/api/cron/mega/route.ts"
git commit -m "feat(mega): o cron passa a propor os casamentos"
```

---

### Task 4: a leitura da fila

**Files:**
- Create: `src/lib/data/conciliacao.ts`

**Interfaces:**
- Consumes: a tabela da Task 1.
- Produces: `export async function listarFilaConciliacao(status?: "sugerida" | "recusada"): Promise<ItemFila[]>`, com

```ts
export type ItemFila = {
  id: string;
  status: "sugerida" | "confirmada" | "recusada";
  confianca: "alta" | "media" | "baixa";
  motivo: string;
  agenteNome: string;
  tipoDocumento: string;
  numeroDocumento: string;
  valorPago: number;
  dataPagamento: string | null;
  lancamentoId: string | null;
  lancamentoDescricao: string | null;
  lancamentoValor: number | null;
};
```

- [ ] **Step 1: escrever o módulo**

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger, erroMeta } from "@/lib/logger";
import { dataDePagamento } from "@/lib/mega/vencimento";

/**
 * A fila de conciliação, achatada para a tela.
 *
 * `createClient()`, nunca `createAdminClient()`: o isolamento por organização
 * desta tela depende de RLS, e um client admin faria todo tenant ver a fila de
 * todos, em silêncio.
 *
 * Tipos de retorno PLANOS de propósito: o PostgREST devolve `T | T[] | null`
 * para o embed, e essa ambiguidade não sobe para o componente.
 */

export type ItemFila = {
  id: string;
  status: "sugerida" | "confirmada" | "recusada";
  confianca: "alta" | "media" | "baixa";
  motivo: string;
  agenteNome: string;
  tipoDocumento: string;
  numeroDocumento: string;
  valorPago: number;
  dataPagamento: string | null;
  lancamentoId: string | null;
  lancamentoDescricao: string | null;
  lancamentoValor: number | null;
};

type Embed<T> = T | T[] | null;

function um<T>(v: Embed<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function listarFilaConciliacao(
  status: "sugerida" | "recusada" = "sugerida",
): Promise<ItemFila[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mega_conciliacao")
    .select(
      "id, status, confianca, motivo, " +
        "mega_titulo ( agente_nome, codigo_mega, tipo_documento, numero_documento, " +
        "valor_parcela, saldo_atual, data_vencimento, data_prorrogado ), " +
        "lancamento_financeiro ( id, descricao, valor )",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    // Erro em LISTA: loga e devolve vazio. A tela mostra o estado vazio em vez
    // de explodir — quem explode é o detalhe, e não há detalhe aqui.
    logger.error("conciliacao: não consegui ler a fila", erroMeta(error));
    return [];
  }

  return (data ?? []).map((r) => {
    const t = um(r.mega_titulo as Embed<{
      agente_nome: string | null;
      codigo_mega: string;
      tipo_documento: string;
      numero_documento: string;
      valor_parcela: number;
      saldo_atual: number;
      data_vencimento: string;
      data_prorrogado: string | null;
    }>);
    const l = um(r.lancamento_financeiro as Embed<{
      id: string;
      descricao: string;
      valor: number;
    }>);

    return {
      id: r.id as string,
      status: r.status as ItemFila["status"],
      confianca: r.confianca as ItemFila["confianca"],
      motivo: r.motivo as string,
      // O código do Mega como fallback: nome nulo é comum, e uma linha sem
      // identificação nenhuma é pior que uma linha com o código cru.
      agenteNome: t?.agente_nome ?? t?.codigo_mega ?? "Agente não identificado",
      tipoDocumento: t?.tipo_documento ?? "",
      numeroDocumento: t?.numero_documento ?? "",
      valorPago: Number(t?.valor_parcela ?? 0),
      // A PRORROGADA, e só com saldo zerado — é `dataDePagamento` que faz esse
      // recorte, e é por isso que ela exige o saldo na assinatura.
      dataPagamento: t
        ? dataDePagamento({
            saldoAtual: Number(t.saldo_atual),
            dataVencimento: t.data_vencimento,
            dataProrrogado: t.data_prorrogado,
          })
        : null,
      lancamentoId: l?.id ?? null,
      lancamentoDescricao: l?.descricao ?? null,
      lancamentoValor: l ? Number(l.valor) : null,
    };
  });
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: commit**

```bash
git add src/lib/data/conciliacao.ts
git commit -m "feat(mega): a leitura da fila de conciliacao"
```

---

### Task 5: as actions — confirmar, recusar, desfazer

**Files:**
- Create: `src/lib/conciliacao.ts` (schemas zod)
- Create: `src/app/(app)/financeiro/conciliacao/actions.ts`

**Interfaces:**
- Consumes: `darBaixa` de `src/app/(app)/financeiro/actions.ts`, `listarFilaConciliacao` da Task 4.
- Produces: `confirmarSugestao(raw: unknown): Promise<ActionResult>`, `recusarSugestao(raw: unknown): Promise<ActionResult>`, `desfazerRecusa(raw: unknown): Promise<ActionResult>`.

- [ ] **Step 1: os schemas**

Em `src/lib/conciliacao.ts` (fora do `actions.ts`, porque um arquivo `"use server"` não pode ser importado por componente cliente e o form precisa do schema):

```ts
import { z } from "zod";

/** Confirmar uma sugestão é dar a baixa que ela propõe. */
export const confirmarSchema = z.object({
  id: z.string().uuid(),
  lancamentoId: z.string().uuid("Esta sugestão não aponta para nenhum lançamento."),
  valorPago: z.coerce.number().positive("Informe o valor pago."),
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de pagamento inválida."),
  multa: z.coerce.number().min(0, "Multa inválida.").default(0),
  juros: z.coerce.number().min(0, "Juros inválidos.").default(0),
  nfNumero: z.string().trim().max(60).nullable().optional(),
});

export const recusarSchema = z.object({ id: z.string().uuid() });

export type ConfirmarInput = z.input<typeof confirmarSchema>;
export type RecusarInput = z.input<typeof recusarSchema>;
```

- [ ] **Step 2: as actions**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { confirmarSchema, recusarSchema } from "@/lib/conciliacao";
import { darBaixa } from "../actions";

/**
 * A confirmação humana de uma sugestão do Mega.
 *
 * É AQUI, e só aqui, que a conciliação escreve no livro financeiro — com
 * sessão de usuário, sob as policies que `lancamento_financeiro` já exige. O
 * cron propõe; ninguém dá baixa sem alguém ter clicado.
 */
export async function confirmarSugestao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para dar baixa em lançamentos.");
  }

  const parsed = confirmarSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  // A BAIXA PRIMEIRO, o status depois. Se a ordem fosse a inversa e a baixa
  // falhasse, a sugestão sairia da fila sem o lançamento ter sido pago — e o
  // título ficaria quitado no Mega, pendente no Loca, e invisível para os dois.
  const baixa = await darBaixa({
    id: d.lancamentoId,
    valorPago: d.valorPago,
    multa: d.multa,
    juros: d.juros,
    nfNumero: d.nfNumero ?? null,
    dataPagamento: d.dataPagamento,
  });
  if (!baixa.ok) return baixa;

  const supabase = await createClient();
  const { error } = await supabase
    .from("mega_conciliacao")
    .update({
      status: "confirmada",
      decidido_por: perfil.id,
      decidido_em: new Date().toISOString(),
    })
    .eq("id", d.id);

  if (error) {
    // A BAIXA JÁ ACONTECEU e não dá para desfazer daqui. Devolver `ok: false`
    // seria mentira: o lançamento está pago. O aviso existe para este caso.
    return {
      ok: true,
      id: d.id,
      aviso:
        "A baixa foi registrada, mas não consegui marcar a sugestão como confirmada. " +
        "Ela pode reaparecer na fila.",
    };
  }

  revalidatePath("/financeiro/conciliacao");
  // `revalidatePath` e não `router.refresh()`: a lista do financeiro também
  // ficou velha, e o refresh do cliente só re-busca a rota atual.
  revalidatePath("/financeiro");
  return { ok: true, id: d.id };
}

/** Recusar tira o título da fila — e é para isso que a tabela existe. */
export async function recusarSugestao(raw: unknown): Promise<ActionResult> {
  return mudarStatus(raw, "recusada", "recusar sugestões");
}

/**
 * Desfazer a recusa devolve o título à fila.
 *
 * Existe porque recusa é um clique, e um clique errado não pode apagar um
 * título para sempre. Não desfaz confirmação: essa mexeu no livro financeiro,
 * e desfazer baixa é outra operação, na tela do lançamento.
 */
export async function desfazerRecusa(raw: unknown): Promise<ActionResult> {
  return mudarStatus(raw, "sugerida", "reabrir sugestões");
}

async function mudarStatus(
  raw: unknown,
  status: "recusada" | "sugerida",
  oQue: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha(`Você não tem permissão para ${oQue}.`);
  }

  const parsed = recusarSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from("mega_conciliacao")
    .update({
      status,
      decidido_por: status === "recusada" ? perfil.id : null,
      decidido_em: status === "recusada" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) return falha("Não foi possível registrar a decisão.");

  revalidatePath("/financeiro/conciliacao");
  return { ok: true, id: parsed.data.id };
}
```

- [ ] **Step 3: typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

Se o lint reclamar do import relativo `../actions`, siga o padrão que o repositório já usa para importar entre pastas de rota irmãs; não troque por um alias novo só para calar o lint.

- [ ] **Step 4: commit**

```bash
git add src/lib/conciliacao.ts "src/app/(app)/financeiro/conciliacao/actions.ts"
git commit -m "feat(mega): confirmar, recusar e desfazer a sugestao de baixa"
```

---

### Task 6: a tela

**Files:**
- Create: `src/app/(app)/financeiro/conciliacao/page.tsx`
- Create: `src/app/(app)/financeiro/conciliacao/_components/linha-sugestao.tsx`

**Interfaces:**
- Consumes: `listarFilaConciliacao` e `ItemFila` de `@/lib/data/conciliacao` (Task 4); `confirmarSugestao`, `recusarSugestao`, `desfazerRecusa` de `../actions` local (Task 5).
- Produces: a rota `/financeiro/conciliacao`.

**Padrão de formulário — o do repositório, não `useActionState`.** O análogo mais
próximo é `src/app/(app)/financeiro/baixa-form.tsx`, e ele usa
`useState` + `useTransition` + `toast` do `sonner` + `FormError`. Siga esse.

- [ ] **Step 1: o componente da linha**

Criar `src/app/(app)/financeiro/conciliacao/_components/linha-sugestao.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { formatarBRL, formatarData } from "@/lib/locacao";
import type { ItemFila } from "@/lib/data/conciliacao";
import { confirmarSugestao, recusarSugestao, desfazerRecusa } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { FormError } from "@/components/shared/form-error";

/**
 * Uma linha da fila de conciliação.
 *
 * O `motivo` fica visível junto dos campos, e não escondido atrás de um ícone:
 * quem confirma está movendo dinheiro, e precisa ler POR QUE o sistema propôs
 * aquele casamento antes de dizer sim.
 */

const CONFIANCA: Record<ItemFila["confianca"], { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  alta: { label: "Alta", variant: "secondary" },
  media: { label: "Média", variant: "outline" },
  baixa: { label: "Baixa", variant: "destructive" },
};

export function LinhaSugestao({ item }: { item: ItemFila }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valorPago, setValorPago] = useState(item.valorPago);
  const [multa, setMulta] = useState(0);
  const [juros, setJuros] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const conf = CONFIANCA[item.confianca];
  const diferenca =
    item.lancamentoValor === null ? 0 : item.valorPago - item.lancamentoValor;

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarSugestao({
        id: item.id,
        lancamentoId: item.lancamentoId,
        valorPago,
        multa,
        juros,
        nfNumero: item.numeroDocumento || null,
        dataPagamento: item.dataPagamento,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // O `aviso` existe para quando a baixa ACONTECEU mas um passo acessório
      // falhou. Mostrar isso como sucesso esconderia um problema real.
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Baixa registrada.");
      router.refresh();
    });
  }

  function decidir(acao: typeof recusarSugestao, mensagem: string) {
    setErro(null);
    startTransition(async () => {
      const r = await acao({ id: item.id });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success(mensagem);
      router.refresh();
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{item.agenteNome}</TableCell>
        <TableCell>
          {item.tipoDocumento} {item.numeroDocumento}
        </TableCell>
        <TableCell>
          {item.dataPagamento ? formatarData(item.dataPagamento) : "—"}
        </TableCell>
        <TableCell>{formatarBRL(item.valorPago)}</TableCell>
        <TableCell>
          {item.lancamentoId ? (
            <span>
              {item.lancamentoDescricao}{" "}
              <span className="text-muted-foreground">
                ({formatarBRL(item.lancamentoValor ?? 0)})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem casamento</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={conf.variant}>{conf.label}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {item.status === "recusada" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pendente}
              onClick={() => decidir(desfazerRecusa, "Sugestão devolvida à fila.")}
            >
              Devolver à fila
            </Button>
          ) : (
            <div className="flex justify-end gap-2">
              {item.lancamentoId && (
                <Button size="sm" disabled={pendente} onClick={() => setAberto((v) => !v)}>
                  {aberto ? "Fechar" : "Confirmar baixa"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pendente}
                onClick={() => decidir(recusarSugestao, "Sugestão recusada.")}
              >
                Recusar
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} className="pt-0 text-xs text-muted-foreground">
          {item.motivo}
        </TableCell>
      </TableRow>

      {aberto && item.lancamentoId && (
        <TableRow>
          <TableCell colSpan={7}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor={`valor-${item.id}`}>Valor pago</Label>
                <Input
                  id={`valor-${item.id}`}
                  type="number"
                  step="0.01"
                  value={valorPago}
                  onChange={(e) => setValorPago(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`multa-${item.id}`}>Multa</Label>
                <Input
                  id={`multa-${item.id}`}
                  type="number"
                  step="0.01"
                  value={multa}
                  onChange={(e) => setMulta(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`juros-${item.id}`}>Juros</Label>
                <Input
                  id={`juros-${item.id}`}
                  type="number"
                  step="0.01"
                  value={juros}
                  onChange={(e) => setJuros(Number(e.target.value))}
                />
              </div>
              <Button disabled={pendente} onClick={confirmar}>
                {pendente ? "Registrando..." : "Registrar baixa"}
              </Button>
            </div>

            {diferenca !== 0 && (
              // A DIFERENÇA É O QUE INTERESSA: ela é a multa, o juro ou o
              // desconto. Escondê-la esconderia exatamente o que o financeiro
              // precisa atribuir.
              <p className="mt-2 text-sm font-medium">
                Diferença de {formatarBRL(Math.abs(diferenca))} — informe multa
                ou juros, se for o caso.
              </p>
            )}

            <FormError message={erro} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
```

Se `FormError` não aceitar a prop `message`, abra
`src/components/shared/form-error.tsx` e use a prop que ele realmente expõe —
não invente uma nova nem crie um componente paralelo.

- [ ] **Step 2: a página**

Criar `src/app/(app)/financeiro/conciliacao/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";

import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { listarFilaConciliacao } from "@/lib/data/conciliacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LinhaSugestao } from "./_components/linha-sugestao";

export const metadata = { title: "Conciliação com o Mega — Loca" };

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const { status } = await searchParams;
  const recusadas = status === "recusada";
  const itens = await listarFilaConciliacao(recusadas ? "recusada" : "sugerida");

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Conciliação com o Mega"
        descricao="O que o ERP já pagou e ainda não tem baixa no Loca."
        acoes={
          <Button variant="outline" render={
            <a href={recusadas ? "/financeiro/conciliacao" : "/financeiro/conciliacao?status=recusada"} />
          }>
            {recusadas ? "Ver a fila" : "Ver recusadas"}
          </Button>
        }
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={<Handshake />}
          titulo={recusadas ? "Nenhuma sugestão recusada" : "Nada a conciliar"}
          descricao={
            recusadas
              ? "Tudo que o sistema propôs foi confirmado ou continua na fila."
              : "O Mega não tem pagamento sem baixa no Loca."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Valor pago</TableHead>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => (
                  <LinhaSugestao key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

Composição de `Button` com link é `render={<a/>}` ou `render={<Link/>}`, **nunca
`asChild`** — os primitivos são shadcn "base-nova" sobre Base UI, não Radix.

- [ ] **Step 3: a auditoria de PT-BR**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/financeiro/conciliacao" --include=*.tsx
```
Expected: só identificadores (`numeroDocumento`, `nfNumero`, `lancamentoId`,
`lancamentoValor`, `lancamentoDescricao`). Qualquer texto visível sem acento é
erro — corrija antes de seguir.

- [ ] **Step 4: ritual completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo PASS. Este é o único ponto do plano em que `npm run build` roda,
porque é onde entram os componentes de cliente.

- [ ] **Step 5: commit**

```bash
git add "src/app/(app)/financeiro/conciliacao"
git commit -m "feat(mega): a tela da fila de conciliacao"
```


### Task 7: versão e changelog

**Files:**
- Modify: `src/lib/changelog.ts`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: bumpar os três pontos para `0.113.0`**

MINOR: funcionalidade nova sem quebrar o que existe.

- `src/lib/changelog.ts`: `APP_VERSION = "0.113.0"` e um `Release` novo no topo do array `CHANGELOG`, com itens de `tipo: "novo"` em texto de usuário, sem jargão. Por exemplo: *"O Loca agora mostra o que o Mega já pagou e ainda não tem baixa, e você confirma com um clique."* e *"Recusou por engano? A sugestão volta para a fila pelo botão Devolver à fila."*
- `CHANGELOG.md`: o mesmo resumo em Keep a Changelog, seção `### Adicionado`, registrando também a mudança de forma da varredura `espelho-nao-da-baixa.test.ts`.
- `package.json`: `"version": "0.113.0"`.

- [ ] **Step 2: conferir a sincronia**

Run: `node -e "const p=require('./package.json');const s=require('fs').readFileSync('src/lib/changelog.ts','utf8');console.log(p.version, s.includes(p.version)?'ok':'DIVERGENTE')"`
Expected: `0.113.0 ok`

- [ ] **Step 3: ritual e commit**

Run: `npm run typecheck && npm run lint && npm test && npm run build`

```bash
git add src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore: v0.113.0 — a conciliacao da baixa com o Mega"
```

- [ ] **Step 4: atualizar o AGENTS.md e a spec**

- Em `AGENTS.md`, a seção **"O que ainda NÃO existe: a BAIXA"** deixou de ser verdade. Reescreva o título para **"A baixa: o Mega propõe, o humano confirma"** e o corpo para descrever o que passou a existir, mantendo as medições (a tabela de bloco × mensal continua sendo o dado que justifica o desenho).
- Em `docs/superpowers/specs/2026-09-16-conciliacao-baixa-mega-design.md`, atualize a seção **Estado da implementação** para 100%, listando o que ficou fora de escopo de propósito.

```bash
git add AGENTS.md docs/superpowers/specs/2026-09-16-conciliacao-baixa-mega-design.md
git commit -m "docs(mega): a baixa deixou de ser o que nao existe"
```

---

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Conciliação da baixa | Spec e plano escritos | Tasks 1 a 7 | 15% |

Próximo passo único: executar a Task 1.
