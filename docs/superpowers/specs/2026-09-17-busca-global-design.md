# Busca global no Ctrl+K — desenho

> Data: 17/09/2026 · Status: aprovado, não implementado

## O problema

O Ctrl+K do Loca não busca nada. O `CommandPalette`
(`src/components/layout/command-palette.tsx:48`) filtra um array em memória com
duas coisas: os rótulos do menu e oito ações fixas ("Nova obra", "Novo
fornecedor"…). É um atalho de navegação vestido de busca.

O pedido, na voz de quem usa:

> "Menu pesquisar deve retornar tudo dentro do sistema, contratos,
> fornecedores, equipamentos, tags, usuários, funcionários, termos, menus,
> configurações, treinamentos, dicas, tudo."

## A revisão do pedido, antes do desenho

Três coisas foram esclarecidas em 17/09/2026 antes de desenhar, e cada uma
mudaria o que seria construído.

**"Tudo" são dois problemas diferentes.** Menus, configurações e dicas são
texto fixo da interface — já funcionam, e são um filtro em memória. Contratos,
fornecedores e equipamentos são registros do banco — não existem na busca, e
são consultas a N tabelas sob RLS a cada tecla. Tratar os dois como uma coisa
só subestimaria o trabalho por um fator grande.

**"Tags" é o `service_tag` do equipamento.** Não há tabela `tag` nem `dica` nas
72 tabelas do banco. O equipamento tem três identificadores —
`identificador`, `numero_serie` e `service_tag` — e no caso que originou o
pedido os três eram `14L4594`.

**O pedido omitia obras e imóveis, e pedia termos que quase não dá para
buscar.** Obra e imóvel têm campo de identidade forte (`obra.nome`,
`obra.codigo`, `imovel.apelido`) e entraram. `termo_equipamento` só tem
`numero_registro` — ninguém decora `TRM-2026-0040`, então o termo se acha pela
pessoa ou pela peça, e ficou fora.

## A decisão que o tamanho do banco tomou sozinha

Medido em 17/09/2026:

| Tabela | Linhas |
| --- | --- |
| funcionario | 510 |
| equipamento_unidade | 137 |
| fornecedor | 37 |
| imovel | 22 |
| obra | 8 |
| contrato_locacao | 6 |
| **total** | **720** |

Com 720 linhas o Postgres varre as seis tabelas em microssegundos. **Nenhum
maquinário de busca se justifica** — nem `tsvector`, nem índice dedicado, nem
view materializada, nem função RPC com `UNION ALL`.

E o argumento decisivo não é a simplicidade. É que **cada uma dessas peças é um
segundo lugar onde a regra de permissão pode divergir**. Uma função SQL tem a
mesma armadilha de `SECURITY DEFINER` que o AGENTS.md documenta para views —
foi o incidente da 0.49.1, e existe varredura só para isso. Uma tabela de
índice precisaria reimplementar as policies de organização e obra. Os dois
falham em silêncio, devolvendo dado de outro tenant sem erro nenhum.

**Seis consultas comuns, cada uma passando pela RLS que já existe, não criam
lugar novo onde a permissão possa estar errada.** É a razão pela qual esta é a
arquitetura, e não a latência.

## O acento decide se a feature funciona — e o filtro não roda no banco

O cliente já remove acentos (`normalizar`, em `command-palette.tsx:41`), mas o
Postgres **não tem `unaccent` nem `pg_trgm` instalados**. Sem tratar isso,
buscar "joao", "jose" ou "antonio" não encontra nada entre 510 funcionários de
nomes brasileiros, e a busca parece quebrada no primeiro uso.

**A primeira versão desta seção mandava usar `unaccent(campo) ilike
unaccent('%termo%')`. Está errada, e a correção é de 17/09/2026.** O PostgREST
não expressa isso: o helper que o repositório já usa, `termoOr`
(`src/lib/lista.ts:34`), monta `campo.ilike.%termo%`, e o filtro `.or()` não
aceita função envolvendo a coluna. A consulta descrita não pode ser emitida
pela camada de acesso.

**A saída é filtrar no servidor, não no banco.** Cada consulta traz só as
colunas de identidade, sem filtro, e o casamento acontece em memória com o
mesmo `normalizar()` que o palette já usa.

Isso só é defensável por causa do tamanho: 720 linhas, umas dezenas de
quilobytes por busca, e **nada sai do servidor além dos acertos** — a leitura
continua sob RLS e o filtro roda antes da resposta. Em troca, some a migration,
some a dependência da extensão, e o acerto fica idêntico entre páginas (filtro
no cliente) e registros (filtro no servidor), porque é a mesma função.

**O limite está escrito de propósito:** a dez vezes o tamanho atual — algo como
7.000 linhas — reler tudo a cada busca deixa de ser barato, e aí a conversa
volta para colunas geradas com um invólucro imutável de `unaccent`, ou para
`pg_trgm`. Não antes.

## Onde o código mora

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/busca.ts` | **puro**: tipos, ordenação, o termo mínimo |
| `src/lib/busca.test.ts` | testes da ordenação e dos limites |
| `src/lib/data/busca.ts` | as seis consultas, `server-only`, `createClient()` |
| `src/components/layout/command-palette.tsx` | **modificar**: debounce e resultados do servidor |

A ordenação sai para o módulo puro pela razão de sempre neste repositório:
regra inventada por nós precisa de teste em memória, como `conciliacao.ts` e
`frota.ts` já fazem. `src/lib/data/` continua sendo só leitura.

## As seis entidades e os campos por onde se busca

| Entidade | Campos | Para onde o resultado leva |
| --- | --- | --- |
| Obra | `nome`, `codigo` | `/obras/<id>` |
| Fornecedor | `nome`, `cnpj` | `/fornecedores/<id>` |
| Equipamento | `identificador`, `numero_serie`, `service_tag`, e a descrição do modelo | `/frota/<id>` |
| Funcionário | `nome`, `cpf` | `/termos/funcionarios` — **não há ficha individual**; o resultado leva à lista |
| Contrato | `numero`, `numero_registro` | `/contratos/<id>` |
| Imóvel | `apelido`, `proprietario_nome` | `/imoveis/<id>` |

## A ordenação: explicável, não esperta

Não há relevância calculada. A ordem sai de três regras, nesta precedência:

1. **Quem começa com o termo vem antes de quem só contém.** "Ande" mostra
   "Anderson" antes de "Fernando Andrade".
2. **Acerto em código ou identificador vem antes de acerto em nome.** Quem
   digita `14L4594` sabe exatamente o que quer.
3. **Empate desempata pela ordem fixa das entidades**, sempre a mesma.

Ordenação estável vale mais que ordenação esperta: o usuário aprende onde as
coisas caem, e a lista não dança entre uma busca e outra.

## Quando o termo casa com quarenta funcionários

Cada entidade traz **no máximo 5**, e o cabeçalho do grupo mostra
"Funcionários (5 de 40)" com link para a lista filtrada.

O Ctrl+K não é tela de listagem — é atalho. Quem precisa de quarenta
resultados precisa da tela de Funcionários, e a busca leva até ela.

## A ordem dos grupos

**Ações** (as oito que já existem), **Páginas** (o menu de hoje), e então um
grupo por entidade.

Páginas vêm antes porque são instantâneas e não dependem do servidor: a lista
já é útil enquanto os registros carregam.

## O comportamento

- **Menos de 2 caracteres não consulta o banco.** Uma letra casaria com quase
  tudo e gastaria seis consultas por nada.
- **Debounce de 200 ms** depois da última tecla.
- **Resposta fora de ordem é descartada.** Sem isso o resultado de "and" pode
  sobrescrever o de "anderson", e a lista mostra o que o usuário já parou de
  procurar.
- **Erro numa consulta não derruba a busca:** loga e devolve vazio para aquela
  entidade, seguindo a regra de leitura de lista do AGENTS.md. As outras cinco
  continuam aparecendo.
- **Nenhuma permissão nova é escrita.** As seis consultas usam `createClient()`
  e passam pela RLS existente. Se o usuário não vê a obra na tela de Obras, ela
  não aparece aqui — pelo mesmo mecanismo, não por uma regra paralela.

## Por que a permissão não é uma seção de segurança à parte

Busca global é o vazamento perfeito, porque **o resultado mostra o nome do
registro antes de qualquer clique**. Digitar três letras e ler o nome de um
contrato de outra obra é o dano, e ele acontece sem ninguém abrir nada.

A defesa não é uma verificação que a busca faz. É a busca **não ter caminho
próprio até o dado**: as seis consultas são leituras comuns, sob o mesmo
`createClient()` de qualquer tela. Não há o que conferir a mais, porque não há
privilégio a mais.

## Uma dependência combinada com a onda de Centros de custo (17/09/2026)

Outra frente está remodelando `obra` para abranger departamentos
administrativos: colunas `tipo` (`obra` | `departamento`) e `pai_id`, rota
`/centros-custo` com redirect de `/obras`.

**Não há nada a filtrar aqui, e isso foi confirmado com aquela frente, não
suposto.** `tipo` nasce `not null default 'obra'`, então toda linha de `obra`
continua aparecendo na busca antes e depois da migration. Obra e departamento
viram **um conceito só** — quem digita "Financeiro" no Ctrl+K quer chegar ao
centro de custo Financeiro, do mesmo jeito que quem digita "Unimed" quer chegar
à obra.

**E é por isso que esta spec NÃO manda prever o filtro.** Escrever
`.eq("tipo", "obra")` antes da coluna existir faz o PostgREST recusar a consulta
inteira, `data` volta nulo, e a entidade some da busca **em silêncio** — sem
erro e sem teste vermelho. É o acidente do `ativo` x `deleted_at` documentado em
`src/lib/mega/servidor.ts`. Retrabalho pequeno é melhor que falha silenciosa.

**O que precisa voltar aqui depois daquela migration** é o RÓTULO, não o
conjunto: `src/lib/data/busca.ts` passa a ler `tipo` e a rotular o resultado com
ele. Hoje o rótulo da entidade é constante, e dizer "Obra" para o RH passará a
ser mentira na tela. Quando houver hierarquia de dois níveis, o `pai_id` é o
desambiguador natural para a linha secundária — melhoria posterior, não agora.

## Fora de escopo, de propósito

- **Busca por conteúdo** (`tsvector` em observações, descrições, motivos). É a
  outra metade do pedido original, e foi adiada explicitamente.
- **Lançamentos financeiros.** Volume alto e texto livre — pertence à busca por
  conteúdo.
- **Termos por número.** `TRM-2026-0040` ninguém decora.
- **Usuários do sistema (`perfil`).** Fora por escolha no escopo.
- **Histórico de buscas, atalhos por resultado, índice de busca.**

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Busca global | Pedido revisado, desenho aprovado e escrito | Plano, migration, módulo puro, camada de leitura, tela, testes | 10% |

Próximo passo único: escrever o plano de implementação.
