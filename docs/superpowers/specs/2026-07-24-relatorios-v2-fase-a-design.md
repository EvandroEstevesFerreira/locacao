# Relatórios v2 — Fase A (fundação + relatórios atuais)

**Data:** 2026-07-24
**Status:** aprovado (design)
**Contexto:** primeira fase do roadmap "Melhorias em relatórios" do Loca.

## Objetivo

Fortalecer a base do módulo de relatórios para que as fases seguintes (B: novos
tipos; C: gráficos + envio por e-mail) reaproveitem tudo. Nesta fase A:

1. **Filtros novos**: por **fornecedor** e por **status** (pago/pendente), além dos
   atuais obra + período.
2. **Coluna Fornecedor** nos relatórios de *Itens em aberto* e *Contas a pagar*.
3. **Subtotais por obra + total geral** no rodapé, em tela, PDF e Excel.

Fora de escopo (fases futuras): novos tipos de relatório (ociosidade, custo por
fornecedor, avarias), gráficos e envio automático por e-mail.

## Arquitetura atual (ponto de partida)

`gerarRelatorio(supabase, tipo, filtros)` em `src/lib/relatorios.ts` devolve
`{ titulo, colunas, linhas }`. Três renderizadores consomem essa estrutura:

- Tela: `src/app/(app)/relatorios/page.tsx`
- PDF: `src/app/api/relatorios/pdf/route.tsx` → `DocumentoRelatorio` em `src/lib/pdf.tsx`
- Excel: `src/app/api/relatorios/excel/route.ts`

Relatórios existentes: `itens_abertos`, `contas_pagar`, `custo_por_obra`.

**Decisão de arquitetura (Abordagem A):** manter `{colunas, linhas}` como fonte
única e introduzir um **helper puro** que expande as linhas com subtotais/total.
Assim os três renderizadores herdam agrupamento e totais sem duplicar lógica.

## Modelo de dados (tipos em `relatorios.ts`)

- `Coluna` permanece `{ key, label, tipo }`. Colunas `tipo === "moeda"` são
  **somáveis** automaticamente (sem flag extra).
- `Relatorio` ganha campo opcional **`agruparPor?: string`** — a `key` de uma
  coluna pelo qual agrupar (ex.: `"obra"`). Ausente ⇒ sem subtotais.
- `FiltrosRelatorio` ganha **`fornecedor_id?: string`** e **`status?: "pago" | "pendente"`**.

### Novo helper puro

```ts
export type LinhaRelatorio =
  | { tipo: "dado"; valores: Record<string, string | number | null> }
  | { tipo: "subtotal"; rotulo: string; valores: Record<string, number> }
  | { tipo: "total"; rotulo: string; valores: Record<string, number> };

export function expandirLinhas(relatorio: Relatorio): LinhaRelatorio[];
```

Comportamento:
- Se `agruparPor` estiver definido: ordena as linhas pela `key` de agrupamento
  (comparação por string do valor formatado), emite as linhas `dado` de cada grupo
  seguidas de uma linha `subtotal` (rótulo = valor do grupo; soma das colunas de
  moeda daquele grupo). Ao final, uma linha `total` com o rótulo "TOTAL GERAL".
- Se `agruparPor` estiver ausente: emite as linhas `dado` e uma única linha `total`
  ("TOTAL GERAL") — usada por `custo_por_obra`.
- Colunas somadas: apenas as de `tipo === "moeda"`. Nas linhas subtotal/total, as
  demais colunas ficam vazias (o rótulo ocupa a primeira coluna de texto).
- Se não houver nenhuma coluna de moeda, não emite subtotal/total (retorna só `dado`).

## Mudanças por relatório (em `relatorios.ts`)

### `itens_abertos`
- `select` passa a incluir `contrato.fornecedor:fornecedor_id(nome)`.
- Nova coluna `{ key: "fornecedor", label: "Fornecedor", tipo: "texto" }` (após "Contrato").
- Linha ganha `fornecedor: contrato?.fornecedor?.nome ?? "—"`.
- Filtro por fornecedor: aplicado como o de obra já é (client-side sobre o resultado,
  comparando `contrato.fornecedor_id`). Requer trazer `fornecedor_id` no select do contrato.
- `agruparPor: "obra"`.

### `contas_pagar`
- `select` passa a incluir `contrato:contrato_id(fornecedor_id, fornecedor:fornecedor_id(nome))`.
- Nova coluna `{ key: "fornecedor", label: "Fornecedor", tipo: "texto" }` (após "Obra").
- Linha ganha `fornecedor` (via contrato; avulso ⇒ "—").
- Filtros: `status` **no servidor** (`.eq("status", filtros.status)` quando presente);
  `fornecedor_id` **client-side** (ver decisão abaixo).
- `agruparPor: "obra"`.

### `custo_por_obra`
- Sem coluna de fornecedor (é uma visão agregada por obra).
- Aplica `status` no servidor e `fornecedor_id` client-side (mesmo embed de
  `contas_pagar`) antes de agregar por obra, para manter coerência.
- **Sem** `agruparPor` (cada linha já é uma obra) ⇒ recebe só o **total geral**.

**Decisão de implementação (filtro de fornecedor):** o filtro por `fornecedor_id` é
sempre aplicado **client-side**, após o fetch, em todos os três relatórios. Motivo:
`lancamento_financeiro.contrato_id` é anulável; usar `!inner` no embed para filtrar
pelo fornecedor no servidor excluiria os lançamentos avulsos **inclusive quando não há
filtro** (quebra a visão padrão). Então o embed de contrato/fornecedor é sempre um
**left join** (traz avulsos com fornecedor "—"), e quando `fornecedor_id` está
presente filtramos as linhas em memória por `contrato.fornecedor_id`. Isso também
mantém o padrão já usado para o filtro de obra em `itens_abertos`. Consequência
esperada e comunicada na UI: ao filtrar por um fornecedor, os lançamentos avulsos
(sem contrato) ficam de fora.

## Renderizadores

Todos passam a chamar `expandirLinhas(relatorio)` e estilizar por `tipo`.

### Tela — `relatorios/page.tsx`
- Dois selects novos no formulário de filtros: **Fornecedor** (lista de `fornecedor`)
  e **Status** (Todos / Pendente / Pago). Enviados na querystring (`fornecedor`, `status`)
  e repassados a `gerarRelatorio` e aos links de exportação.
- Corpo da tabela renderiza `expandirLinhas`: linhas `dado` normais; `subtotal` e
  `total` em **negrito com fundo `bg-muted`**; rótulo na primeira coluna, somas
  alinhadas à direita sob as colunas de moeda.

### PDF — `lib/pdf.tsx` (`DocumentoRelatorio`)
- Consumir `expandirLinhas`; adicionar estilos para linhas `subtotal` (fundo cinza-claro)
  e `total` (negrito, borda superior no acento `#BE3A31`).

### Excel — `api/relatorios/excel/route.ts`
- Iterar `expandirLinhas`: linha `dado` como hoje; `subtotal`/`total` como linha
  com fonte **bold** (e leve `fill` no total). Preserva `numFmt` de moeda/data.

### Rotas de exportação (`pdf` e `excel`)
- Ler `fornecedor` e `status` da querystring e repassar ao `gerarRelatorio`.
  (Hoje só repassam obra/período — **bug latente**: exportação ignoraria os filtros novos.)

## Componentes e responsabilidades

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `gerarRelatorio` + funções por tipo | produzir `{colunas, linhas, agruparPor}` a partir do banco | Supabase, `locacao.ts` |
| `expandirLinhas` (novo, puro) | inserir subtotais por grupo + total geral | só os tipos de `relatorios.ts` |
| `relatorios/page.tsx` | filtros (UI) + prévia | `gerarRelatorio`, `expandirLinhas` |
| `DocumentoRelatorio` (PDF) | render PDF | `expandirLinhas` |
| rota excel | render Excel | `expandirLinhas` |

## Tratamento de erros / bordas

- Relatório vazio: `expandirLinhas` não emite total (sem linhas `dado`); a tela já
  mostra "Nenhum registro".
- Filtro por fornecedor sem correspondência: resultado vazio (tratado como acima).
- `status` só afeta `contas_pagar`/`custo_por_obra`; em `itens_abertos` é ignorado
  (todos são `em_aberto`) — a UI pode manter o select visível; o back-end ignora.

## Verificação (ponta a ponta)

1. **Filtros**: em Contas a pagar, filtrar por fornecedor X e status Pendente →
   tabela mostra só os lançamentos de X pendentes; total geral bate com a soma.
2. **Subtotais**: Itens em aberto com itens de 2 obras → um subtotal por obra +
   TOTAL GERAL = soma dos subtotais.
3. **Coluna fornecedor**: aparece em Itens em aberto e Contas a pagar; avulso = "—".
4. **Export**: PDF e Excel gerados com os mesmos filtros refletem coluna fornecedor,
   subtotais e total (confirma que as rotas repassam fornecedor/status).
5. **Custo por obra**: sem subtotais, com uma linha TOTAL GERAL correta.

## Arquivos afetados

- `src/lib/relatorios.ts` (tipos, `expandirLinhas`, ajustes nos 3 relatórios)
- `src/app/(app)/relatorios/page.tsx` (filtros + render)
- `src/lib/pdf.tsx` (`DocumentoRelatorio`)
- `src/app/api/relatorios/pdf/route.tsx` (repassar filtros)
- `src/app/api/relatorios/excel/route.ts` (repassar filtros + render)
