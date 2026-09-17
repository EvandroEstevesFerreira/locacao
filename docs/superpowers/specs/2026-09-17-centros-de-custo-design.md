# Centros de custo: a obra e o departamento na mesma lista

**Data:** 2026-09-17
**Branch:** `feat/centros-de-custo`
**Estado:** implementado, validado em banco, premissas confirmadas

---

## O problema

A tela de obras tem hoje oito linhas. Uma delas é `800 — Administração`, e ela
não é uma obra: é o departamento administrativo da Sistenge vestido de obra
para conseguir existir no sistema.

O disfarce custa caro. `800 — Administração` herda prazo (`data_inicio`,
`data_fim_prevista`), avanço físico semanal, frentes de serviço, orçamento de
locação e fechamento mensal. Nenhuma dessas coisas significa nada para um
departamento, mas todas estão disponíveis, e qualquer uma delas preenchida
produz um número que entra em relatório financeiro parecendo legítimo.

E o disfarce não escala: a Sistenge tem Engenharia, Comercial, Orçamentos,
Financeiro, Projetos, Administração, Suprimentos, RH e TI. Todos consomem
locação — o notebook do RH, o servidor da TI, o aluguel da sala do Comercial —
e hoje só existe um lugar para colocá-los, que é uma lista chamada "Obras".

O gatilho imediato foi o inventário de TI. Um notebook precisa constar no
centro de custo certo, e a lista não tem o centro de custo certo para oferecer.

## O que este desenho faz

Obra e departamento passam a ser **o mesmo conceito, com naturezas
diferentes**: um *centro de custo*. Uma lista, uma ficha, uma regra de acesso,
uma coluna `Tipo` que diz qual é qual.

O que **não** muda, e é o que faz este trabalho caber numa semana:

- `obra_usuario` continua sendo o vínculo de acesso.
- Toda a RLS continua valendo palavra por palavra: `is_member_of_obra(id)` não
  sabe nem precisa saber se a linha é obra ou departamento.
- Todo `obra_id` das ~40 telas continua se chamando `obra_id`.
- A tabela continua se chamando `obra` no banco.

## Decisões, e por quê

### Um conceito só, não dois

Foram consideradas três formas:

**A — discriminador na `obra` (escolhida).** Duas colunas novas, `tipo` e
`pai_id`. A tabela continua `obra`; o vocabulário "centro de custo" vive na UI.

**B — renomear a tabela para `centro_custo`.** Honesto no banco, com view de
compatibilidade. São 40+ arquivos, 113 migrations de histórico, RLS, views,
`src/lib/data/` e testes — e cada `select` recopiado é a armadilha de `!inner` e
`count` que o `AGENTS.md` já documenta. Semanas de risco para comprar clareza de
nomenclatura.

**C — tabela `departamento` separada.** Toda FK vira polimórfica (`obra_id` OU
`departamento_id` com CHECK), como `mega_titulo` já faz. Isso duplicaria a regra
de escopo em **toda** policy do sistema, e a RLS passaria a ter dois caminhos —
que é exatamente como um tenant começa a ver o que não é dele.

A escolha é **A**. O incômodo real que ela deixa é o nome `obra` no código não
bater com a palavra "centro de custo" na tela. É um incômodo; B e C compram
risco de vazamento entre organizações.

### Hierarquia de dois níveis, e só dois

Departamento pode ter pai (`Administrativo` > `RH`). A profundidade máxima é
**dois**, cobrada por trigger: o pai de um centro de custo tem de ter `pai_id`
nulo.

Não é economia de esforço — é o que elimina ciclo **por construção**. Sem limite
de profundidade, um ciclo (`A` filho de `B`, `B` filho de `A`) exige
`WITH RECURSIVE` na trava e uma consulta recursiva em toda soma de custo por
área. Com dois níveis, a trava é uma comparação e a soma é um `group by`.

Se algum dia a Sistenge precisar de três níveis, isto é uma migration nova com
um problema bem definido — e não uma dívida que já nasceu tendo de ser paga.

### O vínculo de acesso não herda pelo pai

Vincular alguém ao `Administrativo` **não** dá acesso a `RH`, `Financeiro` e
`Suprimentos`. Cada centro de custo é vinculado à mão.

A alternativa (herança) é mais cômoda no cadastro e exige RLS recursiva. O
problema não é o custo: é que, com herança, um erro de cadastro — pendurar um
setor no pai errado — vaza uma área inteira **em silêncio**, e o sintoma aparece
como alguém vendo a folha de outro setor. Sem herança, o pior erro de cadastro é
alguém não ver o que deveria, que é a falha barulhenta e corrigível.

### `tipo` é imutável depois de criado

Um centro de custo nasce obra ou departamento e não troca.

Converter `800 — Administração` em obra depois que ela tem custódia de
equipamento, lançamento financeiro e termo emitido não é um `update` numa
coluna: é uma migração de dados disfarçada de dropdown. A única conversão que
este sistema faz é a da migration abaixo, uma vez, com o banco conferindo o que
está convertendo.

### As travas ficam no banco, não na tela

Departamento não recebe **frente de serviço, avanço, orçamento nem fechamento
mensal**. Isso é cobrado por trigger nas quatro tabelas, não por um bloco
escondido no React.

Esconder o botão não basta. A server action continua alcançável, e um
fechamento mensal do RH é um número plausível dentro de um relatório financeiro
entregue a um cliente — a mesma classe de problema que o `AGENTS.md` já trata em
"agregado que gera documento nunca engole erro".

### Status: departamento não pausa

`status_obra` é `ativa | pausada | encerrada`. "Pausada" descreve uma obra cujo
contrato parou; um departamento não pausa — ele existe ou foi extinto.

Departamento fica restrito a `ativa | encerrada`, por CHECK. O enum não muda
(mudar enum em uso é migration cara e desnecessária aqui).

**Confirmado com o Evandro em 17/09/2026.**

### A migration converte duas linhas e não inventa nenhuma

**Confirmado com o Evandro em 17/09/2026:** `800 — Administração` e
`686 — CPQ03 Manutenção` viram departamento. O 686 é manutenção contínua, não
obra com prazo. As outras seis são obras de verdade.

A lista é **explícita**, e não um padrão ("todo código 8xx"): a regra por padrão
converteria sozinha a próxima obra que nascesse com código parecido, e o erro só
apareceria num relatório faltando linha.

Cada conversão é defensiva — só acontece se encontrar exatamente uma linha com
aquele código e nome. Zero ou mais de uma, aborta com mensagem em vez de
adivinhar. E aborta também se a linha já tiver frente, avanço, orçamento ou
fechamento gravado: **o 686 é o caso em que isso pode disparar de verdade**, já
que ele é obra hoje. Apagar histórico por conta própria não é decisão de
migration.

**A migration não cria Engenharia, Comercial, RH e os demais.** Isso é
deliberado: cada centro de custo tem um `codigo` que precisa bater com o Mega e
com o People, e esse código é dado de negócio que o banco não tem como saber.
Inventar `codigo = '810'` para o RH criaria uma segunda verdade, e a divergência
apareceria meses depois, num rateio.

Os departamentos são cadastrados na tela, por quem sabe os códigos — que é
exatamente a funcionalidade que este trabalho entrega.

Se aparecerem outras linhas disfarçadas depois, acrescentá-las é uma linha na
lista `values` do bloco 5.

---

## Dados

### Colunas novas em `public.obra`

```sql
create type public.tipo_centro_custo as enum ('obra', 'departamento');

alter table public.obra
  add column if not exists tipo   public.tipo_centro_custo not null default 'obra',
  add column if not exists pai_id uuid references public.obra (id) on delete restrict;
```

`default 'obra'` é o que mantém todo o resto do sistema funcionando sem tocar em
nada: toda linha existente e toda linha nova continuam sendo obra até que
alguém diga o contrário.

`on delete restrict` no pai: excluir o `Administrativo` que tem quatro setores
pendurados tem de falhar com mensagem, não arrastar os quatro.

### Travas

| # | Regra | Forma |
| --- | --- | --- |
| 1 | Obra não tem pai | CHECK `tipo = 'departamento' or pai_id is null` |
| 2 | O pai é um departamento | trigger |
| 3 | O pai não tem pai (dois níveis) | trigger |
| 4 | Departamento não tem prazo | CHECK sobre as três colunas de data |
| 5 | Departamento não pausa | CHECK `tipo = 'obra' or status <> 'pausada'` |
| 6 | Departamento não recebe frente / avanço / orçamento / fechamento | trigger nas 4 tabelas |
| 7 | Pai e filho na mesma organização | trigger (junto com 2 e 3) |

As regras 2, 3 e 7 não cabem em CHECK porque consultam outra linha da mesma
tabela. Ficam num trigger `before insert or update` em `public.obra`, e o mesmo
trigger cobre as três — é uma leitura só da linha do pai.

A regra 6 é um trigger por tabela, todos chamando a mesma função
`public.exige_obra(uuid)`, que levanta exceção se o centro de custo apontado for
departamento. Uma função, quatro gatilhos: é como as quatro cópias deixam de
divergir.

### Índices

```sql
create index if not exists idx_obra_pai  on public.obra (pai_id) where pai_id is not null;
create index if not exists idx_obra_tipo on public.obra (org_id, tipo);
```

### RLS

**Nenhuma policy muda.** Está verificado: `obra_select` filtra por
`org_id = current_org_id()` e `is_member_of_obra(id)`, e ambos são indiferentes
ao tipo da linha. Departamento entra no mesmo regime de vínculo que a obra —
que é exatamente a decisão de "mesma regra, sem exceção".

O único cuidado é que `pai_id` aponta para uma linha que o usuário pode não
enxergar. A leitura do pai na tela vem por join sujeito à RLS: quem não tem
acesso ao `Administrativo` vê o setor sem o nome do pai, e não um erro.

---

## Domínio

`src/lib/obra.ts` ganha:

- `TIPO_CENTRO_CUSTO` e `TIPO_CENTRO_CUSTO_INFO` (rótulos "Obra" e
  "Departamento"), no mesmo formato de `STATUS_OBRA_INFO`.
- O `obraSchema` passa a validar `tipo` e `pai_id`, com as mesmas regras das
  travas do banco — aqui para dar **mensagem de campo**, exatamente como o
  `superRefine` de período já faz hoje. O banco recusaria com erro cru, sem nome
  de campo, e o formulário não teria onde pendurá-lo.

Funções puras novas, todas em `src/lib/centro-custo.ts`, testáveis sem banco:

```ts
paiPermitido(filho, paiCandidato): { ok: true } | { ok: false; motivo: string }
ordenarComHierarquia(itens): ItemComNivel[]   // pais seguidos dos seus filhos, com nível
```

`ordenarComHierarquia` é pura de propósito: a indentação da lista é regra, não
CSS, e regra em componente é regra sem teste.

---

## Telas

### Rota

**A rota canônica continua `/obras`**, e `/centros-custo` é um atalho que
redireciona para ela, declarado em `next.config.ts`.

O desenho original dizia o contrário — `/centros-custo` canônica, `/obras`
redirecionando. A implementação inverteu depois de medir: são **68 referências
a `/obras` em 24 arquivos**, incluindo as trilhas do módulo de treinamento, que
levam a pessoa a URLs específicas. O ganho seria estético; o risco, real. É a
mesma troca consciente que a abordagem A já faz no banco — a tabela continua
`obra`, o conceito se chama centro de custo.

O redirect vive no `next.config.ts`, e não numa `page.tsx` com `redirect()`,
porque uma página vazia seria rota de primeiro nível **sem módulo** — e o
middleware só checa permissão quando `moduloDaRota` devolve algo, então
qualquer usuário autenticado entraria. As duas guardas do repositório
(`modulos.test.ts` e `largura-de-pagina.test.ts`) reprovaram a primeira
tentativa, e estavam certas.

A **chave do módulo continua `"obras"`** em `src/lib/modulos.ts`. Ela está
gravada na configuração de módulos de cada organização no banco; renomeá-la
seria uma migração de dados para trocar uma string interna. Muda o `label` e o
`href`, não a chave.

### Lista

- Coluna **Tipo**, com badge.
- `SelectFilter` por tipo, ao lado do de status — no padrão `ListFilters` +
  `ListSearch` do resto do Loca.
- Filhos indentados sob o pai, por `ordenarComHierarquia`.
- Busca continua por código, nome e responsável.

### Formulário

- **Tipo** é escolhido na criação e some (vira texto) na edição.
- Departamento mostra: código, nome, endereço, responsável, centro de custo,
  **pai**, status, destinatários de alerta. (O endereço ficou: uma sala tem
  andar, e esconder um campo de texto opcional não compra nada.)
- Obra mostra exatamente o que mostra hoje, mais nada.
- O select de **pai** lista apenas departamentos sem pai, menos o próprio.

### Ficha

Para departamento, os blocos de frentes, avanço, orçamento e fechamento não são
renderizados. Não é "desabilitado": não existe.

### Os 17 seletores

`listarObrasParaFiltro` em `src/lib/data/obras.ts` abastece os seletores de obra
de 17 páginas. Ela ganha um segundo parâmetro **primitivo**:

```ts
listarObrasParaFiltro(apenasAtivas = false, tipo?: "obra" | "departamento")
```

Primitivo porque `cache()` chaveia por identidade de argumento — um objeto de
opções construído em dois lugares seria *miss* e duplicaria a consulta, que é o
oposto do objetivo da função. O comentário que já existe no arquivo explica
isso; o segundo parâmetro segue a mesma regra.

Quem passa a listar **os dois**: contrato, termo e funcionário, estoque,
financeiro, frota e custódia, imóvel. É aqui que o notebook do RH ganha onde
ficar.

Quem continua **só obra** (`tipo: "obra"`): avanço, frentes, orçamento de
locação, fechamento mensal. Os mesmos quatro que a trava 6 protege no banco —
a tela não oferece e o banco não aceita.

Três consumidores **não passam** por `listarObrasParaFiltro` e liam `obra`
direto; os três ganharam `.eq("tipo", "obra")`:

| Arquivo | O que aconteceria sem o filtro |
| --- | --- |
| `src/lib/data/avanco.ts` | a tela de lançamento semanal ofereceria o RH para alguém digitar percentual |
| `src/lib/data/painel.ts` | departamento entraria no painel como linha eternamente em 0% de prazo |
| `src/app/api/cron/avanco/route.ts` | o aviso semanal cobraria avanço físico do Financeiro **por e-mail**, toda semana |

O terceiro é o que justifica a varredura: nenhuma tela denunciaria, e o sintoma
chegaria como reclamação de quem recebeu o e-mail.

### Busca global — dependência cruzada

`src/lib/data/busca.ts` (branch `feat/busca-global`, em desenvolvimento em
paralelo) indexa `obra`. Como `tipo` nasce `not null default 'obra'`, **o
conjunto de resultados não muda**: todo centro de custo continua aparecendo no
Ctrl+K, antes e depois desta migration.

O que muda é o **rótulo**. O resultado hoje diz "Obra"; dizer "Obra" para o RH
passa a ser mentira na tela. Quando as duas branches se encontrarem na `main`,
`busca.ts` precisa ler `tipo` e rotular com ele.

Registrado dos dois lados, por acordo entre as sessões: a spec da busca global
nomeia esta mudança, e esta nomeia `src/lib/data/busca.ts`.

---

## Testes

| O quê | Onde | Como |
| --- | --- | --- |
| `paiPermitido`, `ordenarComHierarquia` | `src/lib/centro-custo.test.ts` | unitário, sem banco |
| `obraSchema` com tipo e pai | `src/lib/obra.test.ts` | inclui a **segunda passagem** (idempotência), que é o defeito que já voltou três vezes neste repositório |
| As 7 travas da migration | `src/lib/migrations-centro-custo.test.ts` | varredura do SQL, no molde de `migrations-seguranca.test.ts` — sem lista de nomes a manter |
| `security_invoker` | `src/lib/migrations-seguranca.test.ts` | já existe; continua cobrindo |

### Validação em banco real

A varredura do SQL prova que a trava está **escrita**; não prova que ela
**funciona**. A 0114 foi aplicada a um Postgres 15 descartável, sobre um
esqueleto mínimo de `obra` + as quatro tabelas de controle:

- **12 operações que devem falhar falharam**, cada uma com a mensagem prevista:
  obra com pai, pai que é obra, pai de outra organização, três níveis,
  departamento com prazo, departamento pausado, troca de `tipo`, as quatro
  inserções de controle de obra em departamento, e a exclusão de um pai que tem
  setor.
- **As duas operações legítimas passaram**: avanço e fechamento na obra 605.
- **Os dois caminhos de aborto da conversão do 800** abortaram com a frase
  certa: mais de uma candidata, e 800 com avanço já gravado.

O teste em banco achou um defeito que nenhuma leitura pegaria: a mensagem de
três níveis imprimia o **UUID** do pai em vez do nome. Quem esbarra numa
mensagem assim não tem como saber de qual departamento se trata. Corrigido.

---

## Fora de escopo, de propósito

- **Licenças e serviços recorrentes de TI** (M365, antivírus, link de internet).
  É subsistema novo, não remodelagem: contrato sem peça física, sem custódia,
  sem termo, com rateio por centro de custo e alerta de renovação próprio. Ganha
  spec própria — e fica bem mais simples de escrever depois que "centro de
  custo" existir para ratear.
- **Verba / orçamento de custeio por departamento.** Perguntado e descartado: o
  que o departamento precisa carregar é identificação, responsável e hierarquia.
- **Fluxo de aprovação** (gestor x aprovador). Mesma pergunta, mesma resposta.
- **Herança de acesso pelo pai.** Descartada acima, com motivo.
- **Três níveis de hierarquia.**
- **Renomear a tabela `obra` no banco.** É a abordagem B, descartada acima.

---

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Centros de custo | Spec, migration 0114 com as 7 travas **validadas contra um Postgres real**, domínio puro testado, schema, camada de leitura, lista com tipo e hierarquia, formulário condicional, action, 3 consumidores de avanço filtrados, rota-atalho, menu, v0.117.0. Ritual completo verde, suíte em 1491 testes | Confirmar as 2 premissas com o Evandro; rodar a migration no banco; cadastrar os departamentos reais na tela; revisar e mergear; rotular `busca.ts` quando as branches se encontrarem | 90% |

**Próximo passo:** o Evandro confirmar as duas premissas — quais linhas viram
departamento e se departamento aceita "pausada" — e cadastrar os departamentos
com os códigos que batem com o Mega e o People.
