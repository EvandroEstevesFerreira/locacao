# Alertas de vencimento por obra, com central

**Data:** 2026-08-23
**Status:** desenho aprovado, aguardando plano de implementação
**Independente:** não depende do módulo de equipamento; pode ir a produção sozinho

## Objetivo

Hoje o robô diário de vencimentos monta **um único e-mail** com tudo — devoluções
previstas, fins de contrato, pagamentos a vencer, contratos de imóvel — e envia
para **uma lista fixa da organização**, configurada em Configurações → Alertas de
vencimento.

O efeito prático: seis pessoas recebem todo dia os vencimentos de todas as obras,
e cada uma filtra mentalmente o que é seu. Quem toca uma obra só recebe o ruído
das outras; e quem gerencia todos os contratos não tem nada que o distinga de
quem toca uma obra.

Esta entrega separa os dois públicos:

- **Cada obra recebe o que é dela**, e só isso.
- **A central recebe tudo**, agrupado por obra.

## Estado atual

```
config_alerta (org_id PK)
  ativo          boolean
  dias_alerta    int[]        -- "30, 15, 3" da tela
  destinatarios  text[]       -- lista única da organização
```

O cron em `src/app/api/cron/vencimentos/route.ts` (316 linhas) varre cinco fontes,
monta o HTML, envia para `cfg.destinatarios` e grava em `notificacao_log`.

**A boa notícia:** cada alerta que o cron monta **já carrega a obra**. Os selects
trazem `obra:obra_id(codigo, nome)` em todas as fontes, e a função `nomeObra()`
já normaliza. Separar por obra é agrupar antes de enviar — não é buscar de novo.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Destinatários da obra | **Usuários vinculados** (`obra_usuario`) **+ lista extra** de e-mails avulsos |
| O que a central recebe | **Tudo**, agrupado por obra |
| Quem edita a lista extra | **Quem já edita a obra** — o campo fica no cadastro da obra |

### Por que os usuários vinculados, e não uma lista digitada

`obra_usuario` já controla quem enxerga a obra pela RLS. Uma segunda lista em
texto significa que **tirar alguém da obra não tira os alertas dela**: a pessoa
perde o acesso à tela e continua recebendo por e-mail o que já não pode ver.

Isso é vazamento, e é o oposto do objetivo. Derivar da mesma fonte que o controle
de acesso elimina a possibilidade — não há lista para esquecer de atualizar.

A lista extra existe para quem **não tem login**: encarregado terceirizado,
e-mail da obra, mestre de obra. São exatamente as pessoas que `obra_usuario` não
conhece.

## Modelo

```sql
alter table public.obra
  add column destinatarios_alerta text[] not null default '{}';
```

Uma coluna, nenhuma tabela nova. A lista extra é pequena por natureza — dois ou
três endereços — e não tem atributo próprio a guardar.

O conjunto de destinatários de uma obra é, portanto:

```sql
select p.email
  from obra_usuario ou
  join perfil p on p.id = ou.perfil_id
 where ou.obra_id = $1 and p.ativo and p.email is not null
union
select unnest(destinatarios_alerta) from obra where id = $1
```

`p.ativo` no filtro é o que impede o usuário desativado de continuar recebendo —
o mesmo motivo pelo qual a lista não é digitada.

## Roteamento

```
Alerta de vencimento
   │
   ├─ tem obra? ──► e-mail da OBRA (só o que é dela)
   │                └─ obra sem destinatário? cai na central, sinalizado
   │
   └─ sem obra ───► só a central

CENTRAL ──► tudo, de todas as obras, agrupado por obra
```

### Imóvel sem obra

`imovel.obra_id` é **nulável** — todas as outras fontes têm obra obrigatória.
Alerta de imóvel sem obra não tem para onde ir na divisão por obra e vai **só
para a central**, numa seção "Sem obra".

Sem esse tratamento explícito, o alerta cairia num agrupamento de chave nula e
sumiria sem erro.

### Obra sem destinatário — o modo de falha que importa

Uma obra nova, sem usuário vinculado e sem lista extra, **faria o alerta
desaparecer**. Hoje ele chega a alguém; depois desta mudança chegaria a ninguém.
Isso seria uma regressão disfarçada de recurso.

Portanto: obra sem destinatário **cai na central**, e a seção dela no e-mail
central vem marcada — `⚠ sem destinatários próprios`. A central é o destino de
tudo que a divisão por obra não consegue entregar, e ela diz o que aconteceu em
vez de absorver em silêncio.

### O e-mail central

Um e-mail, seções por obra, ordenado por código de obra:

```
Loca — Avisos de vencimento

▸ OB-042 Vista Verde ....... 3 avisos
▸ OB-051 Portal Sul ........ 1 aviso
▸ OB-063 Alto da Serra ..... 5 avisos
   ⚠ sem destinatários próprios
▸ Sem obra ................. 2 avisos
```

O corpo detalhado de cada seção é o mesmo HTML que a obra recebe — a montagem por
obra é reaproveitada, não reescrita.

## O `unique` de `notificacao_log`

```sql
-- hoje
unique (org_id, tipo, referencia_id, data_referencia)
```

Com dois públicos, o mesmo vencimento é notificado **duas vezes no mesmo dia** —
uma para a obra, outra para a central. A segunda gravação viola a restrição.

O `insert` do cron não trata o erro por linha: uma violação aborta o lote, e o
sintoma seria a central parar de receber sem nenhum erro visível. É o tipo de
falha que só aparece quando alguém pergunta "por que não recebo mais os avisos?".

```sql
alter table public.notificacao_log
  add column obra_id uuid references public.obra (id) on delete cascade;
-- nulo = envio para a central

drop  index/constraint antigo;
create unique index on public.notificacao_log
  (org_id, tipo, referencia_id, data_referencia, coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid));
```

O `coalesce` no índice é necessário porque, em Postgres, `null` não é igual a
`null` num índice único: duas linhas com `obra_id` nulo passariam pela restrição
e a central poderia receber o mesmo alerta duas vezes no mesmo dia.

## Policy de insert

`notificacao_log` continua sendo escrito **apenas pelo cron**, via service role,
que ignora RLS. Esta entrega não precisa da policy nova que a spec do recebimento
exige — lá o insert roda com sessão de usuário.

O `createAdminClient()` no cron é o caso permitido pelo AGENTS.md: roda sem
sessão de usuário, não há RLS de organização a respeitar porque ele varre todas.

## Telas

### Cadastro da obra

Campo **"E-mails extras para avisos"**, textarea, um por linha, junto de
responsável e centro de custo. Abaixo dele, em texto de apoio, a lista de quem
**já recebe automaticamente** por estar vinculado à obra — sem isso a pessoa
digita de novo endereços que já estão cobertos.

### Configurações → Alertas de vencimento

A tela atual permanece, com dois ajustes de texto:

- O rótulo "Destinatários" vira **"Central — recebe todas as obras"**.
- Um parágrafo explica que cada obra recebe o que é dela, com link para a
  listagem de obras.

Os seis endereços que já estão lá **continuam funcionando sem migração de
dados**: eles passam a ser a central, que é o comportamento mais próximo do
atual. Ninguém deixa de receber nada no dia da virada — só passa a receber
agrupado.

## Testes

- Agrupamento: alertas de três obras produzem três e-mails de obra + um central.
- Obra sem destinatário não gera e-mail de obra, e sua seção aparece marcada no
  central.
- Imóvel sem obra aparece só no central, na seção "Sem obra".
- Usuário desativado (`perfil.ativo = false`) não entra na lista da obra.
- Endereço presente tanto em `obra_usuario` quanto na lista extra aparece **uma
  vez** — o `union` deduplica, e vale ter o teste porque um `union all` acidental
  mandaria dois e-mails para a mesma pessoa.
- O índice único aceita a mesma referência para obra e para central no mesmo dia,
  e recusa a mesma referência duas vezes para o mesmo público.
- Falha de envio para uma obra não impede as outras nem a central.

## Riscos assumidos

- **O volume de e-mails cresce.** Onde saía um por dia, passam a sair N+1. Numa
  organização com 20 obras ativas isso é 21 e-mails diários do Resend. Vale
  conferir o plano contratado antes de ir a produção.
- **A central pode ficar longa.** Com muitas obras, o e-mail agrupado fica
  extenso. A saída, se incomodar, é o resumo com link — mas isso obriga a abrir o
  sistema, e a decisão foi ver o conteúdo. Fica como ajuste posterior, não como
  desenho inicial.
- **Ninguém vinculado é o estado inicial de toda obra nova.** O fallback para a
  central cobre, mas se a Sistenge criar obras e nunca vincular usuários, o
  resultado prático é o de hoje — tudo na central. O aviso `⚠ sem destinatários
  próprios` existe para tornar isso visível em vez de silencioso.
