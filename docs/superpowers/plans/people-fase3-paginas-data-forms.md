I have everything I need. Here is the plan.

---

# FASE 3 — Varredura das 44 páginas + convenções de data layer e forms

## 0. Correções ao briefing (verificadas nos arquivos)

Antes do plano, dez fatos que divergem do que você me passou. Todos verificados lendo os arquivos reais.

| # | Você disse | Verificado |
|---|---|---|
| 1 | `selectClasses` duplicado "literalmente em ≥4 arquivos" | **20 arquivos, em 5 variantes de string distintas.** V1 (`flex h-9 w-full … shadow-xs … ring-3 ring-ring/50`) em 8; V2 (V1 sem shadow/ring) em 3; V3 (`h-9 w-full` sem `flex`) em 4; V4 (`h-9` sem `w-full`, sem focus) em 4; V5 (`h-8 … text-xs`) em 1. Mais 2 `<select>` com classe inline fora da constante (`obra-filter.tsx`, `fornecedores-toolbar.tsx`). E `relatorios/page.tsx` aplica `selectClasses` também em dois `<input type="date">`. |
| 2 | "Duas páginas gigantes" | **Três.** `imoveis/[id]` 704, `contratos/[id]` 625, **`vistorias/[id]` 417** — essa terceira não estava no briefing e tem os mesmos sintomas (sub-forms inline, `createSignedUrls`, `selectClasses` V5, `Info` local). Mais 4 na faixa 250–280: dashboard 280, `relatorios` 274, `financeiro` 269, `imoveis` 257. |
| 3 | "12 `actions.ts` … cada form" | Os 12 arquivos exportam **69 server actions**. Só **30** têm a assinatura `(_prev, formData)` de `useActionState`; as outras 39 recebem `FormData` (ou args diretos) e são chamadas de `<form action={…}>` / uploaders. E há **26 forms client** com `useActionState`, não 12. **25** actions chamam `redirect()`. |
| 4 | `createSignedUrl(path, 600)` | TTL inconsistente: **600s** em `contratos/[id]`; **3600s** em `imoveis/[id]` (2×) e `imoveis/documentos`. E `vistorias/[id]:74` já usa a forma **plural** correta `createSignedUrls(paths, 3600)` — uma requisição em lote, que é justo o que falta nas outras. |
| 5 | "Verifique se o Loca já tem o guard contra o UTC-shift" | **Já tem.** `dataDeISO()` em `src/lib/locacao.ts` faz o split manual de `yyyy-mm-dd` e `formatarData` a usa. Nada a portar do People aqui. **Mas** existe o bug irmão: **"hoje" é calculado em UTC em 9 lugares** (`new Date().toISOString().slice(0,10)`) enquanto `hojeISOSaoPaulo()` existe e é usado em apenas 4. Detalho em §6. |
| 6 | "`ui/dropdown-menu.tsx` não é importado em lugar nenhum" | Correto — e **`ui/dialog.tsx` também tem 0 imports.** Você mencionou só o dropdown. |
| 7 | People: hooks "cada um abre com `import "server-only"` + `import { cache }`" | `server-only` é universal, **`cache()` não é.** `hooks/use-ferias.ts` não tem `cache()` em nenhuma das 6 funções; `use-colaboradores.ts` envolve só `listarColaboradores`, e `obterColaborador` fica cru. |
| 8 | People como referência de client Supabase | `use-ferias.ts` usa **`createAdminClient()`** (bypassa RLS) para *leitura*, com um comentário assumindo isso. **Não copiar.** O Loca inteiro depende de RLS + `soft_delete` SECURITY DEFINER para isolamento de org e escopo por obra. Vira regra dura (§8, risco 2). |
| 9 | "`@hookform/resolvers` v5+ … confirme" | Confirmado no registry, não por memória: **`@hookform/resolvers@5.7.1`** declara peer `zod: ^3.25.0 \|\| ^4.0.0` e `react-hook-form: ^7.55.0`; o subpath `./zod` continua no export map. **`react-hook-form@7.84.0`** declara peer `react: ^19`. O People está em `@hookform/resolvers@^3.9.0` + `zod@^3.23.8` — **a versão dele não serve**, é o único ponto onde a referência não pode ser copiada. |
| 10 | — (não mencionado) | `export const dynamic` **não é usado em nenhuma página do Loca.** Toda página já lê cookies via `createClient()`, logo já é dinâmica. Copiar o `force-dynamic` do People adiciona 40 linhas de ruído decorativo. **Não adotar.** |

Dois achados que reforçam o "reaproveite o que existe":

- **`src/lib/<dominio>.ts` já É o `lib/validations/` do People.** `src/lib/imoveis.ts` tem `TIPOS_IMOVEL` (= tupla `STATUS_X`), `STATUS_IMOVEL_INFO` (= `STATUS_X_LABEL` + `variant`), `tipoImovelLabel()` (= helper puro) — e há `.test.ts` irmão em 5 domínios. Falta só o schema zod.
- **`src/lib/cnpj.ts` é melhor que o formatter do People**: implementa o CNPJ **alfanumérico de 2026** com DV por ASCII−48. O `formatCNPJ` do People é o formato antigo, só dígitos. Não portar.

---

## 1. Catálogo de transformações das 44 páginas

Um padrão por transformação, com o caminho canônico e a contagem real de sítios.

### 1.1 `PageHeader` — 26 páginas com `eyebrow`

O `eyebrow` atual é, em 24 dos 26 casos, **literalmente o pai do breadcrumb que a Fase 2 adiciona** (`"Locação"`, `"Configurações"`, `"Imóveis"`, `"Financeiro"`). Duplicação, remover. Dois carregam informação real e precisam de novo lar:

- `(app)/page.tsx:155` — `eyebrow={\`Painel · ${formatarData(hojeStr)}\`}` → a data vai para dentro de `descricao`.
- `novidades/page.tsx:13` — `eyebrow={\`Versão atual · v${APP_VERSION}\`}` → `<Badge>` em `acoes`.

Todas as 39 chamadas mudam de qualquer forma, porque a assinatura atual é `children` para as ações e a da Fase 1 é `acoes`, e `descricao?: string` passa a `ReactNode`.

`descricao` como frase de estatística ao vivo — só nas **8 listas** (`obras`, `fornecedores`, `itens`, `contratos`, `imoveis`, `vistorias`, `financeiro`, `usuarios`). Padrão, com separador `·` e pluralização PT-BR inline (modelo `equipe/page.tsx` do People):

```
{total} contrato{total === 1 ? "" : "s"} no filtro · {ativos} ativo{ativos === 1 ? "" : "s"}
{encerrados > 0 && ` · ${encerrados} encerrado${encerrados === 1 ? "" : "s"}`}
```

Cuidado real aqui: as listas são **paginadas** (`.range(from,to)`, `PAGE_SIZE = 20`). A frase tem de usar o `count: "exact"` do PostgREST, não `contratos.length` — senão diz "20 contratos" numa base de 300. `financeiro/page.tsx` e `imoveis/page.tsx` já fazem uma segunda query agregada sobre os mesmos filtros justamente por isso; nas outras 6 listas a frase precisa de números que hoje não existem. **Decisão:** a frase usa `count` para o total e só acrescenta os recortes (`ativos`, `vencido`) onde já existe query agregada. Nas outras, frase de uma cláusula. Não vale abrir uma query agregada nova em 6 listas para enfeitar um subtítulo.

As 17 páginas de formulário (`mx-auto max-w-2xl`) mantêm a `descricao` estática — o People faz o mesmo nas páginas `nova`.

**Container:** há 6 larguras diferentes em 39 páginas (`max-w-2xl` ×17, `5xl` ×6, `3xl` ×6, `4xl` ×5, `6xl` ×4, `md` ×1). Se a Fase 2 deu ao shell um container, remova `mx-auto max-w-*` das listas e detalhes e mantenha só `max-w-2xl`/`3xl` como `<div>` interno nas 17 páginas de form. **Verifique isso no dia 0** — é a edição mais mecânica e a mais capaz de gerar regressão visual em massa se o shell não tiver container.

### 1.2 Tabela: `<Card><CardContent p-0>` → `<div className="rounded-md border">`

10 sítios: `contratos`, `obras`, `fornecedores`, `vistorias`, `usuarios`, `imoveis`, `financeiro`, `relatorios`, `configuracoes/auditoria`, `financeiro/fluxo`. Perde-se o `shadow-sm` do `Card` — então isto **tem de aterrar junto com a Fase 1**, ou o app fica com metade das tabelas com sombra por um commit. Risco baixo, puramente visual.

### 1.3 `EmptyState` — três formas hoje, duas decisões

- **(a) `<Card className="border-dashed">` + medalhão `size-12 rounded-full bg-muted` + CTA** — 6 sítios (`contratos:161`, `fornecedores:155` e `:164`, `obras:135`, `vistorias:157`, `imoveis/documentos:73`). → `EmptyState` direto, `acao={{label, href}}`.
- **(b) linha `<TableCell colSpan={n}>` "Nenhum X encontrado."** — 6 sítios. → **manter**, mas só quando há filtro ativo. `contratos/page.tsx` já implementa exatamente a dicotomia certa (`tem || buscando ? tabela-com-linha-vazia : EmptyState`) — promova esse arquivo a padrão canônico das 6 listas em vez de colapsar tudo em `EmptyState`. Motivo: com filtro ativo, preservar o cabeçalho da tabela mostra ao usuário *sobre quais colunas* ele está filtrando; um `EmptyState` esconde isso.
- **(c) `<p className="text-sm text-muted-foreground">Nenhum…</p>` dentro de um Card de seção** — ~12 sítios, 5 deles só em `imoveis/[id]`. → **não mexer.** `EmptyState` com medalhão e CTA 5× numa página é ruído. O People faz igual (`<p>` mudo dentro da seção). **Não-objetivo explícito.**

### 1.4 `KpiCard` — 3 sítios + 1 armadilha

- `(app)/page.tsx:162-183`: 4 cards `<Link><Card>` com micro-label uppercase + ícone + `font-heading text-5xl`. **`font-heading` é Barlow Condensed hoje e a Fase 1 o remove** — este bloco quebra sozinho, não é opcional. → `KpiCard` com `href`, `icon`, `label`, `value`.
- `imoveis/page.tsx:248` `function Kpi({label, valor})` — 2 usos. Deletar a função.
- `financeiro/page.tsx:250` `function Kpi({label, valor, alerta})` — 3 usos. `alerta` → `variant="danger"` + `invertido`. Deletar a função.

Candidatos que o briefing não listou: `contratos/[id]:256` tem um `<Info … destaque>` "Custo estimado acumulado" que é um KPI dentro de um grid, e `financeiro/fluxo` tem stats no header.

**Armadilha que vale mais que os KPIs:** há **4 helpers locais duplicados** de par label/valor — `Info` em `contratos/[id]:593` e em `vistorias/[id]:410`, `Campo` em `imoveis/[id]:633` e em `configuracoes/empresa-form:32`. Extraia **`src/components/campo.tsx`** (`{label, valor?, node?, span?}`) e use `KpiCard` só onde o número é o assunto. Isso o briefing não pegou e é duplicação real.

### 1.5 Filtros — **estender o que existe, portar só a casca do People**

Recomendação: **não** portar um `filtros.tsx` por módulo. O People tem um por módulo porque **não tem paginação nem sort compartilhados**; o Loca tem os três (`ListSearch`, `SortHeader`, `Pagination`) e o `ListSearch` já faz `params.delete("page")` — coisa que o `setParam` do People **não faz** e que, copiado, deixaria o usuário na página 7 de um resultado com 2 páginas.

Três peças novas, uma vez:

1. **`src/components/list-filters.tsx`** — só a casca do People (`space-y-3 rounded-md border bg-muted/20 p-3`) + o botão ghost "Limpar" com `RotateCcw` em `ml-auto` quando `useSearchParams().toString()` não está vazio. Wrapper de layout + reset, nada mais.
2. **`src/components/select-filter.tsx`** — client, genérico: `{param, label, options: {value,label}[], placeholder}`, `router.replace` em `useTransition`, `params.delete("page")`. Absorve o `ObraFilter` inteiro (`<SelectFilter param="obra" label="Obra" options={obras.map(…)}/>`) e mata os 4 blocos `<form method="get">`.
3. **`ListSearch`**: acrescentar debounce de 300ms + botão X de limpar (UX do People). Remove a exigência de apertar Enter, que hoje é a maior diferença sentida entre as duas listas.

**Deleta:** `obra-filter.tsx`, `fornecedores-toolbar.tsx`, os 4 `<form method="get">`, e a variante V4 do `selectClasses`.

**Divergência deliberada, e o motivo de não existir um filtro único:** `relatorios/page.tsx` tem 6 controles que precisam ser submetidos **juntos** (um botão "Gerar"). Convertê-lo para `router.replace` por controle dispara 6 navegações se o usuário mexer em 6 filtros — e cada navegação re-executa `gerarRelatorio()` (872 LOC de agregação). **Decisão: `relatorios` continua submit-on-click.** Envolva no `ListFilters`, troque `<select>` por `NativeSelect` e `<input type="date">` por `<Input type="date">`, e mantenha o botão. Escreva isso no AGENTS.md como exceção justificada.

### 1.6 Matar `selectClasses` — resposta em dois níveis

Um nível só não resolve, porque há dois contextos com requisitos opostos.

- **Nível 1 — `<select>` nativo estilizado compartilhado.** Novo `src/components/ui/native-select.tsx`: `function NativeSelect(props: React.ComponentProps<"select">)` aplicando a variante V1 via `cn`, altura `h-10` da Fase 1. Serve os forms ligados a `FormData` / `useActionState` (as 39 actions não migradas, uploaders, `biblioteca-item`). **Um arquivo, ~20 imports, zero mudança de comportamento, zero risco.** É o que de fato mata a duplicação.
- **Nível 2 — `ui/select.tsx` (Base UI).** Nos filtros (via `SelectFilter`) e nos 12 forms que vão para RHF. Verifiquei em `node_modules/@base-ui/react/select/root/SelectRoot.d.ts`: `Root` aceita `name`, `required` e `inputRef` — renderiza input oculto, logo **funciona com FormData e com `<form method="get">`**. Mas não é input nativo, então dentro de RHF exige `<Controller>` — é por isso que ele fica restrito a onde RHF já está.

**Dois pré-requisitos da Fase 1 a confirmar:** (i) `SelectTrigger` está hoje em `data-[size=default]:h-8` / `sm:h-7`; com `Input h-10` isso põe um select de 32px ao lado de um input de 40px — a Fase 1 tem de retunar. (ii) `ui/select.tsx` nunca foi usado em produção (0 imports); a Fase 3 é a estreia dele, logo reserve uma passada real de teclado/mobile/dark mode.

Não tente trocar os 20 selects nativos por Base UI nesta fase.

### 1.7 `window.confirm` → `ConfirmDialog` — **a edição de maior alavanca da fase**

`src/components/confirm-delete.tsx` é o único ponto de estrangulamento: **18 chamadas `<ConfirmDelete>` em 9 arquivos**. Reescreva **o corpo** dele para renderizar `ConfirmDialog`, mantendo os props exatos (`action`, `id`, `mensagem`, `hidden`, `rotulo`):

```tsx
onConfirm={async () => {
  const r = await action(formData);
  if (r?.error) return r.error;      // string = erro inline, dialog fica aberto
}}
```

**Zero mudança nas 18 chamadas.** Some o `toast.error` (o erro passa a ser inline).

Duas armadilhas:

1. **`redirect()` dentro de `onConfirm`.** `excluirImovel` (`imoveis/actions.ts:100`) e outras chamam `redirect()`, que lança `NEXT_REDIRECT`. Se o `ConfirmDialog` da Fase 1 fizer `try/catch` genérico e devolver a mensagem como erro inline, a navegação **não acontece e o usuário vê um erro falso**. O `ConfirmDialog` tem de re-lançar o que não for erro dele (`isRedirectError`). **Sinalize para a Fase 1 antes de começar.**
2. `soft_delete` devolve `true`/`false`. O contrato precisa mapear `data !== true` → erro, não só `error != null` — é o que `obras/actions.ts:88` já faz corretamente e que a migração não pode perder.

### 1.8 `LinkRow` / `SecaoTitulo` de configurações

`configuracoes/page.tsx:134` e `:142`. Extraia **`src/components/config-row.tsx`** exportando `ConfigRow` (medalhão `size-9 rounded-lg bg-muted` + título/descrição + `ChevronRight`, dentro de um pai `divide-y p-0`) e `SecaoTitulo`. Hoje é uma página só, mas é o padrão de linha de navegação e `configuracoes/templates/page.tsx` (59 LOC) tem uma variação da mesma coisa — verifique e unifique as duas no mesmo componente.

### 1.9 Os dois gráficos

- `src/components/bar-chart.tsx` — série temporal vertical, com mês corrente em `destaque`, usado pelo dashboard.
- `relatorios/page.tsx:182-197` — barras horizontais de categorias ranqueadas, com valor na linha do rótulo.

**Não force um prop `orientation`.** São gráficos genuinamente diferentes (um é tempo com destaque do "agora", o outro é ranking com o valor fora da barra); um prop booleano de orientação é exatamente a armadilha de proliferação de props. Exporte **`HBarChart`** do mesmo `bar-chart.tsx`, compartilhando o cálculo de `max` e o `formatValue`. Dois ajustes de token: (i) os dois usam `bg-primary`/`bg-primary/55` — alinhe o destaque a `--brand` da Fase 1; (ii) `<div className="h-3 border border-border bg-muted">` é artefato de `--radius: 0px` — com `0.625rem` precisa `rounded-full` na trilha e no preenchimento.

### 1.10 `ui/dropdown-menu.tsx` (268 LOC, 0 imports) e `ui/dialog.tsx` (0 imports)

- **`dialog.tsx`: manter.** Deixa de ser morto no instante em que a Fase 1 constrói `ConfirmDialog` sobre ele (o do People é assim). Confirme que a Fase 1 realmente o usa.
- **`dropdown-menu.tsx`: deletar.** Contexto decisivo: `src/components/layout/user-menu.tsx` traz o comentário *"Dropdown próprio (sem Base UI Menu)"* — ou seja, alguém já decidiu não usá-lo e escreveu 268 LOC de primitivo à toa ao lado. As linhas das listas do Loca têm no máximo 2 ações (Abrir/Editar + Excluir); um dropdown para 2 itens é UX pior e adiciona um client component por linha. Deletar remove 268 LOC de superfície não testada da auditoria de tokens da Fase 1, e `npx shadcn add dropdown-menu` o traz de volta em um comando se um dia uma linha chegar a 4 ações. **Condição de reversão:** se o header da Fase 2 tiver adotado o primitivo no menu do usuário, mantenha.

---

## 2. As três páginas gigantes

Convenção a escrever no AGENTS.md: **uma pasta de rota ganha `_components/` quando tem ≥3 componentes co-localizados ou uma página acima de ~200 LOC; caso contrário, irmãos planos.** Componente usado por mais de uma rota fica um nível acima. É exatamente o critério que o People aplica de facto (`_components/` nos módulos novos, planos nos antigos).

Verifiquei o grafo de imports: **`imovel-form.tsx` é o único compartilhado** (`novo` + `[id]/editar`) → fica em `imoveis/`. Os outros 7 de `imoveis/` são importados **só** por `[id]/page.tsx`; `biblioteca-*` só por `documentos/page.tsx`.

### 2.1 `imoveis/[id]/page.tsx` (704 → ~90)

Corte por **seção**, e empurre o *fetch daquela seção* para dentro do componente, para poder envolvê-lo em `<Suspense>`. São 7 seções idênticas em forma: `[Card de form] + [Card de lista]`.

```
imoveis/[id]/page.tsx                    ~90   params, perfil, imóvel, header, <Suspense> por seção
imoveis/[id]/_components/imovel-dados.tsx        Dados + Contatos + Bancários (render puro da linha)
imoveis/[id]/_components/imovel-contratos.tsx    fetch contrato_imovel + histórico + URLs; form, cards, AnexoLinha
imoveis/[id]/_components/imovel-consumo.tsx      fetch conta_consumo; form + tabela
imoveis/[id]/_components/imovel-reparos.tsx      fetch reparo_imovel + URLs
imoveis/[id]/_components/imovel-ocorrencias.tsx
imoveis/[id]/_components/imovel-vistorias.tsx
imoveis/[id]/_components/imovel-ocupantes.tsx
imoveis/[id]/_components/anexo-linha.tsx         AnexoLinha local (:652)
```
Movem para `_components/`: `contrato-imovel-form`, `contrato-imovel-card`, `contrato-imovel-acoes`, `conta-consumo-form`, `fase3-forms`, `ocupante-form`, `imovel-anexo-uploader`, `imovel-upload`. E `biblioteca-item`/`biblioteca-uploader` → `imoveis/documentos/_components/`.

### 2.2 `contratos/[id]/page.tsx` (625 → ~80)

```
contratos/[id]/_components/contrato-resumo.tsx      grid de Info + custoTotal
contratos/[id]/_components/contrato-documentos.tsx  anexo original + aditivos + URLs + uploaders
contratos/[id]/_components/contrato-retirada.tsx    relatório fotográfico
contratos/[id]/_components/contrato-itens.tsx       form + tabela + DevolucaoForm
contratos/[id]/_components/contrato-devolucoes.tsx  histórico
```
A matemática de dinheiro (`custoLinhaLocado`, `periodosEntre`) **fica onde está**, em `src/lib/locacao.ts`, coberta por `locacao.test.ts`. O mapeamento `linhasCalc` (`:157-175`) vai para `src/lib/data/contratos.ts` como `obterItensLocadosCalculados(contratoId, cadencia, prorata)` — assim ganha teste.

**Este é o caso que justifica `cache()` de verdade**, e vale citá-lo como justificativa: `custoTotal` é consumido pelo `contrato-resumo` no topo **e** pelo `contrato-itens` embaixo. Com a função envolvida em `cache()`, duas seções independentes compartilham uma query. Sem `cache()`, a decomposição *dobra* as queries — é o único lugar onde `cache()` deixa de ser cosmético.

### 2.3 `vistorias/[id]/page.tsx` (417 → ~70)

```
vistorias/[id]/_components/vistoria-fotos.tsx        createSignedUrls + grid + uploader
vistorias/[id]/_components/vistoria-avarias.tsx      tabela + AddAvariaForm + cobrança
vistorias/[id]/_components/vistoria-assinaturas.tsx  RelatorioForm + AssinaturaRO
```
Leva embora o `selectClasses` V5 (`h-8 text-xs`) e os locais `Info`/`AssinaturaRO`.

### 2.4 Como **não** quebrar as URLs assinadas

Duas regras, e um helper novo.

1. **Trocar `createSignedUrl` (singular) por `createSignedUrls` (plural).** Hoje `imoveis/[id]` faz `paths.length + paths3.length` **round-trips individuais** em dois `Promise.all` — um imóvel com 3 contratos, 8 reparos e 12 fotos de vistoria são ~25 requisições **antes do primeiro byte de HTML**. `vistorias/[id]:74` já usa a forma plural e é o modelo. Uma requisição por bucket por seção.
2. **Unificar o TTL.** Hoje 600 vs 3600. `export const TTL_URL_ASSINADA = 600;` em `src/lib/data/storage.ts` — 10 min basta para clicar e é curto o bastante para uma URL copiada morrer.

Helper novo: **`src/lib/data/storage.ts` → `assinarUrls(bucket, paths, ttl?): Promise<Map<string,string>>`**, usando `createSignedUrls`, com dedupe e filtro de falsy. Mata 5 cópias do mesmo laço `Promise.all(map(createSignedUrl))` (imóveis ×2, contratos ×1, vistorias ×1, documentos ×1).

Consequência de arquitetura a assumir: URL assinada torna a página **incacheável** — o que é irrelevante, porque toda página já lê cookies. O que **é** relevante: não `await` a assinatura antes do header renderizar. Daí o `<Suspense>` por seção ser o ponto todo da decomposição, não um enfeite.

### 2.5 Como **não** quebrar os selects PostgREST aninhados

Regra única, e é o que faz os hooks do People funcionarem: **a string do select, o tipo da linha e o achatamento vivem no mesmo arquivo, e a função devolve forma plana.** Nunca exporte um tipo que espelhe a ambiguidade `T | T[] | null` do PostgREST — é isso que o `shapeRow()` do People faz.

Aplicado ao Loca:
- `contratos/[id]` tem `vistoria_retirada:…(id, vistoria_foto(count))` e `movimentacao(…, vistoria:…(vistoria_foto(count)))`. O agregado `count` volta como `[{count:n}]` — já existe `contaFotos()` (`:80`) lendo `v?.vistoria_foto?.[0]?.count ?? 0`. Mova `contaFotos` e os tipos `Linha`/`Mov` para `src/lib/data/contratos.ts` e devolva `fotos: number` já achatado. Nenhuma página volta a tocar `[0].count`.
- `imoveis/page.tsx` tem `contrato_imovel(valor_aluguel, valor_condominio, vigente)` + `vigenteDe()` (`:94`). O read layer devolve `aluguel_vigente: number | null`. Deleta o helper e o tipo `Contrato` local.

**Procedimento obrigatório: mover primeiro, achatar depois.** Copie a string do select **byte por byte** para o novo arquivo, faça a página importar, confira a tela, commit. **Só então** achate. `!inner` e `count` são as duas coisas que mudam cardinalidade em silêncio — e não há teste de UI para pegar.

---

## 3. Nova camada de leitura

### 3.1 Onde vive — `src/lib/data/<dominio>.ts`, **não** `src/hooks/use-*.ts`

Recomendação firme. Quatro razões:

1. O Loca **não tem `src/hooks/`**. Criar um só para abrigar módulos server-only importa a pior decisão de nomenclatura do People — que o próprio CLAUDE.md dele precisa desmentir ("não são React hooks"). Um `use-imoveis.ts` que não pode ser chamado de um componente client é uma armadilha para o próximo dev.
2. O domínio já mora em `src/lib/<dominio>.ts`. `hooks/` partiria cada domínio em duas árvores.
3. **Já existe precedente de query em `src/lib/`:** `fluxo.ts` (`gerarFluxoCaixa(supabase, filtros)`) e `relatorios.ts` (`gerarRelatorio(supabase, tipo, filtros)`) **são** a camada de leitura dos domínios deles. A nova camada segue o precedente, invertendo só a aquisição do client (chama `createClient()` internamente, para o `cache()` poder deduplicar).
4. Separar `data/` dá um lugar físico para apontar a regra `server-only`, e isso passa a importar de verdade: a Fase 3 fará os **forms client importarem `src/lib/<dominio>.ts`** (pelos schemas zod). Sem a subpasta, `src/lib/` fica misturando módulos client-importáveis com server-only sem sinal visual.

`src/lib/queries/` é equivalente. Escolha uma e não misture.

### 3.2 Padrão do arquivo

```ts
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ListParams } from "@/lib/lista";

export type ImovelListItem = { /* forma PLANA, nada de T | T[] | null */ };

const SELECT_LISTA = `id, tipo, apelido, …, obra:obra_id(codigo), contrato_imovel(…)`;

export async function listarImoveis(
  p: ListParams,
  f: { tipo?: string; status?: string; obra?: string },
): Promise<{ itens: ImovelListItem[]; total: number }> {
  const supabase = await createClient();
  let q = supabase.from("imovel").select(SELECT_LISTA, { count: "exact" }).is("deleted_at", null);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  …
  const { data, count, error } = await q.order(p.sort, { ascending: p.ascending }).range(p.from, p.to);
  if (error) { console.error("[listarImoveis]", error); return { itens: [], total: 0 }; }
  return { itens: (data ?? []).map(achatar), total: count ?? 0 };
}
```

Notas obrigatórias:
- `createClient()` do Loca é **`async`** (`await cookies()`), diferente do People. Não copie a chamada sem `await`.
- Retorne `{ itens, total }`, não só o array — as listas do Loca são paginadas e o `count` é parte do contrato. As funções do People retornam array cru porque ele não tem paginação.

### 3.3 Convivência com `parseListParams` / `termoOr` / `.range()`

`src/lib/lista.ts` **não muda** e continua sendo chamado **na página** (é ele que lê a querystring). A página faz:

```ts
const sp = await searchParams;                     // Next 16: Promise
const p = parseListParams(sp, { sortCols: [...], defaultSort: "apelido" });
const { itens, total } = await listarImoveis(p, { tipo: sp.tipo, status: sp.status, obra: sp.obra });
```

`sortCols` **fica na página**, não no read layer: é a allowlist anti-injeção do `.order()` e é específica das colunas que aquela tela oferece para ordenar. Empurrá-la para dentro do read layer a esconde de quem lê a página. `termoOr` é chamado **dentro** do read layer (ele é detalhe de query, não de URL).

### 3.4 Entidades que ganham arquivo

| Arquivo | Funções | Substitui leitura inline em |
|---|---|---|
| `data/perfil.ts` | `getPerfilAtual()` **em `cache()`** | `getCurrentPerfil()` — chamado em ~30 páginas **e** em quase toda action; faz `auth.getUser()` + select em `perfil`. **É aqui que `cache()` paga.** |
| `data/filtros.ts` | `listarObrasParaFiltro()` **em `cache()`** | `from("obra").select("id,codigo,nome")` repetido em dashboard, contratos, imoveis, financeiro, relatorios |
| `data/obras.ts` | `listarObras`, `obterObra` | `obras/page`, `obras/[id]` |
| `data/fornecedores.ts` | `listarFornecedores`, `obterFornecedor` | `fornecedores/*` |
| `data/itens.ts` | `listarItens`, `obterItem` | `itens/*` |
| `data/contratos.ts` | `listarContratos`, `obterContrato`, `obterItensLocadosCalculados` (`cache()`), `listarDocumentosContrato` | `contratos/page`, `contratos/[id]` |
| `data/imoveis.ts` | `listarImoveis`, `obterImovel`, `listarContratosImovel`, `listarContasConsumo`, `listarReparos`, `listarOcorrencias`, `listarVistoriasImovel`, `listarOcupantes`, `listarBiblioteca` | `imoveis/*` — uma por seção decomposta |
| `data/financeiro.ts` | `listarLancamentos`, `obterLancamento`, `resumoFinanceiro` | `financeiro/page`, `financeiro/[id]`, `recorrentes` |
| `data/vistorias.ts` | `listarVistorias`, `obterVistoria`, `listarFotos`, `listarAvarias` | `vistorias/*` |
| `data/usuarios.ts` | `listarUsuarios`, `obterUsuario` | `usuarios/*` |
| `data/config.ts` | `obterConfigAlerta`, `obterConfigRelatorio`, `obterEmpresa`, `listarAuditoria` | `configuracoes/*` |
| `data/storage.ts` | `assinarUrls`, `TTL_URL_ASSINADA` | 5 laços de assinatura |
| `data/dashboard.ts` | `obterKpisDashboard`, `listarDevolucoesProximas` | `(app)/page.tsx` |

**Explicitamente fora:** `src/lib/relatorios.ts` e `src/lib/fluxo.ts` **não migram**. Receber `SupabaseClient` como parâmetro é *melhor* ali, porque a rota de cron e a de Excel passam um client admin. Não os toque.

### 3.5 Avaliação crítica: `cache()` e retorno vazio em erro

**`cache()`: adotar, mas sabendo onde ele paga.**

O ganho é intra-request. Onde realmente paga no Loca: `getPerfilAtual()` (chamado por todas as páginas e todas as actions), `listarObrasParaFiltro()` (5 páginas), e `obterItensLocadosCalculados()` (as duas seções de `contratos/[id]`). Onde **não** paga: envolver cada `listarX` — cada página chama a sua uma vez. Note que os dois casos que *parecem* duplicação (`financeiro/page.tsx` list+KPI, `imoveis/page.tsx` `imoveisRes`+`kpiRes`) são queries **diferentes** (colunas e `range` diferentes) — `cache()` não as deduplica. Envolver todas é inofensivo e uniforme; só não venda isso como performance.

Armadilha a documentar: `cache()` chaveia por **identidade de argumento**. Chamar a mesma função `cache()`ada duas vezes com dois objetos equivalentes mas construídos separadamente é *miss* e query duplicada. Prefira argumentos primitivos; se passar o objeto `ListParams`, construa-o uma vez por request e passe a mesma referência.

**Erro → `[]`: adotar para listas, recusar no caminho do dinheiro.**

Primeiro, corrigindo a premissa: o Loca **não** deixa o erro estourar hoje. `contratos/page.tsx:68`, `imoveis/page.tsx`, `financeiro/page.tsx:67` fazem `const { data, count } = await query` — **o `error` é descartado sem ser lido** e a tela renderiza `data ?? []`. Ou seja, o Loca já degrada em silêncio; só não loga. Adotar o padrão do People é **melhoria estrita** (acrescenta `console.error`), não uma mudança de filosofia.

Onde eu **divirjo** do People:

- **Listas de UI:** `console.error("[listarX]", error); return { itens: [], total: 0 }`. Para leitura negada por RLS, "lista vazia" é semanticamente correto.
- **Detalhe (`obterX`):** devolve `null`; a página chama `notFound()`. É o que `obterColaborador` do People faz e o que `imoveis/[id]`/`contratos/[id]` já fazem com `.single()`.
- **Agregados que saem da aplicação como documento: NUNCA engolir.** `gerarRelatorio` / `gerarFluxoCaixa` alimentam PDF, Excel e o e-mail do cron. Um `[]` silencioso ali produz um relatório financeiro **plausível e errado** entregue a um cliente — muito pior que uma página de erro. Mantenha-os lançando, com `(app)/error.tsx` como rede. Escreva a regra: *engole-e-loga em leitura de UI; lança em agregado que gera documento.*

**`import "server-only"`: adotar.** Tem razão concreta no Loca, não é cerimônia: a Fase 3 torna `src/lib/<dominio>.ts` importável do client (schemas zod), e o guard impede que alguém faça `import { listarImoveis } from "@/lib/data/imoveis"` dentro de um form. Exige o stub no vitest (§7). **Projete para o stub não ser load-bearing:** nenhuma lógica pura deve morar em `data/`, então nenhum teste deveria precisar do stub — ele fica como cinto e suspensório.

### 3.6 `types/database.types.ts`: **não nesta fase**

- Exige `supabase link` + `gen types` (rede + projeto ligado).
- No instante em que `Database` entra em `createServerClient<Database>()`, as ~120 chamadas `.from().select()` do repo passam a ser type-checked — e selects aninhados com `!inner`/`count` são exatamente onde os tipos gerados discordam da realidade. Veja o preço que o People paga: `use-colaboradores.ts` tem 5 `eslint-disable` + `(supabase as any)`; `use-ferias.ts` faz `"solicitacoes_ferias" as never` e `SELECT_BASE as any` em **toda** chamada. É o mesmo `as unknown as Row` do Loca, com mais cerimônia.
- Custo/benefício: o ganho é pegar typo de coluna; o custo é uma avalanche de erros de tipo no meio de um refactor de 44 páginas **sem nenhum teste de UI**.

**Faça agora:** adicione o script `"db:types"` ao `package.json` para ficar pronto. **Não** ligue `Database` no `createClient()`. Isso é uma Fase 4, em árvore limpa, com `db:verify` junto.

---

## 4. Migração de forms para react-hook-form + zodResolver

### 4.1 Pacotes — versões exatas, confirmadas no registry

```
npm i react-hook-form@^7.84.0 @hookform/resolvers@^5.7.1
```

Evidência (não memória): `@hookform/resolvers@5.7.1` declara `peerDependencies.zod = "^3.25.0 || ^4.0.0"` e `peerDependencies["react-hook-form"] = "^7.55.0"`; o export map mantém o subpath `"./zod"`. `react-hook-form@7.84.0` declara `peerDependencies.react = "^16.8.0 || ^17 || ^18 || ^19"`. O `zod@^4.4.3` do Loca satisfaz `^4.0.0`, e `4.4.3` é o último publicado.

Logo o import é **idêntico ao do People** — `import { zodResolver } from "@hookform/resolvers/zod"` — apesar do salto de major. O `@hookform/resolvers@^3.9.0` do People **não serve** (zod 3 only); é o único ponto do briefing onde a referência não pode ser copiada.

Alternativa se algo der errado: zod 4 implementa Standard Schema v1, então `standardSchemaResolver` de `@hookform/resolvers/standard-schema` é a saída. Não deve ser necessária.

O `package-lock.json` tem de ser commitado junto — o `npm ci` da CI (§7) falha sem ele.

### 4.2 Onde os schemas passam a viver — **nos `src/lib/<dominio>.ts` existentes**

O problema real que você apontou é correto e é o gargalo: os schemas hoje moram dentro de arquivos `"use server"` e **um componente client não pode importá-los**.

Recomendação: **não criar `src/lib/validations/`.** Os arquivos `src/lib/<dominio>.ts` **já são** o `lib/validations/` do People — `TIPOS_IMOVEL` é a tupla `STATUS_X`, `STATUS_IMOVEL_INFO` é o `STATUS_X_LABEL` (com `variant` de bônus), `tipoImovelLabel()` é o helper puro, e 5 domínios já têm `.test.ts` irmão. Adicionar `imovelSchema` + `export type ImovelInput = z.infer<typeof imovelSchema>` é um append de ~20 linhas por arquivo, contra 13 arquivos novos com tabelas de rótulo duplicadas.

Distribuição:

| Domínio | Destino | Ação |
|---|---|---|
| imóvel, contrato de imóvel, conta de consumo, reparo, ocorrência, vistoria de imóvel, ocupante | `src/lib/imoveis.ts` | append |
| contrato de locação, item locado, devolução | `src/lib/locacao.ts` (já dono de `CADENCIA`, `STATUS_CONTRATO`) | append |
| lançamento, baixa, recorrentes | `src/lib/financeiro.ts` | append |
| item de catálogo, unidade | `src/lib/itens.ts` | append |
| vistoria, avaria, relatório | `src/lib/vistoria.ts` | append |
| usuário, perfil, papel | `src/lib/permissoes.ts` (já dono de `PAPEIS`/`PAPEL_INFO`) | append |
| biblioteca | `src/lib/biblioteca.ts` | append |
| obra | **`src/lib/obra.ts`** | novo |
| fornecedor | **`src/lib/fornecedor.ts`** (usa `cnpjValido` de `cnpj.ts`) | novo |
| empresa | **`src/lib/empresa.ts`** | novo |
| config de alerta / relatório | **`src/lib/config.ts`** | novo |

Só **4 arquivos novos**, contra 13. E `fornecedorSchema`/`empresaSchema` ganham `.refine(cnpjValido, "CNPJ inválido.")` reaproveitando `src/lib/cnpj.ts` — validação de CNPJ alfanumérico 2026 no client, de graça.

Contrato compartilhado: **`src/lib/acoes.ts`** (~4 LOC) com `export type ActionResult = { ok: true; id?: string } | { ok: false; erro: string }`. O People redeclara esse tipo em cada `actions.ts` — não copie.

### 4.3 O que muda nas actions

De:
```ts
export async function salvarObra(_prev: ObraFormState, formData: FormData): Promise<ObraFormState>
```
Para:
```ts
export async function salvarObra(raw: unknown): Promise<ActionResult>
```

Mudanças por action migrada:
1. `formData.get(...)` sai; `obraSchema.safeParse(raw)` entra (o objeto vem tipado do RHF).
2. `return { error: … }` → `return { ok: false, erro: … }`. O texto PT-BR já existe e está bom — reaproveite palavra por palavra.
3. **`revalidatePath(...)` fica exatamente como está.** Ver §8, risco 3.
4. **`redirect(...)` sai.** O client faz `router.replace`.
5. `id` deixa de vir de um input hidden e passa a ser campo do schema (`z.string().uuid().optional()`).
6. Continua usando `createClient()` (anon + RLS). **Nunca `createAdminClient()`** — divergência deliberada do People.
7. Deletes continuam via `rpc("soft_delete", …)` com o comentário da migration 0041 intacto, e `data !== true` → `{ok:false, erro}`.

As **39 actions que recebem `FormData`** e são chamadas de `<form action={…}>` (`alternarPagoConsumo`, `removerAnexoContrato`, `criarRelatorioRetirada`, `removerContratoDoc`, os `salvarAnexo*`) **não mudam.** Elas não têm form RHF do outro lado. Tocá-las é escopo desnecessário.

### 4.4 `redirect()` — regra dura

**Uma action ou redireciona, ou retorna `{ok}`. Nunca as duas.**

Se sobrar um `redirect()` numa action que agora retorna `{ok}`, o `await` no client nunca resolve (o `NEXT_REDIRECT` propaga) — tudo depois dele, inclusive o `router.refresh()`, é código morto, e o `if (!r.ok)` nunca roda. Há **25 `redirect()`** em actions; cada action migrada perde o seu.

No client, padrão do People:
```ts
startTransition(async () => {
  const r = await salvarObra(values);
  if (!r.ok) { setServerError(r.erro); return; }
  router.replace("/obras");
  router.refresh();
});
```

**Feedback de sucesso — aqui eu divirjo do People conscientemente.** O People usa `?ok=…` + `router.refresh()` porque não tem toast. **O Loca tem `sonner` instalado, `ui/sonner.tsx` pronto e já em uso** (`confirm-delete.tsx`, `baixa-form.tsx`). Portar `?ok=` significaria escrever um leitor de querystring em ~20 páginas para replicar algo que já funciona. **Recomendação: `toast.success("Obra salva.")` + `router.replace` + `router.refresh()`.** Trade-off honesto: perde-se a propriedade de o sucesso sobreviver a um reload (o `?ok=` sobrevive), o que não importa aqui porque nenhum fluxo do Loca depende disso.

**Caso especial, e é o mais perigoso:** os forms *inline* de `imoveis/[id]` (reparo, ocorrência, ocupante, conta de consumo) hoje usam `redirect(\`/imoveis/${imovelId}\`)` — redirect para a **mesma URL** — como mecanismo de re-render. Remover o `redirect()` sem `router.refresh()` e **o registro criado simplesmente não aparece.** Detalho em §8, risco 3.

### 4.5 Quais forms migram — aplicando a regra "≥3 campos com validação cruzada"

Contei campos (`<Input>`/`<select>`/`<Textarea>`/checkbox) em cada um dos 26 forms.

**Migram para RHF + zodResolver (12)** — ≥3 campos **e** regra cruzada real ou volume alto:

| Form | Campos | Regra cruzada que justifica |
|---|---|---|
| `imoveis/imovel-form.tsx` | 22 | volume + bloco bancário condicional |
| `imoveis/contrato-imovel-form.tsx` | 14 | `data_inicio ≤ data_fim`; `seguro_fianca_mensal` altera o total; `caucao_valor` ↔ `caucao_status` — **o caso mais forte** |
| `configuracoes/empresa-form.tsx` | ~16 (via `Campo` local) | CNPJ (`cnpjValido`), CEP, UF |
| `fornecedores/fornecedor-form.tsx` | 9 | CNPJ com máscara + DV; já tem `useState` |
| `contratos/contrato-form.tsx` | 9 | `data_inicio ≤ data_fim_prevista`; cadência ↔ pró-rata |
| `financeiro/lancamento-form.tsx` | 7 | `competencia` ↔ `vencimento`; `valor > 0`; recorrência |
| `usuarios/usuario-novo-form.tsx` | 6 | `papel` ↔ obras permitidas |
| `usuarios/usuario-form.tsx` | 6 | idem — **compartilham um schema** |
| `imoveis/conta-consumo-form.tsx` | 6 | `competencia` ↔ `vencimento`; `valor > 0` |
| `contratos/add-item-locado-form.tsx` | 6 | `quantidade > 0`; `retirada ≤ devolucao_prevista` |
| `configuracoes/config-relatorio-form.tsx` | 5 | `frequencia` decide o domínio de `dia` (1–31 mensal vs 0–6 semanal); `destinatarios` = lista de e-mails |
| `trocar-senha/trocar-senha-form.tsx` | 2 | `senha === confirmacao` — 2 campos, mas é literalmente o `.refine` canônico. **Migre primeiro:** é o exemplar mais barato de todo o pipeline |

**Parcial (1):** `imoveis/fase3-forms.tsx` tem 3 forms num arquivo. Migre só `ReparoForm` (tem `valor` + `data` + `executor`); `OcorrenciaForm` e `VistoriaImovelForm` ficam em `useActionState`.

**Ficam em `useActionState` (13):** `contratos/devolucao-form` (2 — só ganhe `max={saldo}` no input), `itens/add-unidade-form` (2), `itens/item-form` (4, plano), `perfil/perfil-form` (2), `vistorias/add-avaria-form` (2), `vistorias/relatorio-form` (3, mas 2 são canvas de assinatura, não campos), `vistorias/vistoria-form` (5, limítrofe), `configuracoes/config-form` (3, toggle de preferência), `configuracoes/template-editor` (2), `imoveis/ocupante-form` (5 planos — mas mova o schema para a lib, porque `data_entrada ≤ data_saida` merece o `.refine` server-side), `imoveis/biblioteca-item` (3, rename inline), `imoveis/contrato-imovel-acoes` (3 mini-forms de 2–3 campos, já bons).

**Caso especial que economiza trabalho:** `financeiro/baixa-form.tsx` (173 LOC) **já está no padrão-alvo** — `useState` + `useTransition` + `setErro` + chamada direta da action + `router`. Converta só a action para `{ok}` e mude `setErro(…)` para ler `r.erro`. **Zero trabalho de form.** Use-o como template ao migrar os outros, é código do próprio Loca.

Placar: **13 forms migram** (12 + ReparoForm), **13 ficam**, 1 já está pronto (baixa). Metade — que é exatamente o que a regra do People prevê.

### 4.6 Markup dos forms migrados

Adote o do People sem alterações (`space-y-4`; campo em `space-y-1.5`; erro de campo em `<p className="text-xs text-destructive">`; pares em `grid grid-cols-1 sm:grid-cols-2 gap-4`; hint `<span className="text-muted-foreground font-normal">(opcional)</span>`; callout calculado em `rounded-md border bg-muted/30 px-3 py-2 text-sm`; erro de servidor em `border-destructive/30 bg-destructive/10` + `AlertCircle`; footer `flex justify-end gap-2 pt-2` com Cancel outline + submit com `Loader2 animate-spin`).

Três diferenças obrigatórias do Loca:
1. O `*` de obrigatório vai embora do texto do label — o zod passa a dizer qual campo falta, o que é a razão de existir da migração.
2. O botão Cancel usa `render={<Link/>}` (Base UI), não `asChild` (Radix).
3. O input hidden de `id` sai; `id` é campo do schema.

Callouts calculados que valem a pena, porque os dados já estão na tela: em `contrato-imovel-form`, o total mensal (`aluguel + condomínio + IPTU + seguro se mensal`) — hoje esse cálculo só aparece *depois* de salvar, no card de detalhe (`imoveis/[id]:329`). Em `add-item-locado-form`, os períodos/custo estimado via `periodosEntre()`, que já é função pura testada.

---

## 5. Loading e erro

### 5.1 `(app)/loading.tsx` — trocar

Hoje é um skeleton `animate-pulse` genérico em `max-w-5xl`. Dispara em **toda** navegação do grupo, então uma página de formulário mostra um esqueleto de tabela. Troque pelo spinner do People: `min-h-[60vh]` centrado, `<Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>`. Honesto e agnóstico de largura; a Fase 1 já entrega `Skeleton` para os casos que merecem forma.

### 5.2 Spinner por rota (10)

`/obras`, `/fornecedores`, `/itens`, `/contratos`, `/imoveis`, `/vistorias`, `/financeiro`, `/usuarios`, `/relatorios`, `/configuracoes/auditoria`.

### 5.3 Skeleton de forma (5)

`/imoveis/[id]`, `/contratos/[id]`, `/vistorias/[id]`, `/` (dashboard: linha de 4 KPI + placeholder do gráfico), `/financeiro/fluxo`. São as lentas (URLs assinadas, agregações) e as em que a forma evita layout shift. Proporção resultante: 10 spinner / 5 skeleton — bate com os 9/6 do People.

### 5.4 Nada nas 17 páginas de formulário

Uma query ou nenhuma; um flash de spinner é pior que nada.

### 5.5 `<Suspense>` — só nas 3 decompostas

O retorno está aqui e em nenhum outro lugar. Padrão: a página `await`ta só a query de identidade (`imovel`/`contrato`/`vistoria`), renderiza header + primeiro Card na hora, e cada `_components/*` vai dentro de `<Suspense fallback={<SecaoSkeleton/>}>`. Crie **`src/components/secao-skeleton.tsx`** uma vez (Card com `CardHeader pb-2` + 4 linhas `Skeleton`) e reuse. É o único jeito de o custo das URLs assinadas parar de bloquear o primeiro paint.

### 5.6 `(app)/error.tsx` — três ajustes, não reescrita

Ele está bom. (i) `console.error` → `logger` de `src/lib/logger.ts` (35 LOC, sem imports, client-safe — confirmei); (ii) o medalhão `size-12 border border-destructive/40` quadrado é artefato de `--radius: 0px`, vira `rounded-full bg-destructive/10`; (iii) exiba `error.digest` em mono pequeno, para o usuário poder citá-lo num pedido de suporte — higiene de incidente à moda do People.

### 5.7 `not-found.tsx` — **não existe**

Nem em `(app)` nem na raiz. `notFound()` é chamado de `imoveis/[id]`, `contratos/[id]` e outras, e cai no default do Next — que não tem o shell. **Crie `src/app/(app)/not-found.tsx`.** Item de changelog voltado ao usuário.

### 5.8 Não adicione `export const dynamic = "force-dynamic"`

Toda página já lê cookies via `createClient()` → já é dinâmica. Copiar a decoração do People adiciona ruído em 40 arquivos e esconde o motivo real.

---

## 6. Formatadores

**Recomendação: NÃO criar `src/lib/utils/formatters.ts`. Manter em `src/lib/locacao.ts`.**

`formatarBRL`, `formatarData`, `formatarDataHora`, `dataDeISO`, `hojeISOSaoPaulo` estão lá, são importados por ~30 arquivos e cobertos por `locacao.test.ts`. Mover = 30 imports de churn + um shim de re-export, por zero ganho de comportamento, no meio de um refactor. O único argumento a favor seria "espelhar o People", que não é razão.

O guard contra o UTC-shift **já existe** (`dataDeISO` faz o split manual; `formatarData` a usa). A premissa do briefing está errada; nada a portar.

O que fazer de fato — **cinco defeitos verificados**:

1. **`formatarBRL` constrói um `new Intl.NumberFormat` a cada chamada** (`locacao.ts:96`). Em `relatorios`, `fluxo` e `contratos/[id]` são centenas de chamadas por render. Ice para uma const de módulo, como o `brl` do People. Uma linha, mensurável.

2. **"Hoje" em UTC em 9 lugares.** `hojeISOSaoPaulo()` existe e é usado em **4**; outros **9** fazem `new Date().toISOString().slice(0,10)`, que entre 21:00 e 00:00 BRT devolve **amanhã**:
   - `financeiro/page.tsx:81` → um lançamento com vencimento **hoje** conta no KPI "Vencido".
   - `financeiro/actions.ts:69` e `:93` → **um dia extra de multa e juros**.
   - `api/contratos/[id]/pdf:107`, `api/imoveis/[id]/contrato-pdf:140`, `api/imoveis/[id]/termo-pdf:67`, `api/vistorias/[id]/pdf:131` → contrato e termo impressos com a data de amanhã.
   - `lib/relatorios.ts:207`.
   - `contratos/devolucao-form.tsx:8` → data padrão da devolução em amanhã (aqui é o UTC do *browser*).
   
   Fix: as 9 passam a `hojeISOSaoPaulo()`. Correção de correção real, com item de changelog próprio, e **testável** com clock fixo — é o único pedaço da Fase 3 que dá para cobrir com teste de forma barata.

3. **`formatarData` quebra com timestamp completo.** `dataDeISO("2026-01-15T10:00:00Z")` → `Number("15T10:00:00Z")` = `NaN` → `Invalid Date`. Adote o guard explícito do People: regex `^\d{4}-\d{2}-\d{2}$` → split manual; senão `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`. *Confirme se existe call-site real antes de anunciar em changelog* — hoje é fragilidade latente, não bug observado.

4. **Formatadores que faltam vão para o arquivo que já é dono do domínio**, não para um `utils/` novo: `formatarCompetencia("2026-07-01") → "07/2026"` → `src/lib/financeiro.ts` (hoje é `c.competencia.slice(0,7).split("-").reverse().join("/")` inline em `imoveis/[id]:427`). CNPJ **não precisa de nada** — `src/lib/cnpj.ts` já tem `normalizarCnpj`/`formatarCnpj`/`cnpjValido` com suporte a CNPJ alfanumérico 2026, superior ao `formatCNPJ` do People.

5. **Pular os helpers `datetime-local` ↔ TIMESTAMPTZ do People.** Grep: **0 ocorrências de `datetime-local`** no Loca; todas as datas são colunas `date`. Portar seria cargo cult.

---

## 7. Processo

### 7.1 `package.json`

```json
"typecheck": "tsc --noEmit",
"test:watch": "vitest",
"db:types": "supabase gen types typescript --project-id <ref> --schema public > src/types/database.types.ts"
```

**Verifique antes:** `tsconfig.json` tem `include: ["**/*.ts","**/*.tsx","**/*.mts"]` a partir da raiz com só `node_modules` no `exclude`, e `allowJs: true`. Conferi o conteúdo: `scripts/` só tem `.mjs` (fora do include) e `Referencias/` não tem `.ts` — logo o escopo deve estar limpo. Mesmo assim, rode `npx tsc --noEmit` **antes** de adicionar o script; se estourar, acrescente `"Referencias"` e `".next"` ao `exclude`.

O `db:types` entra só como preparo; **não** ligue `Database` no `createClient()` nesta fase (§3.6).

### 7.2 `vitest.config.ts`

Hoje tem só o alias `@`. Espelhe o do People, com o stub:

```ts
resolve: { alias: {
  "server-only": resolve(process.cwd(), "test/stubs/server-only.ts"),
  "@": fileURLToPath(new URL("./src", import.meta.url)),
}},
test: { environment: "node", include: ["src/**/*.test.ts"], exclude: ["node_modules", ".next", "supabase"] },
```

Criar `test/stubs/server-only.ts` com `export {};`. Necessário porque `src/lib/data/*.ts` abre com `import "server-only"`, que não existe no Node do Vitest. Projete para não ser load-bearing: nenhuma lógica pura em `data/` ⇒ nenhum teste importa módulo server-only.

### 7.3 CI — `.github/workflows/ci.yml`

O Loca **não tem `.github/` nenhum** — não há CI hoje. Espelhe o do People, com três desvios:

- **`node-version: "22"`**, não 20. O Loca é Next 16 / React 19; 20 funciona mas 22 é a escolha segura.
- Envs do build são as do `.env.example` do Loca, que **diferem** das do People: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, **`EMAIL_FROM`** (o People usa `RESEND_FROM`), `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
- Passos: checkout → setup-node (cache npm) → `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test` → `npm run build`. Sem `db:verify` (o Loca não tem o script).

`npm ci` exige lockfile em sincronia ⇒ o commit que adiciona RHF tem de incluir `package-lock.json`. **Faça a CI passar na árvore pré-Fase-3**, antes de qualquer mudança — senão você não distingue a sua quebra da herdada.

### 7.4 Bump de versão + changelog

Atual `0.19.4`. Fase 3 tem funcionalidade visível + correções ⇒ **MINOR**. Assumindo Fase 1 = `0.20.0` e Fase 2 = `0.21.0`, a Fase 3 é **`0.22.0`**. Se as três forem num único deploy, colapsam em `0.20.0`.

`src/lib/changelog.ts` — `APP_VERSION = "0.22.0"` + `Release` no topo, `titulo: "Novo padrão de telas"`:

```ts
{ tipo: "melhoria", texto: "As listas de contratos, imóveis, itens, obras, fornecedores, vistorias, usuários e financeiro mostram no topo quantos registros o filtro encontrou, com os destaques do momento." },
{ tipo: "melhoria", texto: "Os filtros ficaram iguais em todas as listas: a busca aplica sozinha enquanto você digita e um botão \"Limpar\" aparece quando há filtro ativo." },
{ tipo: "melhoria", texto: "Excluir um registro abre uma janela de confirmação dentro do sistema, e o motivo aparece ali mesmo quando a exclusão é recusada — em vez do aviso do navegador." },
{ tipo: "melhoria", texto: "As telas de imóvel, contrato e vistoria abrem por partes: cabeçalho e dados principais aparecem de imediato e cada bloco carrega em seguida." },
{ tipo: "melhoria", texto: "Os formulários maiores (imóvel, contrato de imóvel, contrato de locação, lançamento, fornecedor, empresa e usuários) apontam o erro em cada campo enquanto você preenche, em vez de um único aviso depois de salvar." },
{ tipo: "melhoria", texto: "Endereço inexistente passa a mostrar uma tela própria, com atalho de volta." },
{ tipo: "correcao", texto: "Entre 21h e a meia-noite o sistema considerava o dia seguinte: contas com vencimento para hoje apareciam como vencidas, o cálculo de multa e juros contava um dia a mais e os PDFs de contrato e termo saíam com a data errada. O dia passa a ser sempre o de Brasília." },
{ tipo: "correcao", texto: "Telas com muitos anexos (imóvel, contrato, vistoria) demoravam para abrir porque cada arquivo era liberado individualmente; agora são liberados de uma vez." },
```

`CHANGELOG.md` — mesma versão em Keep a Changelog, com o detalhe técnico nas seções `Melhorado` / `Corrigido` / `Interno` (camada `src/lib/data/`, contrato `{ok, erro}`, `_components/`, CI, `typecheck`).

`package.json` — `"version": "0.22.0"`.

**Item extra do release, fácil de esquecer: bumpe `CACHE` em `public/sw.js` de `"loca-v1"` para `"loca-v2"`.** Ver §8, risco 4.

### 7.5 AGENTS.md

O `CLAUDE.md` do Loca é só `@AGENTS.md`, e o `AGENTS.md` só cobre versionamento. Acrescente uma seção "Convenções de código" fixando: a camada `src/lib/data/` (`server-only`, `cache()`, engole-e-loga em lista / lança em agregado-documento), **`createAdminClient()` só em `src/app/api/cron/*`**, deletes só via `rpc("soft_delete")`, contrato `{ok, erro}`, "uma action redireciona ou retorna `{ok}`, nunca as duas", a regra do `_components/`, a regra "RHF só com ≥3 campos e validação cruzada", a exceção do `relatorios` submit-on-click, e a regra PT-BR com acentuação obrigatória do People (INVIOLÁVEL) com o `grep -rEn` de auditoria.

### 7.6 Ritual de fechamento

`typecheck → lint → test → build → review do diff → bump de versão → commit`. Sem `db:verify` (não existe no Loca).

---

## 8. Sequenciamento e risco

### 8.1 Ordem — cada passo deixa `npm run build` verde

**Passo 0 — handoff (bloqueante).** Confirme com as Fases 1/2: nome do prop de ações no `PageHeader` (`acoes` vs `children`); se o shell da Fase 2 tem container de largura (define se o `mx-auto max-w-*` sai das páginas); se `SelectTrigger` foi retunado de `h-8` para `h-10`; se `ConfirmDialog` re-lança `NEXT_REDIRECT`; se `Skeleton` existe; se o header da Fase 2 adotou `ui/dropdown-menu.tsx`. Adicione `typecheck` + CI e **faça passar na árvore pré-Fase-3**.

**Passo 1 — infra pura, nenhuma página tocada, paralelizável.**
- 1a. `native-select.tsx`, `list-filters.tsx`, `select-filter.tsx`, `campo.tsx`, `secao-skeleton.tsx`, `config-row.tsx`, `HBarChart` em `bar-chart.tsx`; debounce + X no `ListSearch`.
- 1b. `src/lib/data/storage.ts` (`assinarUrls` + `TTL_URL_ASSINADA`).
- 1c. **`formatarBRL` hoisted + guard de timestamp no `formatarData` + as 9 substituições por `hojeISOSaoPaulo()`. Commit próprio, sozinho.** É a única coisa da Fase 3 que mexe em matemática de dinheiro. Escreva os testes primeiro em `locacao.test.ts` / `financeiro.test.ts` com clock fixo — o bug de UTC é trivialmente testável.
- 1d. `vitest.config.ts` + `test/stubs/server-only.ts` + `src/lib/acoes.ts`.
- 1e. Novo teste **`src/lib/lista.test.ts`** para `parseListParams` — a allowlist de `sortCols` é um controle de segurança contra injeção no `.order()` e **hoje não tem nenhum teste**.

**Passo 2 — `confirm-delete.tsx` sobre `ConfirmDialog`, props inalterados.** Um arquivo, 18 chamadas intactas. Verifique que os deletes com `redirect()` ainda navegam.

**Passo 3 — read layer, um domínio por vez, mover-então-achatar.** Ordem por risco crescente: `perfil` + `filtros` (o ganho de `cache()`) → `obras` (uma tabela, sem aninhamento) → `fornecedores` → `itens` → `usuarios` → `config` → `contratos` → `vistorias` → `financeiro` → `imoveis`. Por domínio: copie o select byte por byte, aponte a página, confira a tela, commit; **depois** achate e delete os `Row`/`vigenteDe`/`contaFotos` locais. Não toque `relatorios.ts`/`fluxo.ts`.

**Passo 4 — composição das páginas, módulo a módulo, risco crescente:** `obras` → `fornecedores` → `itens` → `usuarios` → `vistorias` → `contratos` → `imoveis` → `financeiro` → `configuracoes` → dashboard → `relatorios` (último, é a exceção do filtro). Por módulo: PageHeader, wrapper de tabela, EmptyState, filtros, `NativeSelect`, `KpiCard`. **Um módulo = um commit = uma revisão visual.**

**Passo 5 — as 3 páginas gigantes, um commit cada:** `vistorias/[id]` (menor, ensaio) → `contratos/[id]` → `imoveis/[id]`. Por página: cria `_components/`, move blocos verbatim, empurra o fetch para a seção, `<Suspense>` + `SecaoSkeleton`, `assinarUrls` em lote. Depois do Passo 3 do domínio, para já ter tipos planos.

**Passo 6 — `loading.tsx` (10 + 5), `not-found.tsx`, polimento do `error.tsx`, reescrita do `(app)/loading.tsx`.** Totalmente independente de tudo.

**Passo 7 — forms + `{ok}`, schema primeiro.** Por módulo, dois commits: (i) move o schema de `actions.ts` para a lib de domínio e a action passa a importá-lo — build verde, comportamento idêntico, ainda `useActionState`; (ii) converte a action para `(raw) => ActionResult` e o form para RHF, juntos. Ordem: `trocar-senha` (o mais barato, prova o pipeline) → `obras` → `fornecedores` → `itens` → `usuarios` → `configuracoes` → `contratos` → `financeiro` → `imoveis` (último, 26 actions).

**Passo 8 — limpeza.** Deleta `ui/dropdown-menu.tsx`, `obra-filter.tsx`, `fornecedores-toolbar.tsx`; remove `.eyebrow` de `globals.css` (coordenar com Fase 1); grep de órfãos.

**Passo 9 — release.** Bump + changelog + `CHANGELOG.md` + AGENTS.md + **`sw.js` para `loca-v2`**. Ritual de fechamento.

### 8.2 O que é seguro em paralelo

- Todos os itens do Passo 1 entre si (arquivos disjuntos) — **exceto 1c, que vai sozinho**.
- Passo 6 é independente de tudo; pode rodar em paralelo com qualquer coisa.
- Módulos do Passo 4 entre si, **depois** do Passo 3 do respectivo domínio.
- Módulos do Passo 7 entre si.

**Serial e não negociável:** 0 → 1c (sozinho) → 2; 3(domínio) antes de 4(domínio); 3 antes de 5; 3(domínio) antes de 7(domínio) — porque o `defaultValues` do form RHF quer o tipo plano do read layer.

### 8.3 Onde está o risco, em ordem

**1. Nenhum teste de UI. Nenhum.** Os 5 vitest são lógica pura em `src/lib/`. A Fase 3 reescreve 44 páginas e 26 forms sem cobertura automatizada. É o risco número um e é estrutural. Mitigação, por valor: (a) **não** introduza framework de UI test no meio do refactor — em vez disso, um commit por módulo, para toda regressão ser bissectável a ~200 LOC; (b) estenda os testes *puros* que dão retorno barato: o fix de UTC, `parseListParams`, e o mapeamento `linhasCalc` depois de ir para `data/contratos.ts`; (c) escreva **uma** checklist de smoke por módulo (lista carrega → filtro → sort → página 2 → estado vazio → criar → editar → excluir-recusado → excluir-ok) e rode a cada commit. Playwright é Fase 4.

**2. RLS + soft-delete.** Duas armadilhas específicas. **(i)** O read layer tem de continuar em `createClient()` (anon + cookies). Se alguém copiar o hábito do People de `createAdminClient()` para um `listarX`, o isolamento de organização e o escopo por obra desaparecem em silêncio e todo tenant vê tudo — **e nenhum teste pega.** Regra dura no AGENTS.md: *`createAdminClient()` só em `src/app/api/cron/*`, nunca em `src/lib/data/`.* **(ii)** Deletes têm de continuar em `supabase.rpc("soft_delete", …)`. Uma "limpeza" que volte a `.update({deleted_at})` reproduz o incidente da 0.19.4 letra por letra (a policy de SELECT esconde `deleted_at`, então o RLS aborta o UPDATE na linha nova). **Mantenha o comentário da migration 0041 no código.** E `soft_delete` devolve `true`/`false` — o mapeamento para `{ok}` precisa tratar `data !== true`, não só `error`.

**3. `revalidatePath` — a regressão funcional mais provável de toda a fase.** Trocar `redirect()` por `router.replace` + `router.refresh()` muda a história de invalidação. `revalidatePath` invalida o cache do servidor; `router.refresh()` só re-busca a rota atual. Duas regras:
- **Mantenha cada `revalidatePath` exatamente como está** ao converter a action; remova apenas o `redirect()`. Se você achar que "o refresh resolve", as *outras* rotas (`/`, `/financeiro`) ficam com dado velho.
- **O caso sutil:** os forms inline de `imoveis/[id]` usam `redirect(\`/imoveis/${imovelId}\`)` — redirect para a **mesma URL** — como mecanismo de re-render. Remover o `redirect()` sem `router.refresh()` no client e o reparo/ocorrência/ocupante recém-criado **simplesmente não aparece**, sem erro nenhum. Está na checklist de smoke de `imoveis` em negrito.

**4. PWA — `public/sw.js`, cache `"loca-v1"`.** Li o arquivo. Precacheia `/offline`, os ícones e o `manifest.webmanifest`; estáticos same-origin em stale-while-revalidate no mesmo cache. Dois problemas: **(i)** `/offline` é HTML precacheado — depois da Fase 1 (novas fontes, tokens, `--radius`) o usuário que volta continua recebendo a versão antiga do offline **para sempre**, até `CACHE` mudar. `/_next/static/` é seguro (nome com hash), mas `/icons/` e o manifest **não** são. ⇒ **bumpe `CACHE` para `"loca-v2"` no commit de release.** **(ii)** `src/app/offline/page.tsx` está **fora** de `(app)`, então **não** recebe o shell novo — vai ser a única tela ainda na identidade antiga. Nenhum dos dois é difícil; os dois são fáceis de esquecer.

**5. Estreia do Base UI `Select` em produção.** `ui/select.tsx` tem **0 imports** hoje; a Fase 3 o coloca em produção no `SelectFilter` e em 13 forms. Verifiquei que `Root` aceita `name`/`required`/`inputRef` (input oculto, funciona com FormData), mas: `SelectTrigger` está em `h-8`, e `value=""` para "Todas" precisa de checagem — Base UI trata `null` vs `""` diferente do Radix. Reserve uma passada real de teclado, mobile e dark mode.

**6. Identidade de argumento no `cache()`.** Chamar a mesma função `cache()`ada duas vezes com dois objetos equivalentes construídos em separado é *miss* e query duplicada — o oposto do que se quis. Prefira argumentos primitivos; se passar `ListParams`, construa-o uma vez por request.

---

### Critical Files for Implementation

- `c:\Projetos_Sistenge\Loca\src\app\(app)\contratos\page.tsx` — a lista mais bem resolvida do repo (dicotomia `EmptyState` vs linha `colSpan`, `ListSearch` + `ObraFilter` + `SortHeader` + `Pagination`, `parseListParams`): é o gabarito canônico do Passo 4.
- `c:\Projetos_Sistenge\Loca\src\app\(app)\imoveis\[id]\page.tsx` — 704 LOC, 7 seções, `createSignedUrl` singular ×2 lotes, 8 forms co-localizados: define a decomposição em `_components/` + `<Suspense>` + `assinarUrls`.
- `c:\Projetos_Sistenge\Loca\src\lib\locacao.ts` — dono de `formatarBRL`/`formatarData`/`dataDeISO`/`hojeISOSaoPaulo` e de `CADENCIA`/`STATUS_CONTRATO`; recebe o fix de UTC, o hoist do `Intl` e os schemas zod de contrato/item/devolução.
- `c:\Projetos_Sistenge\Loca\src\app\(app)\obras\actions.ts` + `c:\Projetos_Sistenge\Loca\src\app\(app)\obras\obra-form.tsx` — o par action/form mais enxuto (92 + 117 LOC, com `soft_delete`, `redirect()`, `selectClasses` V1): é onde se prova o contrato `{ok, erro}` + RHF antes de replicar.
- `c:\Projetos_Sistenge\Loca\src\components\confirm-delete.tsx` — ponto único de estrangulamento das 18 exclusões; a reescrita de maior alavanca da fase, e onde mora a armadilha do `NEXT_REDIRECT`.
- `c:\Projetos_Sistenge\Loca\src\lib\lista.ts` — `PAGE_SIZE`/`parseListParams`/`termoOr`; contrato de fronteira entre página e nova camada `src/lib/data/`, e a allowlist de sort sem nenhum teste hoje.