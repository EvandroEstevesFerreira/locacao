# Loca — Controle de Locações de Materiais e Equipamentos em Obra

Sistema web/PWA para a **Sistenge** controlar, **por obra/contrato**, as locações de
equipamentos e materiais alugados de fornecedores: custo, prazos, vencimentos, vistorias e
relatórios. A Sistenge é a **locatária** (aluga de terceiros) — o foco é controle de custo
e evitar pagar por equipamento parado, não faturar clientes.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (preset base-nova / Base UI)
- **Supabase** (Postgres + Auth + Storage + RLS)
- **Vercel** (deploy + Cron)
- **Resend** (e-mails de aviso de vencimento)

## Funcionalidades (todas as fases implementadas)

| Fase | Entrega | Status |
|---|---|---|
| 0 | Fundação: login, perfis, RLS por organização, shell, PWA | ✅ |
| 1 | Cadastros: obras, fornecedores, itens (+ unidades de equipamento), usuários | ✅ |
| 2 | Contratos + movimentação (cadência, saldo, custo estimado, devoluções) | ✅ |
| 3 | Vistoria & avarias (fotos no Storage, checklist, avarias) | ✅ |
| 4 | Financeiro + Dashboard (contas a pagar, vencimentos, KPIs) | ✅ |
| 5 | Alertas automáticos por e-mail (Vercel Cron + Resend) | ✅ (requer chaves) |
| 6 | Relatórios PDF/Excel com filtros | ✅ |

## Papéis (RBAC)

`admin` (tudo) · `gestor` (obras que administra) · `financeiro` (financeiro e relatórios) ·
`operacional` (movimentação e vistoria) · `visualizador` (somente leitura). Isolamento por
organização e por obra via RLS.

## Setup local

```bash
npm install
cp .env.example .env.local   # preencher as variáveis
npm run dev                  # http://localhost:3000
```

O schema já foi aplicado no Supabase via `supabase/migrations/*.sql`
(ver seção "Banco de dados").

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | Conexão Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave pública (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Fase 5 | Cron de alertas (ignora RLS) — **secreta** |
| `RESEND_API_KEY` | Fase 5 | Envio de e-mail |
| `EMAIL_FROM` | Fase 5 | Remetente verificado (ex.: `avisos@sistenge.com`) |
| `CRON_SECRET` | Fase 5 | Protege `/api/cron/vencimentos` |
| `NEXT_PUBLIC_APP_URL` | opcional | URL pública do app |

## Banco de dados

Migrations versionadas em [`supabase/migrations/`](supabase/migrations/), aplicadas em ordem
(`0001` … `0009`). Para aplicar em um banco novo: rode os arquivos no SQL Editor do Supabase
(ou `supabase db push`), depois o bloco `SEED` no fim de `0001` para criar a organização e o
primeiro admin.

Helper de aplicação via connection string: `node scripts/db/apply.mjs <arquivo.sql>`
(requer `DATABASE_URL` no ambiente).

## Alertas por e-mail (Fase 5)

- Configuração em **/configuracoes** (admin): ativar, antecedência (dias) e destinatários.
- A rota **`/api/cron/vencimentos`** apura devoluções previstas, fins de contrato e
  pagamentos a vencer e envia um resumo via Resend (dedup por referência em `notificacao_log`).
- Agendamento diário em [`vercel.json`](vercel.json) (08:00 UTC). A Vercel envia o header
  `Authorization: Bearer $CRON_SECRET` automaticamente quando `CRON_SECRET` está definido.
- Para funcionar em produção: definir `RESEND_API_KEY`, `EMAIL_FROM`,
  `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET` nas variáveis da Vercel.

## Relatórios (Fase 6)

- Tela **/relatorios**: escolha o relatório (itens em aberto, contas a pagar, custo por obra),
  aplique filtros (obra, período) e exporte.
- Exportação: **PDF** (`/api/relatorios/pdf`) e **Excel** (`/api/relatorios/excel`),
  respeitando o RLS do usuário logado.

## Deploy (Vercel)

1. `npm i -g vercel` e `vercel link` (ou importar o repositório no dashboard da Vercel).
2. Definir as variáveis de ambiente (seção acima) em Project Settings → Environment Variables.
3. `vercel --prod` (ou push na branch de produção). O cron de `vercel.json` é ativado no deploy.

## Estrutura

```
src/
  app/
    (app)/          # área autenticada (compartilha o shell)
      obras/ fornecedores/ itens/ contratos/ vistorias/
      financeiro/ relatorios/ usuarios/ configuracoes/
      page.tsx      # dashboard
    api/
      cron/vencimentos/       # robô de alertas (Fase 5)
      relatorios/{pdf,excel}/ # exportações (Fase 6)
    login/ auth/signout/
  components/{layout,ui}/     # shell + shadcn/ui
  lib/
    supabase/       # clientes browser/server/admin + proxy de sessão
    auth.ts nav.ts cnpj.ts itens.ts locacao.ts vistoria.ts relatorios.ts pdf.tsx email.ts
  proxy.ts          # renova sessão e protege rotas
supabase/migrations/  # schema versionado (0001–0009)
scripts/db/           # apply.mjs / query.mjs (helpers de migração)
```
