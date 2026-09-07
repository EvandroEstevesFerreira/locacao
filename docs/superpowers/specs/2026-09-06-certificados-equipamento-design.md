# Certificados do equipamento — o vencimento que é data, não horímetro

## O problema

O Loca já sabe avisar que uma revisão está próxima **por uso**:
`tipo_equipamento.intervalo_manutencao_h` diz "gerador revisa a cada 250 h",
`apontamento_uso` guarda a leitura do horímetro, e `estadoRevisao` pinta a tela.

Só que a metade que custa multa não é essa. **Inspeção de PTA, PMOC de
ar-condicionado, teste de carga de talha e calibração de instrumento vencem por
CALENDÁRIO** — 12 meses depois da última, tenha a máquina trabalhado 2 000 horas
ou ficado parada no pátio. Hoje o sistema não tem onde guardar essa data, não
avisa, e não guarda o laudo.

Onde isso aparece:

| Exigência | Base | Consequência de vencer |
|---|---|---|
| Inspeção periódica de PTA | NR-12 / NR-18 | Equipamento interditado em fiscalização |
| PMOC | Lei 13.589/2018 | Autuação sanitária |
| Teste de carga (talha, guincho) | NR-11 / NR-12 | Interdição, e é o item que mata quando falha |
| Calibração de instrumento | Sistema da qualidade | Medição sem valor, ensaio refeito |

## O que já existe, e que NÃO se refaz

- **`api/cron/vencimentos`** já reúne devolução, fim de contrato, pagamento, fim
  de contrato de imóvel, reajuste e imóvel sem contrato; agrupa por obra;
  escalona pelos prazos configurados (30 → 15 → 3); deduplica por
  `notificacao_log`; e manda o que sobra para a lista central. Certificado
  vencendo entra ali como **mais uma fonte de candidato** — não é cron novo nem
  e-mail separado.
- **`campos_ficha`** já estabeleceu a gramática "o TIPO declara, a PEÇA
  preenche". Os certificados usam a mesma.
- **Três buckets privados** (`contratos`, `imoveis`, `vistorias`), todos com as
  mesmas quatro políticas: `bucket_id = X and foldername[1] = current_org_id()`.

## Por que não é um campo `data` na ficha

`campos_ficha` já aceita `tipo: "data"` — dava para criar "Inspeção até" como
campo do tipo PTA, sem migration nenhuma. Três motivos para não:

1. **Campo de ficha é inerte.** Nada lê, nada avisa. Seria a mesma pasta de
   papel que o Loca existe para substituir, só que em jsonb.
2. **A renovação sobrescreve.** Registrada a inspeção de 2027, a de 2026 some.
   Fiscalização pergunta pelo histórico, e a resposta seria "não temos".
3. **Não há como saber o que FALTA.** Um campo vazio é indistinguível de um
   campo que ninguém preencheu ainda. A PTA que nunca teve inspeção registrada
   fica em silêncio — que é exatamente o caso perigoso.

O ponto 3 é o que decide o desenho abaixo.

## O modelo

```
tipo_equipamento.certificados_exigidos   (jsonb)   ← o TIPO declara
  PTA              → inspecao_periodica, a cada 12 meses
  AR-CONDICIONADO  → pmoc,               a cada 12 meses

certificado_equipamento                  (tabela)  ← a PEÇA acumula
  PTA-0007 · inspecao_periodica · emitido 2026-03-10 · vence 2027-03-10 · laudo.pdf
  PTA-0007 · inspecao_periodica · emitido 2025-03-02 · vence 2026-03-02 · laudo.pdf
```

### `tipo_equipamento.certificados_exigidos` — jsonb, não tabela

Cada item: `{ especie, periodicidade_meses }`.

É coluna jsonb pelo mesmo motivo que `campos_ficha` é: trata-se de uma
**declaração presa ao tipo**, editada na mesma tela do tipo, nunca consultada
sozinha. Uma tabela acrescentaria um join a toda leitura do catálogo em troca de
nada.

**Por que declarar a exigência no tipo, e não só registrar o certificado que
existe:** uma PTA cadastrada hoje precisa aparecer **imediatamente** como
"inspeção pendente". Sem a declaração, o sistema não tem como distinguir
"equipamento que não exige inspeção" de "equipamento cuja inspeção ninguém
lançou" — e o segundo é o que gera interdição.

`periodicidade_meses` serve para **propor** o vencimento ao lançar um
certificado (emitido em + 12 meses), nunca para calculá-lo: o laudo traz a
validade impressa, e ela nem sempre bate com a regra.

### `certificado_equipamento`

| Coluna | Por quê |
|---|---|
| `id`, `org_id` | Tenant. RLS por `current_org_id()` |
| `unidade_id` → `equipamento_unidade` | O certificado é da PEÇA, não do modelo: duas PTAs iguais têm inspeções em datas diferentes |
| `especie` | Qual exigência este papel atende. Vocabulário fechado |
| `emitido_em` `date` | Nulável — laudo antigo às vezes chega só com a validade |
| `vence_em` `date NOT NULL` | É o que o alerta lê. NOT NULL porque certificado sem validade não vence nunca, e "não vence nunca" é sempre erro de digitação, jamais um fato |
| `numero` `text` | Número da ART, do laudo, do certificado de calibração |
| `responsavel` `text` | Quem emitiu — empresa ou profissional com o CREA |
| `arquivo_path` `text` | O PDF no bucket. Nulável: a data vale mesmo sem o arquivo em mãos |
| `observacoes` `text` | |
| `created_at`, `updated_at`, `deleted_at` | Soft delete, seguindo `reparo_equipamento` |

Restrições:

- `check (emitido_em is null or vence_em >= emitido_em)` — vencer antes de ser
  emitido é digitação trocada, e passaria despercebido para sempre.
- Índice `(org_id, unidade_id, especie, vence_em desc) where deleted_at is null`
  — é exatamente a busca "qual o certificado atual desta peça".
- **Sem unicidade por `(unidade_id, especie)`**: o acúmulo É o recurso. Cada
  renovação é uma linha nova, e a anterior fica como prova de que existiu.

### O vocabulário de espécie

Fechado, em `check` no banco e `const` no TypeScript — não é taxonomia de
usuário, é categoria regulatória:

| Chave | Rótulo |
|---|---|
| `inspecao_periodica` | Inspeção periódica |
| `pmoc` | PMOC |
| `teste_carga` | Teste de carga |
| `calibracao` | Calibração / aferição |
| `art` | ART |
| `laudo_eletrico` | Laudo elétrico |
| `outro` | Outro |

Lista fechada porque campo livre aqui produz `PMOC`, `P.M.O.C.` e
`Pmoc` na mesma coluna — e aí o cruzamento com a exigência do tipo não fecha, em
silêncio. `outro` existe para o laudo que não cabe em nenhuma, com o nome dele
em `observacoes`.

### A view `certificado_pendencia`

O coração. Cruza **o que o tipo exige** com **o que a peça tem**, e por isso
enxerga a ausência:

```sql
create view public.certificado_pendencia
with (security_invoker = on) as
select
  u.org_id,
  u.id                                   as unidade_id,
  u.identificador,
  u.obra_id,
  i.descricao                            as modelo,
  t.nome                                 as tipo,
  e->>'especie'                          as especie,
  (e->>'periodicidade_meses')::int       as periodicidade_meses,
  c.id                                   as certificado_id,
  c.vence_em
from public.equipamento_unidade u
join public.item_catalogo i     on i.id = u.item_id
join public.tipo_equipamento t  on t.id = i.tipo_id
cross join lateral jsonb_array_elements(
  coalesce(t.certificados_exigidos, '[]'::jsonb)) e
left join lateral (
  select c2.id, c2.vence_em
  from public.certificado_equipamento c2
  where c2.unidade_id = u.id
    and c2.especie = e->>'especie'
    and c2.deleted_at is null
  order by c2.vence_em desc
  limit 1
) c on true
where u.ativo;
```

`vence_em is null` **é** a pendência de ausência. Sem o `cross join lateral`
sobre a declaração do tipo, uma peça sem nenhum certificado simplesmente não
apareceria em consulta alguma — o caso perigoso seria o único invisível.

**`security_invoker = on` é obrigatório.** No Postgres 15+ o padrão é `off`: a
view roda com os privilégios do DONO, ignora RLS e devolve as linhas de todas as
organizações a qualquer autenticado. Foi o incidente da 0.49.1 (migration 0058).
A guarda `src/lib/migrations-seguranca.test.ts` varre as migrations e pega isso.

### O estado, e onde ele é calculado

Em `src/lib/certificado.ts`, client-safe, no molde de `estadoRevisao`:

```ts
export type EstadoCertificado = "ausente" | "vencido" | "proximo" | "em_dia";

export function estadoCertificado(
  venceEm: string | null,
  hojeISO: string,
  diasAviso = 30,
): EstadoCertificado
```

`ausente` **primeiro na ordem** de gravidade, e antes de `vencido`: uma PTA que
nunca teve inspeção lançada é pior que uma cuja inspeção venceu ontem — na
segunda alguém pelo menos sabia que existia.

`diasAviso` é parâmetro e não constante porque a organização já configura os
prazos de alerta (`config_alerta.dias_alerta`); a tela usa o maior deles.

**"Hoje" é `hojeISOSaoPaulo()`, nunca `new Date()`.** A comparação é contra
coluna `date`, o Vercel roda em UTC, e das 21h à meia-noite em Brasília o
resultado sairia um dia adiantado — um certificado marcado como vencido no dia
em que ainda vale.

### O bucket

Novo bucket privado `certificados`, com as mesmas quatro políticas dos outros
três (`bucket_id = 'certificados' and foldername[1] = current_org_id()`). Caminho
`{org_id}/{unidade_id}/{certificado_id}.pdf`.

Não reaproveita `contratos`: um laudo não é contrato, e as rotinas de exclusão
de contrato removem objetos por caminho — misturar os dois cria o dia em que
excluir um contrato apaga o laudo de uma PTA.

## As telas

### 1. Configurações → Catálogo → tipo

Ao lado do editor da ficha, um editor das exigências: linhas de
`espécie + periodicidade em meses`, com o mesmo padrão do `ficha-editor`.

### 2. Peça — `frota/[id]`

Seção **Certificados**, entre a ficha e os reparos:

- uma linha por exigência do tipo, com o certificado atual e o estado;
- exigência sem certificado aparece como **Ausente**, em destaque — é o motivo
  da seção existir;
- botão **Renovar** já pré-preenche a espécie e propõe
  `emitido_em + periodicidade`;
- o histórico abre por espécie, com download do PDF por URL assinada.

Peça de tipo sem exigência nenhuma **não mostra a seção**. Uma seção vazia em
todo notebook do parque ensina a ignorá-la.

### 3. Lista da frota

Um filtro `certificado` com as quatro opções do estado, e um selo na linha
quando há pendência. Fase 2.

## O alerta

Em `api/cron/vencimentos`, duas fontes novas, no mesmo formato dos candidatos
existentes:

- **`certificado_vence`** — `vence_em` dentro da janela do maior prazo. Escalona
  30 → 15 → 3 como os demais, e a categoria no e-mail é
  `"Certificado — Inspeção periódica"`.
- **`certificado_ausente`** — exigência sem certificado nenhum. Não tem data, e
  por isso segue o padrão já estabelecido por `imovel_sem_contrato`: avisa **uma
  vez por mês**, com `data_referencia` no dia 1º e `dias = 0`. Sem isso, ou
  avisaria todo dia até alguém resolver, ou nunca.

A `referencia_id` de `certificado_ausente` é a `unidade_id`, e o `tipo` inclui a
espécie (`certificado_ausente:pmoc`) — duas exigências ausentes na mesma peça são
dois avisos, e uma chave só faria a segunda ser descartada como repetida pela
dedupe do `notificacao_log`.

### Uma nota sobre quem recebe

Os destinatários por obra vêm de **duas** fontes somadas: o vínculo
`obra_usuario` (quem tem login ativo) e a lista extra `destinatarios_alerta`.
Estado real hoje:

- **695 — Equinix Tanques**: lista extra vazia, mas tem 1 vinculado ativo. Recebe.
- **800 — Administração**: nenhuma das duas. Não recebe.

A 800 **não cai no vazio**: o cron marca `semDestinatarios` e a lista central
absorve o aviso dizendo que absorveu. Mas a 800 é onde estão as 27 máquinas de
TI, então vale preencher. **Não é pré-requisito desta fatia** — é uma linha na
tela de Obras.

## Faseamento

| Fase | Entrega | Migrations |
|---|---|---|
| **1** | `certificados_exigidos` no tipo; tabela `certificado_equipamento` + RLS + `soft_delete`; view `certificado_pendencia`; bucket; `src/lib/certificado.ts` com schemas e estado; seção Certificados na peça; editor de exigências no tipo | 1 |
| **2** | As duas fontes no cron de vencimentos; filtro e selo na lista da frota; certificados no relatório de equipamento | 0 |

A fase 1 vale por si: o dado passa a existir, com histórico e laudo anexado, e a
tela da peça mostra o que falta. A 2 é o que transforma isso em aviso que chega
sem ninguém abrir a tela.

## O que fica de fora, e por quê

- **Renovação automática.** Nada cria o certificado seguinte sozinho. Certificado
  é ato de terceiro: existe quando o laudo é emitido, não quando o calendário
  vira.
- **Exigência por peça.** A declaração vive só no tipo. Uma PTA específica que
  precisasse de laudo extra não tem como declarar isso — e é raro o bastante
  para caber em `outro` com observação, até que a operação prove o contrário.
- **Bloqueio.** Certificado vencido não impede locar, mover nem entregar a peça.
  O sistema avisa; interditar equipamento é decisão de gente, e um bloqueio
  automático baseado em dado recém-cadastrado pararia obra por erro de digitação.

## Riscos

- **`cross join lateral` sobre jsonb em toda leitura da view.** Com ~130 peças e
  poucas exigências por tipo é irrelevante. Se o parque crescer uma ordem de
  grandeza e a view pesar, o caminho é um índice GIN em `certificados_exigidos`
  ou materializar — não redesenhar.
- **A view é nova e a guarda de `security_invoker` é um teste de varredura, não
  de execução.** Além dele, a fase 1 confere na produção, dentro de transação
  revertida, que um usuário de outra organização não enxerga linha alguma.
- **`especie` em `check` constraint.** Acrescentar uma espécie exige migration.
  É o preço da lista fechada, e foi escolhido de olho aberto: sete cobrem o que
  a operação tem hoje, e `outro` cobre o resto.
