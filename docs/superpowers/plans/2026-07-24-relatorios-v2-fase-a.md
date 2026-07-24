# Relatórios v2 — Fase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtros por fornecedor e status, coluna Fornecedor e subtotais por obra + total geral aos relatórios do Loca (tela, PDF e Excel), via um helper puro reutilizável.

**Architecture:** Manter `{colunas, linhas}` como fonte única. `gerarRelatorio` passa a devolver `agruparPor?` opcional; um helper puro `expandirLinhas(relatorio)` insere linhas de subtotal por grupo e um total geral. Os três renderizadores (tela/PDF/Excel) consomem `expandirLinhas` e estilizam por `tipo`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/Base UI (prop `render`), @react-pdf/renderer, exceljs, Supabase (@supabase/ssr, PostgREST). Testes: vitest (novo, só para libs puras).

## Global Constraints

- Next.js 16 App Router; componentes shadcn/Base UI usam a prop `render` (não `asChild`).
- Acento da marca: `#BE3A31`. Tema com cantos retos (`--radius: 0`).
- Colunas somáveis = apenas `tipo === "moeda"` (soma automática, sem flag).
- Filtro por `fornecedor_id` é sempre **client-side** (embed left join de contrato/fornecedor), para não excluir lançamentos avulsos na visão sem filtro.
- Filtro por `status` (`pago`/`pendente`) é aplicado no servidor e só afeta `contas_pagar` e `custo_por_obra`.
- Não refatorar código não relacionado. Seguir padrões existentes de `relatorios.ts`.
- Cada task termina com `npm run lint && npm run build` limpos (e `npm run test` na Task 1).

---

### Task 1: Helper puro `expandirLinhas` + tipos + vitest

**Files:**
- Modify: `package.json` (devDep vitest + script `test`)
- Create: `vitest.config.ts`
- Modify: `src/lib/relatorios.ts` (tipos `LinhaRelatorio`, campo `agruparPor`, campos de filtro, função `expandirLinhas`)
- Test: `src/lib/relatorios.test.ts`

**Interfaces:**
- Produces:
  - `type LinhaRelatorio = { tipo: "dado"; valores: Record<string, string | number | null> } | { tipo: "subtotal"; rotulo: string; valores: Record<string, number> } | { tipo: "total"; rotulo: string; valores: Record<string, number> }`
  - `Relatorio` ganha `agruparPor?: string`
  - `FiltrosRelatorio` ganha `fornecedor_id?: string` e `status?: "pago" | "pendente"`
  - `export function expandirLinhas(relatorio: Relatorio): LinhaRelatorio[]`

- [ ] **Step 1: Instalar vitest**

Run: `npm install -D vitest`
Expected: adiciona `vitest` em devDependencies.

- [ ] **Step 2: Adicionar script de teste**

Modify `package.json`, dentro de `"scripts"`, adicionar:

```json
"test": "vitest run"
```

- [ ] **Step 3: Criar `vitest.config.ts`** (resolve o alias `@/`)

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

- [ ] **Step 4: Escrever o teste que falha** em `src/lib/relatorios.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { expandirLinhas, type Relatorio } from "./relatorios";

const base = (over: Partial<Relatorio>): Relatorio => ({
  titulo: "T",
  colunas: [
    { key: "obra", label: "Obra", tipo: "texto" },
    { key: "valor", label: "Valor", tipo: "moeda" },
  ],
  linhas: [],
  ...over,
});

describe("expandirLinhas", () => {
  it("agrupa por obra com subtotais e total geral", () => {
    const r = base({
      agruparPor: "obra",
      linhas: [
        { obra: "A", valor: 10 },
        { obra: "B", valor: 5 },
        { obra: "A", valor: 20 },
      ],
    });
    const out = expandirLinhas(r);
    expect(out.map((l) => l.tipo)).toEqual([
      "dado",
      "dado",
      "subtotal",
      "dado",
      "subtotal",
      "total",
    ]);
    const subA = out[2];
    expect(subA).toMatchObject({ tipo: "subtotal", rotulo: "A", valores: { valor: 30 } });
    const total = out[out.length - 1];
    expect(total).toMatchObject({ tipo: "total", rotulo: "TOTAL GERAL", valores: { valor: 35 } });
  });

  it("sem agruparPor gera só total geral", () => {
    const r = base({ linhas: [{ obra: "A", valor: 10 }, { obra: "B", valor: 5 }] });
    const out = expandirLinhas(r);
    expect(out.map((l) => l.tipo)).toEqual(["dado", "dado", "total"]);
    expect(out[2]).toMatchObject({ valores: { valor: 15 } });
  });

  it("relatório vazio não gera total", () => {
    expect(expandirLinhas(base({ linhas: [] }))).toEqual([]);
  });

  it("sem colunas de moeda não gera subtotal/total", () => {
    const r: Relatorio = {
      titulo: "T",
      colunas: [{ key: "obra", label: "Obra", tipo: "texto" }],
      agruparPor: "obra",
      linhas: [{ obra: "A" }, { obra: "B" }],
    };
    expect(expandirLinhas(r).map((l) => l.tipo)).toEqual(["dado", "dado"]);
  });
});
```

- [ ] **Step 5: Rodar o teste e ver falhar**

Run: `npm run test`
Expected: FAIL — `expandirLinhas` não existe / import quebra.

- [ ] **Step 6: Adicionar tipos e o helper em `src/lib/relatorios.ts`**

No tipo `Relatorio` (após `linhas`), adicionar o campo opcional:

```ts
export type Relatorio = {
  titulo: string;
  colunas: Coluna[];
  linhas: Record<string, string | number | null>[];
  agruparPor?: string; // key de coluna para subtotais (ex.: "obra")
};
```

No tipo `FiltrosRelatorio`, adicionar:

```ts
export type FiltrosRelatorio = {
  obra_id?: string;
  fornecedor_id?: string;
  status?: "pago" | "pendente";
  inicio?: string;
  fim?: string;
};
```

Ao final do arquivo, adicionar:

```ts
export type LinhaRelatorio =
  | { tipo: "dado"; valores: Record<string, string | number | null> }
  | { tipo: "subtotal"; rotulo: string; valores: Record<string, number> }
  | { tipo: "total"; rotulo: string; valores: Record<string, number> };

/**
 * Expande as linhas cruas de um relatório inserindo subtotais por grupo
 * (quando `agruparPor` está definido) e um total geral. Soma apenas colunas
 * de tipo "moeda". Puro — sem I/O.
 */
export function expandirLinhas(relatorio: Relatorio): LinhaRelatorio[] {
  const moedaKeys = relatorio.colunas
    .filter((c) => c.tipo === "moeda")
    .map((c) => c.key);
  const dados = relatorio.linhas;
  if (dados.length === 0) return [];

  const somar = (linhas: Record<string, string | number | null>[]) => {
    const acc: Record<string, number> = {};
    for (const k of moedaKeys) {
      acc[k] = linhas.reduce((s, l) => s + Number(l[k] ?? 0), 0);
    }
    return acc;
  };

  const out: LinhaRelatorio[] = [];

  if (relatorio.agruparPor && moedaKeys.length > 0) {
    const chave = relatorio.agruparPor;
    const ordenadas = [...dados].sort((a, b) =>
      String(a[chave] ?? "").localeCompare(String(b[chave] ?? "")),
    );
    let grupoAtual: string | null = null;
    let bucket: Record<string, string | number | null>[] = [];
    const flush = () => {
      if (bucket.length === 0) return;
      out.push({ tipo: "subtotal", rotulo: String(grupoAtual ?? ""), valores: somar(bucket) });
      bucket = [];
    };
    for (const l of ordenadas) {
      const g = String(l[chave] ?? "");
      if (grupoAtual === null) grupoAtual = g;
      if (g !== grupoAtual) {
        flush();
        grupoAtual = g;
      }
      out.push({ tipo: "dado", valores: l });
      bucket.push(l);
    }
    flush();
  } else {
    for (const l of dados) out.push({ tipo: "dado", valores: l });
  }

  if (moedaKeys.length > 0) {
    out.push({ tipo: "total", rotulo: "TOTAL GERAL", valores: somar(dados) });
  }
  return out;
}
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `npm run test`
Expected: PASS (4 testes).

- [ ] **Step 8: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/relatorios.ts src/lib/relatorios.test.ts
git commit -m "feat(relatorios): helper puro expandirLinhas + tipos + vitest"
```

---

### Task 2: `itens_abertos` — coluna/filtro de fornecedor + agruparPor

**Files:**
- Modify: `src/lib/relatorios.ts` (função `itensAbertos`)

**Interfaces:**
- Consumes: `FiltrosRelatorio.fornecedor_id`, `Relatorio.agruparPor` (Task 1)
- Produces: relatório `itens_abertos` com coluna `fornecedor` e `agruparPor: "obra"`

- [ ] **Step 1: Incluir fornecedor no select e no filtro**

Em `itensAbertos`, alterar o `.select(...)` do contrato para incluir `fornecedor_id` e o nome do fornecedor:

```ts
.select(
  "quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, contrato:contrato_id(numero, cadencia, cobranca_prorata, data_fim_prevista, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)), item:item_id(descricao)",
)
```

- [ ] **Step 2: Aplicar filtro de fornecedor (client-side) junto ao de obra**

Substituir o `.filter(...)` atual por um que também considere `fornecedor_id`:

```ts
const linhas = (data ?? [])
  .filter((l: Record<string, unknown>) => {
    const c = l.contrato as { obra_id?: string; fornecedor_id?: string } | null;
    if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return false;
    if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id) return false;
    return true;
  })
  .map((l: Record<string, unknown>) => {
```

- [ ] **Step 3: Ler o nome do fornecedor no map e adicionar ao objeto de linha**

No corpo do `.map`, ao desestruturar `contrato`, incluir `fornecedor`:

```ts
const contrato = l.contrato as {
  numero: string;
  cadencia: Cadencia;
  cobranca_prorata?: boolean;
  data_fim_prevista?: string | null;
  obra: { codigo: string; nome: string } | null;
  fornecedor: { nome: string } | null;
} | null;
```

E no objeto retornado, adicionar `fornecedor` logo após `contrato`:

```ts
return {
  obra: contrato?.obra
    ? `${contrato.obra.codigo} — ${contrato.obra.nome}`
    : "—",
  contrato: contrato?.numero ?? "—",
  fornecedor: contrato?.fornecedor?.nome ?? "—",
  item: item?.descricao ?? "—",
  quantidade: qtd,
  retirada: l.data_retirada as string,
  devolucao: (l.data_devolucao_prevista as string | null) ?? null,
  custoMensal,
  custo,
  custoAteFim,
};
```

- [ ] **Step 4: Adicionar a coluna Fornecedor e `agruparPor`**

No `return` do relatório, inserir a coluna `fornecedor` após `contrato` e adicionar `agruparPor`:

```ts
return {
  titulo: "Itens em aberto",
  agruparPor: "obra",
  colunas: [
    { key: "obra", label: "Obra", tipo: "texto" },
    { key: "contrato", label: "Contrato", tipo: "texto" },
    { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
    { key: "item", label: "Item", tipo: "texto" },
    { key: "quantidade", label: "Qtd.", tipo: "numero" },
    { key: "retirada", label: "Retirada", tipo: "data" },
    { key: "devolucao", label: "Devol. prevista", tipo: "data" },
    { key: "custoMensal", label: "Custo/mês", tipo: "moeda" },
    { key: "custo", label: "Custo até hoje", tipo: "moeda" },
    { key: "custoAteFim", label: "Custo até o fim", tipo: "moeda" },
  ],
  linhas,
};
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros (a tela já renderiza a nova coluna porque é dirigida por `colunas`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/relatorios.ts
git commit -m "feat(relatorios): fornecedor + agrupamento por obra em itens em aberto"
```

---

### Task 3: `contas_pagar` e `custo_por_obra` — fornecedor, status e agrupamento

**Files:**
- Modify: `src/lib/relatorios.ts` (funções `contasPagar` e `custoPorObra`)

**Interfaces:**
- Consumes: `FiltrosRelatorio.fornecedor_id`, `FiltrosRelatorio.status`, `Relatorio.agruparPor`
- Produces: `contas_pagar` com coluna `fornecedor` + `agruparPor: "obra"`; `custo_por_obra` com total geral (sem agrupamento)

- [ ] **Step 1: `contasPagar` — select com fornecedor + filtros status/fornecedor**

Substituir o início de `contasPagar` (query) por:

```ts
let q = supabase
  .from("lancamento_financeiro")
  .select(
    "descricao, competencia, vencimento, valor, status, obra:obra_id(codigo,nome), contrato:contrato_id(fornecedor_id, fornecedor:fornecedor_id(nome))",
  )
  .order("vencimento");
if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
if (filtros.status) q = q.eq("status", filtros.status);
if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
if (filtros.fim) q = q.lte("vencimento", filtros.fim);
const { data } = await q;
```

- [ ] **Step 2: `contasPagar` — filtro client-side de fornecedor + coluna fornecedor**

Substituir o `.map(...)` por uma versão que filtra por fornecedor e expõe o nome:

```ts
const linhas = (data ?? [])
  .filter((l: Record<string, unknown>) => {
    if (!filtros.fornecedor_id) return true;
    const c = l.contrato as { fornecedor_id?: string } | null;
    return c?.fornecedor_id === filtros.fornecedor_id;
  })
  .map((l: Record<string, unknown>) => {
    const obra = l.obra as { codigo: string; nome: string } | null;
    const contrato = l.contrato as { fornecedor: { nome: string } | null } | null;
    return {
      obra: obra ? `${obra.codigo} — ${obra.nome}` : "—",
      fornecedor: contrato?.fornecedor?.nome ?? "—",
      descricao: l.descricao as string,
      competencia: l.competencia as string,
      vencimento: l.vencimento as string,
      valor: Number(l.valor),
      status: l.status === "pago" ? "Pago" : "Pendente",
    };
  });
```

- [ ] **Step 3: `contasPagar` — coluna Fornecedor + `agruparPor`**

Substituir o `return` por:

```ts
return {
  titulo: "Contas a pagar",
  agruparPor: "obra",
  colunas: [
    { key: "obra", label: "Obra", tipo: "texto" },
    { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
    { key: "descricao", label: "Descrição", tipo: "texto" },
    { key: "competencia", label: "Competência", tipo: "data" },
    { key: "vencimento", label: "Vencimento", tipo: "data" },
    { key: "valor", label: "Valor", tipo: "moeda" },
    { key: "status", label: "Status", tipo: "texto" },
  ],
  linhas,
};
```

- [ ] **Step 4: `custoPorObra` — select + filtros status/fornecedor**

Substituir o início de `custoPorObra` por:

```ts
let q = supabase
  .from("lancamento_financeiro")
  .select(
    "valor, status, obra:obra_id(codigo,nome), contrato:contrato_id(fornecedor_id)",
  );
if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
if (filtros.status) q = q.eq("status", filtros.status);
if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
if (filtros.fim) q = q.lte("vencimento", filtros.fim);
const { data } = await q;
```

- [ ] **Step 5: `custoPorObra` — aplicar filtro de fornecedor antes de agregar**

Substituir o laço de agregação para pular linhas fora do fornecedor filtrado:

```ts
for (const l of (data ?? []) as Record<string, unknown>[]) {
  if (filtros.fornecedor_id) {
    const c = l.contrato as { fornecedor_id?: string } | null;
    if (c?.fornecedor_id !== filtros.fornecedor_id) continue;
  }
  const obra = l.obra as { codigo: string; nome: string } | null;
  const nome = obra ? `${obra.codigo} — ${obra.nome}` : "—";
  const atual = mapa.get(nome) ?? { obra: nome, total: 0, pendente: 0, pago: 0 };
  const v = Number(l.valor);
  atual.total += v;
  if (l.status === "pago") atual.pago += v;
  else atual.pendente += v;
  mapa.set(nome, atual);
}
```

(O `return` de `custoPorObra` permanece **sem** `agruparPor` — cada linha já é uma obra; o total geral virá de `expandirLinhas`.)

- [ ] **Step 6: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/lib/relatorios.ts
git commit -m "feat(relatorios): fornecedor/status em contas a pagar e custo por obra"
```

---

### Task 4: Tela de relatórios — filtros novos + render de subtotais/total

**Files:**
- Modify: `src/app/(app)/relatorios/page.tsx`

**Interfaces:**
- Consumes: `expandirLinhas`, `LinhaRelatorio` (Task 1); filtros `fornecedor`/`status` na querystring
- Produces: UI com selects Fornecedor/Status e linhas subtotal/total estilizadas

- [ ] **Step 1: Buscar fornecedores e ler novos filtros**

No corpo do componente, ampliar o tipo de `searchParams` e a leitura. Trocar a assinatura:

```tsx
}: {
  searchParams: Promise<{
    tipo?: string;
    obra?: string;
    fornecedor?: string;
    status?: string;
    inicio?: string;
    fim?: string;
  }>;
}) {
```

Após buscar `obras`, buscar fornecedores:

```tsx
const { data: fornecedores } = await supabase
  .from("fornecedor")
  .select("id, nome")
  .order("nome");
```

- [ ] **Step 2: Passar novos filtros para `gerarRelatorio`**

```tsx
const relatorio = await gerarRelatorio(supabase, tipo, {
  obra_id: sp.obra || undefined,
  fornecedor_id: sp.fornecedor || undefined,
  status: sp.status === "pago" || sp.status === "pendente" ? sp.status : undefined,
  inicio: sp.inicio || undefined,
  fim: sp.fim || undefined,
});
```

- [ ] **Step 3: Incluir novos filtros na querystring de exportação**

Após `qs.set("tipo", tipo);`, adicionar:

```tsx
if (sp.obra) qs.set("obra", sp.obra);
if (sp.fornecedor) qs.set("fornecedor", sp.fornecedor);
if (sp.status) qs.set("status", sp.status);
if (sp.inicio) qs.set("inicio", sp.inicio);
if (sp.fim) qs.set("fim", sp.fim);
```

(Remover as linhas `qs.set` antigas duplicadas de obra/inicio/fim.)

- [ ] **Step 4: Adicionar selects Fornecedor e Status no formulário**

No `<form>` de filtros, após o bloco do select "Obra", inserir:

```tsx
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted-foreground">Fornecedor</label>
  <select name="fornecedor" defaultValue={sp.fornecedor ?? ""} className={selectClasses}>
    <option value="">Todos</option>
    {(fornecedores ?? []).map((f) => (
      <option key={f.id} value={f.id}>
        {f.nome}
      </option>
    ))}
  </select>
</div>
<div className="flex flex-col gap-1">
  <label className="text-xs text-muted-foreground">Status</label>
  <select name="status" defaultValue={sp.status ?? ""} className={selectClasses}>
    <option value="">Todos</option>
    <option value="pendente">Pendente</option>
    <option value="pago">Pago</option>
  </select>
</div>
```

- [ ] **Step 5: Renderizar via `expandirLinhas` com estilo de subtotal/total**

Importar o helper no topo:

```tsx
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  expandirLinhas,
  formatarValor,
  type TipoRelatorio,
} from "@/lib/relatorios";
```

Substituir o `<TableBody>` inteiro por:

```tsx
<TableBody>
  {relatorio.linhas.length === 0 ? (
    <TableRow>
      <TableCell
        colSpan={relatorio.colunas.length}
        className="py-10 text-center text-muted-foreground"
      >
        Nenhum registro para os filtros selecionados.
      </TableCell>
    </TableRow>
  ) : (
    expandirLinhas(relatorio).map((lr, idx) => {
      const alinharDir = (t: string) => t === "moeda" || t === "numero";
      if (lr.tipo === "dado") {
        return (
          <TableRow key={idx}>
            {relatorio.colunas.map((c) => (
              <TableCell key={c.key} className={alinharDir(c.tipo) ? "text-right" : ""}>
                {formatarValor(c.tipo, lr.valores[c.key])}
              </TableCell>
            ))}
          </TableRow>
        );
      }
      const primeira = relatorio.colunas[0].key;
      return (
        <TableRow key={idx} className="bg-muted font-medium">
          {relatorio.colunas.map((c) => {
            let conteudo = "";
            if (c.key in lr.valores) conteudo = formatarValor("moeda", lr.valores[c.key]);
            else if (c.key === primeira)
              conteudo = lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
            return (
              <TableCell key={c.key} className={alinharDir(c.tipo) ? "text-right" : ""}>
                {conteudo}
              </TableCell>
            );
          })}
        </TableRow>
      );
    })
  )}
</TableBody>
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/relatorios/page.tsx"
git commit -m "feat(relatorios): filtros de fornecedor/status e subtotais/total na tela"
```

---

### Task 5: PDF — subtotais/total no `DocumentoRelatorio` + repassar filtros

**Files:**
- Modify: `src/lib/pdf.tsx` (`DocumentoRelatorio` e seus estilos)
- Modify: `src/app/api/relatorios/pdf/route.tsx`

**Interfaces:**
- Consumes: `expandirLinhas`, `LinhaRelatorio` (Task 1)
- Produces: PDF com linhas de subtotal (fundo cinza) e total (negrito, borda no acento)

- [ ] **Step 1: Importar `expandirLinhas` em `pdf.tsx`**

Localizar o import atual de `@/lib/relatorios` em `pdf.tsx` e incluir `expandirLinhas`:

```tsx
import { expandirLinhas, formatarValor, type Relatorio } from "@/lib/relatorios";
```

(Se o import atual trouxer apenas `formatarValor`/`Relatorio`, apenas acrescente `expandirLinhas`.)

- [ ] **Step 2: Renderizar as linhas expandidas**

Substituir o bloco `{relatorio.linhas.map(...)}` (as linhas do corpo) por:

```tsx
{expandirLinhas(relatorio).map((lr, idx) => {
  if (lr.tipo === "dado") {
    return (
      <View key={idx} style={styles.row} wrap={false}>
        {relatorio.colunas.map((c, i) => (
          <Text key={c.key} style={[styles.cell, { flex: larguras[i] }]}>
            {formatarValor(c.tipo, lr.valores[c.key])}
          </Text>
        ))}
      </View>
    );
  }
  const primeira = relatorio.colunas[0].key;
  return (
    <View
      key={idx}
      style={[styles.row, lr.tipo === "total" ? styles.rowTotal : styles.rowSubtotal]}
      wrap={false}
    >
      {relatorio.colunas.map((c, i) => {
        let conteudo = "";
        if (c.key in lr.valores) conteudo = formatarValor("moeda", lr.valores[c.key]);
        else if (c.key === primeira)
          conteudo = lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
        return (
          <Text key={c.key} style={[styles.cell, styles.cellForte, { flex: larguras[i] }]}>
            {conteudo}
          </Text>
        );
      })}
    </View>
  );
})}
```

- [ ] **Step 3: Adicionar os estilos usados**

No `StyleSheet.create({...})` do `DocumentoRelatorio` (o objeto `styles` no topo do arquivo, usado por esse documento), adicionar:

```tsx
rowSubtotal: { backgroundColor: "#f2f2f3" },
rowTotal: { borderTop: "1 solid #BE3A31", backgroundColor: "#f7e9e8" },
cellForte: { fontFamily: "Helvetica-Bold" },
```

- [ ] **Step 4: Repassar filtros na rota do PDF**

Em `src/app/api/relatorios/pdf/route.tsx`, ampliar a leitura de filtros:

```tsx
const relatorio = await gerarRelatorio(supabase, tipo, {
  obra_id: url.searchParams.get("obra") ?? undefined,
  fornecedor_id: url.searchParams.get("fornecedor") ?? undefined,
  status:
    url.searchParams.get("status") === "pago" ||
    url.searchParams.get("status") === "pendente"
      ? (url.searchParams.get("status") as "pago" | "pendente")
      : undefined,
  inicio,
  fim,
});
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pdf.tsx src/app/api/relatorios/pdf/route.tsx
git commit -m "feat(relatorios): subtotais/total no PDF e filtros na rota"
```

---

### Task 6: Excel — subtotais/total + repassar filtros

**Files:**
- Modify: `src/app/api/relatorios/excel/route.ts`

**Interfaces:**
- Consumes: `expandirLinhas`, `LinhaRelatorio` (Task 1)
- Produces: planilha com linhas subtotal/total em negrito

- [ ] **Step 1: Importar `expandirLinhas`**

Incluir na importação de `@/lib/relatorios`:

```ts
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  expandirLinhas,
  type TipoRelatorio,
} from "@/lib/relatorios";
```

- [ ] **Step 2: Repassar filtros**

Substituir a chamada `gerarRelatorio(...)` por:

```ts
const relatorio = await gerarRelatorio(supabase, tipo, {
  obra_id: url.searchParams.get("obra") ?? undefined,
  fornecedor_id: url.searchParams.get("fornecedor") ?? undefined,
  status:
    url.searchParams.get("status") === "pago" ||
    url.searchParams.get("status") === "pendente"
      ? (url.searchParams.get("status") as "pago" | "pendente")
      : undefined,
  inicio: url.searchParams.get("inicio") ?? undefined,
  fim: url.searchParams.get("fim") ?? undefined,
});
```

- [ ] **Step 3: Gerar linhas via `expandirLinhas`**

Substituir o laço `for (const linha of relatorio.linhas) { ... ws.addRow(row); }` por:

```ts
const primeira = relatorio.colunas[0].key;
for (const lr of expandirLinhas(relatorio)) {
  const row: Record<string, string | number | Date | null> = {};
  if (lr.tipo === "dado") {
    for (const c of relatorio.colunas) {
      const v = lr.valores[c.key];
      if (v === null || v === undefined || v === "") row[c.key] = null;
      else if (c.tipo === "data") row[c.key] = dataDeISO(String(v));
      else if (c.tipo === "moeda" || c.tipo === "numero") row[c.key] = Number(v);
      else row[c.key] = String(v);
    }
    ws.addRow(row);
  } else {
    for (const c of relatorio.colunas) {
      if (c.key in lr.valores) row[c.key] = Number(lr.valores[c.key]);
      else if (c.key === primeira)
        row[c.key] = lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
      else row[c.key] = null;
    }
    const r = ws.addRow(row);
    r.font = { bold: true };
    if (lr.tipo === "total") {
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7E9E8" } };
      });
    }
  }
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/relatorios/excel/route.ts
git commit -m "feat(relatorios): subtotais/total no Excel e filtros na rota"
```

---

### Task 7: Verificação E2E + PR

**Files:** nenhum (verificação manual + git)

- [ ] **Step 1: Rodar o app localmente**

Run: `npm run dev`
Abrir `http://localhost:3000/relatorios`.

- [ ] **Step 2: Verificação manual (checklist do spec)**

Com dados de teste (cadastrar 1–2 obras, 1 fornecedor e alguns lançamentos/itens, ou usar `supabase/seed_teste.sql` num ambiente de teste):
1. Contas a pagar → filtrar por fornecedor X + status Pendente: só linhas de X pendentes; TOTAL GERAL = soma.
2. Itens em aberto com 2 obras: um subtotal por obra + TOTAL GERAL = soma dos subtotais; coluna Fornecedor preenchida.
3. Exportar PDF e Excel com os mesmos filtros: coluna Fornecedor, subtotais e total presentes (confirma repasse de filtros nas rotas).
4. Custo por obra: sem subtotais, com TOTAL GERAL correto.
5. `npm run test` verde; `npm run lint && npm run build` limpos.

- [ ] **Step 3: Abrir PR e mergear**

```bash
git push -u origin feat/relatorios-v2-fase-a
gh pr create --title "feat: Relatorios v2 - Fase A (filtros, fornecedor, subtotais)" --base main --head feat/relatorios-v2-fase-a --body "Fase A do roadmap de relatorios: filtros por fornecedor/status, coluna Fornecedor e subtotais por obra + total geral (tela/PDF/Excel), via helper puro expandirLinhas."
gh pr merge --merge --delete-branch
git checkout main
git pull
```

---

## Self-Review

**1. Spec coverage:**
- Filtros fornecedor + status → Tasks 2, 3, 4, 5, 6. ✓
- Coluna Fornecedor (itens/contas) → Tasks 2, 3. ✓
- Subtotais por obra + total geral → Task 1 (`expandirLinhas`) + Tasks 4/5/6 (render). ✓
- `expandirLinhas` helper puro / fonte única → Task 1. ✓
- Custo por obra só total geral → Task 3 (sem `agruparPor`). ✓
- Rotas repassam filtros (bug latente) → Tasks 5, 6. ✓
- Nota fornecedor client-side (avulsos) → Tasks 2, 3 (filtro client-side). ✓

**2. Placeholder scan:** sem TBD/TODO; todo passo tem código concreto e comandos. ✓

**3. Type consistency:** `expandirLinhas`, `LinhaRelatorio`, `Relatorio.agruparPor`, `FiltrosRelatorio.{fornecedor_id,status}` definidos na Task 1 e usados idênticos nas Tasks 2–6. Chave de linha `fornecedor` consistente. `rotulo`/`valores`/`tipo` idênticos entre helper e renderizadores. ✓
