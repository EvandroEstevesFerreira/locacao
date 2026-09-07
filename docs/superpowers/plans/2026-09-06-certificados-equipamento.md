# Certificados do equipamento — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
> Os passos usam checkbox (`- [ ]`).

**Goal:** dar ao Loca o vencimento que é data — inspeção de PTA, PMOC, teste de
carga, calibração — com histórico, laudo anexado, tela na peça e aviso no cron
que já existe.

**Arquitetura:** o TIPO declara o que exige (`certificados_exigidos` jsonb), a
PEÇA acumula certificados (`certificado_equipamento`), e a view
`certificado_pendencia` cruza os dois com `cross join lateral` — é o cruzamento
que torna visível a exigência que nunca foi cumprida.

**Tech Stack:** Postgres 17 (Supabase) + RLS, Next.js 16 App Router, React 19,
zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-certificados-equipamento-design.md`

## Global Constraints

- **PT-BR acentuado** em toda string visível. Nunca em identificador, chave de
  enum, `name=`/`id=`/`key=`, slug de rota ou `console`.
- **`createAdminClient()` nunca toca tabela da aplicação.** Exceção única:
  `src/app/api/cron/*`. Em `src/lib/data/` é sempre `createClient()`.
- **Toda view nasce com `security_invoker = on`.** Guarda:
  `src/lib/migrations-seguranca.test.ts`.
- **"Hoje" é `hojeISOSaoPaulo()`**, nunca `new Date()`, sempre que a data for
  comparada com coluna `date`.
- **Exclusão por `supabase.rpc("soft_delete", ...)`**, e `data !== true` é erro.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **Schemas zod moram em `src/lib/<dominio>.ts`**, não dentro de `actions.ts`.
- Ritual de fechamento: `npm run typecheck && npm run lint && npm test && npm run build`.
- Versionar nos três pontos: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`.

---

## FASE 1 — o dado existe

### Task 1: Migration `0081_certificado_equipamento.sql`

**Files:**
- Create: `supabase/migrations/0081_certificado_equipamento.sql`

**Interfaces:**
- Produz: coluna `tipo_equipamento.certificados_exigidos jsonb not null default '[]'`;
  tabela `public.certificado_equipamento`; view `public.certificado_pendencia`;
  bucket `certificados`; ramo `'certificado_equipamento'` em `public.soft_delete`.

- [ ] **Passo 1: a coluna no tipo**

```sql
alter table public.tipo_equipamento
  add column if not exists certificados_exigidos jsonb not null default '[]'::jsonb;
```

- [ ] **Passo 2: a tabela**

Colunas conforme a spec. Pontos que não podem escapar:
`vence_em date not null`; `check (emitido_em is null or vence_em >= emitido_em)`;
`especie` com `check` sobre as sete chaves; `deleted_at timestamptz`;
índice `(org_id, unidade_id, especie, vence_em desc) where deleted_at is null`;
trigger `set_updated_at` e trigger `registrar_auditoria`.
**Sem** `unique (unidade_id, especie)` — o acúmulo é o recurso.

- [ ] **Passo 3: RLS**

Espelha `reparo_equipamento`: `select` por `org_id = current_org_id() and
deleted_at is null`; `for all` com `pode_operar()` em `using` e `with check`.
O recorte é o da ORGANIZAÇÃO, não o da obra — a peça circula entre obras.

- [ ] **Passo 4: a view, com `security_invoker = on`**

O SQL está na spec, seção "A view `certificado_pendencia`". Copiar dali.

- [ ] **Passo 5: o bucket e as quatro políticas**

`insert into storage.buckets (id, name, public) values ('certificados','certificados',false)
on conflict do nothing;` + as quatro políticas no molde exato de `contratos`.

- [ ] **Passo 6: estender `public.soft_delete`**

Acrescentar o ramo `when 'certificado_equipamento' then` com `pode_operar()`,
seguindo o de `reparo_equipamento`. **Recriar a função inteira** — é `create or
replace` de um `case`, não dá para acrescentar um ramo isoladamente.

- [ ] **Passo 7: aplicar e conferir**

```bash
npx supabase db query -f supabase/migrations/0081_certificado_equipamento.sql --linked
npx supabase db query -f supabase/migrations/0081_certificado_equipamento.sql --linked   # idempotência
npx supabase migration repair --status applied 0081 --linked
```

Conferir na produção, **dentro de transação revertida**, que um usuário de outra
organização não enxerga linha alguma da view.

- [ ] **Passo 8: commit**

---

### Task 2: `src/lib/certificado.ts` + testes

**Files:**
- Create: `src/lib/certificado.ts`
- Create: `src/lib/certificado.test.ts`

**Interfaces:**
- Consome: `numeroOpcional`, `textoOpcional`, `uuidOpcional` de `@/lib/campos`;
  `ehDataISO` de `@/lib/locacao`.
- Produz:
  ```ts
  export const ESPECIES_CERTIFICADO = [...] as const;
  export type EspecieCertificado = (typeof ESPECIES_CERTIFICADO)[number];
  export const ESPECIE_INFO: Record<EspecieCertificado, { label: string; ajuda: string }>;
  export type EstadoCertificado = "ausente" | "vencido" | "proximo" | "em_dia";
  export function estadoCertificado(venceEm: string | null, hojeISO: string, diasAviso?: number): EstadoCertificado;
  export const ESTADO_CERTIFICADO_INFO: Record<EstadoCertificado, { label: string; variant: "destructive" | "secondary" | "outline" }>;
  export function venceEmProposto(emitidoEm: string, periodicidadeMeses: number | null): string | null;
  export const certificadoSchema;      // z.object
  export const exigenciaSchema;        // { especie, periodicidade_meses }
  export const exigenciasSchema;       // array, sem espécie repetida
  export const salvarExigenciasSchema; // { tipo_id, exigencias }
  ```

- [ ] **Passo 1: escrever o teste que falha**

```ts
describe("estadoCertificado", () => {
  it("ausente quando não há certificado nenhum", () => {
    expect(estadoCertificado(null, "2026-09-06")).toBe("ausente");
  });
  it("vencido no dia seguinte ao vencimento", () => {
    expect(estadoCertificado("2026-09-05", "2026-09-06")).toBe("vencido");
  });
  it("o dia do vencimento ainda vale", () => {
    expect(estadoCertificado("2026-09-06", "2026-09-06")).toBe("proximo");
  });
  it("próximo dentro da janela de aviso", () => {
    expect(estadoCertificado("2026-10-05", "2026-09-06", 30)).toBe("proximo");
  });
  it("em dia fora da janela", () => {
    expect(estadoCertificado("2026-10-07", "2026-09-06", 30)).toBe("em_dia");
  });
});

describe("venceEmProposto", () => {
  it("soma a periodicidade em meses", () => {
    expect(venceEmProposto("2026-03-10", 12)).toBe("2027-03-10");
  });
  it("31 de janeiro + 1 mês não vira 3 de março", () => {
    expect(venceEmProposto("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("sem periodicidade não propõe nada", () => {
    expect(venceEmProposto("2026-03-10", null)).toBeNull();
  });
});

describe("exigenciasSchema", () => {
  it("recusa a mesma espécie duas vezes", () => { /* … */ });
});
```

- [ ] **Passo 2: rodar e ver falhar** — `npx vitest run src/lib/certificado.test.ts`
- [ ] **Passo 3: implementar**

`estadoCertificado` compara **strings ISO**, não `Date` — comparação
lexicográfica de `yyyy-mm-dd` é a mesma que a cronológica, e não passa por fuso
nenhum. Só a janela de aviso precisa de aritmética de data.

`venceEmProposto` usa `addMonths` de `date-fns` (que satura o fim do mês
corretamente) sobre a data ISO decomposta, nunca sobre `new Date(iso)` — este
último interpreta como UTC e volta um dia atrás em São Paulo.

- [ ] **Passo 4: rodar e ver passar**
- [ ] **Passo 5: conferir a idempotência dos schemas** — `npx vitest run src/lib/schemas-varredura.test.ts`
- [ ] **Passo 6: commit**

---

### Task 3: `src/lib/data/certificados.ts`

**Files:**
- Create: `src/lib/data/certificados.ts`

**Interfaces:**
- Produz:
  ```ts
  export type PendenciaCertificado = {
    especie: EspecieCertificado; periodicidadeMeses: number | null;
    certificadoId: string | null; venceEm: string | null; estado: EstadoCertificado;
  };
  export type CertificadoDaPeca = {
    id: string; especie: EspecieCertificado; emitidoEm: string | null; venceEm: string;
    numero: string | null; responsavel: string | null; arquivoPath: string | null;
    observacoes: string | null;
  };
  export async function listarCertificadosDaPeca(unidadeId: string): Promise<CertificadoDaPeca[]>;
  export async function listarPendenciasDaPeca(unidadeId: string): Promise<PendenciaCertificado[]>;
  ```

- [ ] **Passo 1: escrever o módulo**

`import "server-only"` no topo. `createClient()`, nunca admin. Tipos de retorno
**planos** — nada de `T | T[] | null` do PostgREST. Erro em leitura de lista:
`console.error` e devolve vazio.

- [ ] **Passo 2: commit**

---

### Task 4: editor de exigências no tipo

**Files:**
- Create: `src/app/(app)/configuracoes/catalogo/exigencias-editor.tsx`
- Modify: `src/app/(app)/configuracoes/catalogo/actions.ts` (nova action `salvarExigenciasDoTipo`)
- Modify: `src/app/(app)/configuracoes/catalogo/catalogo-editor.tsx` (abrir o editor)
- Modify: `src/app/(app)/configuracoes/catalogo/page.tsx` (carregar `certificados_exigidos`)

- [ ] **Passo 1: a action**

Mesmo molde de `salvarCamposDoTipo`: valida com `salvarExigenciasSchema`,
devolve `ActionResult`, `revalidatePath`.

- [ ] **Passo 2: o componente**

Molde do `FichaEditor`: lista inteira salva de uma vez, botão de salvar só
quando há o que salvar. Cada linha: `NativeSelect` de espécie + `Input` numérico
de periodicidade em meses. Sem reordenar — a ordem de exigências não carrega
significado (a da ficha carrega, porque é a ordem de preenchimento).

- [ ] **Passo 3: ligar no `catalogo-editor.tsx`**
- [ ] **Passo 4: typecheck + lint + commit**

---

### Task 5: seção Certificados na peça

**Files:**
- Create: `src/app/(app)/frota/[id]/_components/peca-certificados.tsx`
- Create: `src/app/(app)/frota/[id]/certificado-actions.ts`
- Modify: `src/app/(app)/frota/[id]/page.tsx`

- [ ] **Passo 1: as actions**

`registrarCertificado` (upload opcional do PDF para `certificados`, depois
insert), `excluirCertificado` (`rpc("soft_delete", { p_entidade:
"certificado_equipamento", p_id })`, tratando `data !== true` como erro) e
`urlDoCertificado` (URL assinada, 600 s). Todas devolvem `ActionResult`.

**Se o insert falhar depois do upload, remover o objeto** — senão o bucket
acumula PDF órfão que ninguém encontra.

- [ ] **Passo 2: o componente**

Uma linha por exigência do tipo, com o certificado atual e o selo do estado.
`Ausente` em destaque. Botão **Renovar** pré-preenche a espécie e propõe
`venceEmProposto`. Histórico por espécie, com download por URL assinada.

- [ ] **Passo 3: a seção não aparece quando o tipo não exige nada**

Peça de tipo sem exigência: a seção some. Seção vazia em todo notebook do parque
ensina a ignorá-la.

- [ ] **Passo 4: ritual de fechamento, bump de versão, commit**

---

## FASE 2 — o aviso chega sem abrir a tela

### Task 6: as duas fontes no cron

**Files:**
- Modify: `src/app/api/cron/vencimentos/route.ts`

- [ ] **Passo 1: `certificado_vence`**

Consulta `certificado_pendencia` com `vence_em` entre hoje e `limite`. Candidato
no molde dos existentes: `tipo: "certificado_vence"`, `referencia_id` =
`certificado_id`, categoria `"Certificado — <rótulo da espécie>"`, descrição
`"<identificador> · <modelo>"`.

- [ ] **Passo 2: `certificado_ausente`**

`vence_em is null`. Sem data, então segue `imovel_sem_contrato`:
`data_referencia = format(agora, "yyyy-MM-01")`, `dias = 0`.
`referencia_id` = `unidade_id`, e **`tipo` inclui a espécie**
(`certificado_ausente:pmoc`) — duas exigências ausentes na mesma peça são dois
avisos, e uma chave só faria a segunda ser descartada pela dedupe.
`notificacao_log.tipo` é `text` sem `check`, então a chave composta cabe.

- [ ] **Passo 3: conferir o cron de ponta a ponta**

Chamar a rota com o `CRON_SECRET` em modo de teste e ler o resumo.

- [ ] **Passo 4: commit**

---

### Task 7: filtro e selo na lista da frota

**Files:**
- Modify: `src/app/(app)/frota/page.tsx`
- Modify: `src/lib/data/frota.ts`

- [ ] **Passo 1: `SelectFilter` `certificado`** com as quatro opções do estado.
- [ ] **Passo 2: selo na linha** quando houver pendência.
- [ ] **Passo 3: ritual de fechamento, bump de versão, commit**

---

## Self-review

- **Cobertura da spec:** tabela → Task 1; view → Task 1; estado → Task 2;
  leitura → Task 3; tela do tipo → Task 4; tela da peça → Task 5; alerta →
  Task 6; lista → Task 7. Bucket e `soft_delete` estão na Task 1.
- **Sem placeholders:** todo passo de código traz o código ou aponta a seção da
  spec que o traz.
- **Consistência de tipos:** `EspecieCertificado` e `EstadoCertificado` são
  definidos na Task 2 e usados com o mesmo nome nas Tasks 3, 4, 5, 6 e 7.
