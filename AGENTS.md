<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Versionamento (obrigatório a cada alteração)

Toda mudança relevante (nova funcionalidade, melhoria, correção ou ajuste de
segurança) DEVE ser versionada. Siga [SemVer](https://semver.org):

- **MAJOR** (x.0.0): quebra de compatibilidade.
- **MINOR** (0.x.0): novas funcionalidades sem quebrar o que existe.
- **PATCH** (0.0.x): correções e ajustes pequenos.

Ao concluir uma alteração, atualize **os três** pontos, mantendo-os em sincronia:

1. **`src/lib/changelog.ts`** — fonte única da tela **Novidades**. Adicione (ou
   complemente) o `Release` no topo do array `CHANGELOG` e ajuste `APP_VERSION`.
   Cada item tem `tipo`: `novo` | `melhoria` | `correcao` | `seguranca`, com
   texto curto e voltado ao usuário (não jargão técnico).
2. **`CHANGELOG.md`** — replique um resumo da mesma versão (formato Keep a
   Changelog).
3. **`package.json`** — campo `version` igual a `APP_VERSION`.

Regra prática: se agrupar várias mudanças pequenas no mesmo dia/tema, use um
único `Release` (uma versão MINOR) e vá acrescentando itens até publicar.

# Convenções de código

A identidade e a construção do Loca seguem o **Sistenge People**
(`C:\Projetos_Sistenge\People Plataform\sistenge-people`). Os documentos de
migração, com o levantamento dos dois projetos, estão em
`docs/superpowers/plans/people-fase{1,2,3}-*.md`.

## PT-BR correto em toda a UI — INVIOLÁVEL

Toda string visível ao usuário (rótulo, placeholder, texto de JSX, toast,
mensagem de erro de action, título, e-mail, PDF) sai **acentuada na primeira
escrita**. Palavras que mais escapam: `não`, `usuário`, `permissão`, `função`,
`endereço`, `número`, `ção`, `êxito`, `você`, `também`, `após`, `só`, `até`.

Não acentuar: identificadores TypeScript, chaves de enum e de banco, comentários
`//`, atributos `name=`/`id=`/`key=`, slugs de rota e saída de `console`.

Auditoria antes de fechar uma feature:

```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx
```

## Cores e tema

- Tokens em `src/app/globals.css`, em `hsl()` **completo**, nunca triplet cru: o
  Tailwind v4 compila `bg-x/10` para `color-mix()`, que exige um `<color>`
  válido — com triplet a declaração é descartada em silêncio.
- `--brand` (o vermelho `#BE3A31`) é de **uso restrito**: logotipo e badges de
  crítico. Nunca em CTA, link ou estado de foco. A cor de ação é `--primary`.
- Hex literal só nos três lugares que não resolvem CSS vars: `src/lib/pdf.tsx`,
  `src/lib/email.ts` e `src/app/global-error.tsx` — e sempre importando de
  `src/lib/brand-colors.ts`.
- PDFs **nunca** usam tokens de tema. Um contrato não tem modo escuro.

## Camada de leitura

- Leituras compartilhadas vivem em `src/lib/data/<dominio>.ts`, com
  `import "server-only"` no topo e tipos de retorno **planos** (nunca expor a
  ambiguidade `T | T[] | null` do PostgREST).
- **`createAdminClient()` só em `src/app/api/cron/*`.** Nunca em `src/lib/data/`
  nem em action: ele bypassa RLS, e o isolamento por organização e o escopo por
  obra do Loca dependem de RLS. Usar admin numa leitura faz todo tenant ver tudo
  em silêncio, e nenhum teste pega.
- Erro em leitura de lista: `console.error` e devolve vazio. Erro em detalhe:
  devolve `null` e a página chama `notFound()`.
- **Agregado que gera documento nunca engole erro.** `gerarRelatorio` e
  `gerarFluxoCaixa` alimentam PDF, Excel e e-mail de cron: um `[]` silencioso ali
  produz um relatório financeiro plausível e errado entregue a um cliente. Eles
  lançam, e `(app)/error.tsx` é a rede.
- Ao mover uma query para `data/`: **copie a string do select byte por byte,
  aponte a página, confira a tela, commite — só então achate.** `!inner` e
  `count` mudam cardinalidade em silêncio.

## Server actions

- Retorno padrão: `ActionResult` de `src/lib/acoes.ts`.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.** Um
  `redirect()` lança `NEXT_REDIRECT`, então tudo depois do `await` no cliente —
  inclusive o `router.refresh()` e o próprio `if (!r.ok)` — é código morto.
- Exclusão **sempre** por `supabase.rpc("soft_delete", ...)`, nunca
  `.update({ deleted_at })`. A policy de SELECT esconde linhas com `deleted_at`,
  e o Postgres a aplica também à linha NOVA de um UPDATE, abortando o próprio
  comando (incidente da 0.19.4, migration 0041). E `soft_delete` devolve
  `true`/`false`: trate `data !== true` como erro, não só `error != null`.
- `revalidatePath` fica como está ao converter uma action. `router.refresh()` no
  cliente só re-busca a rota atual; as outras ficariam com dado velho.

## Formulários

- `react-hook-form` + `zodResolver` só quando há **≥3 campos e validação
  cruzada**. Abaixo disso, `useActionState` é mais simples e suficiente.
- Schemas zod moram no `src/lib/<dominio>.ts` do domínio, não dentro do
  `actions.ts`: um arquivo `"use server"` não pode ser importado por componente
  cliente, e o form precisa do schema.

## Componentes

- `src/components/ui/` são primitivos (shadcn "base-nova" sobre **Base UI**, não
  Radix). Composição é `render={<Link/>}`, **não `asChild`**.
- `src/components/shared/` são compartilhados agnósticos de domínio.
- Uma pasta de rota ganha `_components/` quando tem ≥3 componentes
  co-localizados ou a página passa de ~200 LOC.
- Filtros de lista usam `ListFilters` + `ListSearch` + `SelectFilter`, que
  aplicam ao vivo e apagam `page`. **Exceção justificada:** `/relatorios`
  mantém submit em botão — seus 6 controles precisam ser aplicados juntos, e um
  `router.replace` por controle dispararia 6 navegações, cada uma re-executando
  `gerarRelatorio()`.
- Estado vazio: `EmptyState` quando não há nenhum registro; linha
  `<TableCell colSpan>` quando há filtro ativo (preserva o cabeçalho e mostra
  sobre o que se está filtrando). Dentro de card de seção, um `<p>` mudo basta.

## Datas e dinheiro

- "Hoje" é **sempre** `hojeISOSaoPaulo()`. `new Date().toISOString()` devolve a
  data em UTC e entre 21h e a meia-noite em Brasília isso é o dia seguinte — foi
  o bug que cobrava um dia extra de multa e juros (0.22.0).
- Formatação por `formatarBRL` / `formatarData` / `formatarDataHora` de
  `src/lib/locacao.ts`. Ao comparar moeda formatada em teste, lembre que o Intl
  separa "R$" do número com espaço **não separável** (U+00A0).

## Ritual de fechamento

```
npm run typecheck && npm run lint && npm test && npm run build
```

Depois: revisar o diff, bumpar a versão nos três pontos, e commitar explicando o
**porquê**. A CI (`.github/workflows/ci.yml`) roda os quatro em todo push e PR.

Mexeu em `src/app/offline/page.tsx` ou em `public/icons/`? Bumpe `CACHE` em
`public/sw.js`: o `install` só refaz o PRECACHE quando o nome do cache muda.
