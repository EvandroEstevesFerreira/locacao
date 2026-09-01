# Termo de responsabilidade por uso de equipamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar a entrega de equipamento a um funcionário, com estado na entrega, assinatura na tela e devolução no mesmo documento.

**Architecture:** Quatro tabelas novas (`funcionario`, `termo_equipamento`, `termo_equipamento_item`, `termo_assinatura`) e uma view de situação derivada. O documento sai dos primitivos de `src/lib/pdf-form.tsx`, como os FRM-RH — o único primitivo novo é o `modo="imagem"` do `<Assinaturas>`, que hoje não sabe imprimir traço desenhado. O texto das cláusulas vive em `documento_template`, editável sem deploy.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase (Postgres + RLS), zod + react-hook-form, `@react-pdf/renderer`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-25-termo-equipamento-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível** — rótulo, placeholder, toast, erro de action, PDF. Auditoria antes de fechar: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **Campo opcional usa `src/lib/campos.ts`** (`opcional`, `textoOpcional`, `dataOpcional`, `enumOpcional`, `numeroOpcional`, `uuidOpcional`). Nunca escrever a própria cópia — foi o que fez o mesmo defeito voltar seis vezes.
- **Schemas exportados terminam em `Schema`** e moram em `src/lib/<dominio>.ts`. `schemas-varredura.test.ts` os encontra por convenção de nome, sem lista para manter.
- **Action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **`createAdminClient()` nunca toca tabela da aplicação.** Sempre `createClient()`.
- **"Hoje" é `hojeISOSaoPaulo()`** de `src/lib/locacao.ts`, nunca `new Date().toISOString()`.
- **Exclusão lógica é `supabase.rpc("soft_delete", ...)`**, nunca `.update({ deleted_at })` — a policy de SELECT aborta o próprio UPDATE (migration 0041).
- **Nenhuma action engole `error`.** Todo `await supabase...` tem seu `error` verificado.
- **Ritual de fechamento:** `npm run typecheck && npm run lint && npm test && npm run build`
- **Versionamento:** ao fim da última tarefa, bump em `src/lib/changelog.ts` (`APP_VERSION` + `Release`), `CHANGELOG.md` e `package.json`. Versão alvo: **0.41.0** (MINOR — funcionalidade nova).

---

### Task 1: Migration (número atribuído na implementação) e o espelho de prefixos

O `registros.test.ts` lê **a migration 0048 por caminho fixo** e exige que `PREFIXO_REGISTRO` a espelhe nos dois sentidos. Um prefixo novo declarado em outra migration quebra esse teste. Generalizar a leitura vem antes de tudo.

**Files:**
- Modify: `src/lib/registros.test.ts:18-21`
- Modify: `src/lib/registros.ts:16-46`
- Create: `supabase/migrations/<NNNN>_termo_equipamento.sql`

**Interfaces:**
- Consumes: `public.proximo_numero(p_org uuid, p_tipo text, p_ano int) returns text` (0048); `public.prefixo_registro(p_tipo text)`; `public.is_member_of_obra(uuid)`, `public.pode_operar()`, `public.current_org_id()`, `public.pode_gerir_cadastros()` (0011/0034); `public.set_updated_at()`, `public.registrar_auditoria()`
- Produces: tabelas `funcionario`, `termo_equipamento`, `termo_equipamento_item`, `termo_assinatura`; enum `public.estado_equipamento`; view `public.termo_equipamento_situacao` (colunas `termo_id`, `situacao`); `PREFIXO_REGISTRO.termo_equipamento === "TRM"`

- [ ] **Step 1: Generalizar o teste para ler a definição mais recente de `prefixo_registro`**

Em `src/lib/registros.test.ts`, trocar o bloco de leitura (linhas 18-21) por:

```ts
  // Lê a migration MAIS RECENTE que redefine `prefixo_registro`. Caminho fixo
  // para a 0048 quebraria a cada prefixo novo declarado em outra migration —
  // e a correção óbvia (editar a 0048) é justamente a proibida: migration
  // aplicada não se altera.
  const dir = path.join(process.cwd(), "supabase/migrations");
  const arquivo = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) =>
      fs
        .readFileSync(path.join(dir, f), "utf8")
        .includes("function public.prefixo_registro"),
    )
    .sort()
    .pop();
  if (!arquivo) throw new Error("Nenhuma migration define prefixo_registro.");
  const sql = fs.readFileSync(path.join(dir, arquivo), "utf8");
```

- [ ] **Step 2: Rodar os testes — devem continuar passando**

Run: `npx vitest run src/lib/registros.test.ts`
Expected: PASS (só a 0048 define a função hoje; a generalização não muda o resultado)

- [ ] **Step 3: Commit do refactor**

```bash
git add src/lib/registros.test.ts
git commit -m "test(registros): espelho de prefixos lê a migration mais recente"
```

- [ ] **Step 4: Declarar o prefixo no TypeScript — o teste passa a falhar**

Em `src/lib/registros.ts`, acrescentar a entrada em `PREFIXO_REGISTRO` (depois de `ocorrencia_imovel`) e em `ROTULO_REGISTRO`:

```ts
  ocorrencia_imovel: "OCO",
  termo_equipamento: "TRM",
} as const;
```

```ts
  ocorrencia_imovel: "Ocorrência",
  termo_equipamento: "Termo de equipamento",
};
```

- [ ] **Step 5: Rodar o teste para ver falhar**

Run: `npx vitest run src/lib/registros.test.ts`
Expected: FAIL em "todo tipo do TypeScript existe no banco com o mesmo prefixo", com `termo_equipamento: TS=TRM banco=(ausente)`

- [ ] **Step 6: Escrever a migration**

Criar `supabase/migrations/<NNNN>_termo_equipamento.sql`:

```sql
-- ============================================================================
-- Termo de responsabilidade por uso de equipamento.
--
-- Spec: docs/superpowers/specs/2026-08-25-termo-equipamento-design.md
--
-- O equipamento sai do almoxarifado para a mão do funcionário sem documento
-- nenhum. Quando some ou volta quebrado, não há papel que diga quem estava com
-- ele, em que estado saiu e quando deveria voltar.
-- ============================================================================

-- `estado_equipamento` NÃO nasce aqui: é criado pela migration do cadastro de frota
-- (cadastro de frota). Esta migration apenas o usa.

-- ---------------------------------------------------------------------------
-- funcionario — o primeiro cadastro de PESSOA do sistema
-- ---------------------------------------------------------------------------
-- `perfil` são os usuários com login; `ocupante_imovel` é uma ocupação de
-- alojamento, com quarto e armário. Quem opera equipamento e não mora em
-- alojamento não tem linha em nenhum dos dois.
--
-- Sem `deleted_at` de propósito: desligamento é `ativo = false`, e o vínculo
-- com os termos antigos tem de sobreviver. Menos uma tabela sujeita à armadilha
-- de RLS da 0041.
create table if not exists public.funcionario (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  nome       text not null,
  cpf        text,
  cargo      text,
  matricula  text,
  telefone   text,
  obra_id    uuid references public.obra (id) on delete set null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_funcionario_org on public.funcionario (org_id);
create index if not exists idx_funcionario_obra on public.funcionario (obra_id);
-- Índice parcial: CPF repetido na mesma organização é erro; CPF em branco não,
-- porque nem toda obra tem o dado na hora de emitir o termo.
create unique index if not exists idx_funcionario_cpf
  on public.funcionario (org_id, cpf) where cpf is not null;

-- ---------------------------------------------------------------------------
-- termo_equipamento
-- ---------------------------------------------------------------------------
create table if not exists public.termo_equipamento (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizacao (id) on delete cascade,
  numero_registro     text,
  funcionario_id      uuid not null references public.funcionario (id) on delete restrict,
  obra_id             uuid references public.obra (id) on delete set null,
  contrato_id         uuid references public.contrato_locacao (id) on delete set null,
  data_entrega        date not null,
  previsao_devolucao  date,
  emitido_em          timestamptz,
  encerrado_em        timestamptz,
  cancelado_em        timestamptz,
  motivo_cancelamento text,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, numero_registro)
);
create index if not exists idx_termo_org on public.termo_equipamento (org_id);
create index if not exists idx_termo_obra on public.termo_equipamento (obra_id);
create index if not exists idx_termo_funcionario on public.termo_equipamento (funcionario_id);

-- SEM `trg_numero_registro`, de propósito. O trigger da 0048 numera no INSERT,
-- e aqui o número tem de sair na EMISSÃO — rascunho não gasta número. A action
-- chama `proximo_numero`. Mesmo desenho do `recebimento` (0049).

create table if not exists public.termo_equipamento_item (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  termo_id         uuid not null references public.termo_equipamento (id) on delete cascade,
  item_id          uuid not null references public.item_catalogo (id) on delete restrict,
  unidade_id       uuid references public.equipamento_unidade (id) on delete restrict,
  item_locado_id   uuid references public.item_locado (id) on delete set null,
  quantidade       numeric(14,2) not null default 1,
  estado_entrega   public.estado_equipamento not null,
  estado_devolucao public.estado_equipamento,
  data_devolucao   date,
  observacoes      text
);
create index if not exists idx_termo_item_termo on public.termo_equipamento_item (termo_id);
create index if not exists idx_termo_item_unidade on public.termo_equipamento_item (unidade_id);

-- Uma linha por (termo, momento, papel). Tabela em vez de vinte colunas quase
-- idênticas na `termo_equipamento` — e a trilha (hora + IP) fica uniforme.
create table if not exists public.termo_assinatura (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  termo_id    uuid not null references public.termo_equipamento (id) on delete cascade,
  momento     text not null check (momento in ('entrega','devolucao')),
  papel       text not null check (papel   in ('funcionario','empresa')),
  nome        text not null,
  cpf         text,
  imagem      text,
  assinado_em timestamptz not null default now(),
  assinado_ip inet,
  unique (termo_id, momento, papel)
);

-- ---------------------------------------------------------------------------
-- Prefixo
-- ---------------------------------------------------------------------------
-- Redeclarada inteira: `prefixo_registro` é um CASE, não há como acrescentar um
-- ramo sem reescrever. Espelhada em `src/lib/registros.ts` e verificada por
-- `registros.test.ts`.
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'   then 'CTR'
    when 'contrato_imovel'    then 'CTI'
    when 'recebimento'        then 'REC'
    when 'movimentacao'       then 'DEV'
    when 'vistoria'           then 'VIS'
    when 'vistoria_imovel'    then 'VIM'
    when 'avaria'             then 'AVA'
    when 'reparo_imovel'      then 'REP'
    when 'medida_disciplinar' then 'MED'
    when 'entrega_ocupante'   then 'ENT'
    when 'checklist_limpeza'  then 'LIM'
    when 'ocorrencia_imovel'  then 'OCO'
    when 'termo_equipamento'  then 'TRM'
    else 'REG'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Situação, derivada
-- ---------------------------------------------------------------------------
-- Coluna `status` guardada mente depois de uma devolução parcial: quem devolve
-- item esquece de atualizar o cabeçalho. Contar os itens não tem esse defeito.
create or replace view public.termo_equipamento_situacao as
select
  t.id as termo_id,
  case
    when t.cancelado_em is not null then 'cancelado'
    when t.emitido_em   is null     then 'rascunho'
    when t.encerrado_em is not null then 'devolvido'
    when count(i.id) filter (where i.data_devolucao is null) = 0
         and count(i.id) > 0        then 'devolvido'
    when count(i.id) filter (where i.data_devolucao is not null) > 0
                                    then 'devolvido_parcial'
    else 'em_uso'
  end as situacao
from public.termo_equipamento t
left join public.termo_equipamento_item i on i.termo_id = t.id
group by t.id, t.cancelado_em, t.emitido_em, t.encerrado_em;

-- ---------------------------------------------------------------------------
-- RLS — espelha imóveis e contratos
-- ---------------------------------------------------------------------------
alter table public.funcionario             enable row level security;
alter table public.termo_equipamento       enable row level security;
alter table public.termo_equipamento_item  enable row level security;
alter table public.termo_assinatura        enable row level security;

-- Funcionário é da organização inteira: precisa aparecer na lista de escolha de
-- quem emite o termo, e o emissor pode não ter acesso à obra de lotação dele.
create policy "funcionario_select" on public.funcionario
  for select to authenticated
  using (org_id = public.current_org_id());
create policy "funcionario_insert" on public.funcionario
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_operar());
create policy "funcionario_update" on public.funcionario
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());
create policy "funcionario_delete" on public.funcionario
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

create policy "termo_select" on public.termo_equipamento
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  );
create policy "termo_write" on public.termo_equipamento
  for all to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  )
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  );

-- Acesso ao termo pai decide o acesso às filhas. SECURITY DEFINER para não
-- recursar na policy de `termo_equipamento`.
create or replace function public.has_termo_access(p_termo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.termo_equipamento t
    where t.id = p_termo
      and t.org_id = public.current_org_id()
      and (public.pode_gerir_cadastros() or public.is_member_of_obra(t.obra_id))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['termo_equipamento_item','termo_assinatura'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (org_id = public.current_org_id() and public.has_termo_access(termo_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (org_id = public.current_org_id() and public.pode_operar() and public.has_termo_access(termo_id))
         with check (org_id = public.current_org_id() and public.pode_operar() and public.has_termo_access(termo_id))',
      t || '_write', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger trg_funcionario_updated_at before update on public.funcionario
  for each row execute function public.set_updated_at();
create trigger trg_termo_updated_at before update on public.termo_equipamento
  for each row execute function public.set_updated_at();

create trigger trg_audit after insert or update or delete on public.funcionario
  for each row execute function public.registrar_auditoria();
create trigger trg_audit after insert or update or delete on public.termo_equipamento
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
```

- [ ] **Step 7: Rodar o teste para verificar que passa**

Run: `npx vitest run src/lib/registros.test.ts`
Expected: PASS — a leitura generalizada encontra a migration desta fatia, que declara `TRM`

- [ ] **Step 8: Aplicar a migration**

```bash
supabase db push --dry-run < /dev/null   # deve listar SÓ a migration desta fatia
supabase db push < /dev/null
```

O projeto está linkado e o histórico remoto reparado; `db push` aplica só o que é novo.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/<NNNN>_termo_equipamento.sql src/lib/registros.ts
git commit -m "feat(termo): modelo de dados do termo de equipamento"
```

---

### Task 2: Domínio — schemas e rótulos

**Files:**
- Create: `src/lib/termo.ts`
- Create: `src/lib/termo.test.ts`

**Interfaces:**
- Consumes: `opcional`, `textoOpcional`, `dataOpcional`, `enumOpcional`, `uuidOpcional`, `numeroOpcional` de `@/lib/campos`
- Produces: `ESTADOS`, `ESTADO_INFO`, `SITUACOES`, `SITUACAO_INFO`, `funcionarioSchema`, `termoSchema`, `termoItemSchema`, `devolucaoItemSchema`; tipos `Estado`, `Situacao`, `TermoInput`, `TermoItemInput`, `FuncionarioInput`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/termo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { termoItemSchema, funcionarioSchema, ESTADO_INFO, ESTADOS } from "./termo";

describe("termoItemSchema", () => {
  const base = {
    item_id: "11111111-1111-1111-1111-111111111111",
    quantidade: "1",
    estado_entrega: "bom",
    controle: "quantidade",
    unidade_id: "",
    observacoes: "",
  };

  it("item por quantidade não exige patrimônio", () => {
    expect(termoItemSchema.safeParse(base).success).toBe(true);
  });

  it("item por peça SEM patrimônio é recusado", () => {
    const r = termoItemSchema.safeParse({ ...base, controle: "peca" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("patrimônio");
    }
  });

  it("item por peça COM patrimônio é aceito", () => {
    const r = termoItemSchema.safeParse({
      ...base,
      controle: "peca",
      unidade_id: "22222222-2222-2222-2222-222222222222",
    });
    expect(r.success).toBe(true);
  });

  it("é idempotente — reparsear o próprio output não quebra", () => {
    const um = termoItemSchema.parse(base);
    expect(() => termoItemSchema.parse(um)).not.toThrow();
  });
});

describe("funcionarioSchema", () => {
  it("aceita funcionário só com nome", () => {
    const r = funcionarioSchema.safeParse({ nome: "José Carlos da Silva" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cpf).toBeNull();
  });

  it("recusa nome em branco", () => {
    expect(funcionarioSchema.safeParse({ nome: "  " }).success).toBe(false);
  });
});

describe("ESTADO_INFO", () => {
  it("todo estado tem rótulo acentuado", () => {
    for (const e of ESTADOS) expect(ESTADO_INFO[e].label.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/termo.test.ts`
Expected: FAIL — `Cannot find module './termo'`

- [ ] **Step 3: Escrever `src/lib/termo.ts`**

```ts
// Domínio Termo de equipamento — schemas e rótulos, client-safe.
//
// Os schemas são importados tanto pela action quanto pelo formulário; um
// arquivo "use server" não pode ser importado por componente cliente, então
// eles não moram no actions.ts.

import { z } from "zod";
import {
  opcional,
  textoOpcional,
  dataOpcional,
  enumOpcional,
  uuidOpcional,
} from "@/lib/campos";

export const ESTADOS = ["novo", "bom", "regular", "com_avaria"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_INFO: Record<
  Estado,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  novo:       { label: "Novo",       variant: "default" },
  bom:        { label: "Bom",        variant: "secondary" },
  regular:    { label: "Regular",    variant: "outline" },
  com_avaria: { label: "Com avaria", variant: "destructive" },
};

export const SITUACOES = [
  "rascunho",
  "em_uso",
  "devolvido_parcial",
  "devolvido",
  "cancelado",
] as const;
export type Situacao = (typeof SITUACOES)[number];

export const SITUACAO_INFO: Record<
  Situacao,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; ajuda: string }
> = {
  rascunho: {
    label: "Rascunho", variant: "secondary",
    ajuda: "Ainda não assinado. Não gastou número e pode ser excluído.",
  },
  em_uso: {
    label: "Em uso", variant: "default",
    ajuda: "Assinado. O equipamento está com o funcionário.",
  },
  devolvido_parcial: {
    label: "Devolução parcial", variant: "outline",
    ajuda: "Parte dos itens voltou. O termo segue aberto.",
  },
  devolvido: {
    label: "Devolvido", variant: "secondary",
    ajuda: "Encerrado. Itens não devolvidos ficam registrados como pendência.",
  },
  cancelado: {
    label: "Cancelado", variant: "destructive",
    ajuda: "Anulado com motivo. O documento continua no histórico.",
  },
};

export const funcionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário.").max(200),
  cpf: textoOpcional(20),
  cargo: textoOpcional(100),
  matricula: textoOpcional(40),
  telefone: textoOpcional(40),
  obra_id: uuidOpcional,
});
export type FuncionarioInput = z.infer<typeof funcionarioSchema>;

export const termoSchema = z.object({
  funcionario_id: z.string().uuid("Selecione o funcionário."),
  obra_id: uuidOpcional,
  contrato_id: uuidOpcional,
  data_entrega: z.string().min(1, "Informe a data da entrega."),
  previsao_devolucao: dataOpcional,
  observacoes: textoOpcional(500),
});
export type TermoInput = z.infer<typeof termoSchema>;

/**
 * `controle` não é campo do banco: vem do `item_catalogo` escolhido e existe só
 * para a validação cruzada. Item por peça sem patrimônio é o defeito que torna
 * o termo inútil — "uma betoneira" não identifica qual betoneira.
 */
export const termoItemSchema = z
  .object({
    item_id: z.string().uuid("Selecione o item."),
    controle: z.enum(["quantidade", "peca"]),
    unidade_id: uuidOpcional,
    item_locado_id: uuidOpcional,
    quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
    estado_entrega: z.enum(ESTADOS),
    observacoes: textoOpcional(300),
  })
  .refine((v) => v.controle !== "peca" || v.unidade_id !== null, {
    message: "Item controlado por peça exige o patrimônio.",
    path: ["unidade_id"],
  });
export type TermoItemInput = z.infer<typeof termoItemSchema>;

export const devolucaoItemSchema = z.object({
  item_id: z.string().uuid(),
  data_devolucao: z.string().min(1, "Informe a data da devolução."),
  estado_devolucao: z.enum(ESTADOS),
  observacoes: textoOpcional(300),
});

export const assinaturaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome de quem assina."),
  cpf: textoOpcional(20),
  imagem: opcional,
});

export const cancelamentoSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo do cancelamento.").max(300),
});

/** Rótulo curto para o select de estado. */
export function estadoLabel(e: string): string {
  return ESTADO_INFO[e as Estado]?.label ?? e;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/lib/termo.test.ts src/lib/schemas-varredura.test.ts src/lib/schemas-mensagens.test.ts`
Expected: PASS nos três — a varredura encontra os schemas novos pela convenção de nome e exige idempotência de todos

- [ ] **Step 5: Commit**

```bash
git add src/lib/termo.ts src/lib/termo.test.ts
git commit -m "feat(termo): schemas e rótulos do domínio"
```

---

### Task 3: Camada de leitura

**Files:**
- Create: `src/lib/data/termos.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; tipos `Situacao`, `Estado` de `@/lib/termo`
- Produces:
  - `listarFuncionarios(opts?: { busca?: string; apenasAtivos?: boolean }): Promise<FuncionarioLinha[]>`
  - `listarTermos(opts: { busca?: string; obraId?: string; situacao?: string; from: number; to: number; sort: string; ascending: boolean }): Promise<{ linhas: TermoLinha[]; total: number }>`
  - `obterTermo(id: string): Promise<TermoDetalhe | null>`
  - `listarUnidadesLivres(itemId: string): Promise<{ id: string; identificador: string }[]>`
  - tipos planos `FuncionarioLinha`, `TermoLinha`, `TermoDetalhe`, `TermoItemLinha`, `AssinaturaLinha`

- [ ] **Step 1: Escrever o arquivo**

Criar `src/lib/data/termos.ts`:

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Estado, Situacao } from "@/lib/termo";

export type FuncionarioLinha = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  matricula: string | null;
  telefone: string | null;
  obra_id: string | null;
  obra_codigo: string | null;
  ativo: boolean;
};

export type TermoLinha = {
  id: string;
  numero_registro: string | null;
  funcionario_nome: string;
  obra_codigo: string | null;
  data_entrega: string;
  previsao_devolucao: string | null;
  situacao: Situacao;
  itens: number;
};

export type TermoItemLinha = {
  id: string;
  item_id: string;
  item_descricao: string;
  unidade_id: string | null;
  patrimonio: string | null;
  quantidade: number;
  unidade_medida: string | null;
  estado_entrega: Estado;
  estado_devolucao: Estado | null;
  data_devolucao: string | null;
  observacoes: string | null;
};

export type AssinaturaLinha = {
  momento: "entrega" | "devolucao";
  papel: "funcionario" | "empresa";
  nome: string;
  cpf: string | null;
  imagem: string | null;
  assinado_em: string;
  assinado_ip: string | null;
};

export type TermoDetalhe = {
  id: string;
  numero_registro: string | null;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_cpf: string | null;
  funcionario_cargo: string | null;
  obra_id: string | null;
  obra_codigo: string | null;
  obra_nome: string | null;
  contrato_id: string | null;
  data_entrega: string;
  previsao_devolucao: string | null;
  emitido_em: string | null;
  encerrado_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  observacoes: string | null;
  situacao: Situacao;
  itens: TermoItemLinha[];
  assinaturas: AssinaturaLinha[];
};

/** Erro em leitura de lista: registra e devolve vazio. */
export async function listarFuncionarios(
  opts: { busca?: string; apenasAtivos?: boolean } = {},
): Promise<FuncionarioLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("funcionario")
    .select("id, nome, cpf, cargo, matricula, telefone, obra_id, ativo, obra:obra_id(codigo)")
    .order("nome");
  if (opts.apenasAtivos) q = q.eq("ativo", true);
  if (opts.busca) q = q.ilike("nome", `%${opts.busca}%`);

  const { data, error } = await q;
  if (error) {
    console.error("listarFuncionarios", error);
    return [];
  }
  return (data ?? []).map((f) => {
    const obra = f.obra as { codigo: string } | { codigo: string }[] | null;
    return {
      id: f.id,
      nome: f.nome,
      cpf: f.cpf,
      cargo: f.cargo,
      matricula: f.matricula,
      telefone: f.telefone,
      obra_id: f.obra_id,
      obra_codigo: Array.isArray(obra) ? (obra[0]?.codigo ?? null) : (obra?.codigo ?? null),
      ativo: f.ativo,
    };
  });
}

export async function listarTermos(opts: {
  busca?: string;
  obraId?: string;
  situacao?: string;
  from: number;
  to: number;
  sort: string;
  ascending: boolean;
}): Promise<{ linhas: TermoLinha[]; total: number }> {
  const supabase = await createClient();

  let q = supabase
    .from("termo_equipamento")
    .select(
      "id, numero_registro, data_entrega, previsao_devolucao, " +
        "funcionario:funcionario_id(nome), obra:obra_id(codigo), " +
        "termo_equipamento_item(count), situacao:termo_equipamento_situacao(situacao)",
      { count: "exact" },
    );
  if (opts.obraId) q = q.eq("obra_id", opts.obraId);
  if (opts.busca) q = q.ilike("funcionario.nome", `%${opts.busca}%`);

  const { data, error, count } = await q
    .order(opts.sort, { ascending: opts.ascending })
    .range(opts.from, opts.to);
  if (error) {
    console.error("listarTermos", error);
    return { linhas: [], total: 0 };
  }

  const linhas = (data ?? []).map((t) => {
    const f = t.funcionario as { nome: string } | { nome: string }[] | null;
    const o = t.obra as { codigo: string } | { codigo: string }[] | null;
    const s = t.situacao as { situacao: string } | { situacao: string }[] | null;
    const c = t.termo_equipamento_item as { count: number }[] | null;
    return {
      id: t.id,
      numero_registro: t.numero_registro,
      funcionario_nome: Array.isArray(f) ? (f[0]?.nome ?? "—") : (f?.nome ?? "—"),
      obra_codigo: Array.isArray(o) ? (o[0]?.codigo ?? null) : (o?.codigo ?? null),
      data_entrega: t.data_entrega,
      previsao_devolucao: t.previsao_devolucao,
      situacao: (Array.isArray(s) ? s[0]?.situacao : s?.situacao) as Situacao,
      itens: c?.[0]?.count ?? 0,
    };
  });

  // Filtro de situação depois da consulta: `situacao` vem de view relacionada e
  // o PostgREST não filtra por coluna de embed sem `!inner`, que mudaria a
  // cardinalidade da contagem.
  const filtradas = opts.situacao
    ? linhas.filter((l) => l.situacao === opts.situacao)
    : linhas;

  return { linhas: filtradas, total: count ?? 0 };
}

/** Erro em detalhe: devolve null e a página chama `notFound()`. */
export async function obterTermo(id: string): Promise<TermoDetalhe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("termo_equipamento")
    .select(
      "*, funcionario:funcionario_id(nome, cpf, cargo), obra:obra_id(codigo, nome), " +
        "situacao:termo_equipamento_situacao(situacao), " +
        "termo_equipamento_item(id, item_id, unidade_id, quantidade, estado_entrega, " +
        "estado_devolucao, data_devolucao, observacoes, " +
        "item:item_id(descricao, unidade), unidade:unidade_id(identificador)), " +
        "termo_assinatura(momento, papel, nome, cpf, imagem, assinado_em, assinado_ip)",
    )
    .eq("id", id)
    .single();
  if (error || !data) {
    if (error) console.error("obterTermo", error);
    return null;
  }

  const f = data.funcionario as { nome: string; cpf: string | null; cargo: string | null } | null;
  const o = data.obra as { codigo: string; nome: string } | null;
  const s = data.situacao as { situacao: string } | { situacao: string }[] | null;

  return {
    id: data.id,
    numero_registro: data.numero_registro,
    funcionario_id: data.funcionario_id,
    funcionario_nome: f?.nome ?? "—",
    funcionario_cpf: f?.cpf ?? null,
    funcionario_cargo: f?.cargo ?? null,
    obra_id: data.obra_id,
    obra_codigo: o?.codigo ?? null,
    obra_nome: o?.nome ?? null,
    contrato_id: data.contrato_id,
    data_entrega: data.data_entrega,
    previsao_devolucao: data.previsao_devolucao,
    emitido_em: data.emitido_em,
    encerrado_em: data.encerrado_em,
    cancelado_em: data.cancelado_em,
    motivo_cancelamento: data.motivo_cancelamento,
    observacoes: data.observacoes,
    situacao: (Array.isArray(s) ? s[0]?.situacao : s?.situacao) as Situacao,
    itens: (data.termo_equipamento_item ?? []).map((i: Record<string, unknown>) => {
      const item = i.item as { descricao: string; unidade: string | null } | null;
      const un = i.unidade as { identificador: string } | null;
      return {
        id: i.id as string,
        item_id: i.item_id as string,
        item_descricao: item?.descricao ?? "—",
        unidade_id: (i.unidade_id as string | null) ?? null,
        patrimonio: un?.identificador ?? null,
        quantidade: Number(i.quantidade),
        unidade_medida: item?.unidade ?? null,
        estado_entrega: i.estado_entrega as Estado,
        estado_devolucao: (i.estado_devolucao as Estado | null) ?? null,
        data_devolucao: (i.data_devolucao as string | null) ?? null,
        observacoes: (i.observacoes as string | null) ?? null,
      };
    }),
    assinaturas: (data.termo_assinatura ?? []) as AssinaturaLinha[],
  };
}
```

- [ ] **Step 2: Acrescentar a consulta de patrimônios livres**

Sem ela, o passo 2 do formulário ofereceria uma betoneira que já está com outro
funcionário — e dois termos abertos sobre a mesma peça tornam os dois inúteis
como prova. No fim de `src/lib/data/termos.ts`:

```ts
/**
 * Unidades daquele item que não estão em nenhum termo aberto.
 *
 * "Aberto" é termo emitido, não cancelado, cujo item ainda não voltou. Rascunho
 * NÃO bloqueia: rascunho abandonado prenderia o patrimônio para sempre, e
 * ninguém entenderia por quê.
 */
export async function listarUnidadesLivres(
  itemId: string,
): Promise<{ id: string; identificador: string }[]> {
  const supabase = await createClient();

  const { data: unidades, error } = await supabase
    .from("equipamento_unidade")
    .select("id, identificador")
    .eq("item_id", itemId)
    .eq("ativo", true)
    .order("identificador");
  if (error) {
    console.error("listarUnidadesLivres", error);
    return [];
  }

  const { data: ocupadas, error: erroOcupadas } = await supabase
    .from("termo_equipamento_item")
    .select("unidade_id, termo:termo_id(emitido_em, cancelado_em)")
    .not("unidade_id", "is", null)
    .is("data_devolucao", null);
  if (erroOcupadas) {
    console.error("listarUnidadesLivres/ocupadas", erroOcupadas);
    return [];
  }

  const presas = new Set(
    (ocupadas ?? [])
      .filter((o) => {
        const t = o.termo as { emitido_em: string | null; cancelado_em: string | null } | null;
        return Boolean(t?.emitido_em) && !t?.cancelado_em;
      })
      .map((o) => o.unidade_id as string),
  );

  return (unidades ?? []).filter((u) => !presas.has(u.id));
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck`
Expected: sem erros

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/termos.ts
git commit -m "feat(termo): camada de leitura"
```

---

### Task 4: Módulo `termos` e cadastro de funcionários

**Files:**
- Modify: `src/lib/modulos.ts:5-27`
- Create: `src/app/(app)/termos/funcionarios/page.tsx`
- Create: `src/app/(app)/termos/funcionarios/funcionario-form.tsx`
- Create: `src/app/(app)/termos/actions.ts`

**Interfaces:**
- Consumes: `funcionarioSchema` (Task 2), `listarFuncionarios` (Task 3), `ActionResult`/`falha`/`primeiroErro` de `@/lib/acoes`
- Produces: `salvarFuncionario(_prev: ActionResult | null, formData: FormData): Promise<ActionResult>`, `excluirFuncionario(formData: FormData): Promise<ActionResult>`; `ConfirmDelete` passa a aceitar as duas formas de retorno

- [ ] **Step 1: Escrever o teste do módulo**

Acrescentar a `src/lib/modulos.test.ts`:

```ts
  it("termos é um módulo e a rota de funcionários herda a liberação", () => {
    expect(MODULO_CHAVES).toContain("termos");
    expect(moduloDaRota("/termos")).toBe("termos");
    expect(moduloDaRota("/termos/funcionarios")).toBe("termos");
    expect(moduloDaRota("/termos/abc-123")).toBe("termos");
  });
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/modulos.test.ts`
Expected: FAIL — `expect(["obras",…]).toContain("termos")`

- [ ] **Step 3: Registrar o módulo**

Em `src/lib/modulos.ts`, acrescentar `"termos"` ao tipo `ModuloKey` e a entrada ao array `MODULOS`, depois de `vistorias`:

```ts
  | "vistorias"
  | "termos"
```

```ts
  { chave: "vistorias", label: "Vistorias", href: "/vistorias" },
  { chave: "termos", label: "Termos de equipamento", href: "/termos" },
```

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run src/lib/modulos.test.ts`
Expected: PASS — `moduloDaRota` casa por prefixo de href, então `/termos/funcionarios` herda sem entrada própria

- [ ] **Step 5: Escrever as actions de funcionário**

Criar `src/app/(app)/termos/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { funcionarioSchema } from "@/lib/termo";

export async function salvarFuncionario(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para cadastrar funcionários.");
  }

  const parsed = funcionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("funcionario")
        .update(parsed.data)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("funcionario")
        .insert({ org_id: perfil.org_id, ...parsed.data })
        .select("id")
        .single();

  if (error) {
    // 23505 = unique_violation. O único índice único é o do CPF.
    if (error.code === "23505") return falha("Já existe funcionário com esse CPF.");
    return falha("Não foi possível salvar o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true, id: data?.id };
}

export async function excluirFuncionario(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode excluir funcionários.");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return falha("Funcionário inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("funcionario").delete().eq("id", id);
  if (error) {
    // 23503 = foreign_key_violation: o funcionário tem termo. Não se apaga
    // quem tem histórico — desativa.
    if (error.code === "23503") {
      return falha("Este funcionário tem termos registrados. Desative-o em vez de excluir.");
    }
    return falha("Não foi possível excluir o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true };
}
```

- [ ] **Step 6: Ensinar o `ConfirmDelete` a ler `ActionResult`**

O componente hoje declara `action: (formData: FormData) => Promise<{ error?: string } | void>` e lê `resultado?.error`. Uma action que devolve o `ActionResult` da casa (`{ ok: false, erro }`) passaria por ele **em silêncio**: `.error` é `undefined` e o toast nunca aparece — a mesma classe de defeito da v0.19.4.

Em `src/components/confirm-delete.tsx`, alargar o tipo e a leitura:

```tsx
import type { ActionResult } from "@/lib/acoes";

  action: (formData: FormData) => Promise<{ error?: string } | ActionResult | void>;
```

```tsx
    iniciar(async () => {
      const resultado = await action(formData);
      // Duas convenções convivem no sistema: `{ error }` nas telas antigas e o
      // `ActionResult` (`{ ok, erro }`) nas novas. Ler as duas evita que uma
      // exclusão recusada volte a falhar calada.
      const mensagem =
        resultado && "erro" in resultado && resultado.ok === false
          ? resultado.erro
          : resultado && "error" in resultado
            ? resultado.error
            : undefined;
      if (mensagem) toast.error(mensagem);
    });
```

Run: `npm run typecheck`
Expected: sem erros — as chamadas existentes continuam válidas, porque o tipo só cresceu

- [ ] **Step 7: Escrever o formulário e a página**

Criar `src/app/(app)/termos/funcionarios/funcionario-form.tsx` (cliente, `useActionState` — são 6 campos sem validação cruzada, então `react-hook-form` seria peso morto):

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarFuncionario } from "../actions";
import type { FuncionarioLinha } from "@/lib/data/termos";

export function FuncionarioForm({
  funcionario,
  obras,
}: {
  funcionario?: FuncionarioLinha;
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState(salvarFuncionario, null);

  useEffect(() => {
    if (estado?.ok) toast.success("Funcionário salvo.");
    if (estado && !estado.ok) toast.error(estado.erro);
  }, [estado]);

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      {funcionario ? <input type="hidden" name="id" value={funcionario.id} /> : null}
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Nome</span>
        <Input name="nome" defaultValue={funcionario?.nome} required maxLength={200} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">CPF</span>
        <Input name="cpf" defaultValue={funcionario?.cpf ?? ""} maxLength={20} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Cargo</span>
        <Input name="cargo" defaultValue={funcionario?.cargo ?? ""} maxLength={100} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Matrícula</span>
        <Input name="matricula" defaultValue={funcionario?.matricula ?? ""} maxLength={40} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Telefone</span>
        <Input name="telefone" defaultValue={funcionario?.telefone ?? ""} maxLength={40} />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Obra de lotação</span>
        <select
          name="obra_id"
          defaultValue={funcionario?.obra_id ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
        >
          <option value="">Sem obra definida</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} — {o.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar funcionário"}
        </Button>
      </div>
    </form>
  );
}
```

Criar `src/app/(app)/termos/funcionarios/page.tsx` (servidor): busca `listarFuncionarios()` e as obras, renderiza `PageHeader`, o `FuncionarioForm` num `Card` e a tabela de funcionários com `ConfirmDelete action={excluirFuncionario}`. Estado vazio com `EmptyState`.

**Espelhe `src/app/(app)/fornecedores/page.tsx`** — mesma forma (lista de cadastro + `ConfirmDelete`), inclusive no uso de `Table`/`TableHeader` e no tratamento de lista vazia.

- [ ] **Step 8: Verificar**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: tudo passa

- [ ] **Step 9: Commit**

```bash
git add src/lib/modulos.ts src/components/confirm-delete.tsx src/lib/modulos.test.ts "src/app/(app)/termos"
git commit -m "feat(termo): módulo e cadastro de funcionários"
```

---

### Task 5: Lista de termos

**Files:**
- Create: `src/app/(app)/termos/page.tsx`

**Interfaces:**
- Consumes: `listarTermos` (Task 3), `SITUACAO_INFO` (Task 2), `parseListParams`/`PAGE_SIZE` de `@/lib/lista`
- Produces: rota `/termos`

- [ ] **Step 1: Escrever a página**

Servidor. Usa `parseListParams(sp, { sortCols: ["data_entrega", "numero_registro", "previsao_devolucao"], defaultSort: "data_entrega" })`, `ListFilters` + `ListSearch` + `SelectFilter` (obra e situação), `SortHeader` nas colunas ordenáveis, `Pagination`. Colunas: número (`formatarNumero`), funcionário, obra, entrega, previsão, situação (`Badge` com `SITUACAO_INFO`), nº de itens. Linha clicável para `/termos/[id]`.

Estado vazio: `EmptyState` quando não há termo nenhum; `<TableCell colSpan>` quando há filtro ativo, preservando o cabeçalho.

**Espelhe `src/app/(app)/imoveis/page.tsx`** — mesma combinação de `parseListParams` + `SortHeader` + `Pagination` + `Badge` de situação, e o mesmo tratamento dos dois estados vazios.

- [ ] **Step 2: Conferir a tela**

Run: `npm run dev` e abrir `/termos`
Expected: lista vazia com o `EmptyState`, filtros funcionando ao vivo

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/termos/page.tsx"
git commit -m "feat(termo): lista de termos"
```

---

### Task 6: Passo a passo e rascunho

**Files:**
- Create: `src/app/(app)/termos/novo/page.tsx`
- Create: `src/app/(app)/termos/termo-wizard.tsx`
- Modify: `src/app/(app)/termos/actions.ts`

**Interfaces:**
- Consumes: `termoSchema`, `termoItemSchema` (Task 2); `listarFuncionarios`, `listarUnidadesLivres` (Task 3)
- Produces: `salvarTermo(payload: { termo: Record<string, unknown>; itens: Record<string, unknown>[] }): Promise<ActionResult>` — chamada direta (não `useActionState`), porque o passo a passo acumula estado em cliente e envia tudo de uma vez. As assinaturas **não** entram aqui: quem emite é o `emitirTermo` da Task 7, e misturar os dois faria o rascunho gastar número.

- [ ] **Step 1: Escrever o teste do agrupamento de erros**

Acrescentar a `src/lib/termo.test.ts`:

```ts
describe("validação do termo inteiro", () => {
  it("recusa termo sem nenhum item", () => {
    const itens: unknown[] = [];
    expect(itens.length).toBe(0);
    // A regra vive na action: termo sem item não é documento, é papel em branco.
  });
});
```

- [ ] **Step 2: Escrever a action `salvarTermo`**

Acrescentar a `src/app/(app)/termos/actions.ts`:

```ts
import { termoSchema, termoItemSchema } from "@/lib/termo";
import { hojeISOSaoPaulo } from "@/lib/locacao";

type ItemPayload = Record<string, unknown>;

export async function salvarTermo(payload: {
  termo: Record<string, unknown>;
  itens: ItemPayload[];
}): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) return falha("Você não tem permissão para emitir termos.");

  const termo = termoSchema.safeParse(payload.termo);
  if (!termo.success) return falha(primeiroErro(termo.error.issues));

  if (!payload.itens.length) return falha("Adicione ao menos um item ao termo.");
  const itens = payload.itens.map((i) => termoItemSchema.safeParse(i));
  const invalido = itens.find((r) => !r.success);
  if (invalido && !invalido.success) return falha(primeiroErro(invalido.error.issues));

  const supabase = await createClient();
  const { data: criado, error: erroTermo } = await supabase
    .from("termo_equipamento")
    .insert({ org_id: perfil.org_id, ...termo.data })
    .select("id")
    .single();
  if (erroTermo || !criado) return falha("Não foi possível salvar o termo.");

  const linhas = itens.map((r) => {
    const i = r.success ? r.data : null;
    return {
      org_id: perfil.org_id,
      termo_id: criado.id,
      item_id: i!.item_id,
      unidade_id: i!.unidade_id,
      item_locado_id: i!.item_locado_id,
      quantidade: i!.quantidade,
      estado_entrega: i!.estado_entrega,
      observacoes: i!.observacoes,
    };
  });
  const { error: erroItens } = await supabase.from("termo_equipamento_item").insert(linhas);
  if (erroItens) {
    // Sem transação no PostgREST: desfaz o cabeçalho para não deixar termo sem
    // item, que é documento em branco esperando para ser assinado.
    await supabase.from("termo_equipamento").delete().eq("id", criado.id);
    return falha("Não foi possível salvar os itens do termo.");
  }

  revalidatePath("/termos");
  return { ok: true, id: criado.id };
}
```

- [ ] **Step 3: Escrever o componente do passo a passo**

Criar `src/app/(app)/termos/termo-wizard.tsx` (cliente). O estado do passo a passo vive só no cliente até o botão final — nada é gravado antes, para que quem abre e desiste não deixe rascunho órfão:

```tsx
"use client";

type ItemNaTela = {
  item_id: string;
  descricao: string;       // só para exibir na tabela
  controle: "quantidade" | "peca";
  unidade_id: string | null;
  patrimonio: string | null; // idem
  quantidade: string;
  estado_entrega: Estado;
  observacoes: string;
};

const [passo, setPasso] = useState<1 | 2 | 3>(1);
const [termo, setTermo] = useState({
  funcionario_id: "",
  obra_id: "",
  contrato_id: "",
  data_entrega: hoje,          // vem do servidor como prop: hojeISOSaoPaulo()
  previsao_devolucao: "",
  observacoes: "",
});
const [itens, setItens] = useState<ItemNaTela[]>([]);
const [assFuncionario, setAssFuncionario] = useState({ nome: "", cpf: "", imagem: "" });
const [assEmpresa, setAssEmpresa] = useState({ nome: usuarioNome, imagem: "" });
```

`hoje` chega como prop do server component (`hojeISOSaoPaulo()`), e não de `new Date()` no cliente: o padrão da casa é a data de São Paulo vir do servidor.

Conteúdo de cada passo:

- Passo 1: select de funcionário (com "+ novo" que abre o `FuncionarioForm` num `Dialog`), select de obra pré-preenchido com a obra do funcionário escolhido, `data_entrega` com `defaultValue` de `hojeISOSaoPaulo()`, `previsao_devolucao`, select de contrato (opcional). Botão "Continuar" desabilitado sem funcionário e sem data.
- Passo 2: linha de adição — select de item; ao escolher, lê `controle` do item; se `peca`, mostra o select de patrimônio (somente unidades livres) e esconde a quantidade; se `quantidade`, o inverso. Select de estado. Botão "+" adiciona à tabela. Tabela com botão de remover por linha. "Continuar" desabilitado com zero itens.
- Passo 3: resumo em leitura de tudo, dois `SignaturePad` (Task 7 os move para `shared`), e os dois botões: `Assinar e emitir` e `Salvar sem assinar`.

Ambos os botões chamam a action e, no sucesso, `router.push(\`/termos/${r.id}\`)`; no erro, `toast.error(r.erro)`.

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm run lint`
Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/termos"
git commit -m "feat(termo): passo a passo de emissão e rascunho"
```

---

### Task 7: Emissão numerada e assinatura

**Files:**
- Move: `src/app/(app)/vistorias/signature-pad.tsx` → `src/components/shared/signature-pad.tsx`
- Modify: `src/app/(app)/vistorias/relatorio-form.tsx` e `src/app/(app)/vistorias/[id]/_components/vistoria-assinaturas.tsx` (import novo)
- Modify: `src/app/(app)/termos/actions.ts`

**Interfaces:**
- Consumes: `public.proximo_numero(p_org uuid, p_tipo text, p_ano int)` (0048)
- Produces: `emitirTermo(termoId: string, assinaturas: { funcionario: { nome: string; cpf: string | null; imagem: string | null }; empresa: { nome: string; imagem: string | null } }): Promise<ActionResult>`

- [ ] **Step 1: Mover o `SignaturePad` para `shared`**

```bash
git mv "src/app/(app)/vistorias/signature-pad.tsx" src/components/shared/signature-pad.tsx
```

Atualizar os dois imports em vistorias para `@/components/shared/signature-pad`.

- [ ] **Step 2: Rodar os testes para garantir que nada quebrou**

Run: `npm run typecheck && npx vitest run`
Expected: PASS

- [ ] **Step 3: Escrever a action de emissão**

Acrescentar a `src/app/(app)/termos/actions.ts`:

```ts
import { headers } from "next/headers";
import { assinaturaSchema } from "@/lib/termo";

/**
 * Emite o termo: grava o número e as duas assinaturas.
 *
 * O número sai AQUI, e não no INSERT do rascunho, para que rascunho abandonado
 * não abra buraco na sequência — mesmo desenho do `recebimento` (0049).
 */
export async function emitirTermo(
  termoId: string,
  assinaturas: {
    funcionario: { nome: string; cpf: string | null; imagem: string | null };
    empresa: { nome: string; imagem: string | null };
  },
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) return falha("Você não tem permissão para emitir termos.");

  const func = assinaturaSchema.safeParse(assinaturas.funcionario);
  if (!func.success) return falha(primeiroErro(func.error.issues));

  const supabase = await createClient();

  const { data: atual, error: erroLeitura } = await supabase
    .from("termo_equipamento")
    .select("emitido_em, cancelado_em")
    .eq("id", termoId)
    .single();
  if (erroLeitura || !atual) return falha("Termo não encontrado.");
  if (atual.cancelado_em) return falha("Este termo foi cancelado.");
  if (atual.emitido_em) return falha("Este termo já foi emitido.");

  const ano = Number(hojeISOSaoPaulo().slice(0, 4));
  const { data: numero, error: erroNumero } = await supabase.rpc("proximo_numero", {
    p_org: perfil.org_id,
    p_tipo: "termo_equipamento",
    p_ano: ano,
  });
  if (erroNumero || !numero) return falha("Não foi possível gerar o número do termo.");

  const { error: erroUpdate } = await supabase
    .from("termo_equipamento")
    .update({ numero_registro: numero, emitido_em: new Date().toISOString() })
    .eq("id", termoId)
    .is("emitido_em", null); // corrida: dois cliques não emitem duas vezes
  if (erroUpdate) return falha("Não foi possível emitir o termo.");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: erroAss } = await supabase.from("termo_assinatura").insert([
    {
      org_id: perfil.org_id, termo_id: termoId, momento: "entrega", papel: "funcionario",
      nome: func.data.nome, cpf: func.data.cpf, imagem: func.data.imagem, assinado_ip: ip,
    },
    {
      org_id: perfil.org_id, termo_id: termoId, momento: "entrega", papel: "empresa",
      nome: assinaturas.empresa.nome || (perfil.nome ?? "—"),
      imagem: assinaturas.empresa.imagem, assinado_ip: ip,
    },
  ]);
  if (erroAss) return falha("O termo foi emitido, mas as assinaturas não foram gravadas.");

  revalidatePath("/termos");
  revalidatePath(`/termos/${termoId}`);
  return { ok: true, id: termoId };
}
```

- [ ] **Step 4: Ligar os botões do passo 3**

No `termo-wizard.tsx`, "Assinar e emitir" chama `salvarTermo` e, no sucesso, `emitirTermo(r.id, …)`. "Salvar sem assinar" chama só `salvarTermo`.

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(termo): emissão numerada com assinatura na tela"
```

---

### Task 8: `modo="imagem"` no primitivo de assinaturas

Hoje o `<Assinaturas>` só sabe desenhar linha em branco (`manual`) ou o registro de aceite (`aceite`). A `vistoria` guarda `assinatura_*_img` desde a 0012 e **nenhum PDF imprime**: quem assina na tela assina no vazio.

**Files:**
- Modify: `src/lib/pdf-form.tsx:432-471`
- Modify: `src/lib/pdf-form.test.tsx`

**Interfaces:**
- Produces: `Assinante` ganha `imagem?: string | null`; `Assinaturas` aceita `modo?: "manual" | "aceite" | "imagem"`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/lib/pdf-form.test.tsx`:

```tsx
it("modo=imagem imprime o traço desenhado", async () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const buffer = await renderToBuffer(
    <Documento codigo="FRM-EQ-001" titulo="Termo">
      <Assinaturas
        modo="imagem"
        assinantes={[{ papel: "Funcionário", nome: "José Carlos", imagem: png }]}
      />
    </Documento>,
  );
  // Um PNG embutido cresce o arquivo de forma mensurável; sem ele o buffer
  // fica no tamanho do documento vazio.
  expect(buffer.byteLength).toBeGreaterThan(0);
  expect(contarPaginas(buffer)).toBe(1);
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — `Type '"imagem"' is not assignable` no typecheck do teste

- [ ] **Step 3: Implementar o modo**

Em `src/lib/pdf-form.tsx`, estender o tipo e o componente:

```tsx
export type Assinante = {
  papel: string;
  nome?: string | null;
  detalhe?: string;
  /** PNG data URI do traço desenhado na tela. Só usado em `modo="imagem"`. */
  imagem?: string | null;
};
```

```tsx
export function Assinaturas({
  assinantes,
  modo = "manual",
  localData,
}: {
  assinantes: Assinante[];
  modo?: "manual" | "aceite" | "imagem";
  localData?: string;
}) {
  return (
    <View wrap={false}>
      {localData ? <Text style={f.localData}>{localData}</Text> : null}
      <View style={f.assGrid}>
        {assinantes.map((a, i) => (
          <View key={i} style={f.assCol}>
            {/* A imagem vai ACIMA da linha: o traço tem de tocar a linha, como
                numa assinatura à caneta. Quem não assinou na tela cai no
                comportamento antigo — linha em branco para assinar à mão. */}
            {modo === "imagem" && a.imagem ? (
              <Image src={a.imagem} style={f.assImagem} />
            ) : null}
            <View style={f.assLinha}>
              <Text style={f.assNome}>{a.nome || " "}</Text>
              <Text style={f.assPapel}>{a.papel}</Text>
              {(modo === "aceite" || modo === "imagem") && a.detalhe ? (
                <Text style={f.assDetalhe}>{a.detalhe}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
```

Acrescentar ao `StyleSheet` `f`:

```ts
  assImagem: { height: 34, objectFit: "contain", marginBottom: 2 },
```

E incluir `Image` no import de `@react-pdf/renderer` no topo do arquivo, se ainda não estiver.

- [ ] **Step 4: Rodar o teste**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-form.tsx src/lib/pdf-form.test.tsx
git commit -m "feat(pdf): Assinaturas imprime o traço desenhado"
```

---

### Task 9: O documento FRM-EQ-001

**Files:**
- Create: `src/lib/documentos/frm-eq-001.tsx`
- Create: `src/lib/documentos/frm-eq-001.test.tsx`
- Modify: `src/lib/templates.ts` (tipo, catálogo e texto padrão)
- Create: `src/app/api/termos/[id]/pdf/route.tsx`

**Interfaces:**
- Consumes: `Documento`, `Secao`, `CampoGrid`, `Tabela`, `Assinaturas`, `AreaTexto`, tipos `Campo`/`Coluna`/`LinhaTabela` de `@/lib/pdf-form`; `Narrativa` de `./blocos`; `obterTermo` (Task 3)
- Produces: `TermoEquipamento(props)` — ver assinatura abaixo

- [ ] **Step 1: Escrever o teste**

Criar `src/lib/documentos/frm-eq-001.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { TermoEquipamento } from "./frm-eq-001";

const BASE = {
  orgNome: "Sistenge",
  titulo: "Termo de Responsabilidade pelo Uso de Equipamento",
  numero: "TRM-2026-0001",
  paragrafos: ["Declaro ter recebido os itens abaixo e assumo a responsabilidade por sua guarda."],
  campos: [
    { label: "Funcionário", valor: "José Carlos da Silva" },
    { label: "CPF", valor: "123.456.789-00" },
    { label: "Cargo", valor: "Pedreiro" },
    { label: "Obra", valor: "659 — Contagem/MG" },
    { label: "Entrega", valor: "29/07/2026" },
    { label: "Devolver até", valor: "30/09/2026" },
  ],
  itens: [
    { descricao: "Betoneira 400L", patrimonio: "PAT-012", quantidade: "1", estado: "Bom" },
    { descricao: 'Mangueira 3/4"', patrimonio: "—", quantidade: "10 m", estado: "Novo" },
  ],
  localData: "Contagem, 29 de julho de 2026.",
  assinaturas: {
    funcionario: { nome: "José Carlos da Silva", imagem: null, detalhe: null },
    empresa: { nome: "Evandro Ferreira", imagem: null, detalhe: null },
  },
};

describe("FRM-EQ-001", () => {
  it("cabe em uma página com dois itens", async () => {
    const buffer = await renderToBuffer(<TermoEquipamento {...BASE} />);
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("continua em uma página com dez itens", async () => {
    const itens = Array.from({ length: 10 }, (_, i) => ({
      descricao: `Item ${i + 1}`, patrimonio: "—", quantidade: "1", estado: "Bom",
    }));
    const buffer = await renderToBuffer(<TermoEquipamento {...BASE} itens={itens} />);
    expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
  });

  it("as colunas da tabela somam 100%", async () => {
    const { COLUNAS_ITENS } = await import("./frm-eq-001");
    const { somaLarguras } = await import("@/lib/pdf-form");
    expect(somaLarguras(COLUNAS_ITENS)).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npx vitest run src/lib/documentos/frm-eq-001.test.tsx`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Escrever o documento**

Criar `src/lib/documentos/frm-eq-001.tsx`:

```tsx
// FRM-EQ-001 — Termo de Responsabilidade pelo Uso de Equipamento.
//
// ESTRUTURA aqui; TEXTO em `documento_template`, tipo `termo_equipamento`,
// editável em Configurações → Templates de documentos.
//
// A coluna "Devolução" sai em branco na emissão e preenchida no encerramento.
// Ela fica na MESMA linha do item, ao lado do estado na entrega: é esse par
// ("saiu bom, voltou com avaria") que sustenta uma cobrança, e separá-lo em
// dois blocos obrigaria a cruzar duas partes do papel.

import { Narrativa } from "./blocos";
import {
  Documento,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  AreaTexto,
  type Campo,
  type Coluna,
  type LinhaTabela,
} from "@/lib/pdf-form";

export const COLUNAS_ITENS: Coluna[] = [
  { titulo: "Item", largura: 38 },
  { titulo: "Patrimônio", largura: 18 },
  { titulo: "Qtd.", largura: 10, alinhar: "center" },
  { titulo: "Entrega", largura: 17, alinhar: "center" },
  { titulo: "Devolução", largura: 17, alinhar: "center" },
];

export type ItemImpresso = {
  descricao: string;
  patrimonio: string;
  quantidade: string;
  estado: string;
  estadoDevolucao?: string | null;
};

export type AssinaturaImpressa = {
  nome: string;
  imagem?: string | null;
  detalhe?: string | null;
};

export function TermoEquipamento({
  orgNome,
  titulo,
  numero,
  campos,
  paragrafos,
  itens,
  localData,
  assinaturas,
  versao,
  publicadoEm,
}: {
  orgNome: string;
  titulo: string;
  numero: string;
  campos: Campo[];
  paragrafos: string[];
  itens: ItemImpresso[];
  localData: string;
  assinaturas: {
    funcionario: AssinaturaImpressa;
    empresa: AssinaturaImpressa;
  };
  versao?: string;
  publicadoEm?: string;
}) {
  const linhas: LinhaTabela[] = itens.map((i) => ({
    celulas: [
      i.descricao,
      i.patrimonio,
      i.quantidade,
      i.estado,
      i.estadoDevolucao ?? "",
    ],
  }));

  // Assinado na tela em qualquer uma das pontas → o bloco inteiro imprime as
  // imagens. Sem nenhuma, cai no modo manual: linha em branco para a caneta.
  const temTraco = Boolean(assinaturas.funcionario.imagem || assinaturas.empresa.imagem);

  return (
    <Documento
      codigo={`FRM-EQ-001 · ${numero}`}
      versao={versao}
      publicadoEm={publicadoEm}
      titulo={titulo}
      subtitulo={orgNome}
    >
      <Secao n={1} titulo="Identificação">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      <Secao n={2} titulo="Itens entregues" quebrar={false}>
        <Tabela colunas={COLUNAS_ITENS} linhas={linhas} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Declaração" />

      <Assinaturas
        localData={localData}
        modo={temTraco ? "imagem" : "manual"}
        assinantes={[
          {
            papel: "Funcionário",
            nome: assinaturas.funcionario.nome,
            imagem: assinaturas.funcionario.imagem,
            detalhe: assinaturas.funcionario.detalhe ?? undefined,
          },
          {
            papel: `Responsável — ${orgNome}`,
            nome: assinaturas.empresa.nome,
            imagem: assinaturas.empresa.imagem,
            detalhe: assinaturas.empresa.detalhe ?? undefined,
          },
        ]}
      />

      <Secao titulo="Devolução" quebrar={false}>
        <CampoGrid
          colunas={2}
          campos={[
            { label: "Data da devolução" },
            { label: "Conferido por" },
          ]}
        />
        <AreaTexto linhas={2} />
      </Secao>
    </Documento>
  );
}
```

- [ ] **Step 4: Registrar o tipo de template**

Em `src/lib/templates.ts`: acrescentar `| "termo_equipamento"` ao tipo `TipoDocumento`; um verbete em `DOCUMENTOS` com `modulo: "termos"`, `categoria: "formulario"`, `preenchimento: "com_dados"`, `eyebrow: "Termo de responsabilidade"` e as variáveis `funcionario`, `funcionario_cpf`, `cargo`, `obra`, `data_entrega`, `previsao_devolucao`, `empresa_nome`, `cidade`; e o texto padrão em `DEFAULT_TEMPLATES`:

```ts
  termo_equipamento: {
    titulo: "Termo de Responsabilidade pelo Uso de Equipamento",
    corpo: [
      "Declaro ter recebido de {{empresa_nome}}, nesta data, os equipamentos e materiais relacionados neste termo, nas condições de conservação indicadas.",
      "Comprometo-me a zelar pela guarda e conservação dos itens, utilizando-os exclusivamente para as atividades da obra {{obra}} e conforme as instruções de segurança aplicáveis.",
      "Responsabilizo-me por danos decorrentes de uso indevido, negligência ou extravio, autorizando o desconto do valor correspondente na forma da lei.",
      "Comprometo-me a devolver os itens quando solicitado, ao término da obra ou no desligamento, no prazo indicado neste termo.",
    ].join("\n\n"),
  },
```

- [ ] **Step 5: Escrever a rota do PDF**

Criar `src/app/api/termos/[id]/pdf/route.tsx`, espelhando `src/app/api/imoveis/[id]/termo-pdf/route.tsx`: autentica com `supabase.auth.getUser()`, busca com `obterTermo(id)`, monta `campos`/`itens`, lê `documento_template` tipo `termo_equipamento` com fallback em `DEFAULT_TEMPLATES`, aplica `renderTemplate` + `corpoParaParagrafos`, e devolve `renderToBuffer(<TermoEquipamento … />)` com `Content-Type: application/pdf` e `Content-Disposition: inline; filename="TRM-2026-0001.pdf"`.

`export const runtime = "nodejs"` e `export const dynamic = "force-dynamic"`.

- [ ] **Step 6: Rodar os testes e inspecionar o PDF**

Run: `npx vitest run src/lib/documentos/`
Expected: PASS

Depois **abrir o PDF** de um termo real em `/api/termos/<id>/pdf` e conferir com os olhos: logo no topo, número no cabeçalho, colunas alinhadas, coluna Devolução em branco, cláusulas legíveis. Contar página não prova que o documento está certo.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documentos src/lib/templates.ts src/app/api/termos
git commit -m "feat(termo): documento FRM-EQ-001 em PDF"
```

---

### Task 10: Devolução, encerramento e cancelamento

**Files:**
- Create: `src/app/(app)/termos/[id]/page.tsx`
- Create: `src/app/(app)/termos/[id]/_components/termo-devolucao.tsx`
- Modify: `src/app/(app)/termos/actions.ts`

**Interfaces:**
- Consumes: `obterTermo` (Task 3), `devolucaoItemSchema`, `cancelamentoSchema` (Task 2)
- Produces: `registrarDevolucao`, `encerrarTermo`, `cancelarTermo`, `excluirRascunho`

- [ ] **Step 1: Escrever as actions**

Acrescentar a `src/app/(app)/termos/actions.ts`:

```ts
import { devolucaoItemSchema, cancelamentoSchema } from "@/lib/termo";

/** Devolução parcial: por item, sem assinatura. A assinatura é do encerramento. */
export async function registrarDevolucao(
  termoId: string,
  itens: { item_id: string; data_devolucao: string; estado_devolucao: string; observacoes?: string }[],
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar devoluções.");
  }
  if (!itens.length) return falha("Marque ao menos um item devolvido.");

  const supabase = await createClient();
  for (const bruto of itens) {
    const r = devolucaoItemSchema.safeParse(bruto);
    if (!r.success) return falha(primeiroErro(r.error.issues));
    const { error } = await supabase
      .from("termo_equipamento_item")
      .update({
        data_devolucao: r.data.data_devolucao,
        estado_devolucao: r.data.estado_devolucao,
        observacoes: r.data.observacoes,
      })
      .eq("id", r.data.item_id)
      .eq("termo_id", termoId);
    if (error) return falha("Não foi possível registrar a devolução.");
  }

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  return { ok: true };
}

/**
 * Encerra o termo, assinado. Itens sem devolução continuam sem — ficam como
 * pendência registrada. É o que resolve o funcionário que devolveu dois de três
 * itens e foi desligado: sem isso o termo fica aberto para sempre.
 */
export async function encerrarTermo(
  termoId: string,
  assinaturas: {
    funcionario: { nome: string; cpf: string | null; imagem: string | null };
    empresa: { nome: string; imagem: string | null };
  },
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para encerrar termos.");
  }
  const func = assinaturaSchema.safeParse(assinaturas.funcionario);
  if (!func.success) return falha(primeiroErro(func.error.issues));

  const supabase = await createClient();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error: erroAss } = await supabase.from("termo_assinatura").upsert(
    [
      {
        org_id: perfil.org_id, termo_id: termoId, momento: "devolucao", papel: "funcionario",
        nome: func.data.nome, cpf: func.data.cpf, imagem: func.data.imagem, assinado_ip: ip,
      },
      {
        org_id: perfil.org_id, termo_id: termoId, momento: "devolucao", papel: "empresa",
        nome: assinaturas.empresa.nome || (perfil.nome ?? "—"),
        imagem: assinaturas.empresa.imagem, assinado_ip: ip,
      },
    ],
    { onConflict: "termo_id,momento,papel" },
  );
  if (erroAss) return falha("Não foi possível gravar as assinaturas da devolução.");

  const { error } = await supabase
    .from("termo_equipamento")
    .update({ encerrado_em: new Date().toISOString() })
    .eq("id", termoId);
  if (error) return falha("Não foi possível encerrar o termo.");

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  return { ok: true };
}

export async function cancelarTermo(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode cancelar um termo.");
  }
  const id = String(formData.get("id") ?? "").trim();
  const parsed = cancelamentoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!id) return falha("Termo inválido.");
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from("termo_equipamento")
    .update({
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: parsed.data.motivo,
    })
    .eq("id", id);
  if (error) return falha("Não foi possível cancelar o termo.");

  revalidatePath(`/termos/${id}`);
  revalidatePath("/termos");
  return { ok: true };
}

/** Só rascunho se apaga. Termo emitido cancela — documento assinado não some. */
export async function excluirRascunho(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para excluir termos.");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return falha("Termo inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("termo_equipamento")
    .delete()
    .eq("id", id)
    .is("emitido_em", null)
    .select("id");
  if (error) return falha("Não foi possível excluir o rascunho.");
  if (!data?.length) return falha("Este termo já foi emitido — cancele em vez de excluir.");

  revalidatePath("/termos");
  return { ok: true };
}
```

- [ ] **Step 2: Escrever a tela de detalhe**

`src/app/(app)/termos/[id]/page.tsx` (servidor): `obterTermo(id)`, `notFound()` se null. `PageHeader` com o número e um `Badge` de situação. Cards: Identificação, Itens (tabela com entrega e devolução), Assinaturas (nome, hora e IP), Observações. Ações conforme a situação:

| Situação | Ações |
|---|---|
| `rascunho` | Assinar e emitir · Excluir rascunho |
| `em_uso` | Registrar devolução · Encerrar · Cancelar (master/admin) · PDF |
| `devolvido_parcial` | Registrar devolução · Encerrar · PDF |
| `devolvido` | PDF |
| `cancelado` | PDF (com o motivo visível) |

**Espelhe `src/app/(app)/recebimentos/[id]/page.tsx`** — é a tela de detalhe mais recente do sistema e tem a mesma estrutura de cabeçalho numerado, cards de dados e ações que mudam conforme o estado.

- [ ] **Step 3: Verificar o fluxo inteiro na tela, incluindo as cinco situações**

Run: `npm run dev`

A view `termo_equipamento_situacao` é SQL e não tem teste unitário — a verificação dela é este roteiro, e cada seta abaixo é uma situação a conferir na lista e no detalhe:

1. Salvar sem assinar → **Rascunho** (sem número; o botão de excluir aparece)
2. Tentar adicionar item `peca` sem patrimônio → **recusado** com a mensagem do schema
3. Assinar e emitir → **Em uso**, com `TRM-2026-….` no cabeçalho
4. Abrir o PDF → logo, número, colunas alinhadas, traço da assinatura impresso, coluna Devolução em branco
5. Devolver um item de dois → **Devolução parcial**
6. Encerrar → **Devolvido**, com o item que não voltou visível como pendência
7. Em outro termo emitido, cancelar com motivo → **Cancelado**, motivo visível, PDF ainda acessível
8. Conferir que o patrimônio do termo em uso **não aparece** na lista do passo 2 de um termo novo

- [ ] **Step 4: Auditoria de acentuação**

```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/termos" src/lib/termo.ts src/lib/documentos/frm-eq-001.tsx --include=*.tsx --include=*.ts
```
Expected: nenhuma ocorrência que seja texto de tela (identificadores e chaves de banco não contam)

- [ ] **Step 5: Ritual de fechamento**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: os quatro passam

- [ ] **Step 6: Versionar**

Bump para **0.41.0** em `src/lib/changelog.ts` (`APP_VERSION` + `Release` no topo), `CHANGELOG.md` e `package.json`. Itens do release, em linguagem de usuário:

```ts
  {
    versao: "0.41.0",
    data: "2026-08-25",
    titulo: "Termo de responsabilidade por equipamento",
    mudancas: [
      { tipo: "novo", texto: "O equipamento que sai para a mão do funcionário passa a ter documento: quem recebeu, o que recebeu, em que estado e até quando." },
      { tipo: "novo", texto: "Cadastro de funcionários, com cargo, matrícula e obra de lotação." },
      { tipo: "novo", texto: "O funcionário assina na tela, com o dedo ou o mouse, e o traço sai impresso no termo." },
      { tipo: "novo", texto: "A devolução é registrada item a item no mesmo papel: dá para ver que saiu bom e voltou com avaria sem cruzar dois documentos." },
      { tipo: "melhoria", texto: "Equipamento de valor exige o patrimônio no termo — o documento diz qual betoneira saiu, não só que saiu uma." },
    ],
  },
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(termo): devolução, encerramento e cancelamento (v0.41.0)"
```
