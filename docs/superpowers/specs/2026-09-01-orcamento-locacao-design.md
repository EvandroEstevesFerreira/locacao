# Orçamento de locação por obra

**Data:** 2026-09-01
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** subprojeto B do controle orçamentário de locação

> **Número da migration:** atribuído na implementação. Esta fatia vem depois de
> `2026-08-31-avanco-obra-design.md` (já em produção, migration 0050).

## Objetivo

Fechar o **terceiro percentual** que a diretoria pediu. A fatia anterior entregou
prazo decorrido e avanço físico; falta o orçamento consumido, que é o que
transforma dois números em diagnóstico:

```
Obra Ipiranga · orçamento de locação R$ 400.000
  Prazo decorrido ....... 55%
  Avanço físico ......... 31%
  Orçamento consumido ... 62%

Projeção: 62% ÷ 31% = 2,0 → a obra terminaria em ~200% do orçamento.
Estouro previsto: R$ 400.000.
```

Esse é o número que muda decisão. "Consumi 62%" isolado não diz nada; ao lado de
"entreguei 31%" ele diz que a obra vai estourar o dobro.

## Estado atual — e por que ele importa para esta fatia

Levantado no banco de produção em 2026-09-01:

| | |
|---|---|
| Obras ativas | 7 — nenhuma com datas, nenhuma com avanço lançado |
| Contratos ativos | 2 — **zero itens locados** |
| Lançamentos financeiros | 2, R$ 3.100, ambos `manual`, **nenhum com contrato vinculado** |

Duas consequências que moldaram o desenho:

1. **Orçamento é dado que a diretoria fornece**, não depende de adoção de campo.
   É por isso que esta fatia vem antes do subprojeto C (custo por item): C rateia
   nota entre itens de contrato, e não existe um único `item_locado`.

2. **`lancamento_financeiro` não tem categoria de custo.** A coluna `origem`
   (`manual | recorrente | avaria | consumo`) diz COMO o lançamento nasceu, não
   de que tipo de custo é. A única distinção entre locação de equipamento e
   aluguel de imóvel é o FK: `contrato_id` contra `contrato_imovel_id`.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Granularidade | **Total por obra obrigatório; detalhamento por item opcional** |
| Realizado | **Só lançamento com `contrato_id` preenchido** |
| Medida do consumo | **`valor`, incluindo pendente** — não `valor_pago` |
| Revisão de orçamento | **Versão nova**, nunca sobrescrita |
| Soma dos itens ≠ total | **Permitida**, e a diferença é exibida |

### Por que `valor` e não `valor_pago`

Orçamento é consumido quando o custo é **incorrido**, não quando a fatura é
paga. Uma nota pendente já comprometeu o dinheiro; tratá-la como não consumida
faria o percentual despencar todo mês e subir na data de pagamento, sem nada ter
mudado na obra. O pago aparece como informação separada.

### Por que versão, e não edição

A diretoria muda orçamento no meio da obra — sempre. Se a revisão sobrescrever,
a linha de base desaparece e o orçamento passa a **perseguir o realizado**: nunca
há estouro, porque o alvo se move. Sem baseline não existe explicação de desvio.

### Por que a soma dos itens pode divergir do total

Forçar igualdade obriga a diretoria a detalhar tudo ou nada — e o resultado, na
prática, é não detalhar. A tela mostra a diferença:

```
Detalhado: R$ 320.000 de R$ 400.000 · R$ 80.000 sem detalhamento
```

Divergência visível é informação. Divergência proibida é atrito.

### A tela tem de confessar o dado faltante

Como nenhum lançamento tem contrato vinculado hoje, um "0% consumido" seco seria
mentira por omissão. O bloco diz, quando é o caso:

```
R$ 3.100 lançados nesta obra não estão vinculados a contrato
e por isso não entram no realizado.
```

Isso transforma um problema de qualidade de dado num empurrão para o hábito
certo — e é o que impede o painel de parecer saudável quando está apenas vazio.

## Modelo de dados

```sql
create table public.orcamento_locacao (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  obra_id      uuid not null references public.obra (id) on delete cascade,
  versao       int  not null default 1,
  vigente      boolean not null default true,
  valor_total  numeric(14,2) not null check (valor_total >= 0),
  observacoes  text,
  criado_por   uuid references public.perfil (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (obra_id, versao)
);

-- Um único vigente por obra. Índice parcial, e não constraint, porque é o que
-- permite N versões aposentadas convivendo com uma vigente.
create unique index idx_orcamento_vigente
  on public.orcamento_locacao (obra_id) where vigente;

create table public.orcamento_item (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  orcamento_id   uuid not null references public.orcamento_locacao (id) on delete cascade,
  item_id        uuid not null references public.item_catalogo (id) on delete restrict,
  quantidade     numeric(14,2),
  valor_previsto numeric(14,2) not null check (valor_previsto >= 0),
  unique (orcamento_id, item_id)
);
```

`on delete cascade` do item para o orçamento é deliberado: item de orçamento não
tem vida própria. Já `item_id` é `restrict` — apagar do catálogo um item que está
orçado apagaria história.

## O cálculo — `src/lib/orcamento.ts`, puro

| Função | Devolve |
|---|---|
| `percentualConsumido(orcado, realizado)` | `null` se orçado ≤ 0 |
| `projecaoFinal(consumido, fisico)` | fração do orçamento projetada, ou `null` |
| `estouroPrevisto(orcado, projecao)` | reais acima do orçamento, ou `null` |
| `diagnostico(prazo, fisico, consumido)` | veredito legível |
| `totalDetalhado(itens)` | soma dos itens, para a linha de divergência |

### Os casos que devolvem `null`, e por quê

- **orçado ≤ 0** — obra sem orçamento não tem percentual. Dividir por zero daria
  `Infinity`, e a tela mostraria "∞%".
- **avanço físico nulo ou zero** — sem obra entregue não há denominador para
  projetar. Uma obra em 0% que já consumiu R$ 10.000 projetaria infinito.

`null` com a tela dizendo "sem avanço lançado, não há projeção" é honesto.
Número inventado num painel de diretoria destrói a confiança em tudo que está ao
lado dele.

### O diagnóstico

Cruza os três e devolve uma frase. A regra é comparar consumo com entrega:

| Situação | Veredito |
|---|---|
| consumido > físico + 10 pts | **Consumindo mais rápido que entrega** |
| consumido < físico − 10 pts | **Entregando mais que consome** |
| dentro da faixa | **Consumo alinhado ao avanço** |
| falta qualquer um dos números | **Dados insuficientes** — e diz qual falta |

A margem de 10 pontos existe para o veredito não oscilar a cada semana por ruído
de arredondamento.

## Telas

### Bloco de orçamento em `/obras/[id]`

Abaixo do bloco de avanço: orçado vigente, realizado, % consumido, projeção
final, estouro previsto e a linha de confissão dos lançamentos sem contrato.
Detalhamento por item em tabela, quando houver.

Sem orçamento cadastrado, o bloco não mostra zeros — oferece cadastrar.

### Definir e revisar

Formulário no próprio bloco. Salvar com orçamento vigente já existente **cria
versão nova** e aposenta a anterior na mesma transação. O histórico de versões
fica visível, com data, autor e valor — é o que permite explicar o desvio depois.

### Os três percentuais juntos

O bloco de avanço passa a exibir prazo, físico **e** consumido lado a lado. É o
cruzamento inteiro do pedido da diretoria, numa só tela, pela primeira vez.

## RLS

Escopo por obra, no padrão da 0049/0050: leitura para quem tem acesso à obra
(mais master/administrador/gestor), escrita por `pode_gerir_cadastros()`.

`orcamento_item` herda o escopo via `orcamento_id` — a policy resolve a obra
pelo orçamento pai, e não confia num `obra_id` denormalizado que poderia
divergir.

## Testes

- **`orcamento.test.ts`** — orçado zero, avanço zero e nulo, o caso 62/31 do
  exemplo, obra eficiente (físico acima do consumido), o diagnóstico nos quatro
  quadrantes, e a divergência de detalhamento.
- **Varredura de schemas** — `orcamento` entra no `MODULOS` do teste à mão e
  ganha amostra em `AMOSTRAS`.
- **Migration** validada executando num Postgres descartável antes de produção,
  incluindo a prova de que o índice parcial impede dois vigentes na mesma obra e
  de que criar versão nova aposenta a anterior.
- **`get_advisors`** de segurança depois de aplicar.

## Fora de escopo

Orçamento por competência (mês a mês), fechamento mensal com congelamento
(subprojeto D), rateio de lançamento por item (subprojeto C), painel consolidado
e e-mail quinzenal (subprojeto F), e qualquer categorização nova em
`lancamento_financeiro`.

## Risco conhecido

**O realizado começa em zero.** Nenhum lançamento tem contrato vinculado, então o
percentual consumido de toda obra será 0% até esse hábito mudar. O desenho
responde a isso da única forma honesta: a tela declara quanto foi lançado sem
vínculo, em reais, para que o zero seja lido como "falta vincular" e não como
"não gastamos".
