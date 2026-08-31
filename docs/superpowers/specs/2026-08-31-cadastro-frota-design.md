# Cadastro de frota — dois níveis e rastreio da peça

**Data:** 2026-08-31
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** fatia 1 do cadastro de equipamento — "onde está e com quem"

## Objetivo

O catálogo de itens nasceu para alimentar contrato de locação e faz só isso:
descrição, tipo e unidade de medida. Ele não responde nenhuma pergunta de obra.

A Sistenge vai controlar a frota que circula numa obra inteira — betoneira,
furadeira, alicate hidráulico, plataforma de trabalho aéreo, empilhadeira,
gerador, banco de cargas, desktop e notebook. Para isso o cadastro precisa
responder, de qualquer peça: **o que é, de quem é, onde está e em que estado
está.**

Esta fatia entrega **"onde está e com quem"**. Valor, nota fiscal e
especificação técnica são a fatia 2; capacitação e inspeção periódica, a 3.

## O diagnóstico: a pobreza está um nível abaixo do formulário

A queixa de origem foi o formulário de item. O formulário é magro porque a
tabela é magra — mas a tabela magra que importa **não é** `item_catalogo`:

| Nível | Tabela | Hoje tem | Deveria responder |
|---|---|---|---|
| **Modelo** — o que a coisa é | `item_catalogo` | `tipo`, `descricao`, `unidade`, `ativo`, `controle` | "Betoneira 400L, categoria Concretagem" |
| **Peça** — qual coisa, individualmente | `equipamento_unidade` | `identificador`, `observacoes` | "PAT-0431, na Obra Ipiranga, em manutenção" |

Quase tudo da lista é `controle = 'peca'`, e a peça tem **dois** campos úteis. É
lá que a riqueza falta. Achatar os dois níveis num só é o que faria todo campo
novo virar coluna nula na metade dos casos: uma betoneira você aluga três iguais;
um notebook cada um é único e tem dono.

## Estado atual

### O que já existe e será usado

| Existe | Onde | Papel nesta entrega |
|---|---|---|
| `item_catalogo` | 0005 | O modelo; ganha `categoria_id` |
| `equipamento_unidade` | 0005 | A peça; é o centro desta fatia |
| `item_catalogo.controle` (`peca`/`quantidade`) | 0049 | Mantido como está — decide o form de recebimento |
| `item_locado.unidade_id` | 0049 | Vínculo peça↔contrato, já existente |
| `has_obra_access(obra_id)` | 0001, 0011 | Padrão de escopo por obra (ver seção RLS) |
| RLS por organização, `audit_log` | 0034, 0031 | Isolamento e trilha |
| `situacao = 'baixada'` (nova) | esta | Aposentar peça com história — `soft_delete` não cobre estas tabelas |
| `ListFilters` / `ListSearch` / `SelectFilter` | `src/components/shared/` | Filtros ao vivo da tela nova |
| `MODULOS` / `moduloDaRota` | `src/lib/modulos.ts` | Liberação da rota por usuário |
| `idOpcional` | `src/lib/campos.ts` (0.39.1) | Campo `id` dos schemas novos |

### O passivo que esta entrega encontra

**Não existe tela de peça.** Uma unidade de equipamento só aparece dentro do
detalhe de um item (`/itens/[id]`). Não há lugar no sistema onde se pergunte
"onde estão minhas betoneiras" — a informação, mesmo depois de cadastrada, não
teria por onde ser lida. Esta fatia cria essa tela, e é ela que entrega o valor.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Equipamento próprio | **Próprio e locado no mesmo cadastro**, com `propriedade` na peça |
| Pergunta prioritária | **"Onde está e com quem"** — situação e obra atual; valor e NF na fatia 2 |
| Como a situação muda | **Híbrido**: `em_uso`/`disponivel` só por evento; manutenção e baixa à mão. Evento sempre ganha |
| Categoria | **Tabela semeada**, não texto livre — relatório depende dela |
| `tipo_item` | **Mantido.** Aposentá-lo dentro da categoria é migration + varredura de UI em contrato e recebimento; não cabe nesta fatia |
| Tipo das colunas novas | **`text` + `check`**, como a 0049 fez com `controle` |
| Leitura por obra | **Livre na organização** (ver seção RLS) |
| Escopo de campos | Fabricante, modelo, valor, NF, foto e especificação técnica **fora** |

## Modelo de dados — migration 0050

```sql
-- O enum foi declarado na spec do termo (2026-08-25), que ainda não foi
-- implementada. Esta fatia chega antes, então ele nasce aqui e a 0051 (termo)
-- passa a só USAR. Ver "Colisão com a spec do termo".
create type public.estado_equipamento as enum ('novo','bom','regular','com_avaria');

create table public.categoria_equipamento (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  nome       text not null,
  -- Ordem de obra, não alfabética: Concretagem antes de TI porque é o que o
  -- almoxarife procura primeiro. Sem isso a lista sai em ordem de cadastro.
  ordem      smallint not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, nome)
);

create index idx_categoria_equip_org on public.categoria_equipamento (org_id);

create trigger trg_categoria_equip_updated_at
  before update on public.categoria_equipamento
  for each row execute function public.set_updated_at();

-- `on delete set null`: apagar uma categoria não pode apagar o item. Item sem
-- categoria é um estado válido (é o de todos os itens já cadastrados).
alter table public.item_catalogo
  add column if not exists categoria_id uuid
    references public.categoria_equipamento (id) on delete set null;

alter table public.equipamento_unidade
  add column if not exists propriedade text not null default 'locada'
      check (propriedade in ('locada','propria')),
  add column if not exists situacao text not null default 'disponivel'
      check (situacao in ('disponivel','em_uso','manutencao','baixada','perdida')),
  -- NULO = almoxarifado central. Não é dado faltando: é um estado legítimo, e é
  -- o de toda peça já cadastrada.
  add column if not exists obra_id uuid
    references public.obra (id) on delete set null,
  add column if not exists numero_serie text,
  add column if not exists ano smallint check (ano between 1950 and 2100),
  add column if not exists estado public.estado_equipamento;

create index if not exists idx_equip_unidade_situacao
  on public.equipamento_unidade (org_id, situacao);
create index if not exists idx_equip_unidade_obra
  on public.equipamento_unidade (obra_id) where obra_id is not null;
```

### Por que os defaults são esses

`propriedade` default `locada` e `situacao` default `disponivel` porque é o que
descreve com honestidade tudo que já está cadastrado: o Loca só teve equipamento
de terceiro até aqui, e nenhuma peça está registrada como entregue a ninguém.
Nada migra, nada muda de comportamento até alguém editar.

### Por que `estado` entra numa fatia sobre localização

`estado` é condição, não localização, e por isso é candidato natural à fatia 2.
Entra aqui por uma razão: quando uma peça volta de uma entrega com avaria, sem
`estado` a situação `disponivel` passa a **mentir** — o sistema ofereceria para
entrega uma furadeira quebrada. Custa um enum e um select, e sustenta a regra
híbrida da seção seguinte.

### Semeadura das categorias

```sql
insert into public.categoria_equipamento (org_id, nome, ordem)
select o.id, c.nome, c.ordem
from public.organizacao o
cross join (values
  ('Concretagem', 10), ('Ferramenta manual', 20), ('Ferramenta elétrica', 30),
  ('Acesso e altura', 40), ('Movimentação de carga', 50), ('Energia', 60),
  ('Medição e ensaio', 70), ('TI', 80)
) as c(nome, ordem)
on conflict (org_id, nome) do nothing;
```

Organização nova precisa ser semeada à mão. Isso é deliberado: a organização já
nasce à mão hoje — a 0001 traz o `insert` **comentado** — e automatizar a
semeadura de um caminho que não existe é inventar manutenção.

## A regra híbrida da situação

Fonte única em `src/lib/frota.ts`, com a matriz de transição explícita. Não
espalhada pelas actions: espalhada, cada tela inventa a sua regra e a sexta
esquece uma.

| De | Para | Quem pode |
|---|---|---|
| `disponivel` | `em_uso` | **só evento** — termo assinado (fatia seguinte) |
| `em_uso` | `disponivel` | **só evento** — devolução registrada no termo |
| `disponivel` | `manutencao`, `baixada`, `perdida` | à mão, admin/gestor |
| `manutencao` | `disponivel`, `baixada` | à mão, admin/gestor |
| `baixada`, `perdida` | `disponivel` | à mão, admin/gestor (reversão de erro) |
| `em_uso` | `manutencao`, `baixada`, `perdida` | **bloqueado** — encerre o termo primeiro |

A última linha é o que dá sentido às outras. Sem ela, marcar "perdida" à mão
apaga em silêncio o fato de que alguém **assinou** por aquela peça — que é
exatamente o "memória contra memória" que a spec do termo existe para acabar.

Nesta fatia o evento ainda não existe, então `em_uso` é inalcançável e a coluna
nasce inteira em `disponivel`. A matriz é escrita e testada agora para que a
fatia do termo só chame a função, sem redecidir a regra.

## Telas

### `/frota` — nova, e é o centro da entrega

Lista de **peças**, não de modelos: uma linha por patrimônio, com o modelo como
coluna. Filtros ao vivo com `ListFilters` + `SelectFilter` por situação, obra,
categoria e propriedade; `ListSearch` por patrimônio, série ou descrição.

É a tela que responde à pergunta da fatia. Sem ela, os campos novos ficariam
cadastrados e ilegíveis.

Nome: `/frota`, não `/equipamentos`. "Equipamento" já é um valor de `tipo_item` e
uma palavra usada em `/itens`; reaproveitá-la como rota faria duas coisas
diferentes terem o mesmo nome.

### `/itens` — ajustes

Coluna e `SelectFilter` de Categoria. `sortCols` ganha `categoria`. O resto fica.

### `/itens/[id]` — o formulário da peça

`add-unidade-form` passa de 2 campos para 7 (patrimônio, série, propriedade,
situação, obra, ano, estado). Continua em `useActionState`: não há validação
cruzada, então `react-hook-form` seria peso sem ganho — a regra do AGENTS.md.

### Registro do módulo

A rota nova entra em `MODULOS` / `moduloDaRota`. Sem isso ela nasce invisível
para quem não é master, e o sintoma é uma tela 404 sem explicação.

## RLS

`equipamento_unidade` **continua com leitura livre na organização**, mesmo tendo
`obra_id`. É uma exceção consciente ao escopo por obra do resto do Loca, e a
justificativa é o objetivo da fatia: um gestor precisa ver que a betoneira está
na Obra B justamente para ir buscá-la. Escopo por obra na leitura tornaria a
pergunta que a tela existe para responder impossível de responder.

Escrita segue `podeEditarCadastros` (admin/gestor), como o catálogo hoje.

`categoria_equipamento` recebe as mesmas quatro policies de `item_catalogo`, com
`current_org_id()`.

### Exclusão: `baixada` em vez de `soft_delete`

`soft_delete` **não se aplica aqui.** A 0032 deu `deleted_at` a quatro tabelas —
`obra`, `contrato_locacao`, `lancamento_financeiro` e `imovel` — e
`equipamento_unidade` não é uma delas: `excluirUnidade` faz `.delete()` físico
hoje. Esta fatia **não** muda isso, e não acrescenta `deleted_at`.

O que muda é para onde a tela empurra o usuário. Apagar fisicamente uma peça que
tem história é perda silenciosa de dado: `item_locado.unidade_id` é
`on delete set null`, então a exclusão desvincula a peça do contrato sem avisar
ninguém. Com `situacao`, existe agora a saída certa:

- peça **sem** vínculo (`item_locado` e, futuramente, termo): `excluir` continua
  disponível — é o caso do erro de digitação recém-cadastrado;
- peça **com** vínculo: a ação oferecida é **baixar** (`situacao = 'baixada'`),
  não excluir. A peça sai das listas operacionais e a história fica de pé.

A verificação de vínculo é uma contagem em `item_locado` antes de habilitar o
botão, e a mesma checagem repetida na action — a tela pode estar velha.

Leituras em `src/lib/data/frota.ts` com `import "server-only"`, tipos de retorno
planos, e `createClient()` — nunca `createAdminClient()`, que bypassa a RLS de
onde o isolamento depende.

## Testes

- **`src/lib/frota.test.ts`** — a matriz de transição inteira, incluindo as
  bloqueadas. Lógica pura, teste puro, barato.
- **Varredura de schemas** — exige duas ações, e não é automático como parece: o
  `MODULOS` de `schemas-varredura.test.ts` é lista de **módulos** escrita à mão,
  então `frota` precisa ser acrescentada lá; e cada schema novo precisa da sua
  amostra mínima em `AMOSTRAS`, senão a varredura reprova (o que é o
  comportamento desejado — reprovar é melhor que ignorar em silêncio). Aí eles
  ganham de graça a propriedade de idempotência e a de `id: ""`, a trava
  acrescentada na 0.39.1.

  **`unidadeSchema` precisa mudar de lugar.** Hoje ele mora dentro de
  `src/app/(app)/itens/actions.ts`, que é `"use server"` — inalcançável para
  componente cliente e invisível para a varredura. Com o formulário indo a 7
  campos, ele vai para `src/lib/frota.ts`, que é a regra do AGENTS.md e o que
  permite testá-lo.
- **RLS de `categoria_equipamento`** no Postgres local, pelo caminho já
  registrado; em especial que uma organização não lê a categoria da outra.

## Fora de escopo

Fabricante, modelo, valor de aquisição, nota fiscal, foto, QR Code, horímetro,
apontamento de uso, manutenção preventiva com ordem de serviço, depreciação
contábil, histórico de movimentação entre obras, e a regra de capacitação
(NR-11 / NR-35 / NR-10) com inspeção periódica.

A capacitação é a de maior valor de risco e é a fatia 3, mas depende de cadastro
de funcionário — que nasce na fatia do termo, não aqui.

## Colisão com a spec do termo

A spec `2026-08-25-termo-equipamento-design.md` (branch
`docs/spec-termo-equipamento`, não integrada) reivindica a **migration 0050** e
declara `create type public.estado_equipamento`. Esta fatia chega antes e ocupa a
0050.

Ajustes necessários naquela spec, a fazer no mesmo movimento:

1. Migration passa de **0050 para 0051**.
2. Remover o `create type estado_equipamento` — passa a ser dependência, criada
   aqui.
3. Acrescentar a chamada da matriz de `src/lib/frota.ts` no fechamento do termo
   (`disponivel` → `em_uso`) e na devolução (`em_uso` → `disponivel`). É o gancho
   que esta fatia deixa pronto.

## Risco conhecido

O único: **cadastro que fica pela metade**. A tela `/frota` só tem valor com as
peças cadastradas, e a Sistenge não tem hoje um inventário digitado. A fatia
entrega o lugar, não o conteúdo.

Mitigação deliberada — nenhum campo novo é obrigatório. Uma peça vale a pena com
patrimônio, situação e obra preenchidos; série, ano e estado podem entrar depois,
peça por peça, sem bloquear o cadastro. Importação em massa por planilha ficou
fora de propósito: sem saber se existe planilha e em que formato, seria construir
para um requisito imaginado.
