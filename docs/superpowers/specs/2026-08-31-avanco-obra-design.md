# Período da obra e avanço físico semanal

**Data:** 2026-08-31
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** subprojetos A e E do controle orçamentário de locação

> **Número da migration:** atribuído na implementação. Esta fatia é a PRIMEIRA
> das três pendentes — vem antes de `2026-08-31-cadastro-frota-design.md` e de
> `2026-08-25-termo-equipamento-design.md`.

## Objetivo

A diretoria pediu acompanhamento de orçamento de locação por obra. O pedido
inteiro são seis subsistemas e um trimestre de trabalho; esta é a primeira
fatia, e ela entrega **dois dos três percentuais** que sustentam o pedido, sem
tocar em dinheiro.

O que a diretoria quer, no fundo, é cruzar três números que hoje ninguém cruza:

| Percentual | De onde vem | Nesta fatia |
|---|---|---|
| **% prazo decorrido** | datas da obra | **entra** |
| **% avanço físico** | informado semanalmente | **entra** |
| **% orçamento consumido** | realizado ÷ orçado | fatias B, C, D |

Isolados, nenhum decide nada. "Consumi 60% do orçamento" ser bom ou ruim depende
de quanto de obra foi entregue. E isso importa mais em locação do que em
qualquer outra conta: **equipamento alugado cobra por tempo, não por produção.**
Obra atrasada paga diária de betoneira parada — o atraso vira custo todo dia,
sem ninguém decidir nada.

Esta fatia entrega o par que já diagnostica atraso:

```
Obra Ipiranga · semana de 25/08
  Prazo decorrido ....... 55%
  Avanço físico ......... 31%
  Desvio ................ 24 pontos de atraso
```

## Estado atual

### O que já existe e será usado

| Existe | Onde | Papel nesta entrega |
|---|---|---|
| `obra` com `codigo`, `nome`, `status` | 0001 | Ganha as três datas |
| **`obra.destinatarios_alerta text[]`** | 0047 | **Os responsáveis por obra já têm e-mail cadastrado** |
| `hojeSaoPaulo()` / `hojeISOSaoPaulo()` | `src/lib/locacao.ts` | Obrigatório no cálculo (ver "Fuso") |
| Catálogo de e-mails, layout e `Documento` | `src/lib/emails/` | O e-mail novo não inventa desenho |
| Cron da Vercel + dedup por `ultimo_envio` | 0016, `vercel.json` | Precedente do disparo semanal |
| `ListFilters` / `SelectFilter` / `EmptyState` | `src/components/shared/` | Telas |
| `idOpcional`, `aoInvalidar` | `src/lib/campos.ts`, `validacao-form.ts` (0.39.1) | Schema e form |

### Confirmado por leitura do código

- `obra` **não tem** `data_inicio` nem `data_fim` — nenhuma das duas.
- **Não existe nada** de avanço, medição ou progresso no sistema. `vistoria` é
  inspeção de equipamento por contrato, coisa diferente.
- `obra.responsavel` é **texto livre**, não vínculo com usuário. Não muda nesta
  fatia: o destinatário do e-mail é `destinatarios_alerta`, que já resolve o
  disparo, e transformar `responsavel` em FK é trabalho sem retorno agora.
- Frequência de e-mail suporta só `semanal` e `mensal`. **Quinzenal não
  existe** — e não entra aqui, porque só faz sentido com os percentuais
  financeiros (fatia F).

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Natureza do avanço | **Acumulado** ("estamos em 34%"), não incremental |
| Granularidade | **Um número por obra** — sem frentes nem etapas |
| Quem informa | **O administrativo**, a partir do que o engenheiro reporta |
| Onde informa | **Tela em lote**, todas as obras na mesma página |
| Correção de erro | **Upsert** por `(obra_id, semana)` |
| Semana | Identificada pela **segunda-feira**, canonizada no código |
| Responsável da obra | Continua texto livre; e-mail vai por `destinatarios_alerta` |
| Quinzenal | **Fora** — fatia F |

### Por que acumulado, e não incremental

Acumulado se autocorrige: uma semana com número errado é consertada pelo
lançamento seguinte, e semana não informada não corrompe o total. Incremental
soma, então uma semana esquecida estraga o número **para sempre** — e num
processo semanal preenchido por gente ocupada, semana esquecida é certeza, não
hipótese.

## Modelo de dados

```sql
alter table public.obra
  add column if not exists data_inicio       date,
  add column if not exists data_fim_prevista date,
  add column if not exists data_fim_real     date;

-- Nulo é legítimo: nenhuma obra cadastrada tem período, e obra sem
-- `data_fim_prevista` simplesmente não tem "% de prazo decorrido".
alter table public.obra
  add constraint obra_periodo_coerente check (
    data_inicio is null or data_fim_prevista is null
    or data_fim_prevista >= data_inicio
  );

create table public.avanco_obra (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  obra_id       uuid not null references public.obra (id) on delete cascade,
  -- SEMPRE a segunda-feira da semana, canonizada no código. É o que faz o
  -- unique abaixo significar "um lançamento por semana".
  semana        date not null,
  percentual    numeric(5,2) not null check (percentual between 0 and 100),
  observacoes   text,
  -- Quem DIGITOU, que pela decisão é o administrativo — não é o responsável
  -- pela obra. A distinção importa no dia em que o número for contestado.
  informado_por uuid references public.perfil (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (obra_id, semana)
);

create index idx_avanco_obra on public.avanco_obra (obra_id, semana desc);
create index idx_avanco_org  on public.avanco_obra (org_id);

create trigger trg_avanco_obra_updated_at
  before update on public.avanco_obra
  for each row execute function public.set_updated_at();
```

O `unique (obra_id, semana)` é a peça central: relançar na mesma semana é
**upsert**, corrigir é natural, e semana duplicada não existe. É o que torna o
avanço acumulado autocorretivo, e não só acumulado.

## O cálculo — `src/lib/avanco.ts`, puro

| Função | Devolve |
|---|---|
| `segundaDaSemana(dataISO)` | a segunda-feira da semana daquela data |
| `percentualPrazo(obra, hojeISO)` | `null` se falta período; senão 0–100 com clamp |
| `desvio(prazo, fisico)` | pontos percentuais; positivo é atraso |
| `semanasSemLancamento(obra, avancos, hojeISO)` | quantas semanas passaram sem número |
| `previsaoTermino(avancos, hojeISO)` | data estimada pelo ritmo recente, ou `null` |

### Fuso — a trava que não é opcional

**`hojeISOSaoPaulo()`, nunca `new Date()`.** O cálculo compara com coluna `date`
e o Vercel roda em UTC: das 21h à meia-noite em Brasília, `new Date()` já é o dia
seguinte. Aqui isso mudaria o % de prazo de uma obra e, na fatia F, o valor
cobrado. É o bug da 0.22.0, e o AGENTS.md o proíbe explicitamente.

### `previsaoTermino` devolve `null` de propósito

Ritmo zero (obra parada) ou negativo (correção para baixo) faria divisão por zero
ou uma data absurda. `null`, com a tela dizendo "ritmo insuficiente para
projetar", é honesto; "término em 2183" destrói a confiança no painel inteiro.

O ritmo é a média das últimas 4 semanas **com lançamento** — não das últimas 4
semanas de calendário. Senão semana não informada vira ritmo zero, e a projeção
mente para pior justamente quando o dado está faltando.

## Telas

### `/avanco` — nova, e é ela que faz o projeto sobreviver

O lançamento é do administrativo, então a tela é **uma linha por obra ativa,
todas na mesma página**: obra, % da semana anterior, campo do % desta semana,
observação opcional, e um botão que salva tudo.

Isso não é conveniência, é a condição de existência do dado. Se o lançamento
exigisse entrar em cada obra, seriam 8 navegações por semana — e é aí que a
rotina morre no segundo mês, levando com ela o insumo de três subprojetos.

Destaque visual para obra sem lançamento na semana. Sem cobrança visível, a
lacuna passa despercebida.

### `/obras/[id]` — bloco "Avanço da obra"

% atual, % de prazo, desvio em pontos, previsão de término, e as últimas 8
semanas. `EmptyState` quando não há lançamento nenhum.

### `/obras/nova` e edição — as três datas

O form já usa `react-hook-form`, e agora existe validação cruzada de verdade
(`data_fim_prevista >= data_inicio`), o que finalmente justifica o resolver que
já estava lá. O `obraSchema` ganha as três datas com `dataOpcional` de
`@/lib/campos` e um `.superRefine()` para a ordem.

### Registro do módulo

A rota nova entra em `MODULOS` / `moduloDaRota`. Sem isso ela nasce invisível
para quem não é master, e o sintoma é 404 sem explicação.

## O e-mail

Um template novo no catálogo (`avanco-obra`), reaproveitando layout e
`Documento`. Cron semanal, com dedup por data no padrão da 0016.

Conteúdo, por obra, para `destinatarios_alerta`:

- prazo decorrido, avanço físico e desvio em pontos;
- previsão de término contra a data prevista;
- quantidade de itens locados em aberto e prazo de cada contrato — dados que
  `relatorios.ts` já sabe calcular.

Junto vai a cobrança ao administrativo: obra ativa sem lançamento na semana entra
numa lista no mesmo disparo. O e-mail que cobra é o que mantém o cadastro vivo.

## RLS

`avanco_obra` segue o escopo por obra do Loca, com `has_obra_access(obra_id)` —
diferente da exceção aberta na fatia de frota, porque aqui não existe a
justificativa de "preciso ver onde está a betoneira da outra obra". Escrita para
admin/gestor.

Leituras em `src/lib/data/avanco.ts` com `import "server-only"`, tipos planos e
`createClient()` — nunca `createAdminClient()`, exceto no cron, que roda sem
sessão de usuário.

## Testes

- **`src/lib/avanco.test.ts`** — o fuso explicitamente (o caso das 21h à
  meia-noite), obra sem período, clamp em 0 e em 100, canonização da
  segunda-feira em todos os dias da semana, ritmo zero, ritmo negativo, semanas
  sem lançamento, e desvio.
- **Varredura de schemas** — `avanco` entra no `MODULOS` **à mão** (é lista
  manual, como a fatia de frota registrou) e `avancoSchema` ganha amostra em
  `AMOSTRAS`.
- **RLS** no Postgres local: obra de outra organização não é lida, e usuário sem
  `obra_usuario` não lê o avanço daquela obra.

## Fora de escopo

Frentes e etapas com peso, importação de planilha, curva S em gráfico,
frequência quinzenal, e qualquer número de dinheiro — orçamento, realizado,
saldo, fechamento. Nenhum valor em reais aparece nesta fatia.

## Risco conhecido

**Adoção, não código.** Se ninguém lançar o avanço semanal, três dos seis
subprojetos perdem o insumo e o painel fica bonito e vazio.

Mitigações desenhadas: um número por obra e nada mais; tela em lote que resolve
todas as obras de uma vez; destaque de lacuna na própria tela; e e-mail de
cobrança quando a semana passa sem lançamento. Nenhuma garante adoção — mas cada
uma remove um motivo concreto de desistência.
