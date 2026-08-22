# Documentos do alojamento — Fase 1 (primitivos de PDF + FRM-RH-001)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir os oito primitivos de formulário em PDF e provar o vocabulário inteiro no FRM-RH-001 (Termo de Compromisso de Alojamento), que passa a substituir o `termo_responsabilidade` atual.

**Architecture:** Estrutura em código, texto no banco. Os primitivos são componentes `@react-pdf/renderer` em `src/lib/pdf-form.tsx`; as partes narrativas continuam em `documento_template.corpo` com `{{variáveis}}`, editáveis em Configurações. O catálogo `DOCUMENTOS` de `src/lib/templates.ts` vira fonte única, ligada ao módulo.

**Tech Stack:** Next.js (App Router), TypeScript, `@react-pdf/renderer`, Supabase (Postgres + RLS), `react-hook-form` + `zodResolver`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-documentos-alojamento-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário.** Rótulo, placeholder, texto de JSX, toast, erro de action, título de PDF. Não acentuar identificadores TypeScript, chaves de enum/banco, `name=`/`id=`, slugs de rota.
- **PDFs nunca usam tokens de tema.** Hex literal apenas via `import` de `src/lib/brand-colors.ts`.
- **`--brand` (`MARCA_VERMELHO`, `#BE3A31`) é de uso restrito:** logotipo e badges de crítico. Nunca em CTA, link, foco, título de seção ou rodapé.
- **Logo com piso de 85pt de largura** em qualquer documento impresso (manual de identidade: ≥ 3 cm).
- **"Hoje" é sempre `hojeISOSaoPaulo()`** de `src/lib/locacao.ts`, nunca `new Date()`, quando a data for comparada com coluna `date`.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **Exclusão sempre por `supabase.rpc("soft_delete", ...)`**, tratando `data !== true` como erro.
- **Leituras compartilhadas** vivem em `src/lib/data/<dominio>.ts` com `import "server-only"` e `createClient()` — nunca `createAdminClient()`.
- **Ritual de fechamento:** `npm run typecheck && npm run lint && npm test && npm run build`.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/pdf-logo.tsx` | `LogoSistenge` — extraído de `pdf.tsx` para ser compartilhado | Criar |
| `src/lib/pdf-form.tsx` | Os 8 primitivos de formulário + helpers puros testáveis | Criar |
| `src/lib/pdf-form.test.tsx` | Testes dos helpers puros e de contagem de páginas | Criar |
| `src/lib/documentos/frm-rh-001.tsx` | Composição do Termo de Compromisso | Criar |
| `src/lib/pdf.tsx` | Passa a importar o logo de `pdf-logo`; `DocumentoTexto` desenha o logo | Modificar |
| `src/lib/templates.ts` | `DocumentoInfo` ganha `modulo`/`categoria`/`preenchimento`; texto do FRM-RH-001 | Modificar |
| `src/lib/imoveis.ts` | `ocupanteSchema` | Modificar |
| `src/lib/biblioteca.ts` | Exporta `CategoriaBiblioteca` já existente (sem mudança de código) | — |
| `supabase/migrations/0043_alojamento_ocupante.sql` | +5 colunas em `ocupante_imovel` | Criar |
| `src/app/(app)/imoveis/ocupante-form.tsx` | Migra para `react-hook-form` | Modificar |
| `src/app/(app)/imoveis/actions.ts` | `salvarOcupante` passa a receber objeto e devolver `ActionResult` | Modificar |
| `src/app/(app)/configuracoes/templates/page.tsx` | Agrupa por módulo | Modificar |
| `src/app/api/imoveis/[id]/termo-pdf/route.tsx` | Compõe o FRM-RH-001 | Modificar |
| `vitest.config.ts` | Passa a incluir `.test.tsx` | Modificar |

**Nota de resolução de módulo:** os primitivos vão para `src/lib/pdf-form.tsx`, arquivo **irmão** de `src/lib/pdf.tsx` — e não para `src/lib/pdf/form.tsx`. Criar a pasta `src/lib/pdf/` ao lado do arquivo `src/lib/pdf.tsx` deixaria `@/lib/pdf` ambíguo.

---

### Task 1: Vitest aceita testes `.tsx`

**Files:**
- Modify: `vitest.config.ts:22`

**Interfaces:**
- Consumes: nada
- Produces: capacidade de rodar `src/**/*.test.tsx` — todas as tasks seguintes dependem disso

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/pdf-form.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";

describe("infraestrutura de teste", () => {
  it("roda arquivos .test.tsx", () => {
    expect(1).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que o arquivo é ignorado**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — "No test files found" (o `include` só casa `.test.ts`)

- [ ] **Step 3: Ampliar o `include`**

Em `vitest.config.ts`, trocar a linha do `include`:

```ts
    include: ["src/**/*.test.{ts,tsx}"],
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS — 1 teste

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/lib/pdf-form.test.tsx
git commit -m "test: vitest passa a incluir arquivos .test.tsx

Os primitivos de PDF são componentes JSX e seus testes renderizam
documentos, então precisam morar em .tsx."
```

---

### Task 2: Extrair `LogoSistenge` para arquivo próprio

**Files:**
- Create: `src/lib/pdf-logo.tsx`
- Modify: `src/lib/pdf.tsx:20-55`

**Interfaces:**
- Consumes: `MARCA_VERMELHO`, `SLATE_900` de `src/lib/brand-colors`
- Produces: `LogoSistenge({ width?: number })` — usado por `pdf.tsx` e por `pdf-form.tsx` (Task 3)

- [ ] **Step 1: Criar `src/lib/pdf-logo.tsx`**

Mover o bloco de `LogoSistenge` de `src/lib/pdf.tsx` (linhas 32–55, incluindo `LOGO_VIEWBOX`, `LOGO_RATIO`, `ICONE_VERMELHO`, `WORDMARK_COR`) para o novo arquivo, exportando o componente. O cabeçalho do arquivo:

```tsx
// Logotipo da Sistenge portado para as primitivas SVG do @react-pdf/renderer.
// Vive em arquivo próprio porque dois consumidores precisam dele: os documentos
// de texto (pdf.tsx) e os formulários (pdf-form.tsx).
//
// Os paths são byte a byte os do "Versão Fundo Claro.svg" oficial do Manual de
// Identidade Visual 2026. Não editar à mão.
//
// LARGURA MÍNIMA: 85pt. O manual exige 3 cm em impressão, e abaixo disso a
// marca perde legibilidade.

import { Svg, Path, Polygon } from "@react-pdf/renderer";
import { MARCA_VERMELHO, SLATE_900 } from "@/lib/brand-colors";

const LOGO_VIEWBOX = "0 0 1920 392.19";
const LOGO_RATIO = 392.19 / 1920;
const ICONE_VERMELHO = MARCA_VERMELHO;
const WORDMARK_COR = SLATE_900;

/** Largura mínima em pt (3 cm), conforme o Manual de Identidade Visual. */
export const LOGO_LARGURA_MINIMA = 85;

export function LogoSistenge({ width = 150 }: { width?: number }) {
  // ...corpo idêntico ao que estava em pdf.tsx...
}
```

- [ ] **Step 2: Ajustar `src/lib/pdf.tsx`**

Remover o bloco movido e importar:

```tsx
import { LogoSistenge } from "./pdf-logo";
```

Conferir que `Svg`, `Path` e `Polygon` continuam importados de `@react-pdf/renderer` em `pdf.tsx` apenas se ainda houver outro uso; se não houver, remover do import para o lint não acusar.

- [ ] **Step 3: Verificar que nada quebrou**

Run: `npm run typecheck && npm run lint`
Expected: PASS, sem erros

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf-logo.tsx src/lib/pdf.tsx
git commit -m "refactor(pdf): extrai LogoSistenge para arquivo próprio

Os formulários do alojamento precisam do mesmo logo que os documentos de
texto. Sai de pdf.tsx para não transformar aquele arquivo em hub."
```

---

### Task 3: Primitivos de página e seção — `Documento`, `Secao`, `CampoGrid`

**Files:**
- Create: `src/lib/pdf-form.tsx`
- Test: `src/lib/pdf-form.test.tsx`

**Interfaces:**
- Consumes: `LogoSistenge`, `LOGO_LARGURA_MINIMA` de `./pdf-logo`; `SLATE_200`, `SLATE_400`, `SLATE_500`, `SLATE_900` de `@/lib/brand-colors`
- Produces:
  - `type Campo = { label: string; valor?: string | null }`
  - `Documento({ codigo, titulo, subtitulo, orientacao?, children })`
  - `Secao({ n, titulo, children, quebrar? })`
  - `CampoGrid({ campos, colunas? })`
  - `contarPaginas(buffer: Buffer): number` — helper de teste

- [ ] **Step 1: Escrever os testes que falham**

Substituir o conteúdo de `src/lib/pdf-form.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { Text } from "@react-pdf/renderer";
import { Documento, Secao, CampoGrid, contarPaginas } from "./pdf-form";

describe("contarPaginas", () => {
  it("conta as páginas de um PDF renderizado", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-001" titulo="Documento de teste">
        <Secao n={1} titulo="Seção única">
          <Text>Conteúdo curto.</Text>
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("CampoGrid", () => {
  it("renderiza campo com valor e campo em branco sem estourar", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-002" titulo="Campos">
        <Secao n={1} titulo="Identificação">
          <CampoGrid
            colunas={2}
            campos={[
              { label: "Nome completo", valor: "Fulano de Tal" },
              { label: "RG / Órgão emissor" },
              { label: "CPF", valor: "000.000.000-00" },
              { label: "Contato de emergência" },
            ]}
          />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — não consegue resolver `./pdf-form`

- [ ] **Step 3: Implementar os três primitivos**

Criar `src/lib/pdf-form.tsx`:

```tsx
// Primitivos de formulário em PDF.
//
// Os documentos do alojamento (POL-RH-001, FRM-RH-001 a 005) se descrevem por
// composição destes blocos. A ESTRUTURA mora aqui, em código; o TEXTO narrativo
// mora em documento_template.corpo e é editável em Configurações.
//
// Escala própria de formulário (9pt/1.35), mais densa que a de contrato
// (11pt/1.5 em pdf.tsx) — um formulário é para preencher, não para ler corrido.

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { SLATE_200, SLATE_400, SLATE_500, SLATE_900 } from "@/lib/brand-colors";
import { LogoSistenge, LOGO_LARGURA_MINIMA } from "./pdf-logo";

/** Caixa de marcação vazia, para preenchimento à mão. */
export const CAIXA = "\u2610";

const LOGO_LARGURA = 110; // acima do piso de 85pt do manual

const f = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: SLATE_900,
    lineHeight: 1.35,
  },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  codigo: { fontSize: 7.5, color: SLATE_500, textAlign: "right" },
  titulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitulo: {
    fontSize: 8,
    color: SLATE_500,
    textAlign: "center",
    marginBottom: 14,
  },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: SLATE_200,
    borderTopStyle: "solid",
    paddingTop: 4,
    fontSize: 7,
    color: SLATE_400,
  },
  secao: { marginBottom: 10 },
  secaoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  campoGrid: { flexDirection: "row", flexWrap: "wrap" },
  campo: { paddingRight: 10, marginBottom: 6 },
  campoLabel: { fontSize: 7.5, color: SLATE_500, marginBottom: 1 },
  campoValor: { fontSize: 9 },
  campoLinha: {
    marginTop: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_400,
    borderBottomStyle: "solid",
  },
});

export type Campo = { label: string; valor?: string | null };

/**
 * Conta páginas de um PDF já renderizado.
 *
 * Serve aos testes de densidade: a meta de "nenhum formulário passa de 2
 * páginas" só é meta se o CI reprovar quando ela for rompida. Lê o `/Count` do
 * nó de páginas — suficiente e sem dependência nova.
 */
export function contarPaginas(buffer: Buffer | Uint8Array): number {
  const texto = Buffer.from(buffer).toString("latin1");
  const contagens = [...texto.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  if (contagens.length > 0) return Math.max(...contagens);
  // Fallback: conta os objetos de página.
  return [...texto.matchAll(/\/Type\s*\/Page[^s]/g)].length;
}

export function Documento({
  codigo,
  titulo,
  subtitulo,
  orientacao = "portrait",
  children,
}: {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  orientacao?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  return (
    <Document>
      <Page size="A4" orientation={orientacao} style={f.page}>
        <View style={f.cabecalho} fixed>
          <LogoSistenge width={LOGO_LARGURA} />
          <Text style={f.codigo}>{codigo}</Text>
        </View>
        <Text style={f.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={f.subtitulo}>{subtitulo}</Text> : null}
        {children}
        <View style={f.rodape} fixed>
          <Text>Sistenge Construções e Comércio Ltda — Recursos Humanos</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function Secao({
  n,
  titulo,
  quebrar = true,
  children,
}: {
  n?: number;
  titulo: string;
  /** `false` mantém a seção inteira na mesma página. */
  quebrar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={f.secao} wrap={quebrar}>
      <Text style={f.secaoTitulo}>{n ? `${n}. ${titulo}` : titulo}</Text>
      {children}
    </View>
  );
}

/**
 * Campos label/valor. `valor` ausente ou nulo desenha uma LINHA para preencher
 * à mão — é o que permite guardar só parte dos dados no banco sem bifurcar o
 * layout: promover um campo a "guardado" é passar o valor, nada mais.
 */
export function CampoGrid({
  campos,
  colunas = 2,
}: {
  campos: Campo[];
  colunas?: 1 | 2;
}) {
  const largura = colunas === 2 ? "50%" : "100%";
  return (
    <View style={f.campoGrid}>
      {campos.map((c, i) => (
        <View key={i} style={[f.campo, { width: largura }]}>
          <Text style={f.campoLabel}>{c.label}</Text>
          {c.valor ? (
            <Text style={f.campoValor}>{c.valor}</Text>
          ) : (
            <View style={f.campoLinha} />
          )}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS — 2 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-form.tsx src/lib/pdf-form.test.tsx
git commit -m "feat(pdf): primitivos Documento, Secao e CampoGrid

CampoGrid com valor nulo desenha linha para preenchimento manual — é o
que permite o Loca guardar só parte dos dados do alojado sem bifurcar o
layout do formulário."
```

---

### Task 4: Primitivos de texto — `Lista`, `OpcoesCheck`, `AreaTexto`

**Files:**
- Modify: `src/lib/pdf-form.tsx`
- Test: `src/lib/pdf-form.test.tsx`

**Interfaces:**
- Consumes: estilos de `pdf-form.tsx` (Task 3)
- Produces:
  - `Lista({ itens, tipo? })` — `tipo: "numerada" | "marcador"`
  - `type Opcao = { texto: string; linha?: boolean }`
  - `OpcoesCheck({ opcoes })`
  - `AreaTexto({ linhas })`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/lib/pdf-form.test.tsx`:

```tsx
import { Lista, OpcoesCheck, AreaTexto } from "./pdf-form";

describe("primitivos de texto", () => {
  it("lista numerada, opções com linha e área de escrita cabem em 1 página", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-003" titulo="Texto">
        <Secao n={1} titulo="Regras">
          <Lista tipo="numerada" itens={["Primeira regra.", "Segunda regra."]} />
        </Secao>
        <Secao n={2} titulo="Tipo de medida">
          <OpcoesCheck
            opcoes={[
              { texto: "Advertência verbal" },
              { texto: "Suspensão — período:", linha: true },
            ]}
          />
        </Secao>
        <Secao n={3} titulo="Descrição">
          <AreaTexto linhas={4} />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — `Lista`, `OpcoesCheck` e `AreaTexto` não são exportados

- [ ] **Step 3: Implementar**

Acrescentar aos estilos em `f`:

```ts
  listaItem: { flexDirection: "row", marginBottom: 3 },
  listaMarca: { width: 16, fontSize: 8.5 },
  listaTexto: { flex: 1, fontSize: 8.5, textAlign: "justify" },
  opcao: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  opcaoCaixa: { width: 12, fontSize: 10 },
  opcaoTexto: { fontSize: 8.5 },
  opcaoLinha: {
    flex: 1,
    marginLeft: 4,
    marginBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_400,
    borderBottomStyle: "solid",
  },
  areaLinha: {
    height: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
```

E os componentes:

```tsx
export function Lista({
  itens,
  tipo = "marcador",
}: {
  itens: string[];
  tipo?: "numerada" | "marcador";
}) {
  return (
    <View>
      {itens.map((item, i) => (
        <View key={i} style={f.listaItem} wrap={false}>
          <Text style={f.listaMarca}>{tipo === "numerada" ? `${i + 1}.` : "•"}</Text>
          <Text style={f.listaTexto}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export type Opcao = { texto: string; linha?: boolean };

/** `☐ texto`, com linha à direita quando a opção continua em branco. */
export function OpcoesCheck({ opcoes }: { opcoes: Opcao[] }) {
  return (
    <View>
      {opcoes.map((o, i) => (
        <View key={i} style={f.opcao} wrap={false}>
          <Text style={f.opcaoCaixa}>{CAIXA}</Text>
          <Text style={f.opcaoTexto}>{o.texto}</Text>
          {o.linha ? <View style={f.opcaoLinha} /> : null}
        </View>
      ))}
    </View>
  );
}

/** N linhas em branco para escrita à mão. */
export function AreaTexto({ linhas }: { linhas: number }) {
  return (
    <View>
      {Array.from({ length: linhas }, (_, i) => (
        <View key={i} style={f.areaLinha} />
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS — 3 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-form.tsx src/lib/pdf-form.test.tsx
git commit -m "feat(pdf): primitivos Lista, OpcoesCheck e AreaTexto"
```

---

### Task 5: `Tabela` — validada contra o grid do FRM-RH-005

**Files:**
- Modify: `src/lib/pdf-form.tsx`
- Test: `src/lib/pdf-form.test.tsx`

**Interfaces:**
- Consumes: estilos de `pdf-form.tsx`
- Produces:
  - `type Coluna = { titulo: string; largura: number; alinhar?: "left" | "center" }`
  - `type LinhaTabela = { grupo: string } | { celulas: string[] }`
  - `Tabela({ colunas, linhas })`
  - `somaLarguras(colunas: Coluna[]): number` — helper puro

**Por que o caso difícil primeiro:** cinco dos seis documentos usam `Tabela`, no caso fácil (2 colunas de texto, FRM-RH-001) e no difícil (10 colunas de checkbox em paisagem com linha de grupo, FRM-RH-005). Validar contra o difícil agora evita descobrir na quinta composição que o vocabulário não fecha.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `src/lib/pdf-form.test.tsx`:

```tsx
import { Tabela, somaLarguras, CAIXA, type Coluna, type LinhaTabela } from "./pdf-form";

const COLUNAS_LIMPEZA: Coluna[] = [
  { titulo: "Tarefa", largura: 34 },
  { titulo: "Freq.", largura: 6, alinhar: "center" },
  { titulo: "Seg", largura: 7, alinhar: "center" },
  { titulo: "Ter", largura: 7, alinhar: "center" },
  { titulo: "Qua", largura: 7, alinhar: "center" },
  { titulo: "Qui", largura: 7, alinhar: "center" },
  { titulo: "Sex", largura: 7, alinhar: "center" },
  { titulo: "Sáb", largura: 7, alinhar: "center" },
  { titulo: "Dom", largura: 7, alinhar: "center" },
  { titulo: "Rubrica", largura: 11 },
];

describe("somaLarguras", () => {
  it("as colunas do checklist de limpeza somam 100%", () => {
    expect(somaLarguras(COLUNAS_LIMPEZA)).toBe(100);
  });

  it("as colunas de penalidades somam 100%", () => {
    expect(
      somaLarguras([
        { titulo: "Penalidade", largura: 30 },
        { titulo: "Como se aplica", largura: 70 },
      ]),
    ).toBe(100);
  });
});

describe("Tabela", () => {
  it("o grid de 45 tarefas em paisagem cabe em 2 páginas", async () => {
    const grupos = ["BANHEIROS", "COZINHA / REFEITÓRIO", "QUARTOS", "SALA", "LAVANDERIA"];
    const linhas: LinhaTabela[] = [];
    for (const g of grupos) {
      linhas.push({ grupo: g });
      for (let i = 0; i < 9; i++) {
        linhas.push({
          celulas: [
            `Tarefa ${i + 1} do grupo ${g}, com descrição de tamanho realista`,
            "D",
            CAIXA, CAIXA, CAIXA, CAIXA, CAIXA, CAIXA, CAIXA,
            "",
          ],
        });
      }
    }
    const buffer = await renderToBuffer(
      <Documento
        codigo="FRM-RH-005"
        titulo="Checklist semanal de limpeza"
        orientacao="landscape"
      >
        <Tabela colunas={COLUNAS_LIMPEZA} linhas={linhas} />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — `Tabela` e `somaLarguras` não são exportados

- [ ] **Step 3: Implementar**

Acrescentar aos estilos em `f`:

```ts
  tabela: {
    borderWidth: 0.5,
    borderColor: SLATE_200,
    borderStyle: "solid",
    marginBottom: 8,
  },
  tabelaCabecalho: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCabecalhoCelula: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tabelaLinha: {
    flexDirection: "row",
    minHeight: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCelula: { fontSize: 8, paddingVertical: 2.5, paddingHorizontal: 3 },
  tabelaGrupo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: SLATE_500,
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    backgroundColor: "#F1F5F9",
  },
```

E:

```tsx
export type Coluna = {
  titulo: string;
  /** Largura em % da tabela. A soma das colunas deve dar 100. */
  largura: number;
  alinhar?: "left" | "center";
};

export type LinhaTabela = { grupo: string } | { celulas: string[] };

export function somaLarguras(colunas: Coluna[]): number {
  return colunas.reduce((total, c) => total + c.largura, 0);
}

export function Tabela({
  colunas,
  linhas,
}: {
  colunas: Coluna[];
  linhas: LinhaTabela[];
}) {
  return (
    <View style={f.tabela}>
      <View style={f.tabelaCabecalho} fixed>
        {colunas.map((c, i) => (
          <Text
            key={i}
            style={[
              f.tabelaCabecalhoCelula,
              { width: `${c.largura}%`, textAlign: c.alinhar ?? "left" },
            ]}
          >
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((linha, i) =>
        "grupo" in linha ? (
          <Text key={i} style={f.tabelaGrupo} wrap={false}>
            {linha.grupo}
          </Text>
        ) : (
          <View key={i} style={f.tabelaLinha} wrap={false}>
            {colunas.map((c, j) => (
              <Text
                key={j}
                style={[
                  f.tabelaCelula,
                  { width: `${c.largura}%`, textAlign: c.alinhar ?? "left" },
                ]}
              >
                {linha.celulas[j] ?? ""}
              </Text>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS — 6 testes. Se o grid estourar 2 páginas, reduzir `minHeight` da linha para 12 e `paddingVertical` para 2 antes de mexer em qualquer outra coisa.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-form.tsx src/lib/pdf-form.test.tsx
git commit -m "feat(pdf): primitivo Tabela, validado contra o grid do FRM-RH-005

Tabela é o primitivo com maior risco de não generalizar: vai de 2 colunas
de texto a 10 colunas de checkbox em paisagem. Construída já contra o caso
difícil para não descobrir tarde que o vocabulário não fecha."
```

---

### Task 6: `Assinaturas` com modo manual e aceite

**Files:**
- Modify: `src/lib/pdf-form.tsx`
- Test: `src/lib/pdf-form.test.tsx`

**Interfaces:**
- Consumes: estilos de `pdf-form.tsx`
- Produces:
  - `type Assinante = { papel: string; nome?: string | null; detalhe?: string }`
  - `Assinaturas({ assinantes, modo?, localData? })` — `modo: "manual" | "aceite"`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
import { Assinaturas } from "./pdf-form";

describe("Assinaturas", () => {
  it("quatro assinantes em grid 2x2 cabem em 1 página", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-004" titulo="Assinaturas">
        <Assinaturas
          localData="São Paulo, 22 de agosto de 2026."
          assinantes={[
            { papel: "Empregado(a)", nome: "Fulano de Tal" },
            { papel: "Recursos Humanos — Sistenge" },
            { papel: "Testemunha 1" },
            { papel: "Testemunha 2" },
          ]}
        />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: FAIL — `Assinaturas` não é exportado

- [ ] **Step 3: Implementar**

Estilos:

```ts
  localData: { marginTop: 18, marginBottom: 20, fontSize: 9 },
  assGrid: { flexDirection: "row", flexWrap: "wrap" },
  assCol: { width: "50%", paddingRight: 16, marginBottom: 24 },
  assLinha: {
    borderTopWidth: 0.5,
    borderTopColor: SLATE_900,
    borderTopStyle: "solid",
    paddingTop: 3,
  },
  assNome: { fontSize: 8.5 },
  assPapel: { fontSize: 7.5, color: SLATE_500 },
  assDetalhe: { fontSize: 7, color: SLATE_400 },
```

Componente:

```tsx
export type Assinante = { papel: string; nome?: string | null; detalhe?: string };

/**
 * Grid de assinaturas, 2 por linha.
 *
 * `modo="aceite"` está preparado para a fase de aceite digital: em vez da linha
 * para assinar à mão, imprime o registro de data/hora e IP. As colunas
 * ocupante_imovel.aceite_em / aceite_ip já existem, nulas, desde esta fase.
 */
export function Assinaturas({
  assinantes,
  modo = "manual",
  localData,
}: {
  assinantes: Assinante[];
  modo?: "manual" | "aceite";
  localData?: string;
}) {
  return (
    <View wrap={false}>
      {localData ? <Text style={f.localData}>{localData}</Text> : null}
      <View style={f.assGrid}>
        {assinantes.map((a, i) => (
          <View key={i} style={f.assCol}>
            <View style={f.assLinha}>
              <Text style={f.assNome}>{a.nome || " "}</Text>
              <Text style={f.assPapel}>{a.papel}</Text>
              {modo === "aceite" && a.detalhe ? (
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

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/pdf-form.test.tsx`
Expected: PASS — 7 testes

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf-form.tsx src/lib/pdf-form.test.tsx
git commit -m "feat(pdf): primitivo Assinaturas, com modo manual e aceite

O modo 'aceite' já entra desenhado para a fase de assinatura digital: a
troca será de props, não de layout."
```

---

### Task 7: Migration — cinco colunas em `ocupante_imovel`

**Files:**
- Create: `supabase/migrations/0043_alojamento_ocupante.sql`

**Interfaces:**
- Consumes: tabela `ocupante_imovel` (migration 0020)
- Produces: colunas `cargo`, `quarto`, `armario`, `aceite_em`, `aceite_ip`

- [ ] **Step 1: Escrever a migration**

```sql
-- ============================================================================
-- Alojamento — dados do ocupante exigidos pelo FRM-RH-001 (Termo de
-- Compromisso de Alojamento).
--
-- O bloco de identificação do termo tem 15 campos. O Loca passa a guardar os
-- três que ele de fato controla (cargo, quarto, armário); RG, data de admissão
-- e contato de emergência saem como linha em branco no PDF, para preenchimento
-- manual — o CampoGrid trata `valor: null` desenhando a linha.
--
-- aceite_em / aceite_ip entram NULAS agora, para a fase de aceite digital. O
-- primitivo <Assinaturas modo="aceite"> já existe; criar as colunas junto evita
-- uma migration só para elas depois.
-- ============================================================================
alter table public.ocupante_imovel
  add column if not exists cargo     text,
  add column if not exists quarto    text,
  add column if not exists armario   text,
  add column if not exists aceite_em timestamptz,
  add column if not exists aceite_ip inet;

comment on column public.ocupante_imovel.aceite_ip is
  'IP do aceite eletrônico do termo. inet, não text: é um endereço IP.';

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar**

Run: `npx supabase db push`
Expected: aplica apenas `0043_alojamento_ocupante.sql`

- [ ] **Step 3: Conferir**

Run:
```bash
npx supabase db push --dry-run
```
Expected: nenhuma migration pendente

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0043_alojamento_ocupante.sql
git commit -m "feat(db): colunas de alojamento em ocupante_imovel

cargo/quarto/armario alimentam o FRM-RH-001; aceite_em/aceite_ip entram
nulas para a fase de aceite digital."
```

---

### Task 8: `ocupanteSchema` e migração do formulário para `react-hook-form`

**Files:**
- Modify: `src/lib/imoveis.ts` (fim do arquivo)
- Modify: `src/app/(app)/imoveis/actions.ts:570-592`
- Modify: `src/app/(app)/imoveis/ocupante-form.tsx`
- Test: `src/lib/imoveis.test.ts` (criar)

**Interfaces:**
- Consumes: `texto()` (helper local de `imoveis.ts`), `ActionResult`/`falha`/`primeiroErro` de `@/lib/acoes`
- Produces:
  - `ocupanteSchema`, `type OcupanteInput`, `type OcupanteDados` em `@/lib/imoveis`
  - `salvarOcupante(raw: unknown): Promise<ActionResult>`

**Por que migrar:** o formulário vai de 5 para 8 campos e tem validação cruzada (`data_saida` não pode ser anterior a `data_entrada`), cruzando o limiar do AGENTS.md. Mesmo caminho do `ReparoForm` (commit `a279aca`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/imoveis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ocupanteSchema } from "./imoveis";

const base = {
  imovel_id: "11111111-1111-1111-1111-111111111111",
  nome: "Fulano de Tal",
};

describe("ocupanteSchema", () => {
  it("aceita o mínimo: imóvel e nome", () => {
    const r = ocupanteSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("exige o nome", () => {
    const r = ocupanteSchema.safeParse({ ...base, nome: "  " });
    expect(r.success).toBe(false);
  });

  it("campo de texto vazio vira null, não string vazia", () => {
    const r = ocupanteSchema.parse({ ...base, cargo: "", quarto: "  " });
    expect(r.cargo).toBeNull();
    expect(r.quarto).toBeNull();
  });

  it("recusa saída anterior à entrada", () => {
    const r = ocupanteSchema.safeParse({
      ...base,
      data_entrada: "2026-08-10",
      data_saida: "2026-08-01",
    });
    expect(r.success).toBe(false);
  });

  it("aceita saída igual à entrada", () => {
    const r = ocupanteSchema.safeParse({
      ...base,
      data_entrada: "2026-08-10",
      data_saida: "2026-08-10",
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/imoveis.test.ts`
Expected: FAIL — `ocupanteSchema` não é exportado

- [ ] **Step 3: Implementar o schema**

Acrescentar ao fim de `src/lib/imoveis.ts`:

```ts
export const ocupanteSchema = z
  .object({
    id: z.string().uuid().optional(),
    imovel_id: z.string().uuid(),
    nome: z.string().trim().min(1, "Informe o nome do ocupante.").max(200),
    cpf: texto(20),
    contato: texto(40),
    cargo: texto(120),
    quarto: texto(40),
    armario: texto(40),
    data_entrada: texto(10),
    data_saida: texto(10),
    observacoes: texto(1000),
  })
  .refine(
    (v) => !v.data_entrada || !v.data_saida || v.data_saida >= v.data_entrada,
    { message: "A saída não pode ser anterior à entrada.", path: ["data_saida"] },
  );

export type OcupanteInput = z.input<typeof ocupanteSchema>;
export type OcupanteDados = z.output<typeof ocupanteSchema>;
```

**Nota:** a comparação `>=` funciona direto em strings `yyyy-mm-dd` (ordem lexicográfica = ordem cronológica). Nada de `new Date()` aqui — seria fuso errado e desnecessário.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/imoveis.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Converter a action**

Substituir `salvarOcupante` em `src/app/(app)/imoveis/actions.ts` (linhas 570–592):

```ts
export async function salvarOcupante(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para cadastrar ocupantes.");
  }

  const parsed = ocupanteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { imovel_id, id: _id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ocupante_imovel").insert({
    org_id: perfil.org_id,
    imovel_id,
    ...campos,
  });
  if (error) return falha("Não foi possível salvar o ocupante.");

  // Sem `redirect()`: a action devolve {ok} e o form chama router.refresh().
  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}
```

Conferir que `ocupanteSchema` está no import de `@/lib/imoveis` no topo do arquivo, e que `falha`/`primeiroErro`/`ActionResult` já vêm de `@/lib/acoes` (o `salvarReparo` já os usa).

- [ ] **Step 6: Converter o formulário**

Substituir `src/app/(app)/imoveis/ocupante-form.tsx`:

```tsx
"use client";

// `OcupanteForm` está em react-hook-form: são 8 campos e há validação cruzada
// (a saída não pode ser anterior à entrada). Mesmo caminho do ReparoForm.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ocupanteSchema,
  type OcupanteDados,
  type OcupanteInput,
} from "@/lib/imoveis";
import { salvarOcupante } from "./actions";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OcupanteForm({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const vazio: OcupanteInput = {
    imovel_id: imovelId,
    nome: "",
    cpf: "",
    contato: "",
    cargo: "",
    quarto: "",
    armario: "",
    data_entrada: "",
    data_saida: "",
    observacoes: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OcupanteInput, unknown, OcupanteDados>({
    resolver: zodResolver(ocupanteSchema),
    defaultValues: vazio,
  });

  function onSubmit(values: OcupanteDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarOcupante(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Ocupante cadastrado.");
      reset(vazio);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="oc_nome">Nome</Label>
          <Input id="oc_nome" {...register("nome")} />
          <FormError mensagem={errors.nome?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_cpf">CPF</Label>
          <Input id="oc_cpf" {...register("cpf")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_contato">Contato</Label>
          <Input id="oc_contato" {...register("contato")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_cargo">Função / Cargo</Label>
          <Input id="oc_cargo" {...register("cargo")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_quarto">Nº do quarto</Label>
          <Input id="oc_quarto" {...register("quarto")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_armario">Nº do armário</Label>
          <Input id="oc_armario" {...register("armario")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_entrada">Entrada</Label>
          <Input id="oc_entrada" type="date" {...register("data_entrada")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_saida">Saída</Label>
          <Input id="oc_saida" type="date" {...register("data_saida")} />
          <FormError mensagem={errors.data_saida?.message} />
        </div>
      </div>
      <FormError mensagem={erroServidor} />
      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : "Adicionar ocupante"}
      </Button>
    </form>
  );
}
```

**Antes de escrever:** confirmar a prop do `FormError` rodando `sed -n '1,30p' src/components/shared/form-error.tsx` e ajustar `mensagem=` para o nome real da prop.

- [ ] **Step 7: Verificar tipos e lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS. Se `ImovelFormState` ficou sem uso em `actions.ts`, mantê-lo — outros forms ainda o usam.

- [ ] **Step 8: Commit**

```bash
git add src/lib/imoveis.ts src/lib/imoveis.test.ts "src/app/(app)/imoveis/actions.ts" "src/app/(app)/imoveis/ocupante-form.tsx"
git commit -m "feat(imoveis): ocupante com cargo, quarto e armário em react-hook-form

São 8 campos e há validação cruzada de datas — cruza o limiar do AGENTS.md.
A action passa a devolver ActionResult em vez de redirecionar."
```

---

### Task 9: Catálogo de documentos ligado ao módulo

**Files:**
- Modify: `src/lib/templates.ts:5-85`
- Modify: `src/app/(app)/configuracoes/templates/page.tsx`
- Test: `src/lib/templates.test.ts`

**Interfaces:**
- Consumes: `ModuloKey` de `@/lib/modulos`, `CategoriaBiblioteca` de `@/lib/biblioteca`
- Produces: `DocumentoInfo` com `modulo`, `categoria`, `preenchimento`; `documentosDoModulo(modulo)`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `src/lib/templates.test.ts`:

```ts
import { DOCUMENTOS, documentosDoModulo } from "./templates";

describe("catálogo de documentos", () => {
  it("todo documento declara módulo, categoria e preenchimento", () => {
    for (const d of DOCUMENTOS) {
      expect(d.modulo, `documento ${d.tipo}`).toBeTruthy();
      expect(d.categoria, `documento ${d.tipo}`).toBeTruthy();
      expect(["com_dados", "em_branco"]).toContain(d.preenchimento);
    }
  });

  it("filtra por módulo", () => {
    const imoveis = documentosDoModulo("imoveis");
    expect(imoveis.length).toBeGreaterThan(0);
    expect(imoveis.every((d) => d.modulo === "imoveis")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — `documentosDoModulo` não existe e os campos não estão no tipo

- [ ] **Step 3: Estender o tipo e o catálogo**

Em `src/lib/templates.ts`, acrescentar aos imports do topo:

```ts
import type { ModuloKey } from "@/lib/modulos";
import type { CategoriaBiblioteca } from "@/lib/biblioteca";
```

Estender o tipo:

```ts
export type DocumentoInfo = {
  tipo: TipoDocumento;
  label: string;
  descricao: string;
  eyebrow: string; // subtítulo fixo no topo do documento
  /** Módulo a que o documento pertence — governa onde ele aparece. */
  modulo: ModuloKey;
  /** Categoria na tela de documentos do alojamento. */
  categoria: CategoriaBiblioteca;
  /** Sai preenchido com dados do sistema, ou em branco para preencher à mão. */
  preenchimento: "com_dados" | "em_branco";
  variaveis: VariavelInfo[];
};
```

Acrescentar os três campos a cada entrada de `DOCUMENTOS`:

- `contrato_imovel`: `modulo: "imoveis"`, `categoria: "formulario"`, `preenchimento: "com_dados"`
- `contrato_equipamento`: `modulo: "contratos"`, `categoria: "formulario"`, `preenchimento: "com_dados"`
- `termo_responsabilidade`: `modulo: "imoveis"`, `categoria: "formulario"`, `preenchimento: "com_dados"`

E o helper, junto de `documentoInfo`:

```ts
/** Documentos de um módulo, na ordem do catálogo. */
export function documentosDoModulo(modulo: ModuloKey): DocumentoInfo[] {
  return DOCUMENTOS.filter((d) => d.modulo === modulo);
}
```

**Verificar que `templates.ts` continua client-safe:** `modulos.ts` e `biblioteca.ts` não têm dependência de servidor, então o import é seguro. Confirmar com `head -5 src/lib/modulos.ts src/lib/biblioteca.ts`.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS

- [ ] **Step 5: Agrupar a tela de Templates por módulo**

Em `src/app/(app)/configuracoes/templates/page.tsx`, substituir o `<Card>` único por um card por módulo. Acrescentar aos imports:

```tsx
import { MODULOS } from "@/lib/modulos";
import { DOCUMENTOS, documentosDoModulo } from "@/lib/templates";
import { SecaoTitulo } from "@/components/shared/config-row";
```

E trocar o corpo do retorno (mantendo `PageHeader` e a busca de `personalizados`):

```tsx
      {MODULOS.filter((m) => documentosDoModulo(m.chave).length > 0).map((m) => (
        <div key={m.chave} className="space-y-2">
          <SecaoTitulo>{m.label}</SecaoTitulo>
          <Card>
            <CardContent className="divide-y p-0">
              {documentosDoModulo(m.chave).map((doc) => (
                <ConfigRow
                  key={doc.tipo}
                  href={`/configuracoes/templates/${doc.tipo}`}
                  icon={FileText}
                  titulo={doc.label}
                  descricao={doc.descricao}
                  extra={
                    personalizados.has(doc.tipo) ? (
                      <Badge variant="secondary">Personalizado</Badge>
                    ) : (
                      <Badge variant="outline">Padrão</Badge>
                    )
                  }
                />
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
```

Se `DOCUMENTOS` ficar sem uso direto no arquivo, remover do import.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts "src/app/(app)/configuracoes/templates/page.tsx"
git commit -m "feat(templates): catálogo de documentos ligado ao módulo

Um catálogo só, com modulo/categoria/preenchimento. A tela de Templates
agrupa por módulo, e a filtragem de moduloLiberado passa a valer para
documentos de graça."
```

---

### Task 10: Texto do FRM-RH-001 como padrão do termo

**Files:**
- Modify: `src/lib/templates.ts` (entrada `termo_responsabilidade` em `DOCUMENTOS` e em `DEFAULT_TEMPLATES`)
- Test: `src/lib/templates.test.ts`

**Interfaces:**
- Consumes: `renderTemplate`, `corpoParaParagrafos` (já existem)
- Produces: `DEFAULT_TEMPLATES.termo_responsabilidade` com o texto do FRM-RH-001 e 11 variáveis

**Fonte do texto:** `Referencias/Documentos/FRM-RH-001-Termo_Compromisso_Alojamento.docx`, seções 2 (22 regras), 3 (CFTV), 4 (armário) e 6 (declarações finais). As seções 1 (identificação), 5 (penalidades) e 7 (assinaturas) **não** vão para o template — são estrutura, e viram `CampoGrid`, `Tabela` e `Assinaturas` na Task 11.

- [ ] **Step 1: Escrever o teste que falha**

```ts
describe("termo de compromisso (FRM-RH-001)", () => {
  const tpl = DEFAULT_TEMPLATES.termo_responsabilidade;

  it("o título é o do FRM-RH-001", () => {
    expect(tpl.titulo).toContain("COMPROMISSO");
  });

  it("cobre as regras que sustentam justa causa", () => {
    for (const termo of ["22h", "drogas", "CFTV", "armário", "cozinhar"]) {
      expect(tpl.corpo.toLowerCase()).toContain(termo.toLowerCase());
    }
  });

  it("declara o canal de denúncias exigido pela Lei 14.457/2022", () => {
    expect(tpl.corpo).toContain("sistenge-ouvidoria.vercel.app");
  });

  it("toda variável usada no corpo está declarada no catálogo", () => {
    const doc = DOCUMENTOS.find((d) => d.tipo === "termo_responsabilidade")!;
    const declaradas = new Set(doc.variaveis.map((v) => v.chave));
    const usadas = [...tpl.corpo.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1]);
    for (const u of usadas) expect(declaradas, `variável {{${u}}}`).toContain(u);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: FAIL — o título ainda é "TERMO DE RESPONSABILIDADE" e o corpo não tem as regras

- [ ] **Step 3: Extrair o texto original**

Run:
```bash
mkdir -p /tmp/frm && cd /tmp/frm && unzip -o -q "c:/Projetos_Sistenge/Loca/Referencias/Documentos/FRM-RH-001-Termo_Compromisso_Alojamento.docx" && python -c "
import re
xml=open('word/document.xml',encoding='utf-8').read()
xml=xml.replace('</w:p>','\n')
print(re.sub(r'<[^>]+>','',xml))
"
```
Copiar as 22 regras da seção 2, os 7 itens da seção 3, os 6 da seção 4 e os 6 da seção 6, **preservando acentuação**.

- [ ] **Step 4: Escrever o template**

Substituir a entrada `termo_responsabilidade` de `DEFAULT_TEMPLATES`. O corpo usa parágrafos separados por linha em branco (`corpoParaParagrafos` os separa) e marcadores `—` para as listas. Estrutura:

```ts
  termo_responsabilidade: {
    titulo: "TERMO DE COMPROMISSO DE ALOJAMENTO",
    corpo: [
      "Pelo presente Termo de Compromisso, o(a) empregado(a) abaixo identificado(a), nesta data admitido(a) por {{empresa_nome}}, declara conhecer e aceitar as regras de uso, convivência, higiene e segurança do alojamento que lhe foi disponibilizado pela empresa para residência temporária durante a execução do contrato de trabalho.",
      "Este Termo é parte integrante do contrato de trabalho e referencia a Política de Alojamento POL-RH-001, à qual o(a) empregado(a) teve acesso integral antes da assinatura.",
      "REGRAS QUE DECLARO CONHECER E ME COMPROMETO A CUMPRIR",
      // ...as 22 regras, uma por parágrafo, cada uma iniciada por "— "...
      "CÂMERAS DE SEGURANÇA (CFTV) — CONSENTIMENTO INFORMADO",
      // ...os 7 itens...
      "ARMÁRIO INDIVIDUAL — GUARDA E RESPONSABILIDADE",
      // ...os 6 itens...
      "DECLARAÇÕES FINAIS",
      // ...os 6 itens, incluindo o do canal de denúncias...
    ].join("\n\n"),
  },
```

E as variáveis da entrada `termo_responsabilidade` em `DOCUMENTOS`:

```ts
    variaveis: [
      { chave: "ocupante", descricao: "Nome do alojado" },
      { chave: "ocupante_cpf", descricao: "CPF do alojado" },
      { chave: "ocupante_cargo", descricao: "Função / cargo" },
      { chave: "imovel", descricao: "Alojamento — apelido (tipo)" },
      { chave: "imovel_endereco", descricao: "Endereço do alojamento" },
      { chave: "quarto", descricao: "Nº do alojamento / quarto" },
      { chave: "armario", descricao: "Nº do armário individual" },
      { chave: "obra", descricao: "Contrato / obra" },
      { chave: "centro_resultado", descricao: "Centro de Resultado (CR)" },
      { chave: "empresa_nome", descricao: "Nome da empresa (cedente)" },
      { chave: "cidade", descricao: "Cidade do alojamento" },
    ],
```

E o `label`/`descricao` da entrada: `label: "Termo de Compromisso de Alojamento (FRM-RH-001)"`, `descricao: "Gerado no ocupante do imóvel (botão “Gerar termo”)."`, `eyebrow: "FRM-RH-001 · Termo de Compromisso"`.

- [ ] **Step 5: Rodar e verificar que passa**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates.ts src/lib/templates.test.ts
git commit -m "feat(templates): FRM-RH-001 vira o texto padrão do termo

O termo genérico anterior era o FRM-RH-001 empobrecido: sem consentimento
de CFTV, sem cláusula de armário, sem canal de denúncias. Nenhuma linha de
documento_template é tocada — quem customizou continua com o texto dele."
```

---

### Task 11: Compor o Termo de Compromisso e ligar à rota de PDF

**Files:**
- Create: `src/lib/documentos/frm-rh-001.tsx`
- Modify: `src/app/api/imoveis/[id]/termo-pdf/route.tsx`
- Test: `src/lib/documentos/frm-rh-001.test.tsx`

**Interfaces:**
- Consumes: `Documento`, `Secao`, `CampoGrid`, `Lista`, `Tabela`, `Assinaturas`, `type Campo`, `type Coluna` de `@/lib/pdf-form`; `corpoParaParagrafos`, `renderTemplate` de `@/lib/templates`
- Produces: `TermoCompromisso({ campos, paragrafos, orgNome, localData })`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/documentos/frm-rh-001.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { corpoParaParagrafos, DEFAULT_TEMPLATES, renderTemplate } from "@/lib/templates";
import { TermoCompromisso } from "./frm-rh-001";

const VARIAVEIS = {
  ocupante: "Fulano de Tal",
  ocupante_cpf: "000.000.000-00",
  ocupante_cargo: "Pedreiro",
  imovel: "Alojamento Central (casa)",
  imovel_endereco: "Rua das Obras, 100, São Paulo, SP",
  quarto: "3",
  armario: "12",
  obra: "OBRA-001 — Edifício Aurora",
  centro_resultado: "CR-4410",
  empresa_nome: "Sistenge Construções e Comércio Ltda",
  cidade: "São Paulo",
};

function montar() {
  const tpl = DEFAULT_TEMPLATES.termo_responsabilidade;
  return (
    <TermoCompromisso
      orgNome={VARIAVEIS.empresa_nome}
      titulo={renderTemplate(tpl.titulo, VARIAVEIS)}
      campos={[
        { label: "Nome completo", valor: VARIAVEIS.ocupante },
        { label: "CPF", valor: VARIAVEIS.ocupante_cpf },
        { label: "RG / Órgão emissor" },
        { label: "Função / Cargo", valor: VARIAVEIS.ocupante_cargo },
        { label: "Centro de Resultado (CR)", valor: VARIAVEIS.centro_resultado },
        { label: "Contrato / Obra", valor: VARIAVEIS.obra },
        { label: "Data de admissão" },
        { label: "Endereço do alojamento", valor: VARIAVEIS.imovel_endereco },
        { label: "Nº do alojamento / Quarto", valor: VARIAVEIS.quarto },
        { label: "Nº do armário individual", valor: VARIAVEIS.armario },
        { label: "Encarregado responsável" },
        { label: "Telefone do encarregado" },
        { label: "Contato de emergência (nome)" },
        { label: "Contato de emergência (telefone)" },
      ]}
      paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, VARIAVEIS))}
      localData="São Paulo, 22 de agosto de 2026."
    />
  );
}

describe("FRM-RH-001", () => {
  it("cabe em 2 páginas", async () => {
    expect(contarPaginas(await renderToBuffer(montar()))).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run src/lib/documentos/frm-rh-001.test.tsx`
Expected: FAIL — não resolve `./frm-rh-001`

- [ ] **Step 3: Implementar a composição**

Criar `src/lib/documentos/frm-rh-001.tsx`:

```tsx
// FRM-RH-001 — Termo de Compromisso de Alojamento.
//
// ESTRUTURA aqui; TEXTO em documento_template, tipo `termo_responsabilidade`,
// editável em Configurações → Templates de documentos.
//
// Os parágrafos do template vêm em blocos; os que estão em CAIXA ALTA e sem
// ponto final são tratados como título de subseção, e os iniciados por "— "
// viram itens de lista.

import { Text } from "@react-pdf/renderer";
import {
  Documento,
  Secao,
  CampoGrid,
  Lista,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
} from "@/lib/pdf-form";

const COLUNAS_PENALIDADE: Coluna[] = [
  { titulo: "Penalidade", largura: 30 },
  { titulo: "Como se aplica", largura: 70 },
];

const PENALIDADES = [
  { celulas: ["Advertência verbal", "Aplicada pelo Encarregado, registrada em livro de ocorrências."] },
  { celulas: ["Advertência escrita", "Aplicada pelo RH (FRM-RH-002), com ciência do empregado e juntada à pasta funcional."] },
  { celulas: ["Suspensão disciplinar (1 a 30 dias)", "Sem remuneração, conforme art. 474 da CLT. Aplicável diretamente em casos como visita íntima, consumo de bebida alcoólica ou adulteração de câmeras."] },
  { celulas: ["Rescisão por justa causa", "Nas hipóteses do art. 482 da CLT — improbidade, indisciplina, agressão, porte ou uso de drogas e demais infrações graves."] },
];

/** Um parágrafo do template é título de subseção quando está em caixa alta. */
function ehSubtitulo(p: string): boolean {
  return p === p.toUpperCase() && !p.endsWith(".");
}

export function TermoCompromisso({
  orgNome,
  titulo,
  campos,
  paragrafos,
  localData,
}: {
  orgNome: string;
  titulo: string;
  campos: Campo[];
  paragrafos: string[];
  localData: string;
}) {
  // Agrupa os parágrafos: cada subtítulo abre um bloco, e os "— " viram lista.
  const blocos: { titulo?: string; itens: string[]; texto: string[] }[] = [];
  let atual = { titulo: undefined as string | undefined, itens: [] as string[], texto: [] as string[] };
  for (const p of paragrafos) {
    if (ehSubtitulo(p)) {
      blocos.push(atual);
      atual = { titulo: p, itens: [], texto: [] };
    } else if (p.startsWith("— ")) {
      atual.itens.push(p.slice(2));
    } else {
      atual.texto.push(p);
    }
  }
  blocos.push(atual);

  return (
    <Documento
      codigo="FRM-RH-001"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Identificação do Alojado">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      {blocos
        .filter((b) => b.titulo || b.itens.length > 0 || b.texto.length > 0)
        .map((b, i) => (
          <Secao key={i} titulo={b.titulo ?? "Apresentação"} quebrar>
            {b.texto.map((t, j) => (
              <Text key={j} style={{ fontSize: 8.5, textAlign: "justify", marginBottom: 4 }}>
                {t}
              </Text>
            ))}
            {b.itens.length > 0 ? <Lista tipo="numerada" itens={b.itens} /> : null}
          </Secao>
        ))}

      <Secao titulo="Penalidades — estou ciente de que">
        <Tabela colunas={COLUNAS_PENALIDADE} linhas={PENALIDADES} />
      </Secao>

      <Assinaturas
        localData={localData}
        assinantes={[
          { papel: "Empregado(a)", nome: campos[0]?.valor ?? undefined },
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Testemunha 1" },
          { papel: "Testemunha 2" },
        ]}
      />
    </Documento>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run src/lib/documentos/frm-rh-001.test.tsx`
Expected: PASS. Se estourar 2 páginas, reduzir o `marginBottom` da `Secao` para 8 e o `fontSize` das listas para 8, nessa ordem — nunca cortar cláusula.

- [ ] **Step 5: Ligar a rota**

Em `src/app/api/imoveis/[id]/termo-pdf/route.tsx`, substituir a montagem do `DocumentoTexto` pelo `TermoCompromisso`. As mudanças:

1. Trocar o import `DocumentoTexto` por `TermoCompromisso` de `@/lib/documentos/frm-rh-001`.
2. Ampliar o `select` do ocupante para `nome, cpf, cargo, quarto, armario`.
3. Buscar a obra do imóvel para `obra` e `centro_resultado`:

```tsx
  const { data: obra } = imovel.obra_id
    ? await supabase
        .from("obra")
        .select("codigo, nome, centro_custo")
        .eq("id", imovel.obra_id)
        .single()
    : { data: null };
```
   (acrescentar `obra_id` ao `select` do imóvel)
4. Montar `campos` com os 14 rótulos do teste da Step 1, passando `valor` só onde há dado.
5. Ampliar `variaveis` com `ocupante_cargo`, `quarto`, `armario`, `obra`, `centro_resultado`.
6. Renderizar:

```tsx
  const buffer = await renderToBuffer(
    <TermoCompromisso
      orgNome={orgNome}
      titulo={tituloDoc}
      campos={campos}
      paragrafos={paragrafos}
      localData={`${imovel.cidade ?? "________"}, ${hojeStr}.`}
    />,
  );
```

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/documentos "src/app/api/imoveis/[id]/termo-pdf/route.tsx"
git commit -m "feat(imoveis): termo do ocupante passa a ser o FRM-RH-001

Estrutura por composição dos primitivos; texto vindo do template. Teste
trava a densidade em 2 páginas."
```

---

### Task 12: Logo no `DocumentoTexto` e fechamento da versão 0.24.0

**Files:**
- Modify: `src/lib/pdf.tsx` (`DocumentoTexto`, ~linha 418)
- Modify: `src/lib/changelog.ts:17` e o topo de `CHANGELOG`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `LogoSistenge` de `./pdf-logo` (Task 2)
- Produces: versão 0.24.0 nos três pontos

- [ ] **Step 1: Trocar a palavra pelo logo**

Em `src/lib/pdf.tsx`, no `DocumentoTexto`, substituir:

```tsx
        <Text style={docStyles.marca}>SISTENGE</Text>
```

por:

```tsx
        <LogoSistenge width={110} />
```

Remover o estilo `marca` de `docStyles` se ficar sem uso.

- [ ] **Step 2: Verificar que os documentos de texto seguem renderizando**

Run: `npm run typecheck && npm run lint && npx vitest run`
Expected: PASS

- [ ] **Step 3: Bumpar a versão nos três pontos**

`src/lib/changelog.ts` — `APP_VERSION = "0.24.0"` e, no topo de `CHANGELOG`:

```ts
  {
    versao: "0.24.0",
    data: "2026-08-22",
    titulo: "Termo de Compromisso de Alojamento",
    mudancas: [
      { tipo: "novo", texto: "O termo do ocupante agora é o Termo de Compromisso de Alojamento (FRM-RH-001), com as regras de convivência, o consentimento de câmeras, a cláusula de armário e o canal de denúncias." },
      { tipo: "novo", texto: "O cadastro do ocupante ganhou função, número do quarto e número do armário, que saem preenchidos no termo." },
      { tipo: "melhoria", texto: "Os templates de documentos agora aparecem agrupados por módulo." },
      { tipo: "melhoria", texto: "Contratos e termos passaram a sair com o logotipo da Sistenge no lugar do nome escrito." },
    ],
  },
```

`CHANGELOG.md` — acrescentar a seção equivalente no topo, formato Keep a Changelog.

`package.json` — `"version": "0.24.0"`.

- [ ] **Step 4: Ritual de fechamento**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: os quatro passam

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf.tsx src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore(release): 0.24.0 — Termo de Compromisso de Alojamento"
```

---

## Self-Review

**1. Cobertura da spec (fase 1):**

| Requisito da spec | Task |
|---|---|
| 8 primitivos | 3, 4, 5, 6 |
| `Tabela` validada contra o 005 | 5 |
| Logo no lugar da palavra `SISTENGE` | 12 |
| Piso de 85pt do logo | 2 (constante `LOGO_LARGURA_MINIMA`) |
| `ocupante_imovel` +5 colunas | 7 |
| `ocupante-form` em react-hook-form | 8 |
| `DocumentoInfo` com modulo/categoria/preenchimento | 9 |
| Tela de Templates agrupada por módulo | 9 |
| FRM-RH-001 substitui o termo, sem tocar em linhas existentes | 10 |
| Composição do FRM-RH-001 + rota | 11 |
| Teste de contagem de páginas | 3 (helper), 5, 11 |
| Versão nos três pontos | 12 |

Fora do escopo desta fase, por desenho: POL-RH-001 e os outros quatro formulários (fase 2); `medida_disciplinar` e `entrega_ocupante` (fase 3); limpeza (fase 4); aceite digital (fase 5).

**2. Placeholders:** nenhum. Os pontos de "copiar o texto do .docx" (Task 10, Step 3) trazem o comando exato de extração.

**3. Consistência de tipos:** `Campo`, `Coluna`, `LinhaTabela`, `Opcao` e `Assinante` são definidos na Task em que aparecem primeiro e importados por nome idêntico depois. `contarPaginas` é definido na Task 3 e usado nas 5, 6 e 11. `ocupanteSchema`/`OcupanteDados` definidos na Task 8 e usados na mesma. `documentosDoModulo` definido e usado na Task 9.

## Riscos de execução

- **A `Tabela` pode estourar 2 páginas no teste da Task 5.** Saída prevista e ordenada: `minHeight` 14 → 12, depois `paddingVertical` 2.5 → 2. Não mexer nas larguras — elas somam 100 e o teste garante isso.
- **O `FormError` pode ter outra prop além de `mensagem`.** A Task 8 manda conferir antes de escrever.
- **`npx supabase db push` (Task 7) atinge o banco remoto.** Se a intenção for testar antes, aplicar primeiro no Postgres local.
