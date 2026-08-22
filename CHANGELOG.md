# Changelog

Todas as mudanças relevantes do **Loca** ficam aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

> Fonte única para a tela **Novidades**: [`src/lib/changelog.ts`](src/lib/changelog.ts).
> Ao concluir uma alteração, atualize **os dois** (ver processo em `AGENTS.md`).

## [0.24.0] — 2026-08-22

Primeira fase dos **documentos do alojamento**: os oito primitivos de formulário
em PDF e o FRM-RH-001 provado de ponta a ponta.

### Adicionado

- **Termo de Compromisso de Alojamento (FRM-RH-001)** como texto padrão do termo
  do ocupante, substituindo a versão genérica anterior: 22 regras de convivência,
  consentimento informado de CFTV (LGPD), cláusula de armário individual, tabela
  de penalidades (CLT, arts. 474 e 482) e o canal de denúncias exigido pela Lei
  14.457/2022. Nenhuma linha de `documento_template` é tocada — quem customizou
  o texto continua com o dele.
- **Primitivos de formulário em PDF** (`src/lib/pdf-form.tsx`): `Documento`,
  `Secao`, `CampoGrid`, `Lista`, `OpcoesCheck`, `Tabela`, `AreaTexto` e
  `Assinaturas`. `CampoGrid` com valor nulo desenha linha para preenchimento
  manual; `Assinaturas` já aceita `modo="aceite"` para a fase de assinatura
  digital.
- **Colunas `cargo`, `quarto` e `armario`** em `ocupante_imovel`, com
  `aceite_em`/`aceite_ip` nulas reservadas (migration `0043`).

### Alterado

- A tela **Configurações → Templates de documentos** agrupa por módulo.
- `DocumentoInfo` ganhou `modulo`, `categoria` e `preenchimento`, tornando o
  catálogo de `templates.ts` a fonte única de documentos do sistema.
- O formulário de ocupante migrou para `react-hook-form` + `zodResolver` (8
  campos e validação cruzada de datas) e `salvarOcupante` passou a devolver
  `ActionResult` em vez de redirecionar.
- Contratos e termos passaram a desenhar o logotipo no lugar da palavra
  `SISTENGE`.

### Notas

- O FRM-RH-001 fecha em **3 páginas**, não nas 2 previstas para formulários: o
  texto sozinho (44 cláusulas, 7.270 caracteres) já ocupa 2 páginas a 8,5pt, e
  comprimir mais exigiria corpo abaixo de 7,5pt num documento que sustenta justa
  causa. Um teste trava esse limite.

## [0.23.0] — 2026-08-07

Conclusão da Fase 3 da migração para a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase3-paginas-data-forms.md`).

### Corrigido

- **Segunda forma do bug de fuso, agora no cálculo de dinheiro.** A 0.22.0
  corrigiu `new Date().toISOString().slice(0, 10)`; esta corrige passar
  `new Date()` cru para funções que comparam **dia de calendário** com uma data
  vinda do banco. `new Date()` é um instante, as datas do banco chegam por
  `dataDeISO` (meia-noite), e o dia de calendário do instante é lido no fuso do
  runtime — que na Vercel é UTC. Das 21h à meia-noite em Brasília,
  `differenceInCalendarDays` conta um dia a mais. Efeitos: **um período inteiro
  a mais no custo estimado do contrato**; a coluna "Custo até hoje" e "dias em
  atraso" de dois relatórios (que vão para Excel e para a diretoria); a projeção
  do fluxo de caixa começando do mês seguinte no último dia do mês; a janela
  "vence nos próximos 7 dias" do painel deslocada; competência e vencimento da
  cobrança de avaria; e a numeração anual do contrato em 31/12.
  Novo `hojeSaoPaulo()` com quatro testes de relógio fixo, incluindo o que trava
  a cobrança do período extra.
- **Ordem das seções na tela do contrato.** A ordem visual vinha de classes
  `order-1..order-6` sobre uma ordem de DOM diferente, e `AtividadeTimeline` —
  sem classe de ordem, portanto `order: 0` — era renderizada acima do resumo do
  contrato. Agora a ordem de DOM é a ordem de leitura.
- **Contraste dos avisos em amarelo.** Usavam `text-warning` sobre
  `bg-warning/10`: o mesmo amber a 50% de luminosidade sobre um tint de 10% dele
  mesmo, ~1,9:1. Novo token `--warning-strong` como a variante legível sobre o
  próprio tint, em light e dark.

- **Indicadores podiam discordar da tabela em Financeiro e Imóveis.** As duas
  telas montavam o recorte de filtro **duas vezes** — uma na query paginada da
  lista, outra na query dos indicadores, que soma o filtro inteiro. Um filtro
  novo esquecido num dos lados fazia os KPIs somarem um recorte diferente do que
  a tabela mostrava, sem erro nenhum. Agora as duas passam pelo mesmo
  `aplicarFiltros` dentro do leitor de domínio.
- **`not-found.tsx` da raiz não existia.** Uma URL que não casa com nenhuma rota
  caía na tela padrão do Next — em inglês e sem estilo. A de `(app)` não cobre o
  caso: ela vive dentro do grupo, atende só ao `notFound()` de uma rota do grupo
  e herda o shell, que exige sessão.

### Segurança

- **Vazamento de UI de permissão em `imoveis/[id]`.** Nas listas de reparos e
  ocorrências, "Anexar" e o botão de excluir apareciam para quem só tem leitura
  — as duas únicas listas da página sem o gate `podeEditar`. As actions já
  recusavam, mas os controles não deviam estar visíveis.

### Alterado

- **As três páginas gigantes foram decompostas** em `_components/` + `<Suspense>`,
  cada seção buscando os próprios dados: `imoveis/[id]` 684 → 117 linhas + 6
  seções, `contratos/[id]` 602 → 189 + 5, `vistorias/[id]` 410 → 178 + 3. Antes
  cada página esperava todas as consultas em série antes do primeiro byte de
  HTML.
- **`obterItensLocadosCalculados`** (`src/lib/data/contratos.ts`) sob `cache()`:
  três seções de `contratos/[id]` consomem o mesmo resultado (custo do resumo,
  tabela de itens, histórico de devoluções), então sem o cache a decomposição
  triplicaria a consulta mais pesada da rota. Chaveado por três primitivos de
  propósito — `cache()` compara identidade de argumento.
- **URLs assinadas por seção** em `imoveis/[id]`: três lotes em vez de um, mas
  correndo em paralelo em vez de depois de todas as consultas. O que importava
  era não voltar a assinar uma URL por arquivo, e cada lote continua em lote.
- **`ReparoForm` em react-hook-form** — último dos 13 forms do plano, fechando 14
  em RHF + zodResolver. `salvarReparo` passa a `(raw) => ActionResult` e perde o
  `redirect()`. `reparoSchema` novo: o `valor` era gravado por
  `num(...) ?? 0`, que transformava texto inválido em R$ 0,00 em silêncio num
  campo de dinheiro.
- **Camada de leitura para as 8 listagens** em `src/lib/data/<dominio>.ts`, com
  `import "server-only"`, tipo de retorno **plano** e `{ itens, total }` — o
  total vindo do `count: "exact"` do PostgREST, não de `array.length`, porque as
  listas paginam em 20. Achatar o retorno removeu 6 `as unknown as Row` e um
  `obras!.map` das páginas: a ambiguidade `T | T[] | null` dos embeds do
  PostgREST para de atravessar o boundary. Os leitores de lista deliberadamente
  **não** usam `cache()` — ele chaveia por identidade de argumento e estes
  recebem um objeto literal montado a cada chamada, então o cache nunca
  acertaria.
- **Regra do `createAdminClient()` no `AGENTS.md` corrigida.** Estava absoluta
  demais ("só em `api/cron/*`") e proibia um uso legítimo e necessário: as
  chamadas `auth.admin.*` de `usuarios/actions.ts` exigem service role e
  `auth.users` não é tabela da aplicação. O invariante real é que o client admin
  nunca faz `.from(...)` em tabela da aplicação, porque é aí que o RLS — e com
  ele o isolamento por organização — desaparece.

## [0.22.0] — 2026-08-06

Primeira parte da Fase 3 da migração para a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase3-paginas-data-forms.md`).

### Corrigido

- **"Hoje" era calculado em UTC em nove lugares**, enquanto `hojeISOSaoPaulo()`
  já existia e era usado em quatro. `toISOString()` devolve a data em UTC, então
  entre 21h e a meia-noite em Brasília (BRT = UTC−3) todos enxergavam o dia
  seguinte. Efeitos: conta com vencimento hoje entrava no total "Vencido"; o
  cálculo de multa e juros da baixa contava um dia a mais de atraso; os quatro
  PDFs saíam datados de amanhã; a data padrão da devolução vinha errada.
  Coberto por testes com clock fixo, com uma asserção travando explicitamente o
  comportamento errado ao lado do certo.
- `formatarData` devolvia "Invalid Date" para timestamp completo: `dataDeISO`
  faz split manual em `-`, então `"2026-03-10T12:00:00Z"` produzia
  `Number("10T12:00:00Z")` = `NaN`. Agora há guard por regex.
- `ObraFilter` montava a URL só com `?obra=`, **descartando os demais
  parâmetros** — filtrar por obra em /contratos apagava a busca por número.
- Mudar filtro sem voltar para a primeira página deixava a lista vazia (pedido
  da página 3 num resultado com uma só). Os três filtros novos apagam `page`.

### Adicionado

- `src/lib/data/storage.ts` com `assinarUrls` e `TTL_URL_ASSINADA` — o primeiro
  arquivo da camada de leitura.
- `src/lib/acoes.ts` com o tipo `ActionResult` compartilhado.
- `src/components/shared/`: `campo.tsx`, `list-search.tsx` (reescrito),
  `select-filter.tsx`, `list-filters.tsx`.
- **CI** em `.github/workflows/ci.yml` — o projeto não tinha nenhuma. Node 22,
  `npm ci` → typecheck → lint → test → build.
- Seção **"Convenções de código"** no `AGENTS.md`, fixando a regra PT-BR
  inviolável, a restrição do token `--brand`, `createAdminClient()` só em cron,
  `soft_delete` obrigatório, "uma action ou redireciona ou devolve ActionResult",
  quando usar react-hook-form, e a exceção justificada de /relatorios.
- 23 testes novos (de 30 para 53): `hojeISOSaoPaulo`, `formatarData`,
  `formatarBRL` e `src/lib/lista.test.ts` cobrindo `parseListParams` e `termoOr`
  — que são controle de segurança (allowlist do `.order()` e sanitização do
  `.or(ilike)`) e estavam sem nenhum teste.
- Stub de `server-only` no vitest, para a camada de leitura.

### Alterado

- **Anexos assinados em lote.** `imoveis/[id]` fazia dois `Promise.all` de
  `createSignedUrl` individuais: um imóvel com 3 contratos, 8 reparos e 12 fotos
  disparava ~25 requisições ao Storage antes do primeiro byte de HTML. Agora uma
  por bucket, via `createSignedUrls`. O TTL também foi unificado (era 600 em um
  lugar e 3600 em dois).
- `formatarBRL` e o formatador de data içados para constante de módulo — eram
  reconstruídos a cada chamada, centenas por render em /relatorios e /fluxo.
- **Perfil e obras deduplicados por requisição.** `getCurrentPerfil()` (102
  chamadas em 47 arquivos) passou a ser `cache()`ado, e o `(app)/layout.tsx`, que
  fazia seu próprio `getUser()` + SELECT para a mesma informação, passou a usá-lo
  — cada render gastava duas idas ao Auth e duas ao banco. O mesmo
  `select("id, codigo, nome")` de obra, repetido em 18 páginas, virou
  `listarObrasParaFiltro()` em `src/lib/data/obras.ts`, também `cache()`ada. O
  parâmetro dela é um booleano primitivo de propósito: `cache()` chaveia por
  identidade de argumento, e um objeto de opções construído em dois lugares seria
  *miss* e duplicaria a consulta.
- **Busca ao vivo** com debounce de 300ms e botão de limpar. Enter continua
  aplicando na hora.
- Os dois `<form method="get">` de /financeiro e /imoveis viram
  `ListFilters` + `ListSearch` + `SelectFilter`.
- Os 7 `<Card className="border-dashed">` viram `EmptyState`, com descrição
  explicando para que serve o cadastro.
- As duas funções `Kpi` locais viram `KpiCard` com ícone e variante de cor. A
  prop booleana `alerta` era a proliferação que o `variant` resolve.
- Três helpers locais idênticos de par rótulo/valor (`Info` × 2 e `Campo`) viram
  `src/components/shared/campo.tsx`.

### Removido

- `src/components/obra-filter.tsx` e `src/components/list-search.tsx`,
  substituídos pelos equivalentes em `shared/`.

## [0.21.0] — 2026-08-06

Fase 2 da migração para a identidade e a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase2-shell.md`).

### Adicionado

- **Sidebar de 72px que expande a 240px** no hover, com cross-fade entre o
  símbolo e o logotipo. `fixed`, com a coluna principal compensando em
  `md:pl-18`. Acréscimo sobre o People: expande também no `focus-within`, senão
  quem navega por Tab percorre 11 ícones sem rótulo nenhum. O foco usa
  `ring-inset`, porque a `<aside>` tem `overflow-hidden` e um ring com offset
  seria cortado na borda de 72px.
- **Header sticky de 64px** com `backdrop-blur`, em três zonas.
- **`Breadcrumb`** derivado do pathname — é ele que substitui a prop `eyebrow`
  removida na 0.20.0. Segmentos dinâmicos (UUID) são omitidos; estáticos ganham
  rótulo em PT-BR por mapa, e um segmento não mapeado também é omitido.
- **`CommandPalette`** (Ctrl/⌘+K), sem `cmdk`: Dialog + Input + lista filtrada,
  com navegação por ↑/↓ e agrupamento "Páginas"/"Ações". Diverge do People, que
  indexa só páginas: aqui entram 8 ações rápidas, cada uma condicionada ao
  módulo e ao papel via `src/lib/permissoes.ts`.
- **`MobileNav`** — gaveta sobre o `Dialog` do Base UI, substituindo a barra
  inferior que reaproveitava a lista vertical da sidebar num `overflow-x-auto`.
- **`AuthShell`** — split-screen para `/login`, `/auth/recuperar` e
  `/auth/nova-senha`, com o cartão em `data-theme="light"` (escopo criado na
  0.20.0 e que estreia aqui).
- **`loading.tsx` por rota** em 8 listagens e 3 telas de detalhe, com as formas
  em `src/components/shared/skeletons.tsx`.
- **`(app)/not-found.tsx`** — não existia. `notFound()` caía no 404 padrão do
  Next: página branca, sem shell e em inglês.

### Alterado

- **`src/lib/nav.ts` vira dado puro**: `icon` passa de `LucideIcon` a uma união
  de strings, com o lookup em `src/components/layout/nav-icon.tsx`, e a
  filtragem por permissão sai do client para o server. Não conserta bug — a
  sidebar era client e importava `NAV_ITEMS` ela mesma, então o boundary nunca
  era cruzado. É escolha de arquitetura: filtra uma vez em vez de duas, o bundle
  do cliente deixa de listar `/configuracoes` para todo mundo, e o arquivo fica
  utilizável em qualquer runtime, como `src/lib/modulos.ts` já era.
- **`UserMenu` reconstruído sobre `ui/dropdown-menu.tsx`**, que estava no
  projeto com 268 linhas e zero imports. Absorveu o rodapé rico da sidebar
  (avatar, nome, papel, "Meu perfil", "Sair"), que não caberia em 72px. `w-64` é
  obrigatório no `Content`: o primitivo usa `w-(--anchor-width)`, ou seja,
  dimensiona pela largura do gatilho — aqui um avatar de 32px.
- **`main` perde o `overflow-y-auto`**: quem rola é o documento. Com ele, `main`
  seria um segundo container de scroll — barra dupla e momentum scroll quebrado
  no iOS.
- `(app)/loading.tsx` deixa de ser um esqueleto de tabela em `max-w-5xl`, que
  disparava em toda navegação do grupo (inclusive nas 17 páginas de formulário),
  e passa a ser o spinner neutro.
- `(app)/error.tsx` ganha o painel do People, o `error.digest` em monoespaçada,
  `render={<Link/>}` no lugar de `window.location.href` e log pelo `logger.ts`.
- `/offline` recebe a paleta nova e modo escuro via `<style>` com
  `prefers-color-scheme` — não via classe `.dark`, porque a folha de CSS não
  está no PRECACHE e o script do next-themes não roda offline.
- `bar-chart.tsx` e a barra horizontal de `/relatorios` passam de `bg-primary`
  para `bg-foreground` com opacidade: com a paleta nova o primary inverte para
  slate-50 no tema escuro, o que daria barras de branco puro.
- `public/sw.js`: `CACHE` de `loca-v1` para `loca-v2`, obrigatório porque
  `/offline` mudou e o `install` só refaz o PRECACHE quando o nome do cache muda.

### Removido

- `src/components/layout/sidebar.tsx`, substituída por `nav-link.tsx` mais a
  `<aside>` do layout.
- O `<Card>` de dentro dos três forms de autenticação: a moldura precisa ser
  dona do wrapper para aplicar o `data-theme` nele.
- O branch morto de item "em breve" no nav (todos os itens estão implementados).

### Interno

- `MobileNav` fecha ao trocar de rota ajustando estado durante o render, o
  padrão que o React documenta. Um `useEffect` seria reprovado por
  `react-hooks/set-state-in-effect` e custaria um render extra; um `onClick` no
  `Link` deixaria a gaveta aberta quando a navegação vem do botão voltar.
- A gaveta é montada sobre os primitivos do Base UI, não sobre `ui/dialog.tsx`:
  o `DialogContent` dele embute `top-1/2 -translate-y-1/2`, e o `tailwind-merge`
  não considera `top-1/2` conflitante com `inset-y-0` — as duas viriam.
- Verificado com uma rota de inspeção temporária e screenshots em light/dark,
  desktop/mobile: `scrollWidth === clientWidth`, sem overflow horizontal, com a
  tabela de 7 colunas contida pelo `overflow-x-auto`. Isso confirma que
  `TableCell p-4` (0.20.0) cabe e não precisa virar `p-3`.

## [0.20.0] — 2026-08-06

Fase 1 da migração para a identidade e a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase1-fundacao-design.md`).

### Adicionado

- **Identidade Sistenge 2026**: `src/app/globals.css` reescrita com a paleta
  slate do Sistenge People — `--primary` slate-900, cards brancos com
  `shadow-sm`, `--radius: 0.625rem` — e as famílias novas `--success`,
  `--warning`, `--info` e `--brand`. O vermelho `#BE3A31` deixa de ser a cor
  primária e passa a ser o token `--brand`, de uso restrito a logotipo e badges
  de crítico.
- **Modo escuro**, com `ThemeProvider` (next-themes) e `ThemeToggle` no header.
  O pacote já estava instalado desde a v0.13, mas nunca foi montado: a classe
  `.dark` jamais chegava ao `<html>`, então todo o bloco `.dark` era código
  morto e o `useTheme()` de `ui/sonner.tsx` sempre caía no default.
- Escopo `[data-theme="light"]`, para forçar tokens claros numa região sobre
  fundo escuro (o card do `/login` na Fase 2).
- Compartilhados em `src/components/shared/`: `PageHeader` (reescrito),
  `EmptyState`, `KpiCard`, `ConfirmDialog` e `ThemeToggle`.
- Primitivos `ui/skeleton.tsx` e `ui/native-select.tsx`.
- `SistengeIcon` — só o símbolo, recortado do mesmo viewBox do logotipo, para a
  sidebar colapsada da Fase 2.
- `src/lib/brand-colors.ts` — paleta em hex para os três consumidores que não
  resolvem CSS custom properties (PDF, e-mail, `global-error.tsx`).
- Headers de segurança e CSP em `next.config.ts`, que estava vazio.
- Script `npm run typecheck` e regras de ESLint do Sistenge People.

### Alterado

- **Tipografia**: Barlow + Barlow Condensed → **Inter + JetBrains Mono**. O
  token `--font-heading` foi removido em vez de apontar para o Inter: um alias
  no-op mentiria sobre a intenção. Os números de KPI saem de `text-5xl` em
  Barlow Condensed para `text-2xl tabular-nums`.
- **Primitivos alinhados ao People**: Button `h-8`→`h-10` (e `sm` `h-7`→`h-9`,
  `icon-sm` `size-7`→`size-9`), Input/Textarea `h-8`→`h-10`, `TableHead`
  `h-10 px-2` uppercase → `h-12 px-4`, `TableCell` `p-2`→`p-4`, Badge
  `rounded-full`, Dialog `p-6`/`rounded-lg`/`shadow-lg`. As variantes
  `destructive` de Button e Badge passam de tonais a sólidas.
- **`Card` adota o modelo clássico** e aposenta `--card-spacing`, a moldura
  `.blueprint` e as marcas de registro nos cantos. Isso conserta 26 call sites
  que eram no-ops: 21 `<CardContent className="pt-6">` só fazem sentido com
  `CardContent p-6 pt-0`, e 5 `<CardHeader className="flex-row space-y-0">` só
  com `CardHeader flex flex-col`. Efeito colateral desejado: os 12
  `<CardContent className="p-0">` que embrulham tabelas ficam flush com a
  borda, equivalendo ao `<div className="rounded-md border">` do People.
- **`PageHeader` com a API do People**: `children` → `acoes`, `descricao`
  aceita `ReactNode`, e a prop `eyebrow` foi removida — em 24 dos 26 casos
  repetia o pai que o breadcrumb da Fase 2 vai mostrar. As props foram
  removidas do tipo de propósito, para `tsc --noEmit` enumerar os 39 call
  sites; o projeto não tem nenhum teste de UI.
- **`NativeSelect` unifica os 38 selects.** A mesma string de classe estava
  duplicada em 20 arquivos, em 5 variações divergentes — a maior duplicação do
  repositório, que punha selects de alturas diferentes ao lado dos campos.
- **`ConfirmDelete` sobre `ConfirmDialog`** em vez de `window.confirm()`. Os
  props foram mantidos, então os 18 call sites em 9 arquivos não mudaram. O
  `ConfirmDialog` re-lança erros com `digest` começando em `NEXT_`: engoli-los
  transformaria o `redirect()` das actions de exclusão num erro falso na tela.
- `ACENTO` dos PDFs e o botão de CTA dos e-mails passam de vermelho a
  slate-900. O símbolo da marca em `pdf.tsx` segue vermelho, agora no `#BE3A31`
  do Manual em vez do `#cf2927`.
- `signature-pad.tsx`: canvas sempre `bg-white` com traço escuro. Ele é
  exportado por `toDataURL()` e embutido num PDF de fundo branco — é papel, não
  interface, e seguir o tema deixaria a assinatura invisível no modo escuro.
- `viewport.themeColor` passa a ser um par light/dark em slate, alinhado ao que
  `manifest.webmanifest` já declarava.

### Removido

- Classes `.blueprint` e `.eyebrow`, a regra `h1..h6 { Barlow Condensed }`, o
  token `--font-heading` e `--radius: 0`.
- Tokens sem nenhum consumidor: `--surface`, a rampa `--accent-300..800`,
  `--neutral-*` e os 8 `--sidebar-*` (× 2 escopos).
- `CardAction` e a prop `size` do `Card`; variantes `ghost` e `link` do
  `Badge` — todos sem call site, confirmado por `tsc`.
- `toastOptions.classNames.toast = "cn-toast"` em `ui/sonner.tsx`: a classe não
  era definida em nenhum arquivo do projeto.

### Interno

- `@source not "../../docs"` em `globals.css`: exemplos de código em markdown
  (`bg-[url(...)]`, `from-[#1A1D24]`) eram lidos pelo Tailwind v4 como
  utilities reais e o Turbopack tentava resolver `url(...)` como módulo,
  quebrando o build.
- Tokens em `hsl()` completo, nunca triplet cru. O Tailwind v4 compila
  `bg-x/10` para `color-mix()`, que exige um `<color>` válido no primeiro
  termo; com triplet a declaração é descartada em silêncio e todo o vocabulário
  de opacidade dos primitivos deixa de pintar.
- `ThemeToggle` usa `useSyncExternalStore` com snapshots diferentes por
  ambiente para detectar hidratação, em vez de `useState` + `useEffect`
  (reprovado por `react-hooks/set-state-in-effect` no React 19).

## [0.19.4] — 2026-07-29

### Corrigido

- **Exclusão de registros não funcionava** em imóveis, obras, contratos e
  lançamentos financeiros: a tela recarregava e o registro permanecia na lista.
  As policies de SELECT criadas em `0033`/`0034` exigem `deleted_at is null` e o
  Postgres aplica essa policy também à **nova** linha de um `UPDATE`, abortando
  o próprio comando que marca a exclusão (`new row violates row-level security
  policy`). A exclusão passa a usar a função `public.soft_delete` (SECURITY
  DEFINER, migration `0041`), que valida organização, papel e escopo de obra.

### Melhorado

- Exclusão recusada (permissão, registro inexistente) agora mostra o motivo em
  um aviso na tela — antes o erro do banco era descartado silenciosamente.
- Excluir contrato passa a pedir confirmação, como nas demais telas.

### Segurança

- `public.soft_delete` (SECURITY DEFINER) deixa de ter `execute` para o papel
  `anon` (migration `0042`). Sem sessão a função já recusava, mas função com
  SECURITY DEFINER não deve ficar exposta a chamadas anônimas.

## [0.19.3] — 2026-07-27

### Melhorado

- Tela de Configurações reorganizada em duas seções — **Organização** (atalhos:
  empresa, templates, usuários, auditoria, como lista de linhas clicáveis) e
  **Automações de e-mail** (alertas e relatório) — com layout mais limpo.

## [0.19.2] — 2026-07-27

### Corrigido

- Barras do gráfico "Desembolso previsto" do painel não apareciam (altura em `%`
  colapsava dentro do contêiner flex). Agora a altura é calculada em pixels.

## [0.19.1] — 2026-07-27

### Melhorado

- E-mail de avisos de vencimento agora inclui as colunas **Obra** e **Custo
  mensal** de cada item (contratos, imóveis, devoluções e pagamentos).

## [0.19.0] — 2026-07-27

### Melhorado

- Novo contrato de locação já vem com número sugerido automaticamente
  (`CT-<ano>-<sequência>`), editável pelo usuário.

## [0.18.0] — 2026-07-27

### Adicionado

- Service worker com uso offline básico: navegação usa network-first e, sem
  conexão, exibe uma página `/offline` amigável. Estáticos com
  stale-while-revalidate. Registro best-effort.
- Ícones PNG 192/512 do PWA (gerados por `scripts/gen-icons.mjs`) referenciados
  no manifest e no `<head>` (incl. apple-touch-icon).

### Interno

- `apresentacao-loca.html` (arquivo avulso) adicionado ao `.gitignore`.

## [0.17.0] — 2026-07-27

### Adicionado

- Linha do tempo de auditoria por entidade (contrato de locação e imóvel):
  quem criou/alterou/excluiu e quando. Visível ao Master (RLS).

### Melhorado

- Logs do servidor em formato estruturado (JSON por linha) via `src/lib/logger.ts`,
  aplicados às rotinas de cron; preparação para APM (Sentry via `SENTRY_DSN`).

## [0.16.0] — 2026-07-27

### Adicionado

- Botão "Gerar cobrança" na avaria: cria uma conta a pagar com o custo estimado,
  marca a avaria como "cobrada" e vincula os dois (idempotente).

### Melhorado

- Aviso ao cadastrar/editar fornecedor com CNPJ já usado por outro fornecedor,
  com opção de "salvar mesmo assim".

## [0.15.0] — 2026-07-27

### Adicionado

- Geração do contrato de locação de equipamento em PDF, com template editável
  (variáveis) em Configurações → Templates e a lista de itens do contrato.

### Melhorado

- Termo de responsabilidade passa a citar a Política de Alojamento (POL-RH-001)
  e a obrigação de entrega das chaves na devolução.

## [0.14.0] — 2026-07-27

### Segurança

- Troca de senha obrigatória no primeiro acesso e após redefinição pelo
  administrador (flag `senha_temporaria` + guarda no middleware).
- Dados sensíveis (CPF, conta bancária e chave PIX) exibidos mascarados na tela,
  com opção de revelar sob demanda.

## [0.13.0] — 2026-07-27

### Adicionado

- Filtro por obra no painel inicial; todos os indicadores e o gráfico passam a
  respeitar a obra escolhida.
- Gráfico de desembolso previsto (12 meses) no painel, com pago, pendente e
  projeção dos contratos (equipamentos e imóveis).
- Indicadores de imóveis no painel: quantidade e custo mensal dos contratos
  vigentes.

## [0.12.0] — 2026-07-26

### Melhorado

- Busca por texto nas listas de obras, itens, contratos, fornecedores, imóveis
  e financeiro.
- Ordenação por coluna (clique no cabeçalho) e paginação em todas as listas
  principais, preservando busca e filtros na URL.
- Desempenho: as listas carregam por página (20 itens) em vez de trazer todos
  os registros de uma vez.

## [0.11.0] — 2026-07-26

### Adicionado

- Reajuste do aluguel por percentual, com efeito imediato no valor e registro
  no histórico do contrato (adianta a próxima data de reajuste).
- Aditivo de contrato de imóvel: altera valor de aluguel e/ou prazo (data fim)
  preservando o histórico de mudanças.
- Encerramento/distrato do contrato de imóvel com data e motivo; encerra a
  vigência e o contrato deixa de projetar no fluxo de caixa.
- Histórico versionado do contrato (timeline de aditivos, reajustes e
  encerramentos) na tela do imóvel.

## [0.10.0] — 2026-07-26

### Adicionado

- Geração de contas a pagar recorrentes a partir dos contratos de imóvel e de
  locação (uma parcela por mês, idempotente — não duplica meses já gerados).
- Baixa de conta com conciliação: valor efetivamente pago, data do pagamento,
  número da NF e anexo do comprovante no Storage.
- Cálculo de multa (2%) e juros (1% a.m. pró-rata) por atraso, com sugestão
  aplicável na tela de baixa.

## [0.9.1] — 2026-07-26

### Melhorado

- Documentos da biblioteca do alojamento agora podem ter nome, descrição e
  categoria editados.

## [0.9.0] — 2026-07-26

### Adicionado

- Biblioteca de documentos do alojamento no módulo Imóveis (normativos,
  formulários e placas), com categorias, upload por administradores e download
  para toda a equipe. Arquivos no Storage.

## [0.8.0] — 2026-07-26

### Segurança

- Imóveis e relatórios passam a respeitar o acesso por obra do usuário (correção
  de vazamento entre obras).

### Adicionado

- Identificação do equipamento (nº de série/registro/tag) nos itens do contrato.
- Aditivos e renovações: anexar novos documentos ao contrato além do original.

### Melhorado

- Nova disposição da tela do contrato (adicionar item → itens → relatório de
  retirada → documentos do contrato).

## [0.7.0] — 2026-07-26

### Adicionado

- Página **Novidades** com o histórico de versões e melhorias, acessível pelo menu.
- Número da versão visível no rodapé do menu.

### Melhorado

- Processo de versionamento (SemVer) documentado para todas as alterações futuras.

## [0.6.0] — 2026-07-26

### Segurança

- Correção crítica: impedida a autopromoção de usuário a "master".

### Adicionado

- Trilha de auditoria (quem criou/alterou/excluiu), com tela em Configurações.

### Melhorado

- Exclusões reversíveis (soft-delete) em obras, contratos, lançamentos e imóveis.
- Alertas por e-mail mais robustos (isolamento de erro + fuso de São Paulo).
- Integridade de dados: número de contrato único por organização e índices.
- Acessibilidade nos filtros de relatórios e indicador de carregamento.

### Corrigido

- Custo de devolução parcial (não cobra mais a quantidade cheia), na tela do
  contrato e no fluxo de caixa.

## [0.5.0] — 2026-07-26

### Adicionado

- Cadastro completo da empresa usado nos contratos.
- Templates de documentos editáveis com variáveis (contrato de imóvel e termo).
- Acesso modular por usuário.
- Fornecedores vinculados a obras, com busca e filtro.
- IPTU, seguro fiança e dados bancários no contrato do imóvel.

### Melhorado

- Imóveis no fluxo de caixa; edição de contratos de imóvel; subtotal por obra no
  relatório de custo; logo da Sistenge nos PDFs.

## [0.4.0] — 2026-07-25

### Adicionado

- Módulo de Imóveis: cadastro, contratos, consumo, vistorias, reparos,
  ocorrências, ocupantes, emissão de contrato/termo, alertas e relatórios.

## [0.3.0] — 2026-07-24

### Adicionado

- Relatórios v2: ociosidade, custo por fornecedor, avarias, filtros, subtotais,
  gráficos e envio automático por e-mail.

### Corrigido

- Menu do usuário que quebrava ao abrir.

## [0.2.0] — 2026-07-24

### Adicionado

- Fluxo de caixa, gestão de usuários, meu perfil, filtro por obra, e-mails de
  acesso, login com logo e recuperação de senha, múltiplos prazos de aviso.

### Melhorado

- Identidade visual da Sistenge e data/hora nas assinaturas de vistoria.

## [0.1.0] — 2026-07-23

### Adicionado

- MVP: obras, fornecedores, itens, contratos, movimentação com devolução
  parcial, vistorias com fotos e avarias, financeiro, alertas de vencimento,
  relatórios em PDF/Excel e PWA instalável.
