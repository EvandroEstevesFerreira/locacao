# Custódia da peça — histórico de quem está e quem ficou

**Data:** 2026-09-02
**Escopo:** livro de custódia por peça, campos de TI na peça, e o ato de mover
que hoje não existe
**Depende de:** `2026-08-31-cadastro-frota-design.md` (peça com situação e obra)
e da fatia do termo, já implementada (0.49.1)

## O pedido

Controlar na Frota todos os aparelhos da Sistenge — celular, notebook, desktop,
além do equipamento de obra — e ter no cadastro **histórico de com quem a peça
está, com quem ficou e por quanto tempo**.

## O que já existe, e por isso não vai ser construído de novo

Metade do histórico **já está gravada**. Cada linha de `termo_equipamento_item`
guarda a peça e, pelo termo, o funcionário, a data de entrega, a data de
devolução e o estado nas duas pontas. Para custódia com pessoa por documento
assinado, o dado existe desde a 0.49.0.

O que falta é de outra natureza:

| Falta | Por quê |
|---|---|
| Tela da peça | `/frota` é só lista. Não há `/frota/[id]`, e a linha do tempo não tem onde morar |
| **O ato de mover** | `adicionarUnidade` grava `situacao` e `obra_id` no cadastro e nenhum caminho humano os altera depois. Só o termo mexe. Mover a peça de obra é impossível hoje |
| Custódia sem pessoa | Obra, almoxarifado e fornecedor em manutenção não são registrados em lugar nenhum |
| Campos de TI | A peça tem série, ano e estado. Celular precisa de IMEI e linha; computador, de service tag e configuração |
| Termo cancelado | As linhas de item continuam existindo. A linha do tempo precisa marcar o período como anulado, senão exibe custódia que nunca valeu |

A ausência do ato de mover é o achado que ordena a fatia: **sem ele o livro não
tem o que registrar**, e a tela de custódia nasceria com uma linha só, a do
cadastro.

## Decisões tomadas antes do desenho

Quatro, decididas com o Evandro em 02/09/2026:

1. **Livro de custódia**, e não derivação do termo. Toda troca de posse vira
   linha, para qualquer tipo de detentor.
2. **Quatro ângulos de leitura**: peça, cadastro do item, funcionário e obra.
3. **Colunas dedicadas** para os campos de TI, não campo livre.
4. **Entrega a funcionário exige termo assinado, sempre.**

A decisão 4 tem uma consequência que governa todo o resto e vale isolar:

> **Custódia de funcionário só nasce por termo.** O caminho manual da Frota
> abre posse para almoxarifado, obra e fornecedor — nunca para pessoa. Não é
> restrição técnica: é o que garante uma única fonte de verdade sobre quem
> responde pelo equipamento, e é o que sustenta a cobrança por dano ou não
> devolução. Duas portas para "entregar ao Fulano", uma com assinatura e outra
> sem, produziriam exatamente a divergência que o Loca existe para eliminar.

## Modelo de dados

### `custodia_peca` — uma linha por período de posse

```sql
create table if not exists public.custodia_peca (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  unidade_id     uuid not null references public.equipamento_unidade (id) on delete cascade,
  tipo           text not null,
  obra_id        uuid references public.obra (id) on delete set null,
  funcionario_id uuid references public.funcionario (id) on delete set null,
  fornecedor_id  uuid references public.fornecedor (id) on delete set null,
  inicio         date not null,
  -- NULO = posse aberta. É o que faz "com quem está" e "com quem ficou" serem
  -- a mesma tabela lida de dois jeitos.
  fim            date,
  origem         text not null,
  termo_id       uuid references public.termo_equipamento (id) on delete set null,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

**Uma só posse aberta por peça**, garantida por índice parcial — o mesmo recurso
que já segura "um orçamento vigente por obra" na 0051:

```sql
create unique index if not exists idx_custodia_aberta
  on public.custodia_peca (unidade_id) where fim is null;
```

Peça sem nenhuma linha é estado legítimo: é o de todas as peças já cadastradas.
Zero linhas abertas não viola o índice.

**Coerência do detentor**, por check. Sem ele nasce a linha que diz
"funcionário" e aponta para uma obra, e a leitura passa a ter de adivinhar:

```sql
alter table public.custodia_peca add constraint custodia_tipo_check
  check (tipo in ('almoxarifado','obra','funcionario','fornecedor'));

alter table public.custodia_peca add constraint custodia_detentor_coerente
  check (
    case tipo
      when 'almoxarifado' then obra_id is null and funcionario_id is null and fornecedor_id is null
      when 'obra'         then obra_id is not null and funcionario_id is null and fornecedor_id is null
      when 'funcionario'  then funcionario_id is not null and fornecedor_id is null
      when 'fornecedor'   then fornecedor_id is not null and funcionario_id is null
    end
  );

alter table public.custodia_peca add constraint custodia_periodo_check
  check (fim is null or fim >= inicio);

alter table public.custodia_peca add constraint custodia_origem_check
  check (origem in ('termo','manual'));

-- Posse de funcionário só nasce por termo. É a decisão 4, no banco — não só na
-- tela, que pode estar velha.
alter table public.custodia_peca add constraint custodia_funcionario_exige_termo
  check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null));
```

`tipo = 'funcionario'` admite `obra_id` preenchido de propósito: o notebook está
com a pessoa, e a pessoa está numa obra. As duas informações são verdadeiras ao
mesmo tempo, e é o que faz a tela "o que está na obra" encontrar o notebook.

### Imutabilidade: só o fechamento pode mudar

O livro é somente-inclusão, com **uma** exceção — encerrar uma posse aberta
gravando `fim`. A guarda não lista colunas:

```sql
create or replace function public.guard_custodia_peca()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Posse não pode ser apagada. Encerre a posse e abra a seguinte.';
  end if;

  if old.fim is not null then
    raise exception 'Esta posse já foi encerrada e não pode ser reaberta.';
  end if;

  if new.fim is null then
    raise exception 'Nada a alterar: só o encerramento da posse pode ser gravado.';
  end if;

  -- Comparação por jsonb, sem lista de colunas a manter: coluna acrescentada
  -- amanhã fica protegida sem ninguém lembrar de vir aqui.
  if (to_jsonb(new) - 'fim' - 'updated_at') is distinct from
     (to_jsonb(old) - 'fim' - 'updated_at') then
    raise exception 'Numa posse encerrada, só a data de fim pode ser gravada.';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_custodia_peca() from public;

drop trigger if exists trg_custodia_peca_imutavel on public.custodia_peca;
create trigger trg_custodia_peca_imutavel
  before update or delete on public.custodia_peca
  for each row execute function public.guard_custodia_peca();
```

O `revoke ... from public` é deliberado e não redundante: `EXECUTE` é concedido
a `PUBLIC` por padrão, e `anon`/`authenticated` herdam de lá. Revogar só desses
dois roles retorna sucesso e não revoga nada — foi o incidente da 0.45.1.

### Campos de TI na peça

Na **peça**, não no item de catálogo: o mesmo "Notebook Dell Latitude 3490" tem
unidades com 8 e com 16 GB, e a verdade fica onde as duas divergem.

```sql
alter table public.equipamento_unidade
  add column if not exists imei             text,
  add column if not exists imei_2           text,
  add column if not exists linha_telefonica text,
  add column if not exists operadora        text,
  add column if not exists service_tag      text,
  add column if not exists memoria_gb       smallint,
  add column if not exists configuracao     text;
```

Duas escolhas a justificar:

- **`memoria_gb` separado, o resto em `configuracao`.** Memória é o campo pelo
  qual se filtra ("quais notebooks têm 8 GB para trocar este ano"). Processador,
  armazenamento e sistema operacional são descritivos e vivem melhor numa linha
  escrita como o TI já escreve: `i5 11ª ger. / SSD 512 GB / Win 11 Pro`. Quatro
  colunas cujo único consumidor é uma linha de texto na tela seriam quatro
  campos para preencher e nenhuma consulta a mais.
- **`imei_2` existe** porque celular corporativo com dois chips é comum, e o
  segundo IMEI é o que a operadora pede no bloqueio por roubo.

**Unicidade de IMEI e de linha**, por índice parcial. IMEI é único no mundo por
definição, e uma linha telefônica está num aparelho só:

```sql
create unique index if not exists idx_unidade_imei
  on public.equipamento_unidade (org_id, imei) where imei is not null;
create unique index if not exists idx_unidade_linha
  on public.equipamento_unidade (org_id, linha_telefonica) where linha_telefonica is not null;
```

### Quais campos o formulário mostra

Por **perfil da categoria**, não pelo nome dela. Acoplar a UI a
`categoria.nome = 'TI'` quebra quando alguém renomeia para "Tecnologia":

```sql
alter table public.categoria_equipamento
  add column if not exists perfil_campos text not null default 'geral';

alter table public.categoria_equipamento drop constraint if exists categoria_perfil_check;
alter table public.categoria_equipamento
  add constraint categoria_perfil_check check (perfil_campos in ('geral','ti'));

update public.categoria_equipamento set perfil_campos = 'ti' where nome = 'TI';
```

O `update` por nome é aceitável **uma vez**, na migração das 8 categorias
semeadas em 0055 — é dado conhecido, não regra permanente.

### RLS

`custodia_peca` acompanha `equipamento_unidade`, e não o escopo por obra do
resto do Loca: **leitura livre na organização**. É a mesma exceção consciente
registrada na spec de frota, pela mesma razão — um gestor precisa ver que a
betoneira esteve na Obra B justamente para ir buscá-la, e escopo por obra na
leitura tornaria impossível a pergunta que a tela existe para responder.

Escrita: `pode_operar()`.

Nenhuma view é criada. "Posse atual" é `where fim is null`, que o índice parcial
já cobre. Se uma view vier a ser necessária, nasce com `security_invoker = on` —
regra do AGENTS.md desde a 0.49.1.

## Onde a regra mora

### `src/lib/custodia.ts` — puro e testável

Sem acesso a banco, no molde de `frota.ts` e `estoque.ts`:

| Função | O que faz |
|---|---|
| `TIPOS_DETENTOR`, `DETENTOR_INFO` | Fonte única dos quatro tipos e seus rótulos em PT-BR |
| `descreverDetentor(linha)` | "Fulano de Tal", "800 — Administração", "Almoxarifado central", "Mecânica Silva (manutenção)" |
| `diasDePosse(inicio, fim, hoje)` | Dias de calendário. Posse aberta usa `hoje` |
| `descreverPeriodo(dias)` | "menos de 1 dia", "1 dia", "23 dias", "1 ano e 2 meses" |
| `montarLinhaDoTempo(linhas, termos)` | Ordena da posse aberta para a mais antiga e marca período de termo cancelado |
| `custodiaSchema`, `moverPecaSchema` | Validação, importável pelo formulário cliente |

**`hoje` é parâmetro, nunca `new Date()` dentro da função.** `inicio` e `fim`
são colunas `date`, e o Vercel roda em UTC: das 21h à meia-noite em Brasília a
contagem de dias sairia um dia maior. Quem chama passa `hojeISOSaoPaulo()`.
Aritmética em `Date.UTC`, como em `avanco.ts`.

Caso de borda que o teste fixa: **entrou e saiu no mesmo dia** dá 0 dias, e a
tela diz "menos de 1 dia" — nunca "0 dias", que se lê como dado faltando.

### `src/lib/custodia-servidor.ts` — o escritor único

```
abrirCustodia(supabase, { unidadeId, tipo, obraId?, funcionarioId?,
                          fornecedorId?, inicio, origem, termoId?, observacoes? })
fecharCustodia(supabase, { unidadeId, fim })
```

`fecharCustodia` encerra a posse aberta da peça, se houver, e é idempotente:
sem posse aberta não faz nada e não é erro. `abrirCustodia` fecha a anterior
antes de abrir a nova, na mesma data — é o que impede o buraco de um dia entre
duas posses.

**Data de fechamento anterior ao início.** O check `fim >= inicio` recusa o
fechamento retrodatado, e hoje é possível chegar nele: `devolucaoItemSchema` só
exige que a data de devolução exista, sem compará-la com a da entrega. Registrar
devolução em data anterior à entrega faria o banco abortar com mensagem de
Postgres na cara do almoxarife. Duas correções, as duas nesta fatia:

1. `devolucaoItemSchema` passa a recusar data de devolução anterior à entrega,
   com mensagem em PT-BR no campo — é validação que faltava independentemente da
   custódia.
2. `fecharCustodia` recebe `fim` já validado e, se ainda assim vier menor que o
   `inicio` da posse aberta, devolve erro tratado em vez de deixar o check
   estourar.

**Por que um arquivo novo em `src/lib/`.** O AGENTS.md dá endereço para leitura
compartilhada (`src/lib/data/`) e não dá para **escrita** compartilhada. Este
escritor é chamado de dois grupos de rota — `termos/actions.ts` e
`frota/actions.ts` — e copiá-lo nos dois é como as duas cópias divergem. Abre
uma convenção nova, com `import "server-only"` no topo, e vale registrar no
AGENTS.md junto com a regra de `data/`.

Usa `createClient()`, nunca `createAdminClient()`: o isolamento por organização
depende de RLS.

## Ganchos no termo

`moverPecasDoTermo` (privado em `termos/actions.ts`) já é o único lugar que move
peça por evento. Passa a chamar o escritor de custódia junto:

| Evento | Peça | Custódia |
|---|---|---|
| `emitirTermo` | `disponivel` → `em_uso` | Abre posse de funcionário, `inicio = data_entrega`, `origem = 'termo'` |
| `registrarDevolucao` | `em_uso` → `disponivel` | Fecha com `fim = data_devolucao` e abre posse de almoxarifado |

A posse de almoxarifado aberta na devolução leva `origem = 'termo'` e o
`termo_id`, e não `'manual'`: o evento que a produziu foi a devolução de um
termo, e é isso que permite a linha do tempo dizer *por que* a peça voltou.
`'manual'` fica reservado ao que uma pessoa fez na tela da Frota.
| `encerrarTermo` | solta o que sobrou | Fecha as posses abertas do termo na data do encerramento |
| `cancelarTermo` | solta tudo | Fecha na data do cancelamento. A linha **fica**: quem leu o documento assinado precisa ver que existiu e foi anulado |

Termo cancelado não apaga linha nenhuma. `montarLinhaDoTempo` cruza `termo_id`
com a situação do termo e marca o período como anulado — é a diferença entre
"esta peça esteve com o Fulano" e "houve um termo com o Fulano que não valeu".

## As telas

Duas fatias, e **o plano de implementação cobre a Fatia 1**. A Fatia 2 ganha o
seu próprio plano depois que a 1 estiver publicada e vista funcionando com dado
real — são três telas que só leem o que a 1 grava, e planejá-las agora seria
planejar sobre um livro ainda vazio.

### Fatia 1 — o histórico funcionando

**`/frota/[id]` (nova).** Dados da peça, detentor atual em destaque, campos de
TI quando o perfil da categoria for `ti`, linha do tempo completa com tempo de
cada posse, e as ações que hoje não existem:

- **Mover peça** — para obra ou para o almoxarifado central
- **Mandar para manutenção** — escolhe o fornecedor, abre posse de fornecedor
- **Editar a peça** — patrimônio, série, ano, estado, observações e os campos de
  TI. **Não** inclui obra nem situação: esses dois mudam só por Mover, Mandar
  para manutenção e Baixar, que passam pelo escritor de custódia. Um formulário
  de edição genérico com `obra_id` dentro seria a primeira porta a furar o livro
- **Baixar / marcar como perdida** — pela matriz de `frota.ts`, que já recusa
  os atalhos indevidos

Sem posse aberta, a tela mostra "sem registro de posse" e oferece abrir a
primeira. Não inventa uma posse retroativa que ninguém registrou.

**Não** oferece "entregar a funcionário": esse botão leva a `/termos/novo` com a
peça pré-selecionada. É a decisão 4 aparecendo na tela.

**Semeadura retroativa.** A migration semeia o livro a partir dos termos já
emitidos, para o histórico não começar vazio. Hoje há **zero termos em
produção**, então é um `insert` que não faz nada — e é exatamente por isso que
tem de ser agora: dentro de seis meses seria script de correção com termo real
em cima.

### Fatia 2 — os três ângulos

- **Cadastro do item** (`/itens/[id]`): o bloco Unidades passa a mostrar o
  detentor atual de cada peça, com link para a linha do tempo dela
- **Por funcionário** (`/termos/funcionarios/[id]`, nova): "o que o Fulano tem
  em mãos" — a pergunta do desligamento — mais o histórico do que já teve
- **Por obra** (seção em `/obras/[id]`): o que está na obra hoje e o que passou
  por ela. Seção numa página que já existe, e não rota nova

## Testes

**Puros** (`src/lib/custodia.test.ts`): dias de posse com posse aberta e
fechada; mesmo dia dá 0 e é descrito como "menos de 1 dia"; rótulo de cada tipo
de detentor; ordenação da linha do tempo com a aberta no topo; período de termo
cancelado marcado; schemas rejeitando tipo incoerente com o detentor.

**Migration, em Postgres local** pelo caminho já registrado — criar o banco
descartável com os stubs do que a migration referencia, aplicar com
`psql -v ON_ERROR_STOP=1`, provar e derrubar:

1. Duas posses abertas na mesma peça são recusadas pelo índice parcial
2. `delete` é recusado pela guarda
3. Reabrir posse encerrada é recusado
4. Alterar `tipo` ou `inicio` junto com `fim` é recusado
5. Gravar só `fim` numa posse aberta é aceito
6. `tipo = 'funcionario'` sem `termo_id` é recusado pelo check
7. Detentor incoerente (tipo obra apontando funcionário) é recusado
8. IMEI repetido na organização é recusado
9. Uma organização não lê a custódia da outra

**Varredura** (`src/lib/custodia-varredura.test.ts`): nenhum
`.update({ obra_id ...})` ou `.update({ situacao ...})` sobre
`equipamento_unidade` fora do escritor único e de `adicionarUnidade`. É a guarda
que mantém honesta a escolha da Abordagem 1 — sem ela, o livro divergiria do
campo em silêncio, que é o modo de falha desta arquitetura.

## Fora de escopo

Valor de aquisição, nota fiscal e depreciação (era a fatia 2 da spec de frota, e
continua sendo). Capacitação NR-10/11/35 com inspeção periódica (fatia 3). Foto
e QR Code da peça. Importação de inventário por planilha. Termo com cláusula
específica de celular (uso de dados, LGPD, devolução do chip) — o sistema de
templates já suporta um tipo de documento novo, então é acréscimo barato depois,
não agora.

## Riscos

**O escritor único contornado.** Modo de falha desta arquitetura: um
`.update({ obra_id })` novo em qualquer action faz o campo e o livro divergirem
sem estourar erro. Mitigado pela varredura, que reprova no CI.

**Inventário que não é digitado.** O mesmo risco da fatia 1 de frota, e não
resolvido por ela: hoje há **uma** peça cadastrada em produção. A fatia entrega
o lugar, não o conteúdo. Mitigação deliberada: nenhum campo novo é obrigatório,
e peça sem posse registrada é estado válido — o livro começa a valer na primeira
movimentação, sem exigir recadastro de nada.
