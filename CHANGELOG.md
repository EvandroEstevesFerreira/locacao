# Changelog

Todas as mudanças relevantes do **Loca** ficam aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

> Fonte única para a tela **Novidades**: [`src/lib/changelog.ts`](src/lib/changelog.ts).
> Ao concluir uma alteração, atualize **os dois** (ver processo em `AGENTS.md`).

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
