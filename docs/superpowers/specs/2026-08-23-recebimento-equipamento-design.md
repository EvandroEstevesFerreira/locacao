# Recebimento de equipamento, numeração de registros e aviso ao fornecedor

**Data:** 2026-08-23
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** subprojeto 1 de 4 do módulo de equipamento locado

## Objetivo

O Loca nasceu para controlar equipamento locado de terceiros — recebimento, uso,
devolução, avarias e reparos. O registro existe (`contrato_locacao`,
`item_locado`, `movimentacao`, `vistoria`, `avaria`), mas **não gera documento
nenhum** e não comunica o fornecedor. O papel que circula na obra continua sendo
o do fornecedor.

Esta entrega fecha a ponta de entrada: dar entrada no equipamento, gerar o
romaneio no template do Loca e avisar o fornecedor por e-mail com o PDF anexo.
E, antes disso, dá a todo registro do sistema um **número único**, porque sem ele
não há como alguém dizer "confere o REC-2026-0014".

## Estado atual

### O que já existe e será usado

| Existe | Onde | Papel nesta entrega |
|---|---|---|
| `fornecedor` com `contato_email` | migration 0002 | Destinatário do aviso |
| `item_catalogo` | 0005 | Ganha a coluna `controle` |
| `equipamento_unidade` | 0005 | Patrimônio/série — **hoje órfã** |
| `contrato_locacao`, `item_locado` | 0006 | O recebimento se pendura neles |
| `movimentacao` | 0006 | Só grava devolução; `retirada` nunca é escrito |
| `vistoria`, `avaria` | 0007 | Ganham número; o resto é do subprojeto 2 |
| `notificacao_log` | 0009 | Registra o envio — **precisa de policy nova** |
| `enviarEmail` com `AnexoEmail` | `src/lib/email.ts` | Envio com PDF anexo, já pronto |
| Primitivos de PDF | `src/lib/pdf-form.tsx` | O romaneio sai deles, sem componente novo |

### Os três passivos que esta entrega encontra

1. **`contrato_locacao.numero` é texto digitado à mão e não tem `unique`.** Dois
   contratos podem ter o mesmo número hoje, e nada reclama.
2. **`equipamento_unidade` está órfã desde a 0005.** Existe, é única por
   organização, e nenhuma outra tabela a referencia. O controle é por quantidade.
3. **`notificacao_log` não aceita insert de usuário autenticado.** A policy diz,
   em comentário, que a inserção é do cron via service_role. Fechar um
   recebimento roda com sessão de usuário — sem policy nova, o insert falha.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Granularidade | **Mista**: `item_catalogo.controle` = `peca` \| `quantidade` |
| Formato do número | **Prefixo + ano + sequencial**, reiniciando a cada ano |
| Registros antigos | **Numerar retroativamente**, na ordem de criação |
| Número de registro excluído | **Morre com o registro** — nunca é reaproveitado |
| Gatilho do e-mail | **No fechamento** do recebimento, não ao salvar |
| Corpo do e-mail | **PDF anexo** + corpo curto |
| Vínculo com contrato | **Sempre**, com opção de criar o contrato na mesma tela |
| Quem lança | **Depende da obra**: celular no portão ou desktop dias depois |
| Documentos-fonte | **Criados do zero** no template do Loca |

## Fase 0 — Numeração de registros

### Dois números, sempre

A confusão que este desenho evita é tratar como um só o que são dois:

- **O número deles** — contrato do fornecedor, nota de remessa, romaneio.
  Digitado, pode repetir, pode vir em branco. É `contrato_locacao.numero` hoje.
- **O número nosso** — o registro no Loca. Gerado, único, nunca em branco.

`contrato_locacao.numero` **não é sobrescrito**. Ele continua sendo o número do
fornecedor e ganha `numero_registro` ao lado.

### Formato

```
CTR-2026-0007   contrato de locação de equipamento
CTI-2026-0003   contrato de imóvel
REC-2026-0014   recebimento
DEV-2026-0031   devolução
VIS-2026-0022   vistoria
AVA-2026-0009   avaria
REP-2026-0004   reparo
```

O ano no número diz sozinho de quando é o documento e impede que a sequência
cresça para sempre. Não entra o código da obra: duas obras produziriam o `0001`
no mesmo ano e o número deixaria de identificar o registro na organização.

### Sem buracos

```sql
create table public.numero_sequencia (
  org_id  uuid not null references public.organizacao (id) on delete cascade,
  tipo    text not null,
  ano     int  not null,
  ultimo  int  not null default 0,
  primary key (org_id, tipo, ano)
);

create function public.proximo_numero(p_tipo text, p_ano int) returns text ...
-- insert ... on conflict do update set ultimo = numero_sequencia.ultimo + 1
-- returning format('%s-%s-%s', prefixo, p_ano, lpad(ultimo::text, 4, '0'))
```

Uma `sequence` do Postgres seria mais rápida e é a escolha óbvia — **e está
errada aqui**. Transação abortada queima o número, e o livro fica sem o
`REC-2026-0008` sem que ninguém saiba por quê. Num sistema de alguns registros
por dia, o custo de serializar o contador é imperceptível e a garantia de
continuidade é o motivo de a numeração existir.

`on conflict do update` faz o lock de linha sozinho: não há `select … for update`
separado, e portanto não há janela entre ler e escrever.

### O ano é o de São Paulo

`p_ano` vem da aplicação, calculado com `hojeISOSaoPaulo().slice(0, 4)` — nunca
`extract(year from now())` dentro da função. O Vercel roda em UTC, e das 21h à
meia-noite de 31 de dezembro o banco viraria o ano antes da Sistenge. O primeiro
recebimento de 2027 sairia `REC-2027-0001` no dia 31/12/2026.

### Quando o número é atribuído

**No momento em que o registro vira oficial**, não na criação da linha.

Um rascunho numerado que é excluído deixa exatamente o buraco que o contador
gapless existe para evitar. Então: recebimento recebe número **ao fechar**;
registros sem estado de rascunho (vistoria, avaria) recebem na criação. Rascunho
aparece na tela como "Rascunho — sem número".

### Exclusão

Exclusão é `soft_delete`, e a linha continua no banco com o número. Quem procurar
o `REC-2026-0008` encontra o registro excluído, com data e autor na auditoria.
O número nunca volta para a fila: dois documentos com o mesmo número, um deles já
impresso e assinado, é pior do que uma sequência com um item cancelado.

### Retroatividade

A migration numera o que já existe, por tabela, na ordem de `created_at` e no ano
de `created_at`. Um livro que começa no meio obriga a explicar para sempre por
que metade dos registros não tem número.

## Fase 1 — Recebimento

### Modelo

```sql
alter table public.item_catalogo
  add column controle text not null default 'quantidade'
    check (controle in ('peca', 'quantidade'));

alter table public.item_locado
  add column unidade_id uuid references public.equipamento_unidade (id);
-- NULO = controlado por quantidade. É o estado de todo contrato existente:
-- nenhum dado migra e o fluxo atual continua funcionando.

create table public.recebimento (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  contrato_id     uuid not null references public.contrato_locacao (id) on delete cascade,
  fornecedor_id   uuid not null references public.fornecedor (id) on delete restrict,
  numero_registro text,            -- nulo enquanto rascunho
  recebido_em     date not null,   -- CAMPO, não now()
  conferente      text,
  nota_fornecedor text,            -- o número DELES
  observacoes     text,
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'fechado')),
  fechado_em      timestamptz,
  fechado_por     uuid references auth.users (id),
  aviso_enviado_em timestamptz,    -- nulo = fechado mas fornecedor não avisado
  documento_path  text,            -- o romaneio assinado, digitalizado
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, numero_registro)
);

create table public.recebimento_item (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizacao (id) on delete cascade,
  recebimento_id  uuid not null references public.recebimento (id) on delete cascade,
  item_locado_id  uuid references public.item_locado (id) on delete set null,
  item_id         uuid not null references public.item_catalogo (id) on delete restrict,
  unidade_id      uuid references public.equipamento_unidade (id),
  quantidade      numeric(14, 2) not null,
  condicao        text not null default 'ok'
                  check (condicao in ('ok', 'avaria', 'divergencia')),
  observacoes     text,
  created_at      timestamptz not null default now()
);
```

`item_locado_id` é **nulável de propósito**: nulo significa que chegou algo que
não estava no contrato. Sem isso o conferente teria de mentir no documento para
conseguir salvar — e mentira em documento de conferência é pior do que
divergência registrada.

`unidade_id` é preenchido quando `item_catalogo.controle = 'peca'`. O formulário
lê a flag e troca o campo: seletor de patrimônio ou campo de quantidade.

### `recebido_em` é campo, não "agora"

A resposta "depende da obra" é a razão desta coluna existir separada de
`created_at`. Obra grande lança com o caminhão parado; obra pequena manda a nota
para o escritório e alguém digita três dias depois. Se a data de recebimento
fosse `now()`, o segundo caso produziria um documento com a data errada — e é o
documento que vai ao fornecedor.

**Não há escrita offline.** O service worker (`public/sw.js`) só serve a página
offline em navegação; não há fila de sincronização. "Lançar no celular na hora"
significa tela boa em celular e conexão ativa. Prometer mais do que o SW faz
produziria registro perdido no portão da obra.

### Rascunho → fechado

| Estado | Permite | Número | E-mail |
|---|---|---|---|
| `rascunho` | Editar, acrescentar, excluir | não tem | não |
| `fechado` | Só leitura, anexar digitalizado | atribuído | disparado |

Fechar é irreversível na operação normal. **Reabrir existe e é só do master**,
com registro na auditoria: um recebimento fechado por engano às 7h não pode
travar a obra o dia inteiro. Reabrir **não devolve o número** — ao fechar de
novo, o mesmo `numero_registro` é mantido.

Ao fechar, a action:

1. Valida que há ao menos um item.
2. Pede `proximo_numero('recebimento', ano)`.
3. Escreve `data_retirada` nos `item_locado` vinculados que ainda não a têm, e
   carimba `recebimento_id`.
4. Gera o PDF e envia o e-mail.
5. Grava em `notificacao_log`.

### A decisão estrutural

Fechar **escreve em `item_locado`** em vez de substituí-lo. O cadastro de
contrato existente continua funcionando; o recebimento vira o caminho preferido,
não o único.

A alternativa — recebimento como fonte única e `item_locado` derivado — é mais
limpa no papel e custa reescrever o cadastro de contrato inteiro, migrar os
contratos existentes e conviver com duas verdades durante a transição. Para um
sistema em produção com contratos ativos, não compensa.

### E-mail ao fornecedor

Destinatário: `fornecedor.contato_email`. Sem e-mail cadastrado, o fechamento
acontece e a tela avisa que o fornecedor não tem endereço — o recebimento é
registro interno antes de ser comunicação.

Corpo curto no padrão de `montarEmailRelatorio`, com o **romaneio em PDF anexo**.
Fornecedor arquiva PDF; tabela no corpo quebra em metade dos clientes de e-mail e
não serve como comprovante.

**O envio não pode derrubar o fechamento.** Se o Resend falhar, o recebimento
continua fechado com `aviso_enviado_em` nulo, e a tela mostra "aviso não enviado"
com botão de reenviar. Um serviço de e-mail fora do ar não pode impedir o
registro de uma entrega física que já aconteceu.

`notificacao_log` ganha `tipo = 'recebimento'`, e o `unique (org_id, tipo,
referencia_id, data_referencia)` que já existe impede envio duplicado.

**Policy nova, obrigatória:** hoje `notificacao_log` não tem policy de insert para
`authenticated` — o comentário da migration 0009 diz que a inserção é do cron via
service_role. Fechar um recebimento roda com sessão de usuário. Sem a policy, o
insert falha e o fechamento quebra depois de o e-mail já ter saído.

### Romaneio de recebimento

Documento novo, criado do zero, no template do Loca. Sai dos primitivos de
`src/lib/pdf-form.tsx` — `Documento`, `CampoGrid`, `Tabela`, `Assinaturas` — sem
componente novo.

Cabeçalho com `numero_registro` em destaque, dados do fornecedor e do contrato,
a nota do fornecedor, tabela de itens com patrimônio quando houver, coluna de
condição, e assinaturas do conferente e do entregador.

Novo `tipo` em `documento_template` (`romaneio_recebimento`), entrada no catálogo
`DOCUMENTOS` com `modulo: "contratos"`, e o texto narrativo editável em
Configurações — mesmo desenho dos seis documentos do alojamento.

### Telas

- **`/contratos/[id]`** ganha a seção Recebimentos, com número, data, situação e
  o link do PDF.
- **`/recebimentos`** — listagem com filtro por obra, fornecedor, situação e mês,
  usando `ListFilters` + `ListSearch` + `SelectFilter` + `MesFilter`. A busca
  acha por `numero_registro` e por `nota_fornecedor`.
- **`/recebimentos/novo`** — seleção do contrato (com opção de criar na hora),
  cabeçalho, itens, salvar rascunho.
- **`/recebimentos/[id]`** — detalhe, edição enquanto rascunho, botão Fechar com
  confirmação que diz o que vai acontecer, e o anexo do digitalizado depois.

Uma coluna, alvos grandes, campos numéricos com teclado numérico. A mesma tela
serve o celular no portão e o desktop no escritório.

## Testes

- `proximo_numero` não deixa buraco sob concorrência: N chamadas paralelas
  produzem N números consecutivos, sem repetição.
- O ano vem de São Paulo: às 23h de 31/12 em Brasília o número ainda é do ano
  corrente.
- `intervaloDoMes` do filtro já é coberto; o filtro de recebimento reusa.
- Fechar atribui número, escreve `data_retirada` e não repete o número ao
  reabrir e fechar de novo.
- Falha de e-mail deixa o recebimento fechado com `aviso_enviado_em` nulo.
- Item com `controle = 'peca'` exige `unidade_id`; com `quantidade`, recusa.
- Schemas idempotentes: `parse(parse(x)) === parse(x)`, como todo schema do
  sistema.
- O romaneio renderiza e é **inspecionado**, não só contado. Lição das fases 1 e
  2 do alojamento: `lineHeight` na `Page` apaga o rodapé fixo e o Helvetica não
  tem o glifo `☐` — os dois passaram pelo teste de contagem de páginas.

## Faseamento

| Fase | Entrega | Migrations |
|---|---|---|
| 0 | `numero_sequencia`, `proximo_numero`, numeração retroativa, número nas telas e nos PDFs existentes | 1 |
| 1a | `controle` no item, `unidade_id` no `item_locado`, tabelas do recebimento, CRUD do rascunho | 1 |
| 1b | Fechamento, romaneio em PDF, e-mail ao fornecedor, policy de `notificacao_log` | 1 |

A fase 0 vai sozinha para produção. Ela é útil por si — dá número a tudo o que já
existe — e é pré-requisito das outras duas.

## Riscos assumidos

- **A numeração retroativa toca todas as tabelas de registro.** É uma migration
  de dados, não de esquema. Roda uma vez, e um erro nela é difícil de desfazer.
  Precisa ser testada contra uma cópia do banco antes de ir a produção.
- **O e-mail sai para fora da empresa.** É a primeira comunicação do Loca com
  terceiro. O gatilho no fechamento e a irreversibilidade existem para dar a
  janela de correção antes disso.
- **`item_locado.unidade_id` não é obrigatório**, mesmo para item com `controle =
  'peca'`. Torná-lo obrigatório quebraria os contratos existentes. A obrigação
  fica na validação do formulário de recebimento, não no banco — e isso significa
  que dado antigo continua sem peça vinculada.

## O que fica para os próximos subprojetos

| # | Subprojeto | Depende de |
|---|---|---|
| 2 | Devolução, laudo de avaria, ordem de reparo, `reparo_equipamento` | Numeração e vínculo de peça |
| 3 | Apontamento de uso, termo do operador, alocação por frente | Vínculo de peça |
| 4 | Relatórios sobre o dado dos anteriores | Todos |

Os três nascem de specs próprias. O subprojeto 3 é o maior e provavelmente se
decompõe de novo — apontamento de horímetro e alocação por frente são problemas
diferentes com públicos diferentes.
