# Catálogo em quatro níveis, e o cadastro de tipos em Configurações

## O problema, medido

A hierarquia **já existia — escrita como prosa dentro de um campo de texto**:

```
"Notebook Dell Latitude 3490"
 └─tipo──┘ └───modelo──────┘
```

O sistema não sabia que aquilo eram duas coisas, e o preço apareceu no banco: o
mesmo modelo cadastrado **duas vezes** por um erro de digitação
(`Latitude` / `Latitute`), com seis máquinas divididas entre os dois cadastros.
Ao lado, um `Desktop` genérico convivendo com onze `Desktop Dell OptiPlex …`, e
um `Locação de Veículo` — que é serviço — no meio da mesma lista.

Com tipo e modelo em campos separados, e o tipo vindo de uma lista, esse
cadastro duplicado não teria como nascer.

## O que já existe e será usado

- **8 categorias**, bem pensadas e prontas: Acesso e altura, Concretagem,
  Energia, Ferramenta elétrica, Ferramenta manual, Medição e ensaio,
  Movimentação de carga, TI. É o nível de cima, e não precisa ser inventado.
- **`equipamento_unidade`**, que é a peça, com `identificador`, `numero_serie`,
  `service_tag`, `imei`, `memoria_gb` e `configuracao` — campos de TI já
  acrescentados na importação do inventário.
- **`item_catalogo`**, que passa a ser o MODELO.

## A colisão de nomes, e como se resolve

`item_catalogo.tipo` hoje significa **natureza** — Equipamento, Material
retornável, Consumível — e a tela chama isso de "Tipo". No desenho novo, TIPO
significa **família**: NOTEBOOK, ANDAIME, BETONEIRA. Dois campos "Tipo" na mesma
tela seria um desastre.

**O campo atual passa a se chamar `natureza`.** E ele **absorve o
`controle`**, que hoje o contradiz:

| Natureza | Controle (derivado) |
|---|---|
| Equipamento | por peça (patrimônio) |
| Material retornável | por quantidade |
| Consumível | por quantidade |

Isso conserta um defeito visível: o estado PADRÃO de um item novo é
`Tipo = Equipamento` (cuja ajuda diz "controlado por unidade") com
`Controle = Por quantidade`. **O formulário nasce se contradizendo**, e os dois
campos dizem a mesma coisa por caminhos diferentes.

O dropdown "Controle no recebimento" **deixa de existir na tela**. A coluna
continua no banco, escrita a partir da natureza — dezenas de consultas já a
selecionam, e derivá-la em tempo de leitura exigiria tocar todas.

## O modelo

```
categoria_equipamento          TI                     (existe)
  └── tipo_equipamento         NOTEBOOK               (NOVO)
        └── item_catalogo      Dell Latitude 3490     (é o de hoje)
              └── equipamento_unidade  NB-0231        (existe)
```

### `tipo_equipamento`

| Coluna | Por quê |
|---|---|
| `categoria_id` | O tipo pertence a uma categoria só |
| `nome` | NOTEBOOK, ANDAIME |
| `natureza_padrao` | Sugere a natureza do modelo novo. NOTEBOOK sugere Equipamento; PRANCHA sugere Material retornável |
| `campos_ficha` | jsonb — quais campos as PEÇAS deste tipo têm |
| `ativo` | Tipo em desuso some do seletor sem sumir do histórico |

`item_catalogo.tipo_id` é **nulável**, e permanentemente: um modelo pode existir
antes de alguém decidir seu tipo, e tornar obrigatório travaria o cadastro
rápido que a obra faz com o caminhão no portão.

### A ficha por tipo — e por que não são colunas

Foi pedida configuração em **campos estruturados**, para poder perguntar "quais
notebooks têm menos de 8 GB". Mas `memória` e `disco` **não existem num
andaime**: criar essas colunas em `equipamento_unidade` encheria de nulos toda
betoneira e escora do sistema, e cada tipo novo pediria uma migration.

**O TIPO define quais campos suas peças têm**, e a peça guarda os valores num
`ficha jsonb`:

```
TIPO NOTEBOOK        campos_ficha
  processador        { chave, rotulo, tipo: texto,  }
  memoria            { chave, rotulo, tipo: numero, unidade: "GB" }
  disco              { chave, rotulo, tipo: numero, unidade: "GB" }
  disco_tipo         { chave, rotulo, tipo: lista,  opcoes: [SSD, HDD] }

PEÇA NB-0231         ficha
  { "processador": "i5-1135G7", "memoria": 8, "disco": 256, "disco_tipo": "SSD" }
```

Filtrar continua funcionando — o Postgres indexa e consulta `jsonb`. E este é o
**construtor de formulário** que já estava na fila: os dois problemas são o
mesmo problema.

`memoria_gb` e `configuracao`, que já existem como colunas em
`equipamento_unidade`, **ficam onde estão**. Migrá-las para a ficha é uma fatia
à parte, com dado real dentro, e misturá-la com a criação da estrutura dobraria
o risco das duas.

### Unidades de medida

Hoje é campo livre com sugestões (`un, m, kg…`). Campo livre de unidade sempre
vira `un`, `UN`, `unid` e `unidade` convivendo na mesma tabela — e aí nenhum
relatório soma direito. Vira lista fechada, cadastrável.

## Configurações

Hoje a tela tem só "Alertas de vencimento" e "Relatório por e-mail" — nenhum
cadastro. Ganha:

- **Catálogo** — categorias, e os tipos dentro de cada uma
- **Ficha do tipo** — os campos das peças de cada tipo
- **Unidades de medida**

## Faseamento

| Fase | Entrega | Migrations |
|---|---|---|
| A | `tipo_equipamento`, `item_catalogo.tipo_id`, `natureza`, `controle` derivado, `unidade_medida`; Configurações com categorias, tipos e unidades; formulário do item | 1 |
| B | `campos_ficha` no tipo, `ficha` na peça, o construtor de campos e o formulário dinâmico da peça | 1 |

A fase A vale por si: ela conserta a contradição do formulário, cria a
hierarquia e o cadastro. A B é o construtor de formulário.

## O momento é agora

O catálogo está **vazio** — os 27 itens e 132 peças foram removidos a pedido, com
backup. **Não há dado legado para migrar**, o que elimina a parte mais arriscada:
não é preciso adivinhar o tipo de "Notebook Dell Latitute 3490" por análise de
texto. Cada item novo já nasce classificado.

## Riscos assumidos

- **`natureza` é renomeação de coluna em uso.** `tipo` é lido em formulário,
  listagem, filtro e relatório. A migration renomeia e uma varredura confirma
  que nenhuma referência sobrou.
- **`controle` derivado muda comportamento existente.** Hoje é escolhido à mão;
  passa a vir da natureza. Como o catálogo está vazio, nenhum registro muda de
  valor — mas o formulário de recebimento lê essa coluna para decidir se exige
  patrimônio, e isso é testado.
