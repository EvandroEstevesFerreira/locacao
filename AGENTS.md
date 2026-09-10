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
- **`createAdminClient()` nunca toca tabela da aplicação.** O que ele bypassa é
  RLS, e o isolamento por organização e o escopo por obra do Loca dependem de
  RLS: um `.from(...)` com client admin faz todo tenant ver tudo em silêncio, e
  nenhum teste pega. Onde é permitido:
  - `src/app/api/cron/*` — roda sem sessão de usuário, não há RLS a respeitar;
  - `auth.admin.*` (criar/excluir/atualizar usuário), como em
    `usuarios/actions.ts` — a Admin API do Supabase Auth exige service role e
    `auth.users` não é tabela da aplicação.

  Fora disso, e **sempre** em `src/lib/data/`, use `createClient()`.
- **Escrita compartilhada entre grupos de rota mora em `src/lib/<dominio>-servidor.ts`**,
  com `import "server-only"` no topo e recebendo o `supabase` de quem chama.
  `src/lib/data/` é só leitura. O primeiro caso é
  `src/lib/custodia-servidor.ts`, chamado por `termos/actions.ts` e por
  `frota/actions.ts`: copiar o escritor nos dois é como as duas cópias
  divergem, e a divergência num livro de custódia aparece como equipamento
  que consta com duas pessoas.
- **Toda view nasce com `security_invoker = on`.** No Postgres 15+ o padrão é
  `off`: a view executa com os privilégios do DONO, que ignora RLS, e passa a
  devolver as linhas de todas as organizações para qualquer usuário
  autenticado — o mesmo furo do `createAdminClient()`, por outra porta, e
  igualmente silencioso. Foi o incidente da 0.49.1 (migration 0058). A guarda
  é `src/lib/migrations-seguranca.test.ts`, que varre as migrations sem lista
  de nomes a manter.
- **"Hoje" nunca é `new Date()`** quando a data vai ser comparada com coluna
  `date` do banco — use `hojeSaoPaulo()` (ou `hojeISOSaoPaulo()` para string).
  `new Date()` é um instante e o Vercel roda em UTC, então das 21h à meia-noite
  em Brasília a contagem de dias de calendário sai um dia maior — e em cima dela
  está o cálculo de custo de locação. `new Date()` continua correto para
  timestamp completo (`updated_at`) e em componente `"use client"`, onde o fuso
  já é o do usuário.
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

# Pagamentos no Mega

O Mega é o ERP do contas a pagar. É lá que se confere se a locação foi
**efetivamente paga** — o Loca sabe o que foi contratado e o que corre; quem
sabe o que saiu do caixa é o Mega.

**Consulta pronta**, sem escrever código:

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\mega-pagamentos.ps1 -Codigo 2630
powershell ... -File scripts\mega-pagamentos.ps1 -Codigo 2630 -Inicio 2026-07-01 -Fim 2026-12-31
powershell ... -File scripts\mega-pagamentos.ps1 -Codigo 2630 -Json
```

`-Codigo` é o **`fornecedor.codigo_mega`** do Loca, cru. Medido em 10/09/2026:
36 dos 38 fornecedores têm o código preenchido.

## O que a resposta traz

```
AP 32549 | NF     | doc 42824001 | venc 15/08/2026 | R$ 2.038,53 | saldo 0,00     → paga
AP 33162 | FATURA | doc 42824002 | venc 15/09/2026 | R$ 2.038,53 | saldo 2.038,53 → em aberto
```

- **`SaldoAtual == 0` é o que significa "pago".** Não existe campo de data de
  pagamento nessa rota: dá para saber SE pagou, não QUANDO.
- **`NumeroDocumento` é o número da fatura** — `42824002` é a fatura
  nº 042.824.002 do fornecedor. É a chave para ligar um título do Mega a um
  documento do Loca, e não exige interpretar texto livre.
- Retenção (ISS, INSS, IR, GUIA) fica em **agente próprio**, o do órgão. Filtrar
  pelo código do fornecedor já as exclui — mas em consulta por período elas
  aparecem, e `AP | parcela` **não é chave única**. A chave é
  `AP | parcela | agente | tipoDoc | numDoc | vencimento | valor`.

## Duas correções ao guia do Mega

O guia completo está em
`C:\Users\evandro.ferreira\Projects\Financeiro\docs\CONEXAO-MEGA-API.md`.
Duas coisas foram medidas aqui e divergem dele:

1. **A rota de contas a pagar quer o código CRU** (`2630`), não `1-2630`. Com o
   prefixo, a API responde `The value '1-2630' is not valid`. O formato
   `padrao-codigo` só vale em `/api/globalagente/Agente/{id}`, que serve para
   confirmar nome e CNPJ do fornecedor.
2. **`@($s | ConvertFrom-Json)` no PowerShell 5.1 devolve UM elemento** contendo
   o array inteiro: a contagem sai 1 e a soma estoura com `op_Addition`.
   Atribuir primeiro (`$d = $s | ConvertFrom-Json`) e envolver depois
   (`@($d)`) desenrola certo.

## Regras que não se negociam

- **Uma autenticação por vez.** Encadear tentativas já bloqueou a conta
  `120.apifin`. O script reaproveita o token salvo (vale 2 h) e só reautentica
  quando ele passa de 100 min.
- **Nunca imprimir `mega_cred.txt` nem o `TENANT`** — o tenant é GUID e é
  segredo. O script lê o arquivo e mostra só o resultado da chamada.
- **Erro de autenticação volta HTTP 200 com `text/plain`.** Nunca converter para
  JSON direto; ler o corpo e só converter se começar com `{` ou `[`.
- Rodar pelo **PowerShell do Windows**, não pelo shell Linux: o container não
  alcança os arquivos de credencial.

## O que ainda NÃO existe

Não há integração automática: o Loca **não** consulta o Mega sozinho, e
`lancamento_financeiro` está praticamente vazia (2 lançamentos, nenhum ligado a
contrato). A consulta acima é manual, por sessão.

Se um dia virar sincronização, ela deve ser **cron**, e não consulta ao vivo por
requisição: vários usuários abrindo a tela do contrato autenticariam em paralelo
e derrubariam a conta de API.
