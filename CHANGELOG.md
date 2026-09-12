# Changelog

Todas as mudanças relevantes do **Loca** ficam aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

> Fonte única para a tela **Novidades**: [`src/lib/changelog.ts`](src/lib/changelog.ts).
> Ao concluir uma alteração, atualize **os dois** (ver processo em `AGENTS.md`).

## [0.112.2] - 2026-09-11

Duas afirmacoes do AGENTS.md contradiziam o que o proprio AGENTS.md passou a
dizer na 0.112.0, e uma terceira contradizia a referencia do Sistenge People.

### Corrigido
- A secao "O que a resposta traz" ainda afirmava que nao existe data de
  pagamento na rota. Agora aponta para a secao da prorrogacao.
- **`NumeroDocumento` nao e sempre o numero da fatura.** O AGENTS.md afirmava
  que sim; a referencia do People afirmava que nao. As duas estavam certas
  sobre populacoes diferentes, e a medicao (465 titulos) da o recorte: em `NF`
  ele e confiavel (9 genericos em 183), em `RECIBO` nao (92 de 94), em
  `CONTRATO` 7 de 7, em `ALUGUEL` 20 de 22. Em titulo de imovel e 100% generico
  (106 de 106). Regra nova: casar por documento so em titulo fiscal, nunca com
  valor de 1 a 3 digitos, e nunca corrigir o dado do Loca a partir dele.

### Devolvido ao Sistenge People
- `docs/integracoes/mega-erp/CLAUDE.md` daquele projeto recebeu oito medicoes
  que so existiam aqui: limite de 2 anos, codigo cru x com prefixo, o modulo de
  contratos inteiro, chaves em minuscula, `cnpj` com padding em pessoa fisica,
  os 63 specs OpenAPI, anexos sem conteudo, e a confirmacao independente da
  prorrogacao. **Editado, nao commitado** -- aquele repositorio esta noutro
  branch.

## [0.112.1] - 2026-09-11

O cliente do Mega deixa de supor o que o ERP informa.

Tres lacunas apontadas pela referencia de integracao do Sistenge People, todas
fechadas em `src/lib/mega/cliente.ts` -- que ate aqui era o unico modulo do
diretorio sem teste.

### Corrigido
- A validade do token sai de `expirationToken`, campo da resposta do SignIn,
  com margem de 5 min. Supor 2 h rende 401 intermitente no dia em que o
  fornecedor mudar a politica. A constante antiga virou fallback.
- HTTP 401 numa consulta rende UMA renovacao e uma repeticao. O segundo 401
  propaga: encadear login foi o que bloqueou a conta `120.apifin`, compartilhada
  com o projeto Financeiro.
- Toda chamada leva `AbortSignal.timeout(30s)`. O cron tem `maxDuration = 300`;
  sem teto, uma rota travada consome a rodada e as outras consultas nem saem.

### Adicionado
- `src/lib/mega/cliente.test.ts`, 8 casos -- incluindo a **assercao negativa**:
  passa a senha real num corpo de erro que a ecoa e prova que ela nao aparece na
  mensagem nem na pilha.

### Medido
- Faturamento por mes x por bloco, sobre os 465 titulos do espelho. A divisao e
  estrutural: **imovel e sempre bloco** (7 de 7), **fornecedor e quase sempre
  mensal** (29 de 32). As 3 excecoes sao alugueis pagos pelo cadastro de
  fornecedor. Logo a baixa tem de casar pelo DOCUMENTO, nunca 1<->1.

## [0.112.0] - 2026-09-11

A data de pagamento existe, e e a PRORROGACAO.

Ate aqui o `AGENTS.md` afirmava que a API do Mega nao devolve data de pagamento,
e por isso a baixa nao existia. A afirmacao caiu: confirmado com o dono do
processo, `DataProrrogado` **e** a data de pagamento -- `DataVencimento` e o
vencimento contratado do documento, e quando o financeiro renegocia quem manda e
a prorrogada.

Medido no espelho no mesmo dia, sobre as 450 parcelas ja copiadas: nenhuma vem
sem prorrogacao, nenhuma prorroga para tras, e 54 (12,0%) adiam de fato.

### Adicionado
- `dataDePagamento()` em `src/lib/mega/vencimento.ts`. Exige o saldo na
  assinatura: em titulo aberto a prorrogacao e previsao, e devolve-la como
  "pago em" marcaria como quitado o que ainda vai vencer.
- `pagoEm` no espelho lido, e "pago em <data>" na secao "No Mega".

### Alterado
- O rodape da secao nao afirma mais que o Mega desconhece a data do pagamento.
- `AGENTS.md` e `docs/mega-api-para-custos.md` corrigidos. Falta **uma** decisao
  para a baixa existir (faturamento por mes ou por bloco), nao mais duas.

### Nao mudou
- O espelho continua **sem escrever** em `lancamento_financeiro`;
  `espelho-nao-da-baixa.test.ts` segue cobrando isso.
- `quitacao_vista_em` fica: e o dia em que o cron VIU o saldo zerar, auditoria
  da sincronizacao, e nao a data de pagamento.

## [0.111.1] - 2026-09-11

Cada linha da resposta de contratos e um ITEM, nao um contrato.

A primeira rodada em producao morreu com "ON CONFLICT DO UPDATE command cannot
affect row a second time". Medido: 958 linhas para **664 contratos** -- o
contrato 813 sozinho tem 15 itens (sprinkler, tubo de cobre, execucao da
instalacao). Nem `(codigo, produto)` serve de chave: ainda colide 77 vezes.

Somar os itens e o certo, e da para provar: a soma das 19 linhas da CCN e
R$ 550.627,17, o mesmo que o BigNumber `GetTotalContratado` do proprio ERP
responde para ela.

O produto so e guardado quando o contrato tem UM item -- mostrar o primeiro de
quinze seria escolher um por sorteio e chama-lo de o contrato.

## [0.111.0] - 2026-09-11

Contratos do ERP na tela do contrato.

O Loca projeta o comprometido a partir dos itens cadastrados. O Mega tem o
numero OFICIAL: quanto foi contratado com cada fornecedor em cada obra, quanto
ja foi medido e quanto sobra.

### Como foi encontrado

O portal de APIs e uma SPA e nao entrega catalogo. O caminho foram as **63
especificacoes OpenAPI publicas** em
`storage.googleapis.com/br-com-mega-ecossistema-api/`. Varrendo as 63: cinco
modulos com rotas de contrato, e o util e
`Construcao.AdmObra.AcompanhamentoContratoEngenhariaX`, com 31 rotas.

`Visoes/GetVisoesFornecedor` sem filtro devolve **958 contratos de 247
fornecedores numa unica chamada**, com projeto, codigo do contrato, medicao e
saldo. O `projeto` vem como "608 - RACIONAL - DANTE" e o prefixo e o
`obra.codigo` do Loca: **7 das 8 obras casam, cobrindo 571 contratos**.

### Duas armadilhas do ERP

- **A data aqui e `dd/MM/yyyy`**, ao contrario da rota de contas a pagar, que
  exige ISO. Mandar ISO devolve HTTP 500 sem dizer por que -- foi o que custou
  as primeiras tentativas.
- O campo `nota` volta como NUMERO nesta rota e como TEXTO em
  `GetTabelaFornecedores`. O schema aceita os dois.

O filtro do que entra e em memoria, como nos titulos: dos 55 projetos, so
entram as obras do Loca.

## [0.110.0] - 2026-09-11

Codigos das contas de consumo.

O Mega tem 803 titulos do tipo CONTA (CPFL 287, SABESP 274, DESKTOP 111) e
nenhum diz de que imovel e: o agente e a concessionaria, que atende a casa
toda.

### Por que nao casar por valor e data

Foi medido, nao suposto:

- o Mega registra a data do LOTE de pagamento, nao o vencimento do boleto --
  contas de agua de tres imoveis diferentes caem todas em 24/08;
- contas de agua colidem por natureza: R$ 74,83 / R$ 74,86 / R$ 75,44 no mesmo
  mes. Uma conta do Loca casou com TRES titulos ao mesmo tempo;
- 157 dos 803 titulos (20%) colidem em agente + mes + valor, e piora conforme
  entram mais imoveis.

### A chave

O numero da instalacao (CPFL) ou do RGI (SABESP): impresso em toda conta, nao
muda e e unico. O imovel ganhou o cadastro desses codigos, e a rodada liga o
titulo ao imovel por ele -- ignorando valor e vencimento.

A convencao combinada com o Evandro: o numero vai no campo **Documento** do
lancamento, so digitos. O Historico continua com obra + nome da casa +
instalacao, para quem le o Mega. O Documento foi escolhido como chave porque
vem de graca nas 2 chamadas diarias; o Historico so existe na rota de detalhe,
um titulo por chamada, com 36% de aproveitamento -- sessenta chamadas por dia
contra duas.

Conta cuja instalacao nao esta cadastrada fica SEM imovel, de proposito: e
assim que aparece a conta de imovel ja entregue que a empresa segue pagando.

## [0.109.0] - 2026-09-11

Imobiliaria que recebe por varios imoveis.

Descoberto ao conciliar o MPD Contagem: ate marco/2026 os alugueis iam para
locadores individuais (KEILA SANTOS, ANDERSON ALMEIDA, ROBERTO BATISTA); desde
abril/2026 **passaram todos para a EXPRESSO ENGENHARIA**, um agente so, com 15
titulos do tipo ALUGUEL cobrindo varios imoveis.

O modelo nao suportava isso. `imovelPorCodigo` era um Map de codigo->imovel: com
6 imoveis no mesmo codigo, o ultimo cadastrado vencia e TODOS os titulos caiam
nele, em silencio.

Agora o mapa e codigo->lista. O titulo so aponta para um imovel quando nao ha
duvida; com locador compartilhado, `imovel_id` fica nulo e a tela acha os
titulos pelo `codigo_mega`. O rodape avisa por quantos imoveis aquele locador
recebe -- sem isso, somar o "pago" de cada tela contaria o mesmo dinheiro N
vezes.

## [0.108.1] - 2026-09-10

Excluir imovel passou a encerrar os contratos dele.

`soft_delete('imovel', ...)` marcava so o imovel. O `contrato_imovel` seguia
`vigente = true`, apontando para um imovel que a policy de SELECT esconde -- e
toda soma de contratos vigentes herdava o erro.

Apareceu na conciliacao de aluguel: a soma dava R$ 66.575/mes contra R$ 58.075
reais. **R$ 8.500/mes de aluguel fantasma** em 3 contratos de imoveis excluidos.

A migration parte do codigo EM PRODUCAO, nao da 0041: a funcao ganhou cinco
ramos depois dela, e reescreve-la de memoria teria apagado os cinco em silencio.
O contador do imovel ficou em variavel separada -- sem isso, um imovel sem
contrato voltaria `false` e a tela diria "nao foi possivel excluir" logo apos
excluir.

O cadastro do imovel tambem ganhou o campo de **codigo do Mega digitavel**:
locador pessoa fisica costuma nao ter CPF no ERP (nos quatro encontrados, o
campo de CNPJ vem com o proprio codigo), e para esses a busca por documento nao
acha.

## [0.108.0] - 2026-09-10

Aluguel de imovel no espelho do Mega.

21 contratos de imovel vigentes, R$ 66.575/mes de aluguel, zero lancamentos
financeiros: o Loca sabia o contrato e nao sabia o pagamento.

### Duas chamadas por dia, no lugar de 74

A rota `FaturaPagar/Saldo/{ini}/{fim}` traz TODAS as parcelas do periodo sem
filtrar agente -- 458 num mes, de 224 agentes. A rodada passou a usa-la, e o
filtro do que interessa e **em memoria**.

O filtro em memoria e decisao, nao economia: a resposta traz tudo que a empresa
paga (folha, vale-transporte, impostos, veiculos), e guardar isso no Loca seria
coletar muito alem do proposito do sistema.

### A chave do locador

O locador vivia em texto livre. O cadastro do imovel ganhou **CPF ou CNPJ**,
com digito verificador conferido -- um documento trocado num digito acharia o
agente de outra pessoa, e a tela mostraria o pagamento de um terceiro.

`GetAgenteCnpj` resolve o codigo do agente a partir do documento, sob clique.
Medido: a rota quer o documento **so com digitos**; com mascara devolve 500.

### Casar por nome ou por valor NAO funciona aqui

Diferente do mutirao de custodia (89 de 95 automaticos), o casamento por
semelhanca erra muito: dos 8 candidatos por valor+dia, **3 eram falsos** --
PONTOMAIS TECNOLOGIA, PREVENT SENIOR e BULLLA INSTITUICAO DE PAGAMENTO casaram
com aluguel por pura coincidencia de valor e dia. Por isso o vinculo e pelo
documento, e nao por proposta automatica.

## [0.107.0] - 2026-09-10

A data de pagar e a prorrogada.

`DataVencimento` e a data original do documento. Quando o financeiro renegocia,
o Mega grava a nova data em `DataProrrogado` -- e e ela que vale para pagar.

Medido sobre 5.372 parcelas reais: **866 (16,1%) tem prorrogacao**, e ela e
SEMPRE para depois, nem uma unica vez para antes. As vezes por meses
(vencimento 03/12/2024, prorrogado para 31/03/2025).

Ler o vencimento original nesses 16% faria a tela acusar atraso em titulo que
esta em dia -- e mandar alguem cobrar uma renegociacao que a propria casa fez.

A lista agora ordena e exibe pela data de pagar; a original so aparece, em
letra menor, quando houve adiamento. Cada titulo diz se esta pago, a vencer,
vencendo hoje ou atrasado, e o total atrasado tem celula propria: e o unico dos
tres numeros que pede acao hoje.

## [0.106.1] - 2026-09-10

A primeira rodada em producao voltou 37 consultas recusadas.

O Mega **nao aceita intervalo maior que 2 anos** entre as datas, e a janela era
de tres (do ano passado ao ano que vem). A mensagem do ERP diz isso com todas as
letras -- mas o erro do Loca a descartava, entao o cron rendeu 37 linhas de "o
Mega recusou a consulta" e nenhuma pista. Duas correcoes:

- a janela foi partida em duas, de no maximo 2 anos, sem pular data na emenda;
- o erro da consulta passou a carregar o corpo da resposta do ERP. O do
  `SignIn` continua fora do log, porque la o que volta pode falar da credencial.

Nada disso esta na documentacao do Mega.

## [0.106.0] - 2026-09-10

O Loca passa a ver os pagamentos do Mega.

### O que mudou

A tela do contrato ganhou a secao "No Mega": os titulos a pagar do fornecedor no
ERP, com o total pago, o total em aberto e a data em que o dado foi copiado. Um
cron diario as 7h30 de Brasilia (`30 10 * * *` -- a Vercel roda em UTC) enche o
espelho em `mega_titulo`.

### O que esta versao NAO faz

**Nao da baixa em nada.** Nenhum arquivo desta onda escreve em
`lancamento_financeiro`, e ha varredura cobrando isso
(`src/lib/mega/espelho-nao-da-baixa.test.ts`). O motivo e concreto: a API do
Mega nao devolve data de pagamento -- a rota tem 10 campos e nenhum e isso. No
projeto Financeiro essa data saia da pasta de comprovantes no OneDrive.

O espelho guarda `quitacao_vista_em`: o dia em que o Loca VIU o saldo zerar.
Com cron diario erra no maximo um dia, e o nome diz o que e.

### Seguranca

`mega_titulo` e `mega_sync` nascem com policy de SELECT e mais nenhuma: ninguem
edita o espelho pela aplicacao. Quem escreve e o cron, com service role.
A sincronizacao e fail-closed em dois pontos -- sem as tres variaveis de
ambiente nao roda, e so toca organizacao com linha ativa em `mega_sync`.

## [0.105.2] - 2026-09-10

Consulta de pagamentos no Mega.

O Loca sabe o que foi contratado e o que corre; quem sabe o que saiu do caixa e
o Mega. `scripts/mega-pagamentos.ps1` consulta o contas a pagar de um fornecedor
pelo `codigo_mega` e diz, parcela a parcela, o que esta pago e o que esta em
aberto. A secao "Pagamentos no Mega" do AGENTS.md registra as duas correcoes ao
guia do ERP que foram medidas aqui: a rota de contas a pagar quer o codigo CRU
(nao `1-2630`), e `@($s | ConvertFrom-Json)` no PowerShell 5.1 nao desenrola o
array.

Ainda **nao** ha integracao automatica: a consulta e manual, por sessao.

## [0.105.1] - 2026-09-10

O valor do contrato agora salva.

### O defeito

Salvar o contrato com "32616,48" no campo novo devolvia **"Invalid input"** --
mensagem crua do zod, com o campo preenchido corretamente.

Causa: **falha de idempotencia**. O formulario usa
`useForm<Input, unknown, Output>`, entao o submit recebe o output JA
transformado (`32616.48`, um NUMERO) e o manda para a action, que parseia de
novo. O campo aceitava `z.union([z.string(), z.null()])`, e a segunda passagem
recusava o proprio output:

    invalid_union
      expected: "string", received: number
      expected: "null",   received: number

### O guarda existia, e eu escapei dele

`schemas-varredura.test.ts` cobra exatamente isso de todo schema -- "aceita o
proprio output" e "nao muda o output na segunda passagem". Ele passou na 0.105.0
porque a AMOSTRA de `contratoSchema` nao incluia o campo novo: a varredura testa
o que a amostra tem.

O conserto foi na ordem certa: primeiro o campo entrou na amostra (e os dois
casos passaram a falhar, provando que o guarda morde), depois o schema passou a
aceitar `z.number()`.

### Corrigido

`valor_total_contratado` aceita string e numero. String continua tratando
"32.616,48" e "32616.48" -- quem copia do PDF cola o formato de la.

## [0.105.0] - 2026-09-10

O contrato confere consigo mesmo.

### Medido no contrato 1726, que e um documento real

    2 x AR CONDICIONADO 12000BTU  @ R$ 156,667  = R$   313,33
    7 x AR CONDICIONADO 18000BTU  @ R$ 246,457  = R$ 1.725,20
    Valor mensal ......................... R$ 2.038,53
    Prazo previsto: 16 meses
    Valor total previsto ................. R$ 32.616,48

Tres divergencias apareceram sozinhas ao comparar o cadastro com o PDF, e as
tres motivam o que esta nesta versao.

### Adicionado

- `contrato_locacao.valor_total_contratado` (0105): o valor que esta no
  DOCUMENTO. Digitado, nao calculado -- e a referencia contra a qual o cadastro
  e conferido.
- `comprometidoDoContrato()`: cada item projetado ate o fim do contrato. Nenhuma
  matematica nova -- e `custoLinhaLocado` com `fim = data_fim_prevista` em vez de
  `fim = hoje`. Item ja devolvido para na devolucao, senao a projecao inflaria e
  a conferencia acusaria divergencia que nao existe.
- `conciliarContrato()`: compara os dois. `acima` e `abaixo` sao estados
  separados de proposito -- projetar a mais costuma ser prazo, projetar a menos
  costuma ser item faltando. Dois problemas, duas conversas, duas mensagens.
- Painel do contrato com os TRES numeros: Contratado, Comprometido, Acumulado.

### A tolerancia, e por que ela existe

`TOLERANCIA_CONCILIACAO = 1` real, fixo.

O erro de arredondamento acumulado e da ordem de centavos -- mesmo com cem
linhas e sessenta periodos da trinta centavos. Ja o menor erro REAL a pegar e
uma unidade a mais ou a menos: no 1726, um aparelho de R$ 156,67 por vinte meses
sao R$ 3.100. Entre trinta centavos e tres mil reais cabe qualquer corte, e um
real e o que se explica sem tabela.

Percentual do contratado seria pior: num contrato grande a tolerancia cresceria
ate engolir o item que se quer flagrar.

### Quatro casas decimais, e sem elas nada disso funciona

`item_locado.valor_unitario_periodo` foi de `numeric(14,2)` para `numeric(14,4)`.

O contrato tem valor unitario com TRES casas. Com duas, o cadastro do 1726 ficou
com 156,67 e 246,46 -- mensal de R$ 2.038,56 contra os R$ 2.038,53 do documento.
Tres centavos por mes.

Em dinheiro nao e nada. Para a conferencia e fatal: todo contrato divergiria por
centavos, e um alarme que toca sempre e um alarme que ninguem le. Com quatro
casas, `156,667 x 2 + 246,457 x 7 = 2.038,533`, que arredonda para os 2.038,53
do documento.

Alargar a escala preserva os valores existentes -- 156,67 continua 156,67 --,
mas NAO os corrige: os itens ja cadastrados seguem com duas casas ate alguem
reeditar.

### Agrupamento por categoria, e por que nao a cascata

O pedido era um seletor de categoria que filtrasse os itens. Medido: 29 itens
ativos, 10 categorias, **8 delas vazias**, e **27 dos 29 em TI**.

Filtrar por categoria leva 29 para 2 num contrato de climatizacao e 29 para 27
num de TI -- cobrando um clique a mais em toda linha para nao resolver o caso
majoritario. O que quebra TI e o TIPO, nao a categoria, e ai seriam dois cliques.

`<optgroup>` nativo resolve o mesmo desconforto sem cascata, sem segundo
controle e sem estado novo. Quando o catalogo passar de ~60 itens, um campo com
busca -- que tambem resolve TI.

### Alterado

- `/itens` abre com os grupos recolhidos, como `/frota` desde a 0.99.0. Buscar
  ou filtrar por tipo abre sozinho; escolher categoria nao, porque ali e
  navegacao. Duas telas com o mesmo desenho que se comportassem diferente seriam
  duas regras para aprender.

### Um teste que corrigi no lado certo

A primeira versao de `comprometido.test.ts` esperava 12 periodos para um ano e
recebeu 13. Nao e defeito: `periodosEntre` e inclusiva e arredonda para cima
("periodo iniciado = periodo cheio"), com mensal aproximado em 30 dias -- 366/30
= 12,2, que vira 13. O teste e que estava com o modelo mental errado, e agora diz
isso por escrito, porque quem comparar a projecao com os "16 meses" do documento
vai ser tentado a consertar o lado errado.

## [0.104.0] - 2026-09-10

Varios contatos por fornecedor.

### Adicionado

- Tabela `fornecedor_contato` (migration 0104): `nome`, `cargo`, `telefone`,
  `principal`. **Um principal por fornecedor garantido no banco**, por indice
  unico PARCIAL `unique (fornecedor_id) where principal` -- o mesmo recurso do
  `idx_custodia_aberta` (0059) e do "um orcamento vigente por obra" (0051). Ele
  permite N contatos comuns convivendo com um principal, e permite ZERO, que e
  estado legitimo.
- `src/lib/telefone.ts`: `normalizarTelefone` e `formatarTelefone`, 10 casos por
  TDD. Guarda digitos com DDI, formata na exibicao.
- `ContatosDoFornecedor`, com `useFieldArray` -- ja o padrao em `ficha-campos` e
  `orcamento-form`.

### A ordem de escrita, que nao e obvia

O PostgREST nao tem transacao. A action **apaga e reinsere** os contatos, em vez
de casar linha por linha: nada aponta para `fornecedor_contato` (nao ha FK a
preservar), e inserir o lote de uma vez com um so `principal: true` faz o estado
intermediario de "duas principais" -- que o indice unico recusaria -- nao
existir.

O erro das DUAS escritas e conferido, seguindo a licao ja registrada na
sincronia de obras: la o `delete` limpava, o `insert` falhava, e o resultado era
um fornecedor sem vinculo nenhum anunciado como "atualizado". Os dois avisos
(obras e contatos) sao devolvidos juntos, porque falham por caminhos
independentes.

### O que NAO mudou, e e a decisao mais importante

`fornecedor.contato_email` **fica onde esta**. E a caixa da EMPRESA -- no
cadastro real, `contato@nautika.com.br` -- e o destinatario do romaneio de
recebimento e do termo de devolucao, com seis pontos do codigo dependendo dele.
Amarrar o documento ao e-mail de uma PESSOA faria o romaneio parar de chegar no
dia em que ela saisse da empresa.

O nome da coluna passa a mentir um pouco: `contato_email` nao e o e-mail do
contato, e o da empresa. Renomear custaria seis call sites sem ganho, entao ficou
o `comment on column` em vez do rename.

### Expandir e contrair

`contato_nome` e `contato_telefone` **continuam no banco**, marcadas como
superadas por `comment on column`. Derruba-las na mesma migration quebraria a
producao na janela entre aplicar o SQL e publicar o codigo -- quatro telas as
liam.

O risco dessa fase e a coluna que existe, tem dado e nao e mais atualizada:
quem a ler recebe o valor congelado no dia da migracao.
`src/lib/fornecedor-contato.test.ts` e a varredura que segura isso ate a
migration que as derruba.

**A varredura foi verificada com isca**: um arquivo temporario com
`f.contato_nome` a fez falhar, e sem ele ela passa. Sem essa checagem ela teria
passado por vacuidade -- a primeira versao tinha um caractere BACKSPACE invisivel
(``) no meio da regex, vindo do escape de `` em Python, e nao casava com
nada.

### Alterado

- A listagem devolve `contatoPrincipal` ja achatado, por embed para-MUITOS --
  mesma forma do embed de obras ao lado, que nao multiplica linhas nem afeta o
  `count`. So `!inner` faria isso.
- `PageHeader` da tela de edicao: nome do fornecedor no titulo, "Editar
  fornecedor" na descricao.
- O telefone e formatado na CARGA do formulario, e nao so no `onBlur`: o banco
  guarda digitos e o campo abriria com "5511980765016" em todo cadastro
  existente.

### Verificado

Migration aplicada e conferida por consulta, nao por ausencia de erro:
`to_regclass` devolve a tabela, `relrowsecurity` e true, `pg_policies` conta 2,
o indice parcial existe, e os 3 contatos migraram com o telefone normalizado --
inclusive "11 95914-0002", que virou `5511959140002`.

## [0.103.1] — 2026-09-10

Os 37 fornecedores com código do Mega — e duas razões sociais corrigidas.

**Mudança de dado, não de código.** Fica registrada porque razão social e CNPJ
saem em contrato, e daqui a seis meses alguém vai perguntar por que a “Voke”
virou “Suprisul”.

| Antes (Loca) | Agora (do Mega) | Código |
|---|---|---|
| Voke SA — `04.212.396/0001-91` | SUPRISUL LOCACAO E SERVICO LTDA — `01.899.546/0001-99` | 2863 |
| A2 WORKS COMERCIO E SERVICOS LTDA — `04.121.167/0001-61` | WORKS INFORMATICA COMERCIAL LTDA — `00.320.065/0001-14` | 3703 |
| ARMASA (duplicado) | — excluído pelo Evandro | 4114 no que ficou |

Nos dois casos **o nome e o CNPJ vieram do Mega**, e não do que estava digitado
aqui: era o cadastro do Loca que estava errado.

### O código que quase entrou errado

O primeiro número informado para a Suprisul foi **1684**. Conferido antes de
gravar, `1-1684` é **`BANCO ITAU SA AG. 8098 CC. 01595-4`** — e o campo `cnpj`
dele volta como `"1684              "`, o próprio código com padding, que é a
marca de agente que é conta bancária ou órgão. Os padrões 0 a 5 foram testados;
só existe o `1-1684`.

O código certo é **2863**. Conferir custou uma chamada; gravá-lo errado teria
amarrado um fornecedor de locação à conta corrente do banco na conciliação.

**Estado final:** 37 fornecedores, 37 com código, **37 códigos distintos**.

## [0.103.0] — 2026-09-10

O código do fornecedor no Mega.

### Por que um código, e não o nome

O Mega é o ERP onde o contas a pagar vive, e cada fornecedor tem lá um código
numérico — `5I SERVICOS DE MANUTENCAO LTDA` é o **2630**. Conciliar pelo nome é
o pior identificador possível: muda de razão social, vem abreviado, vem com
acento de um lado e sem do outro.

`codigo_mega` e não `codigo`, pelo mesmo motivo de `obra.codigo_people`: quem
ler o schema daqui a um ano precisa saber **pelo nome** de onde o número veio e
quem manda nele. O Loca não o gera — lê de outro sistema, e um dia pode
divergir.

**Texto, não inteiro.** Ninguém soma código de fornecedor, e um dia o Mega pode
emitir código com zero à esquerda. Guardar como número transformaria `0042` em
`42` no primeiro salvamento, em silêncio.

### Buscado no próprio Mega

Os 38 fornecedores foram cruzados por CNPJ em `GET
/api/globalagente/Agente/GetAgenteCnpj/{cnpj}`, um a um.

| Resultado | Quantos |
|---|---|
| Encontrados no Mega | **36** |
| Nome divergente entre os dois sistemas | **nenhum** |
| Não existem no Mega (HTTP 204) | 2 |
| Preenchidos | **34** |

Os dois que não existem lá são **A2 WORKS** e **Voke SA** — resposta limpa da
API, não erro. Os outros dois que ficaram sem código são o par duplicado
descrito abaixo.

O CNPJ é gravado **formatado** no Loca (`18.376.396/0001-31`), e a barra quebra
a rota do Mega. A consulta usa só os dígitos.

### O índice já nasce apontando um problema

Único por organização. **Ao contrário do CNPJ**, que desde a 0043 apenas AVISA e
deixa salvar: ali o duplicado era decisão de quem cadastra. Aqui não há caso —
duas linhas apontando para o mesmo agente do Mega são a mesma empresa cadastrada
duas vezes, e a conciliação somaria dois fornecedores num título só.

`ARMASA COMERCIO E SERVICOS PARA PERFURACAO LTDA` está **duas vezes** no Loca,
com o mesmo CNPJ, e as duas casam com o código **4114**. As duas ficaram sem
código até alguém decidir qual linha vale — que é exatamente o trabalho que este
índice existe para provocar.

### Migrations

- `0103_codigo_mega_do_fornecedor.sql` — a coluna e o índice único parcial.

## [0.102.1] — 2026-09-10

O histórico de custódia volta a caber numa tela.

### Recolhido, não apagado

`peca-linha-do-tempo.tsx` dizia o contrário, e por um bom motivo: *"documento
anulado não some do histórico, e 'esteve com o Fulano' é diferente de 'houve um
termo que não valeu'"*. A intenção continua certa — **o que mudou foi a escala**.

O mutirão de regularização emitiu 142 termos para 95 peças (um `useState` que
não reinicializava entre rodadas, corrigido na 0.98.1), e os **48 duplicados**
foram cancelados. Na `14L4594` isso virou **quatro linhas**, três anuladas no
mesmo dia, para uma posse que importa.

Histórico que ninguém consegue ler protege menos que histórico curto.

**Consideramos apagar as 48 e não apagamos.** São documentos numerados que
registram um incidente de produção e a remediação dele; apagá-los deixaria
buracos na numeração e destruiria o rastro. Elas saem da primeira leitura e
ficam a **um clique** — e continuam no banco, que é onde a auditoria as procura.

### A posse aberta nunca sai

O comentário que eu ia escrever afirmava que "a posse aberta nunca é anulada",
porque cancelar um termo fecha a posse que ele abriu. **Não é garantido:**
`cancelarTermo` grava o cancelamento ANTES de mexer no livro e devolve
`problemaNoLivro` quando a segunda parte falha — o que deixa uma posse **aberta**
apontando para um termo **cancelado**.

Esconder essa linha seria a pior falha possível desta tela: a peça está com
alguém, e o histórico diria que não está com ninguém. Quando as duas condições
brigam, "está com alguém agora" ganha — e há teste com esse nome.

## [0.102.0] — 2026-09-10

Transferir custódia de uma pessoa para outra.

*"Vou herdar a máquina que era do André, e a minha fica disponível."*

### O caminho que existia

Dois caminhos separados, em telas diferentes: caçar o termo ativo na lista de
Termos, registrar devolução, encerrar; e só então voltar à peça para emitir o
novo. A página da peça mostrava “Com quem está” e **nem link para o termo
tinha** — o número aparecia como texto.

O bloco “Movimentar” oferece Obra, Almoxarifado e Fornecedor, nunca uma pessoa,
e nada dizia que para outra pessoa o caminho era outro.

### Continuam sendo dois termos

A trava `custodia_funcionario_exige_termo` fica como está: posse de funcionário
só nasce de termo assinado. É ela que garante existir um papel dizendo **em que
estado** o equipamento saiu da mão de quem o tinha — se a tela aparecer trincada
semana que vem, o termo encerrado responde.

O que muda é o **caminho**, não a regra.

### Não é uma transação, e isso é deliberado

As duas assinaturas podem acontecer em dias diferentes, e entre elas a peça fica
**disponível** — sem estado novo na matriz de transição, sem trava.

O preço é que outra pessoa pode levá-la no meio do caminho. A resposta é um
**lembrete**, não uma reserva: a peça mostra “entrega pendente para Fulano” com
o botão que retoma. Se alguém levou antes, `lembreteValido` para de mostrar
sozinho — foi decisão de quem estava lá, e insistir transformaria uma intenção
anotada num impedimento real.

### Devolução sem assinatura, com motivo

211 pessoas da base estão desligadas. Uma delas que saiu com um notebook **não
vai assinar devolução nenhuma**, e exigir a assinatura ali não protegia o
patrimônio: só impedia o fato de ser registrado, e o equipamento ficava para
sempre “com” quem não trabalha mais aqui.

O motivo é **obrigatório** quando a assinatura falta, com mínimo de dez
caracteres, e quem garante isso é o `check` do banco — não a tela. Sem ele o
caminho sem assinatura viraria o mais curto, e em seis meses metade das
devoluções não teria nem assinatura nem explicação. O campo **só aparece quando
a assinatura falta**, pelo mesmo motivo.

A regra passou a valer também no servidor: `assinaturaSchema` sempre aceitou
imagem nula, e quem chamasse `encerrarTermo` por fora encerrava sem assinatura e
sem explicação nenhuma.

### O termo é descoberto no servidor

A action não recebe `termo_id` da tela. Aceitá-lo permitiria encerrar o termo de
**outra peça** — e encerrar termo alheio devolve para `disponivel` equipamento
que está legitimamente com alguém.

### Migrations

- `0102_transferir_custodia.sql` — `devolucao_sem_assinatura_motivo` no termo,
  com `check` de tamanho mínimo; `entrega_pendente_funcionario_id` e
  `entrega_pendente_em` na peça, com índice parcial. Aborta se a trava que
  obriga o termo tiver sumido.

## [0.101.0] — 2026-09-10

Quem vê o parque de máquinas.

### O que já existia

`perfil.modulos` libera módulos **por usuário**, marcados no cadastro, e o
middleware redireciona quem digita `/frota` sem ter o módulo. Isso continua
como estava: **esta versão não muda o acesso de ninguém**, só fecha por onde
ele vazava.

### O middleware só barra GET

Server action é `POST` e nunca passou por ele. As doze actions da Frota
conferiam **papel**, e papel não sabe nada de módulo: um operador com a Frota
desmarcada, numa aba aberta antes da mudança, seguia movimentando peça,
lançando certificado e excluindo ordem de reparo.

Uma delas — `excluirReparo` — não lia o perfil de jeito nenhum; a proteção era
só o RPC e o RLS.

Agora todas chamam `exigirModulo`. E uma **varredura** reprova qualquer action
nova de frota que nasça sem a guarda — conferida reintroduzindo o defeito de
propósito, que a fez apontar `frota/actions.ts: moverPeca` pelo nome.

### A janela ao lado da porta

`/relatorios` é módulo próprio. Três relatórios — **Equipamento em conserto**,
**Custo de manutenção** e **Uso do equipamento** — listam identificador de
peça. Quem tivesse Relatórios e não tivesse Frota extraía por PDF exatamente
o que a tela de Frota lhe negava.

Os três passaram a declarar o módulo que exigem, e a trava vale nos **três
caminhos**: a lista da tela, `/api/relatorios/pdf` e `/api/relatorios/excel`.
As duas rotas aceitavam `?tipo=` de quem soubesse montar o endereço.

### Fail-closed, só na Frota

O sistema é fail-open de propósito: um soluço na leitura do perfil não pode
trancar quem está trabalhando. Para um módulo que existe **para ser restrito**,
esse padrão está invertido — "não consegui conferir" não pode significar
"entra", ou a proteção vale até a primeira instabilidade de banco.

`MODULOS_FECHADOS` tem um nome só, e um teste exige que continue curta: cada
entrada ali é um lugar onde uma falha de banco vira gente impedida de
trabalhar.

### O cadastro agrupa, sem acoplar

Os módulos passaram a aparecer agrupados por assunto, com marcar e desmarcar o
grupo num clique. Frota, Itens e Termos ficam juntos em **Equipamento** — são
onde a peça está, o catálogo dela e quem assinou por ela; liberar um sem os
outros deixa o controle pela metade.

**Agrupar não é acoplar.** Cada módulo continua gravado e auditável sozinho.
Fazer o código apagar Termos quando alguém desmarca Frota produziria permissão
que ninguém consegue explicar depois.

### O que isto NÃO protege

As policies do banco **não conhecem módulo** — elas usam organização, papel e
obra. Quem tiver sessão válida e conhecimento técnico ainda consegue ler
`equipamento_unidade` direto pela API.

Contra distração e curiosidade, esta versão protege. Contra má-fé técnica, não.
Foi escolha consciente: descer ao RLS mexeria em policies de várias tabelas, e
fica para quando for necessário.

## [0.100.0] — 2026-09-09

A planilha de coleta volta para dentro do sistema.

`scripts/db/importar-coleta-locacoes.mjs` le a planilha "Coleta de Locacoes"
preenchida e grava contrato, itens locados e o PDF do contrato no bucket
`contratos`. Idempotente: contrato por (organizacao, numero), item por
(contrato, item do catalogo, data de retirada).

**Por que.** `gerar-planilha-coleta.mjs` existe desde a 0.94.0 e produz a
planilha em branco. Faltava o caminho de volta — e sem ele a planilha
preenchida virava digitacao a mao na tela de contrato, uma linha por vez.

**O que ele recusa, e por que recusar e o servico.**
`item_locado.valor_unitario_periodo` e `not null` com DEFAULT 0: celula de valor
vazia nao da erro, grava a locacao custando R$ 0,00 e o relatorio de custo da
obra fecha certo com o numero errado. Retirada no futuro faz constar como nao
entregue um equipamento que esta em campo sendo faturado. Nos dois casos nada e
gravado e o script sai com codigo 1.

A primeira planilha devolvida (contrato 1726, 5I Climatizacao) tinha o segundo
caso: a retirada veio com a data de FIM do contrato nas duas linhas. Nao e
desatencao de quem preencheu — e o que acontece quando a coluna ao lado tem uma
data e a mao desce.

**Deriva de centavos, dita em voz alta.** A 5I cobra o split de 12000 a
R$ 156,667 a unidade e fatura a linha arredondada (2 x 156,667 = R$ 313,33).
`numeric(14,2)` guarda 156,67, e o Loca calcula R$ 313,34. Um centavo por linha,
todo mes. Nao e motivo para recusar; e motivo para o aviso dizer o numero, com a
previa mostrando o total que sera GRAVADO e nao o da fatura.

**Dados carregados.** Contrato 1726 — obra 691 (Racional Garoa), 5I Servicos de
Manutencao, mensal, 13/07/2026 a 01/03/2028: 2 splits de 12000 BTU e 7 de 18000,
R$ 2.038,56 por mes, com o PDF do contrato anexado.

A planilha como recebida fica intacta em `Referencias/Importacao/Daniela-moura/`;
a correcao da retirada mora na copia `(conferida)`. Divergencia em aberto: o
contrato preve fim em 01/03/2028 e a fatura 042.824.002 informa periodo
contratado ate 24/10/2027 — anotado nas observacoes do contrato, para conferir
com o fornecedor.

## [0.99.2] — 2026-09-09

Saber qual versao esta no ar.

`GET /api/versao`, atras do `CRON_SECRET`, devolve `versao`, `commit`
(`VERCEL_GIT_COMMIT_SHA`) e `ambiente`.

**Por que.** Tres investigacoes se perderam hoje na mesma pergunta: "o conserto
nao funciona" era, nas tres vezes, deploy ainda nao propagado. A unica forma de
saber era pedir a alguem que olhasse o rodape da tela — e diagnostico que depende
de outra pessoa olhar nao e diagnostico.

O commit vai junto porque "0.99.1" nao distingue o build que subiu do que ficou
pela metade.

Atras do segredo, como as demais rotas de servico: a versao nao e segredo, mas
rota publica anunciando o que roda e uma linha a menos de trabalho para quem
procura versao vulneravel conhecida.

## [0.99.1] — 2026-09-09

O nome de quem esta com a peca, ao lado do modelo.

### O que estava errado

A 0.98.1 pos o nome na coluna reservada da PONTA DIREITA, e nao ao lado do
modelo. A leitura da linha ficava quebrada: o nome aparecia a meia tela de
distancia do equipamento a que se refere.

### Alterado

- O `flex-1` saiu do modelo e foi para a coluna do detentor. Antes o modelo
  esticava e abria um vazio no meio da linha; agora a folga fica DEPOIS do nome.
  **Nenhuma coluna nova foi criada** — o espaco ja existia, mal distribuido.
- "Com quem esta" e "onde esta" viraram duas colunas FIXAS. Eram a mesma coluna
  alternando conforme o `perfil` da categoria, e foi essa alternancia que fez
  "Todas" e "TI" mostrarem o mesmo conjunto com informacao diferente.
- `perfil` saiu de `frota/page.tsx`: nao havia mais consumidor.

A linha agora le como a pergunta: **patrimonio · modelo · com quem esta ·
onde esta · situacao**.

## [0.99.0] — 2026-09-09

A Frota abre recolhida.

### Alterado

`<details open>` vira `<details open={procurando}>` em `frota/page.tsx`.

- **Recolhido por padrao.** Com 96 notebooks num grupo, a tela abria numa parede
  de linhas e o segundo grupo ficava fora da primeira dobra. O cabecalho ja traz
  a contagem, que e o que se le primeiro.
- **Busca e filtro abrem sozinho.** Recolhido com busca ativa esconderia
  exatamente o que a pessoa procurou — pior que o estado anterior.
- **Categoria NAO conta como busca.** Escolher "TI" no menu e navegar, nao
  procurar: abrir os tres grupos de 128 pecas ali daria a mesma parede.
- O estado aberto vem do **servidor**, entao nao pisca. O `<details>` nativo
  continua funcionando sem JavaScript, no primeiro render e na tela offline.

### Adicionado

Seta no cabecalho do grupo, girando com o `open` via variante arbitraria
`[details[open]_&]:rotate-90`. Sem ela, um cabecalho recolhido parece linha
morta e ninguem descobre que clica.

Conferida no CSS **de producao**, porque o Tailwind descarta variante que nao
parseia em silencio:

```
details[open] .\[details\[open\]_\&\]\:rotate-90{rotate:90deg}
```

## [0.98.1] — 2026-09-09

Tres consertos no mutirao, e a limpeza dos duplicados.

### O que aconteceu em producao

Primeira execucao real: **142 termos emitidos para 95 pecas**, 24 pecas em mais
de um termo (pior caso: quatro), e **zero e-mails enviados** — com a tela
afirmando que as vias foram para a caixa de teste.

A custodia final estava **correta**: 95 posses abertas, nas pessoas certas.

### Defeito 1 — a selecao nao era limpa entre rodadas

`useState` so inicializa na montagem. O `router.refresh()` recarregava as
propostas, mas o mapa de escolhas continuava com as pecas ja emitidas — e o
clique seguinte pegava as **mesmas** 12.

Reemitir nao estoura nada: `abrirCustodia` fecha a posse anterior e abre outra.
Por isso o defeito passou silencioso — so sobraram documentos numerados a mais,
sem ninguem saber qual valia.

Duas barreiras agora: a tela remove do mapa o que foi emitido, e o servidor
recusa peca que ja tenha custodia aberta.

### Defeito 2 — eu descartava o motivo

`emitirTermo` devolve em `aviso` o motivo exato quando a via nao sai. A action so
olhava `ok` e montava a mensagem a partir de `emitidos.length > 0`.

**Emitir um termo nao tem relacao com a via ter saido.** Trata-los como a mesma
coisa produziu uma tela afirmando o que nao sabia — o mesmo defeito que a 0.90.3
consertou no painel de fechamento do recebimento.

`resumoDoMutirao()` em `src/lib/frota.ts`, seis casos por TDD. O que fixa a
regressao: **a frase sobre envio so aparece quando nao houve aviso de envio.**

### Defeito 3 — a coluna nao aparecia em "Todas"

O nome do detentor so era mostrado quando `perfil !== "geral"`, isto e, com uma
categoria selecionada. Em "Todas" o perfil cai em "geral" e a coluna exibia a
obra. Com as 128 pecas em TI, "Todas" e "TI" mostravam o mesmo conjunto com
informacao diferente.

Agora o nome vem primeiro, independente do perfil. Nada se perde no perfil de
obra: ali o `detentor_rotulo` e o proprio rotulo da obra.

### A limpeza

48 termos cancelados, com `motivo_cancelamento` registrado.

**Feita em SQL de proposito, sem passar por `cancelarTermo`.** Aquela action
chama `moverPecasDoTermo(id, "devolucao")`, que devolve as pecas para
`disponivel` e **fecha a custodia** — inclusive a atual, que pertence a outro
termo. Cancelar por ali teria destruido exatamente o que o mutirao acertou nas
24 pecas repetidas.

Recorte, medido antes: manter todo termo referenciado por
`custodia_peca.termo_id` de posse aberta (95); cancelar o resto (48).
`custodia_sem_termo = 0`, entao nada ficou orfao. Conferido depois: 95 posses
abertas, 95 pecas em uso, 95 termos validos, **0 pecas em mais de um termo
valido**.

### Ainda em aberto

**Por que nenhum e-mail saiu.** O modo de teste esta correto — a rota
`/api/dev/emails` disparou 15 e-mails de galeria para a caixa configurada. E
`termo_link` nao tem nenhuma linha de hoje, o que indica que
`enviarViaDoFuncionario` parou antes do ponto onde o link e gerado. Dos 142
termos, 65 sao de funcionarios **sem e-mail nenhum** no cadastro; 76 tinham
e-mail conferido e mesmo assim nao receberam.

O diagnostico agora e de um clique: `reenviarTermo` devolve `envio.motivo`
direto na tela. Basta abrir um dos 95 termos e clicar em reenviar.

## [0.98.0] — 2026-09-09

Regularizar a custódia emitindo os termos.

### O caminho certo, e por que só hoje ficou barato

A 0.97.1 estabeleceu que posse de funcionário nasce do TERMO — o check
`custodia_funcionario_exige_termo` (0059) não é obstáculo a contornar, é a
regra. Então o mutirão emite termos, e a custódia nasce por `moverPecasDoTermo`
com `origem: 'termo'`.

Isso era inviável até esta manhã: regularizar 95 peças exigiria 95 pessoas
assinando na tela. A **0.96.0** tornou a assinatura opcional na emissão — cada
pessoa recebe a via com o link e o sistema cobra a cada 3 dias.

### A trava, que é a decisão mais importante do arquivo

`emitirTermosDoMutirao` **recusa rodar se `EMAIL_MODO_TESTE` estiver
desligado**, no servidor:

```ts
if (!emTeste()) {
  return falha("O modo de teste de e-mail está DESLIGADO. …");
}
```

Emitir 50 termos manda 50 e-mails a 50 pessoas, com link de assinatura e
cobrança a cada 3 dias. O acidente não tem desfazer — e-mail enviado não volta.
A trava fica no servidor porque a tela pode estar velha, e não depende de
alguém ter conferido a variável na Vercel antes de clicar.

### Três decisões de lote

- **Um termo por PESSOA**, não por peça: quem levou três máquinas no mesmo dia
  recebe um documento, não três — e um pedido de assinatura, não três.
- **Doze peças por rodada** (`mutiraoTermosSchema`). Não é limite de digitação:
  cada termo gera um PDF e um e-mail, e cinquenta numa requisição estouraria o
  tempo da função — deixando metade emitida sem ninguém saber quais. A tela diz
  quantas faltam.
- **`obra_id` só quando todas as peças da pessoa estão na mesma obra.** Escolher
  uma das duas poria no documento uma obra que não vale para metade dos itens.

### Detalhes que não são óbvios

- Os dados do termo (`item_id`, `controle`) são lidos do BANCO, não do que o
  cliente mandou: eles decidem se o termo aceita a linha, e confiar no
  formulário deixaria uma requisição forjada montar termo inconsistente.
- `estado_entrega` cai em `bom` quando a peça não tem estado no cadastro. O
  termo exige um valor, e `com_avaria` acusaria dano que ninguém viu.
- O comentário do topo de `mutirao-form.tsx` foi reescrito. Ele dizia "POR QUE
  ESTA TELA NÃO GRAVA", da 0.97.1, e agora ela grava — comentário desatualizado
  é pior que nenhum.

## [0.97.1] — 2026-09-09

A tela de custódia parou de prometer o que não fazia.

### O defeito, e ele era meu

O mutirão da 0.97.0 falhou em produção: 88 confirmações, 88 falhas, com
"Não foi possível registrar a posse da peça" e nenhuma explicação.

Causa-raiz, uma só, encontrada em `pg_constraint` e confirmada em produção:

```
custodia_funcionario_exige_termo  (migration 0059)
CHECK (tipo <> 'funcionario' OR (origem = 'termo' AND termo_id IS NOT NULL))
```

`confirmarMutiraoCustodia` chamava `abrirCustodia` com `tipo: "funcionario"`,
`origem: "manual"` e `termo_id: null`. Viola em toda linha.

**E a invariante está certa.** O motivo está escrito ao lado dela na migration:
*"posse de funcionário só nasce por termo assinado. No BANCO, e não só na tela:
a tela pode estar velha, e o valor do termo é justamente ser a única fonte de
verdade sobre quem respondeu pelo equipamento."* `moverPeca` sempre respeitou —
`custodia.ts` registra que *"funcionario NÃO está entre os destinos"*. O mutirão
era o único fora do padrão.

### Por que os testes não pegaram

Typecheck, lint, 1255 testes e build passaram todos. O tipo `AberturaCustodia`
aceita a combinação — `tipo`, `origem` e `termoId` são campos independentes — e a
recusa só existe no `check` do Postgres. Nenhum teste do projeto exercita
`abrirCustodia` contra um banco real.

### Corrigido

- `confirmarMutiraoCustodia` e `mutiraoCustodiaSchema` **removidos**. No lugar da
  action ficou o comentário explicando por que ela não pode existir.
- A tela vira **conferência**: sem botão que promete gravar, e com o motivo à
  vista. Botão que falha em 100% dos casos é pior que nenhum botão.
- O casamento de nomes (`custodia-mutirao.ts`, 14 casos, 89 de 95 automáticos)
  **fica**: é o trabalho difícil, está conferido, e é o que a emissão dos termos
  vai consumir.

### O teste que teria pegado

`custodia-invariante.test.ts` varre o `src` procurando chamada de
`abrirCustodia` que junte `tipo: "funcionario"` com `origem: "manual"`. Escrito
antes da correção e visto acusando o arquivo certo — `frota/actions.ts` — que é o
que uma varredura tem de fazer para valer algo.

Move a reprovação do banco em produção para o teste antes do deploy. Não
substitui o `check`: o banco continua sendo a última palavra.

## [0.97.0] — 2026-09-09

Com quem está cada máquina.

### A pergunta era "é possível?" e a resposta mudou o trabalho

A coluna era meia hora. O problema é que ela sairia vazia: medido em produção,
**128 peças, 95 em uso, 2 com custódia ativa**. A importação criou as peças já
em uso e nunca criou o vínculo com a pessoa — o próprio `pecasComResponsavel`
registrava isso: *"a tela afirma que a máquina está com alguém e não sabe dizer
com quem"*.

E o nome existia: **95 peças** com `Com: <nome> (conforme planilha)` no texto das
observações. Então o trabalho era o backfill, não a coluna.

### A coluna já existia reservada

`frota/page.tsx` tinha um comentário descrevendo exatamente isto: *"A COLUNA QUE
MUDA DE PERFIL. Em TI e em veículo a pergunta é quem está com a peça; em obra,
onde ela está. Hoje ninguém tem custódia aberta, e a tela diz isso em vez de
fingir."*

Não houve coluna nova, nem mudança de largura — o que a 0.93.0 acabou de
padronizar segue intacto. `pecasComResponsavel` passou de `Set<string>` para
`Map<string, string>` (id → rótulo do detentor): uma consulta responde as duas
perguntas, e a troca não mexeu em nenhum call site, porque todos usavam `.has()`.

### O casamento de nomes, e as duas recusas que custam acerto de propósito

`custodia-mutirao.ts`, 14 casos por TDD. O resultado medido sobre o inventário
real, com a mesma função que roda em produção:

| | Peças |
|---|---|
| Nome idêntico | 20 |
| Nome curto → completo | 69 |
| **Automático** | **89 de 95 (94%)** |
| Ambíguo | 5 |
| Não casou | 1 |

- **`detentorNoTexto` lê só o que vem depois de `Com:`.** Metade das observações
  traz também `usuário anterior <nome>`: uma busca no texto inteiro casaria com
  quem já devolveu o equipamento.
- **Token inteiro, nunca prefixo.** "Lui" não casa com "Luis". Com prefixo,
  "Ana" casaria com meia empresa.
- **Um token só nunca casa**, nem com candidato único. Num cadastro de 509
  pessoas, primeiro nome é identificação fraca — e a contratação da segunda
  "Juliana" tornaria retroativamente errado um vínculo que ninguém revisa. O
  único caso que não casou foi exatamente esse: `Lourival`.

### Escreve pelo escritor compartilhado

`confirmarMutiraoCustodia` grava por `abrirCustodia`
(`src/lib/custodia-servidor.ts`), e não com insert próprio. É o AGENTS.md ao pé
da letra — ele nomeia este arquivo como o caso em que a divergência "aparece
como equipamento que consta com duas pessoas". `origem: "manual"`, porque não há
termo por trás: o mutirão registra o fato; o documento, se vier, vem depois.

**Parcial é resultado válido.** Com 89 peças, "tudo ou nada" faria uma linha
problemática desfazer 88 confirmações certas.

### Um problema de dado que apareceu no caminho

**8 nomes duplicados no cadastro de funcionários, 16 fichas.** O padrão diz a
causa: uma ficha com CPF e sem e-mail, a outra com e-mail e sem CPF — duas
origens (a planilha e a sincronização do People) criando registros separados
para a mesma pessoa. Um dos 5 "ambíguos" era isso, não ambiguidade real.

O mutirão mostra CPF e e-mail ao escolher, para dar para distinguir. **Não
consertei a duplicação** — é outro assunto, afeta a integração do People e o
e-mail do termo (uma pessoa com duas fichas: qual recebe?), e merece decisão
própria.

### Descoberta

O aviso "93 peças em uso sem termo assinado" ganhou um botão **Regularizar**.
Antes a faixa inteira era link para o filtro: mostrava o problema e deixava a
pessoa procurando o conserto. Agora o texto mostra e o botão resolve.

## [0.96.0] — 2026-09-09

Emitir agora, assinar depois.
Spec: `docs/superpowers/specs/2026-09-09-assinatura-pos-emissao-design.md`.

### A trava não estava no formulário

A regra "assina antes de emitir" vivia no BANCO. A migration 0077 tem
`if v_termo.emitido_em is not null` nas **duas** funções de assinatura à
distância — `termo_do_link` (que abre a página) e `assinar_termo_por_link` (que
grava) — e ambas são `security definer` com `revoke all from public`.

Migration 0101 estreita a guarda: `cancelado_em` continua barrando **sempre**;
`emitido_em` passa a barrar só quando a assinatura do funcionário **já existe**.
Termo emitido *e* assinado volta a ser intocável, que é o estado final desejado.

Recusadas: "termo emitido é editável" (abriria caminho para alterar assinatura
já colhida) e um `momento = 'ratificacao'` novo (desnecessário —
`termo_assinatura` já grava `assinado_em` e `assinado_ip` por linha, então a
data em que a assinatura veio depois da emissão já fica registrada).

### A corrida que o recorte abriu, e como foi fechada

A guarda nova é um `exists`: dois links válidos usados ao mesmo tempo passariam
os dois antes de qualquer insert, e o termo ficaria com **duas** assinaturas do
mesmo funcionário — o PDF mostraria duas linhas para uma pessoa. O `for update`
da 0077 protege um link, não dois.

Índice único `(termo_id, momento, papel)` fecha isso por construção. Medido
antes de aplicar: `duplicadas = 0` sobre 4 assinaturas em 2 termos.

### Adicionado

- `deveCobrarAssinatura()` e `INTERVALO_COBRANCA_DIAS = 3` em `src/lib/termo.ts`.
- `/api/cron/termos-sem-assinatura`, diário às 08:40, decidindo **por termo** —
  "a cada 3 dias" é do termo, não do calendário: dois termos emitidos em dias
  diferentes têm ciclos diferentes.
- `termosSemAssinatura()` em `templates.ts`: o resumo para a administração, com
  o MOTIVO na coluna de situação quando a cobrança automática não saiu. É o que
  transforma o resumo de relatório em lista de trabalho.
- Tarja "PENDENTE DE ASSINATURA DO FUNCIONÁRIO" no PDF, só para termo emitido —
  o rascunho sai em branco de propósito, para colher assinatura à caneta.
- Selo "Sem assinatura" na lista, como **segundo** selo e não como situação
  nova: a pendência é ortogonal ao ciclo do termo (um termo em uso, vencido ou
  encerrado pode estar sem assinatura).
- `EMAIL_RESUMO_TERMOS` no `.env.example`.

### O detalhe que quase passou

`assinaturaSchema` **já** aceitava `imagem` nula — o bloqueio era só do cliente.
Removê-lo sem mais nada faria `emitirTermo` gravar uma linha de
`termo_assinatura` com `imagem: null`: o banco passaria a dizer que o
funcionário assinou, e o PDF desenharia a linha dele sobre um traço que não
existe. Agora, sem traço, **a linha não é gravada** — e é a ausência dela que
torna a pendência detectável pela tela, pelo PDF e pela cobrança.

O template do e-mail tinha o mesmo problema: dizia "assinado em {data}" e "não é
preciso responder nem devolver nada", falsos num termo sem assinatura. Anexar um
botão àquela frase produziria um e-mail que se contradiz. O corpo, o assunto e a
nota do anexo mudam quando há pendência.

### Duas varreduras do próprio repositório pegaram coisas

- `admin-client.test.ts` exigiu declarar o cron em `PERMITIDOS` **com motivo**.
  E recusou minha entrada "defensiva" `termo_assinatura`: a lista não aceita
  tabela que ninguém toca, porque não listar já é o que fecha a porta. Assinar é
  ato de pessoa, com conferência de CPF na função de banco, e não de cron.
- `schemas-varredura` pegou o `amarrarPecaSchema` da versão anterior.

### Não alterado, de propósito

A assinatura de **encerramento/devolução** (`termo-devolucao.tsx`) mantém o
bloqueio. É outro momento e outro pedido.

### Medido em produção antes de aplicar

`emitidos_sem_assinatura_func = 0` — nenhum termo emitido hoje está sem a
assinatura do funcionário. O risco que o spec listou ("a tarja muda documento já
emitido") **não se materializa**: não há documento existente que passe a receber
a tarja.

## [0.95.0] — 2026-09-09

De quem é a peça locada.
Spec: `docs/superpowers/specs/2026-09-09-dono-da-peca-locada-design.md`.

### O achado que encolheu o trabalho

A relação peça↔contrato **já existia** e é deliberada (migration 0049):
`item_catalogo.controle` diz se o item é rastreado por patrimônio,
`item_locado.unidade_id` liga a linha do contrato à peça física, e
`contrato_locacao.fornecedor_id` aponta a locadora. A empresa dona é, portanto,
**derivada** — não há campo de fornecedor na peça que possa divergir do
contrato.

Faltava tela, não modelo.

### Adicionado

- `donoDaPeca()` em `src/lib/frota.ts`: cinco estados — `contrato`,
  `contrato-sem-fornecedor`, `provisorio`, `ambiguo`, `nenhum`. O contrato manda
  sobre o provisório, sempre.
- `linhasElegiveis()`: as quatro condições que fazem uma linha de contrato
  receber esta peça (mesmo item de catálogo, em aberto, sem peça vinculada — ou
  já apontando para ela, porque reamarrar não é erro).
- `equipamento_unidade.fornecedor_provisorio_id` (migration 0099), com
  `comment on column` dizendo para não usá-lo em relatório de custo.
- Seção "Locação" na peça, só para `propriedade = 'locada'`, com o formulário de
  amarração.
- `obterDonoDaPeca` e `listarContratosParaAmarrar` em `src/lib/data/custodia.ts`.

### Segurança: uma peça, um contrato em aberto

Migration 0100: índice **único** parcial
`(unidade_id) where unidade_id is not null and status = 'em_aberto'`.

O spec deixou este índice de fora, porque migration que falha ao aplicar é pior
que o defeito que previne e não se sabia se produção já violava a regra. Medido
antes de aplicar: **`linhas_amarradas = 0`, `pecas_em_dois_contratos = 0`** —
nenhuma peça está amarrada a contrato ainda. Este é o momento mais barato que o
índice jamais terá; depois do mutirão das 27 peças locadas, qualquer violação
criada no caminho viraria limpeza antes de poder aplicá-lo.

`donoDaPeca()` mantém o caso `ambiguo` mesmo assim. Ele fica inalcançável por
construção, e é isso que se quer: a tela continua sabendo dizer a verdade se o
dado aparecer por um caminho que ninguém previu — importação, script, ou este
índice sendo removido no futuro.

### Dois desvios do spec, deliberados

1. **Os campos de amarração ficaram em seção própria, não dentro de
   `peca-editar`.** A escrita é outra action e toca outra tabela
   (`item_locado`); enfiá-la no `editarPeca` faria uma action escrever em duas
   tabelas com duas histórias de permissão.
2. **`obterDonoDaPeca` devolve `{ dono, provisorioId }`.** A função pura recebe
   e expõe o NOME, que é o que a tela mostra, mas o formulário precisa do id para
   abrir no valor atual. As alternativas — segunda leitura só para o id, ou fazer
   `donoDaPeca` carregar o id até a tela — eram as duas piores.

### Um defeito meu, pego antes de subir

O passo que solta a peça do contrato anterior usava `erroDeEscrita`, que trata
"zero linhas afetadas" como falha — correto para update dirigido por `id`, e
errado aqui, onde zero é o caso **normal** (peça que nunca foi amarrada). Com
ele, a amarração falharia justamente na primeira vez de cada peça. Trocado por
checagem direta de `error`.

### Testes

11 casos por TDD, vistos falhando antes da implementação. Os que valem citar:

- **duas linhas em aberto dão `ambiguo`, não a primeira** — escolher produziria
  tela plausível e errada;
- **contrato sem fornecedor não vira "nenhum"** — a peça ESTÁ amarrada, e cair
  em travessão mandaria a pessoa procurar no lugar errado;
- **a linha que já aponta para esta peça continua elegível** — sem isso o seletor
  não ofereceria a opção já escolhida.

E a varredura `schemas-varredura` pegou o `amarrarPecaSchema` não declarado,
como deveria.

### Medido em produção

27 peças com `propriedade = 'locada'` — não 128, que é a frota inteira. O
mutirão de amarração é bem menor do que o levantamento inicial sugeria.

## [0.94.0] — 2026-09-09

O protocolo do fornecedor na vistoria.

### Adicionado

- `vistoria_anexo` (migration 0098): documentos da contraparte na vistoria, com
  `tipo` (`protocolo` | `os` | `outro`), `descricao`, `path` e `data`.
  Espelha `contrato_anexo` (0035), que resolveu o mesmo problema no contrato.
- Seção "Protocolos e OS" na tela da vistoria, em qualquer tipo de vistoria.
  Aceita PDF e imagem.
- `TIPO_ANEXO_VISTORIA` e `tipoAnexoValido()` em `src/lib/vistoria.ts` — as
  chaves do mapa são exatamente os valores do `check` da coluna.
- Campo "Empresa locadora" no relatório de vistoria, em linha de largura cheia:
  "SJUSTINO CONSTRUCOES LOCACOES E SERVICOS LTDA" tem 45 caracteres e não cabe
  em 25% de linha. Vem de `contrato_locacao.fornecedor_id` — relação para-um,
  que não muda a cardinalidade do select.

### Três decisões de modelagem

- **Tabela, e não coluna `protocolo_path` na vistoria.** Protocolo e OS são dois
  papéis distintos e chegam separados; com uma coluna, o segundo substituiria o
  primeiro em silêncio.
- **Não reaproveitar `vistoria_foto`.** O relatório em PDF desenha *toda* linha
  de `vistoria_foto` como imagem: um PDF de protocolo ali quebraria a
  renderização, e a falha apareceria só ao gerar o relatório de uma vistoria
  específica.
- **RLS espelhando a forma ATUAL do irmão `vistoria_foto`,** que é a da
  migration 0011 e não a da 0007. Na 0007 o mesmo par de policies foi escrito
  com `current_papel() in ('admin','gestor','operacional')` — nomes de papel que
  a 0011 substituiu por `pode_operar()`. Copiar a 0007 daria uma policy
  referenciando valor de enum extinto.

### Alterado

- `DocumentoVistoria` passa a usar a linha `topo` com `justifyContent:
  space-between`, como o `DocumentoRelatorio` já fazia: marca à direita, texto à
  esquerda com `flex: 1` para que um subtítulo longo quebre na coluna em vez de
  empurrar a marca fora da página.
- Eyebrow: "SISTENGE · LOCAÇÕES DE OBRA" → "SISTENGE · LOCAÇÕES".

### Corrigido

- `excluirVistoria` limpava do Storage apenas os paths de `vistoria_foto`. Fotos
  e anexos dividem a bucket `vistorias`: o protocolo ficava **órfão** — arquivo
  sem dono, ocupando armazenamento e invisível na interface, porque a linha que
  o apontava foi apagada em cascata com a vistoria. Agora as duas consultas
  correm em paralelo e os dois conjuntos de path são removidos juntos.

### Testes

- `tipoAnexoValido` por TDD, quatro casos vistos falhando antes da
  implementação. Ela cai em `outro` em vez de lançar: o arquivo **já** subiu ao
  Storage quando ela roda, e recusar o registro por causa do rótulo deixaria o
  documento órfão.
- `relatorio-vistoria.test.tsx` confere o TEXTO do relatório com `contemTexto`.
  Inclui o caso negativo "não diz mais DE OBRA" — sem ele, a asserção do texto
  novo passaria com o texto velho, porque o antigo **contém** o novo.
- Estes últimos foram escritos depois do código; a lógica pura foi TDD.

### Verificado

Migration aplicada no remoto e conferida por consulta, não por ausência de erro:
`to_regclass` devolve a tabela, `relrowsecurity` é `true`, `pg_policies` conta 2.
Registrada com `migration repair --status applied 0098`. E o PDF foi gerado e
olhado — marca à direita, cabeçalho novo, empresa locadora em linha própria.

## [0.93.0] — 2026-09-09

Toda tela com a largura do seu tipo.

### O levantamento

Oito larguras de container em 67 telas: `md` (448), `2xl` (672), `3xl` (768),
`4xl` (896), `5xl` (1024), `6xl` (1152), `[1536px]` e **sem cap nenhum** (6
telas). Não foi desleixo de uma pessoa — cada um escolheu um cap na hora de
acomodar a tabela do dia, porque não havia regra a seguir.

E a inconsistência não estava espalhada: os 18 formulários em `2xl` já estavam
alinhados. O caos estava **inteiro** nas 20 telas com tabela, distribuídas por
`4xl`, `5xl`, `6xl`, `1536px` e sem cap. O sintoma que se vê é barra horizontal
onde há tela sobrando: `/contratos` em 1152px mostrava barra numa janela de
1920px com ~400px vazios de cada lado, enquanto `/frota`, sem cap, exibia uma
lista mais larga sem barra alguma.

### Adicionado

- Três utilitários em `globals.css`, no mecanismo `@utility` que o projeto já
  usava para `scrollbar-sutil`:

  | Utilitário | Largura | Papel |
  |---|---|---|
  | `pagina-form` | 42rem (672px) | formulário e registro único |
  | `pagina-leitura` | 56rem (896px) | detalhe e texto corrido |
  | `pagina-lista` | 96rem (1536px) | tabela |

  Incluem `margin-inline: auto` de propósito: isto **é** o container da página,
  não um `max-width` que alguém combina com um `mx-auto` e às vezes esquece.
  Mudar a largura de todas as listas passa a ser uma linha, não 20 arquivos.

- `src/lib/largura-de-pagina.test.ts`: varredura sem lista de rotas a manter.
  Exige que toda página declare um papel, que nenhuma volte ao `mx-auto max-w-*`
  cru, e que nenhuma use dois papéis (o caso do retorno antecipado que fica com
  o cap antigo). É o que impede o nono cap.

### Alterado

67 telas: 27 `pagina-lista`, 23 `pagina-form`, 17 `pagina-leitura`.

O mapeamento partiu do cap antigo, mas o **papel manda** onde os dois
divergiam — e divergiam nos dois sentidos:

- quatro telas com tabela estavam em `4xl` (`/usuarios`,
  `/configuracoes/auditoria`, `/imoveis/[id]`, `/treinamento/pendentes`) →
  `pagina-lista`;
- três formulários estavam em `3xl`/`4xl` (`/imoveis/novo`,
  `/frota/reparos/nova`, `/imoveis/[id]/editar`, `/termos/novo`) →
  `pagina-form`.

Deixar essas sete como estavam manteria exatamente o defeito que a regra existe
para resolver: duas telas do mesmo tipo com larguras diferentes.

### O que isto NÃO faz

A barra horizontal **continua aparecendo em janela estreita**, por decisão
explícita: `ui/table.tsx` segue com `whitespace-nowrap` em toda célula, e
"SJUSTINO CONSTRUCOES LOCACOES E SERVICOS LTDA" ocupa ~330px numa linha só. O
que o `max-width` garante é que a página nunca fica mais larga que a janela e
que a rolagem acontece **dentro do card** (`overflow-x-auto` do primitivo), sem
empurrar menu, cabeçalho ou busca para fora. Degradação elegante, não ausência
de barra. Liberar a quebra nas colunas de texto longo é o próximo passo, se e
quando incomodar.

### Verificado

Os três utilitários conferidos no CSS **de produção** — o Tailwind v4 descarta
declaração inválida em silêncio, e uma `@utility` que não compilasse tiraria a
largura de todas as 67 telas sem erro nenhum:

```
.pagina-form{max-width:42rem;margin-inline:auto}
.pagina-leitura{max-width:56rem;margin-inline:auto}
.pagina-lista{max-width:96rem;margin-inline:auto}
```

## [0.92.0] — 2026-09-09

Editar o item locado.

### O que faltava

A linha de `item_locado` tinha adicionar, devolver e excluir — não tinha editar.
Corrigir um valor por período digitado errado, ou preencher o número de série
que faltou, significava excluir a linha e cadastrar de novo, perdendo o
`created_at` e a trilha de auditoria daquele registro.

### Adicionado

- `EditarItemLocadoForm`: os mesmos sete campos do cadastro, pré-preenchidos, em
  **diálogo**. Não formulário na linha — a linha já carrega o form de "Devolver"
  com `min-w-[300px]`, e a tabela só passou a caber sem barra horizontal na
  0.90.3; um segundo form embutido reabriria a barra que acabou de ser fechada.
  O botão de lápis divide a célula com a lixeira pelo mesmo motivo: uma 11ª
  coluna custaria ~40px.
- `editarItemLocado` em `contratos/actions.ts`, no molde das vizinhas
  (`podeOperar`, `ActionResult`, `revalidatePath`).
- `itemLocadoEdicaoSchema`, `efeitoDaEdicao` e `podeTrocarItem` em
  `src/lib/locacao.ts` — o schema fora do `actions.ts` porque arquivo
  `"use server"` não pode ser importado por componente cliente.
- `item_id` e `frente_id` em `ItemLocadoCalculado`, para pré-preencher os dois
  `<select>`. Escalares da própria linha: não mudam a cardinalidade do select.

### O defeito que não nasceu

`efeitoDaEdicao` recalcula `status` e `data_devolucao` a partir do novo saldo, em
vez de gravar só os campos do formulário. O `status` do item é escrito num único
lugar — quando uma devolução zera o saldo, em `registrarDevolucao` — e nunca
reavaliado depois. Subir a quantidade de 1 para 2 num item marcado "devolvido" o
deixaria **devolvido com saldo 1**: devolvido e em uso ao mesmo tempo, com o
custo estimado correndo. É a contradição da 0.78.0 em outra tela, e ela voltaria
por esta porta.

Descer a quantidade abaixo do já devolvido é **recusado**, com o mínimo na
mensagem, em vez de aparado em silêncio: aparar esconderia do usuário que o
número digitado não é o que ficou gravado, num campo que multiplica o custo.

### Decisões de escopo

- **`data_retirada` é editável, com aviso.** Ela alimenta o cálculo de custo e é
  carimbada pelo fechamento do recebimento — mas corrigir data digitada errada é
  caso real, e sem isso só se resolve excluindo a linha. O aviso aparece apenas
  quando o campo muda de fato.
- **`item_id` é editável só sem devolução.** Escolher o equipamento errado no
  combo é o erro mais comum do cadastro; mas a devolução gravou `movimentacao` e
  uma `vistoria` fotográfica, e trocar o item depois faria aquelas fotos se
  referirem a outra coisa.
- **Auditoria sem código novo:** o trigger `trg_audit` da migration 0031 já
  cobre `item_locado`.

### Testes

`efeitoDaEdicao` e `podeTrocarItem` foram escritas por TDD — oito testes vistos
falhando antes da implementação, incluindo o caso de comparação numérica (`"10"
< "9"` em ordem alfabética aceitaria quantidade 9 com 10 devolvidos). Os três
testes de `itemLocadoEdicaoSchema` foram escritos DEPOIS do schema, para provar
que a intersecção `.and()` não engole o `.refine()` do schema base — o risco não
se confirmou, e agora está guardado.

## [0.91.0] — 2026-09-09

A marca em todo documento.

### O levantamento

Varredura dos quatro primitivos de documento do app — `Documento` (pdf-form,
que serve os doze formulários e termos), `DocumentoTexto`, `DocumentoRelatorio`
e `DocumentoVistoria`. Só o último não desenhava a marca, e é dos que mais saem
da empresa: o relatório de vistoria vira anexo de contrato e prova de estado do
equipamento. `inspecionar.tsx` e `registro.tsx` aparecem sem logo na varredura e
está correto — um lê texto para teste, o outro é um mapa de tipo para
componente.

### Adicionado

- `LogoSistenge` em `DocumentoVistoria`, na mesma disposição do `DocumentoTexto`
  (marca acima do eyebrow, 110pt), para que os dois cheguem iguais na mão de
  quem recebe. 110pt está acima do mínimo de 85pt (= 3cm, exigência do manual).
- `temLogo()` em `src/lib/documentos/inspecionar.tsx` e o teste-guarda
  `logo-em-todo-documento.test.tsx`. Casa por nome de componente, não por
  identidade de referência: `inspecionar` é utilitário de leitura e não deve
  puxar `pdf-logo`, que arrasta as primitivas SVG do renderer. Desce nos filhos
  sempre, e não apenas no retorno da execução do componente — primitiva do
  @react-pdf que lança fora do renderer cairia no ramo de props, que ignora
  `children`, e a marca dentro de um `<Page>` ficaria invisível.
- `MARCA_PRETO = "#000000"` em `brand-colors.ts`.

### Corrigido

- O wordmark do logotipo passa de `SLATE_900` (#0F172A, azulado) para
  `MARCA_PRETO`. A página "Cores" do Manual de Identidade Visual 2026 especifica
  a paleta em três valores — #BE3A31, #000000 e #FFFFFF — e a página "Usos
  incorretos" lista "foram usadas cores não institucionais" entre as
  reprovações.

### A divergência que fica registrada

O `Versão Fundo Claro.svg` oficial desenha o ícone em **#cf2927** e o wordmark
em **#1c1c1c**; o manual especifica **#BE3A31** e **#000000**. Quando o arquivo
e o manual divergem, o manual manda — ele é a especificação, o SVG é uma
exportação. Está anotado no topo de `pdf-logo.tsx` porque a divergência convida
ao conserto errado: quem abrir o SVG ao lado do código vai achar que a cor está
errada no código e "corrigir" a marca para um vermelho que não é o da empresa.

### Não alterado, de propósito

- `MARCA_VERMELHO` (#BE3A31) já estava correto conforme o manual.
- `LOGO_LARGURA_MINIMA = 85` (pt) já equivale aos 3 cm exigidos para impressão.

## [0.90.3] — 2026-09-09

O aviso de fechamento não promete mais o que não vai acontecer.

### O defeito

A trava de teste de e-mail (`EMAIL_MODO_TESTE`) vive no transporte, em
`enviarEmail`, justamente porque é o único ponto por onde todo envio passa. O
efeito colateral é que a TELA não sabia dela: `fechar-recebimento.tsx` anunciava
"um e-mail com o romaneio em PDF sai para <fornecedor>" enquanto o envio ia para
a caixa de teste. Um aviso de ação irreversível que descreve errado a
consequência é pior que nenhum aviso — a pessoa confirma contando com um efeito
que não vai existir. Pior no estado `bloqueado` (trava ligada sem
`EMAIL_TESTE_DESTINO`): ali o envio *lança*, o fornecedor não recebe nada, e o
painel prometia o e-mail do mesmo jeito.

### Adicionado

- `avisoEnvio(destinatarios, estado)` em `src/lib/emails/modo-teste.ts`: função
  pura que devolve o que a tela deve dizer sobre o destino, nos quatro estados
  (`sem-destinatario`, `normal`, `teste`, `bloqueado`). `sem-destinatario` vem
  antes de `bloqueado` de propósito: sem endereço o call site nem chama
  `enviarEmail`, então nada falha e nada sai.

### Corrigido

- Os painéis de fechamento de **recebimento** e de **devolução** passam a
  receber `avisoEmail: AvisoEnvio` do servidor, em vez do endereço do
  fornecedor, e dizem o destino real. A devolução tinha a frase e o defeito
  idênticos; consertar só um dos dois deixaria o outro mentindo.
- `src/app/(app)/contratos/[id]/page.tsx` sai de `max-w-5xl` (1024 px) para
  `max-w-[1536px]`. A tabela de itens locados tem 10 colunas, todo `TableCell` é
  `whitespace-nowrap` e a célula "Devolver" carrega um formulário com
  `min-w-[300px]` — o conjunto pede ~1420 px, medidos na própria barra de
  rolagem (975 px visíveis, polegar de 668 px). `max-w-7xl` não resolveria:
  faltariam ~190 px. Tailwind v4 não tem `max-w-screen-2xl`, daí o literal.

### Sabido, não consertado

- `avisarFornecedor` engole o motivo específico da trava: o `catch` troca
  "EMAIL_MODO_TESTE está ligado, mas EMAIL_TESTE_DESTINO não tem nenhum
  endereço válido" por um genérico "O envio do e-mail falhou.". O painel agora
  avisa antes, mas o diagnóstico depois do fato continua cego.

## [0.90.2] — 2026-09-07

O e-mail deduzido que bloqueava o dono verdadeiro.

```
duplicate key value violates unique constraint "idx_funcionario_email"
```

**Não era duplicata dentro do People** — lá os 194 e-mails são todos distintos,
medido. Era um endereço **deduzido** de `nome.sobrenome@sistenge.com`, gravado
no Loca antes da integração, sentado numa linha ainda não conciliada — enquanto
o People mandava aquele mesmo endereço para o cadastro de quem ele realmente é.
Duas linhas, as duas em cadastros sem vínculo.

O People é a fonte da verdade de pessoa. Se ele diz que um endereço é da pessoa
P, nenhuma outra linha daqui pode segurá-lo: **e-mail corporativo não é
compartilhado**. A chave é liberada de quem a segura, e o dono recebe a dele na
mesma rodada.

**Libera a chave, não apaga a linha.** Quem perde o e-mail continua existindo,
com nome, obra e histórico de equipamento. O que perde é um palpite que
pertencia a outro — e mantê-lo faria o termo de responsabilidade de uma pessoa
chegar na caixa de outra, que é exatamente o incidente que `email_confirmado`
existe para evitar.

A liberação roda **antes** do upsert e sobre o lote inteiro, nunca por fatia:
liberar dentro do laço deixaria a fatia seguinte esbarrando numa chave que a
anterior ainda não soltou.

### Uma observação sobre os lotes

As fatias de 200 **não são atômicas entre si**: nesta falha, o lote 1 gravou e o
lote 2 abortou, deixando 200 das 483 no banco. Não houve estrago porque toda
escrita é `upsert` e o cursor **não avança** quando a rodada falha — a próxima
tentativa refaz tudo e converge. É o mesmo desenho que segurou os dois defeitos
da 0.90.1.

## [0.90.1] — 2026-09-07

A primeira sincronização de verdade — e os dois defeitos que só ela achou.

### 1. O índice que o `ON CONFLICT` não enxergava

```
Falha ao gravar o lote 1: there is no unique or exclusion constraint
matching the ON CONFLICT specification
```

A 0094 criou `idx_funcionario_people` **parcial**, `where people_id is not
null`. O `ON CONFLICT (org_id, people_id)` do upsert não consegue inferir um
índice parcial — para usá-lo, o comando teria de repetir o mesmo predicado, e o
PostgREST não emite `WHERE` nenhum.

**O raciocinio que levou ao parcial estava errado.** O comentário justificava
“parcial porque as 118 linhas de hoje ficam com `people_id` nulo”. Não
precisava: no Postgres dois `NULL` nunca são iguais entre si num índice único, e
um índice **completo** já aceita quantas linhas sem vínculo existirem.

### 2. Cinco cadastros duplicados, um CPF só

```
duplicate key value violates unique constraint "idx_funcionario_cpf"
```

Cinco pessoas têm dois cadastros no People, por um bug de import da ADP: dois
`people_id` para o mesmo ser humano e, portanto, o **mesmo CPF**.

`semRepetidas` não pegava isso — lá as duas linhas têm a mesma chave e uma
vence. Aqui são duas pessoas legítimas do ponto de vista do People, e **as duas
têm de entrar**: é por uma delas que alguém pode estar com equipamento.

O que não pode entrar duas vezes é o CPF. Então **apaga o valor, nunca a
linha** — dado repetido e recuperável, que volta sozinho quando o People
mesclar os dois. Fica com o cadastro **atualizado mais recentemente**, e empate
resolve por `id`, para a rodada de amanhã decidir igual à de hoje.

O e-mail entra na mesma guarda por ser o outro índice único da tabela. Hoje não
há nenhum repetido; a guarda existe porque uma mescla mal feita produziria
exatamente isso, e o sintoma seria de novo o lote inteiro morrendo.

### O desenho segurou

Nas duas falhas: `gravadas: 0`, cursor **não avançou**, rodada `ok: false`. Nada
foi gravado pela metade, e a janela inteira é tentada de novo — que era
exatamente o desenhado.

### Migrations

- `0097_indice_people_nao_parcial.sql` — refaz o índice completo e aborta se
  alguém o recriar parcial.

## [0.90.0] — 2026-09-07

Equipamento com quem já saiu da empresa — **fase 3**.

### A pergunta que o sistema não sabia fazer

211 dos 483 do recorte são desligados de 2026, e eles entram **porque podem
estar com equipamento na mão**. Até agora o Loca não tinha como perguntar
isso: o cadastro guardava um `ativo` booleano, e ali afastado e desligado eram
a mesma coisa.

Com `situacao_people` crua, viram coisas diferentes — e a distinção é a que
mais importa para quem cobra devolução. **Afastado não entra no aviso:** quem
está de licença volta, e continua respondendo pelo notebook que levou para casa.

A faixa vem **antes** das outras pendências da Frota, de propósito. É a única
com prazo do mundo real: as outras esperam, esta piora a cada dia, porque o
vínculo que permitiria cobrar acabou.

### Quando alguém desaparece do People

Cinco pessoas têm hoje dois cadastros no People, por um bug de import. Quando
forem mescladas, o `people_id` descartado **deixa de existir**.

Do nosso lado o estrago é silencioso e de outro tipo: a linha vinculada
simplesmente **para de ser atualizada**. Nada quebra, nada avisa — ela só
envelhece, com o cargo de antigamente e a obra de antigamente, enquanto alguém
segue com o notebook.

**O delta não consegue ver isso.** `?desde=` traz só quem mudou; ausência não é
mudança, e quem sumiu nunca mais aparece em resposta nenhuma. Por isso uma vez
por semana a rodada é **completa**, e só ela pode marcar ausência — vinda de um
delta, uma resposta vazia (o caso normal de um dia sem novidade) acusaria a base
inteira.

**Marca, não apaga.** A causa provável é o merge; mas pode ser alguém que saiu
do recorte de 2026. Apagar o vínculo levaria junto o histórico de equipamento
de uma pessoa que talvez ainda esteja com ele — e essa é decisão de gente, não
de cron. Quem volta a aparecer tem a marca limpa sozinha.

A varredura completa só conta como feita quando **dá certo**: marcar uma que
falhou empurraria a próxima por mais uma semana, e a ausência ficaria invisível
justamente depois de um problema.

### Migrations

- `0096_ausente_no_people.sql` — `funcionario.ausente_no_people_em` com índice
  parcial, e `people_sync.ultima_varredura_completa`.

## [0.89.0] — 2026-09-07

Conciliar os funcionários com o Sistenge People — **fase 2**.

### A ordem importa, e é contraintuitiva

**Conciliar vem ANTES de ligar a sincronização.** As 118 linhas de hoje têm
`people_id` nulo, e o `upsert` casa por `people_id`: sincronizar antes criaria
uma linha nova para cada pessoa que já está cadastrada, e as duas apareceriam
lado a lado na hora de emitir um termo.

Vinculada, a linha é **encontrada** pelo upsert e atualizada. Por isso o vínculo
grava só o `people_id` — nome completo, CPF, cargo e obra chegam sozinhos na
primeira sincronização.

A tela de Funcionários agora diz quantos faltam, e o botão de conciliar vem
antes do de sincronizar.

### O cruzamento por subsequência

Os nomes do Loca estão abreviados (“Evandro Ferreira”) contra o nome completo do
People (“Evandro Esteves Ferreira”), e a tabela não tem CPF nem matrícula para
comparar.

O documento do People mediu o cruzamento por **primeiro + último nome**: 75
inequívocos, 6 ambíguos, 36 sem candidato, 1 de uma palavra só. Aquela regra
quebra no nome do meio — “Andre Piva” virava a chave “andre correa” contra
“Andre Piva Correa” e não casava.

Aqui a comparação é por **subsequência na ordem**: “andre piva” cabe dentro de
“andre piva correa”. Partículas (`de`, `da`, `dos`) saem, porque “João da Silva”
e “João Silva” são a mesma pessoa. A **ordem é respeitada**: “Silva Joao” não
casa com “Joao Silva”, porque nome invertido é outro registro, não um apelido.

### O que sai do automático

- **Ambíguos** — dois ou mais candidatos. A tela mostra todos, com situação,
  cargo e matrícula, que é o que desempata.
- **Nome de uma palavra** (“Lourival”) — mesmo casando com um único cadastro,
  um primeiro nome sozinho não identifica ninguém numa base de 483.
- **Duas linhas do Loca apontando para a MESMA pessoa** — o documento avisa de
  três pares duplicados. Vincular as duas criaria dois vínculos para uma pessoa
  só; uma delas é duplicata e precisa ser resolvida antes.

Para linha que nunca foi pessoa — há uma “Adm Obra” —, há **“Não é pessoa —
desativar”**. `funcionario` não tem `deleted_at` de propósito, porque o vínculo
com os termos antigos precisa sobreviver; desativar é reversível pela edição.

### O lote é calculado no servidor

A tela mostra os pares que vão ser criados, mas **não é ela que os manda**.
Aceitar uma lista vinda do cliente deixaria qualquer um enviar os vínculos que
quisesse — e vínculo errado gruda o histórico de equipamento de uma pessoa no
cadastro de outra. O servidor recalcula antes de gravar.

Os vínculos são gravados **um a um**, e não em lote: se um esbarrar no índice
único, os outros ainda valem.

### Sem tabela de apoio

As 483 pessoas são lidas ao vivo, em cinco páginas. Esta tela é usada um punhado
de vezes na vida do sistema — uma tabela de staging seria estrutura permanente
para um trabalho que acaba.

### O de-para de obra saiu de graça

Medido contra a API real, com as 483 pessoas em mãos: **os códigos são os
mesmos**. O People manda o código do centro de resultado e a obra do Loca já usa
exatamente esse número — com o mesmo nome nas sete.

O documento do People listava o **800** entre os administrativos “sem obra
correspondente”. Tem sim: a obra 800 “Administração” existe no Loca e é onde
estão os notebooks da sede. Sem ela, 17 pessoas iriam para o nulo à toa.

**422 das 483 (87%)** chegam com obra. Ficam nulas 61: Elea (685, 697), Equinix
SP6 (702), os administrativos 801 a 807 e 5 sem centro de resultado. A obra 695
do Loca não tem CR no People e segue sem código.

### Verificado contra a API de verdade

As **483 pessoas passaram no schema**, sem uma exceção. Cobertura real:
`matricula` e `admissao` 483/483, `cargo` 478, `cpf` 461 (o documento previa
442), `telefone` 437, `email` **194** — os 40% documentados.

O cruzamento por subsequência rendeu mais que o previsto: **82 automáticas**
contra as 75 estimadas, e o trabalho manual caiu de 43 para **36** — 6 ambíguas,
23 sem candidato, 1 de uma palavra e 6 pares apontando para a mesma pessoa.

### Migrations

- `0095_de_para_de_obra.sql` — as sete obras ganham `codigo_people`.

## [0.88.0] — 2026-09-07

A base de pessoas passa a vir do Sistenge People — **fase 1: o consumidor**.

Spec: `docs/superpowers/specs/2026-09-07-integracao-people-design.md`. O
contrato da API é do People e fica **fora do git**, porque traz nomes de
pessoas reais.

### Por que

`funcionario` tem 118 linhas digitadas à mão, com **zero CPF, zero matrícula e
zero CNH**. O People é a fonte da verdade de pessoa na Sistenge, e tem 483 no
recorte acordado: 265 ativos, 8 afastados e 210 desligados de 2026.

Desligado entra porque **pode estar com equipamento na mão** — e hoje o Loca
não tem como fazer essa pergunta.

### As três decisões

**A chave é `people_id`, nunca CPF nem matrícula.** No People, 23 pessoas não
têm CPF e 5 carregam matrícula gerada por bug de import. Chave que falta em 28
linhas não é chave. O índice único é **por organização**, e não global.

**A obra vem por de-para explícito.** Coluna `codigo_people` em `obra`, 8
linhas, preenchida por quem conhece as obras. Sem correspondência, `obra_id`
fica **nulo** — chutar por semelhança de nome colocaria equipamento na obra
errada, e o erro só apareceria numa cobrança.

**Diária às 7h30, mais um botão.** Meia hora antes do cron de vencimentos, para
os alertas das 8h saírem com a base fresca. O botão existe porque contratar de
manhã e entregar o notebook à tarde é caso real.

### A CNH é do Loca, e a sincronização nunca a toca

O People **não guarda CNH** — não existe coluna para categoria nem validade em
tabela nenhuma lá. As três colunas da 0086 são o único dado de pessoa que
continua sendo do Loca.

É a regra mais fácil de quebrar por descuido: um `upsert` montado a partir da
pessoa inteira zeraria as três em silêncio, e ninguém ligaria uma coisa à outra
quando, meses depois, perguntassem quem pode dirigir o caminhão.

Duas travas: o tipo da linha é **fechado** (o TypeScript recusa) e uma varredura
reprova qualquer menção às três colunas em código da integração. A varredura foi
conferida **reintroduzindo o defeito de propósito** — ela reprovou.

### O e-mail do People manda, inclusive quando é nulo

Só **194 das 483** têm e-mail corporativo. O Loca tem 97 endereços **deduzidos**
de `nome.sobrenome@sistenge.com`, todos com `email_confirmado = false` —
palpites que ninguém conferiu. Palpite não confirmado perde para o silêncio de
quem é fonte da verdade.

Isso **não bloqueia termo nenhum**: a assinatura na tela sempre foi o caminho
padrão do wizard e não depende de e-mail. O e-mail é o atalho para quem está
longe.

### Afastado não é desligado

A situação vai crua em `situacao_people` **e** mapeada em `ativo`. Colapsar os
três num booleano perderia a distinção que mais importa para quem está com
equipamento: de quem se cobra a devolução hoje. Afastado volta; desligado não.

### O que a rede entrega é `unknown` até alguém olhar

O contrato está fechado, mas um deploy do People com campo renomeado escreveria
`undefined` em 483 linhas — e o estrago só apareceria com o nome de quem recebe
o termo em branco. A resposta é validada em zod e a rodada morre inteira em vez
de gravar meia verdade.

**O cursor só avança se tudo gravou.** Salvá-lo antes deixaria a janela para trás
em definitivo: a rodada seguinte pediria só o que mudou depois dela, e ninguém
jamais saberia que faltaram pessoas. Falhar e repetir a janela é barato;
perdê-la é silencioso.

Idempotência: o People falha deliberadamente para o lado de **repetir**, nunca
de perder, e a mesma pessoa pode chegar duas vezes. Toda escrita é `upsert`, e
as repetidas do mesmo lote são reduzidas antes — senão o Postgres recusaria o
comando inteiro com *“ON CONFLICT DO UPDATE command cannot affect row a second
time”*.

### Onde mora a configuração

Mesmo desenho dos quatro crons que já existiam: **tabela por organização,
segredo no ambiente**. `PEOPLE_API_URL` e `PEOPLE_API_TOKEN` no ambiente; o
token nunca entra no banco nem na query string. **Sem linha em `people_sync`,
não há sincronização** — fail-closed.

O escritor recebe o `supabase` de quem chama: o cron passa o client admin (roda
sem sessão), e o botão passa o do usuário, que atravessa as policies. A
varredura de client admin pegou a rota nova e a exceção foi declarada nomeando
**só `people_sync`** — se alguém escrever `funcionario` direto lá, ela reclama.

### Migrations

- `0094_integracao_people.sql` — `people_id`, `situacao_people` e
  `sincronizado_em` em `funcionario`; `codigo_people` em `obra`; a tabela
  `people_sync` com RLS. Aborta se as três colunas de CNH tiverem sumido.

### O que ainda não está pronto

**Fase 2 — conciliar as 118 linhas de hoje.** O cruzamento por nome casa 75 de
forma inequívoca; **43 (36%) precisam de decisão humana**, entre elas 6 ambíguas
e 36 sem nenhum candidato. Os nomes do Loca estão abreviados contra o nome
completo do People, e a heurística quebra no nome do meio. Não é automatizável,
e não deve fingir que é.

**Fase 3 — a limpeza**, depois da 2.

Os endpoints do People ainda não respondem. O consumidor foi escrito contra o
contrato e verificado com fixtures copiadas dele.

## [0.87.0] — 2026-09-07

O termo que nasce na peça já sabe qual é a peça.

### O que estava errado

Abrir a peça `13RK564`, clicar em **“Registrar quem está com ela”**, preencher o
passo 1 — e o passo 2 pedir para **escolher o equipamento de novo**, começando de
uma lista vazia com um botão “Acrescentar item”.

A escolha já tinha sido feita, dois cliques antes, num botão que estampa o
patrimônio. Perguntar de novo é pedir a mesma resposta duas vezes.

O motivo era simples: o botão em `frota/[id]/page.tsx` apontava para
`/termos/novo` **sem parâmetro nenhum**, e `termos/novo/page.tsx` não lia
`searchParams`. A peça se perdia na porta.

### O que passa a acontecer

`?peca=` leva a escolha junto. O passo 2 chega com a linha montada — item,
patrimônio e quantidade — restando o estado de entrega. A **obra da peça**
também vem preenchida no passo 1, pelo mesmo motivo: é o mesmo conhecimento
vindo do mesmo clique.

Mesmo desenho do `?avaria=` da abertura de ordem de reparo, que já existia no
projeto.

### Linha normal, não linha travada

A peça pré-selecionada entra como **linha comum**, editável e removível. Termo
com duas peças para a mesma pessoa é caso corriqueiro — o notebook e o celular
saem juntos — e uma linha imutável obrigaria a um segundo modo do wizard só
para atender isso.

### A conferência que não é opcional

O parâmetro vem da URL, e URL é digitável, editável e compartilhável. Aceitá-lo
sem conferir permitiria montar um termo sobre peça que **já está com outra
pessoa** — dois documentos assinados sobre o mesmo patrimônio, que é exatamente
o que a lista de livres existe para impedir.

`resolverPecaPedida` procura o id **dentro da lista de livres** e nada além
disso. Cinco testes a prendem, entre eles o que recusa id que não está na lista
e o que impede confundir `id` com `identificador` — um `find` pelo patrimônio
aceitaria `13RK564` na URL, e patrimônio se repete entre organizações.

Quando a peça pedida não está mais livre — alguém emitiu um termo para ela entre
o clique e o carregamento — a tela **diz isso**, em vez de abrir vazia e deixar
a pessoa procurar no passo 2 uma peça que não está lá.

A obra só é pré-selecionada quando existe no seletor: a leitura da peça é livre
na organização, mas a lista de obras respeita o escopo de quem está olhando, e
um `value` sem `<option>` correspondente perderia a obra em silêncio.

## [0.86.1] — 2026-09-07

O seletor de item do termo estava vazio.

### O defeito

A consulta de itens do termo filtrava por `deleted_at`. **`item_catalogo` não
tem essa coluna.**

O PostgREST recusa a consulta inteira quando ela cita coluna inexistente, `data`
volta `null`, e o `?? []` do call site transforma o erro numa lista vazia. **Nada
aparece na tela, e nada aparece no log.** Com 27 itens ativos no banco, o
seletor mostrava só “Selecione o item…”.

É a explicação de um número que eu vinha citando o dia inteiro sem entender:
**zero termos emitidos**. Não era falta de uso — o fluxo não tinha como chegar ao
fim.

O mesmo filtro impossível estava em **duas consultas da tela de Estoque**. Não
era um deslize isolado: era um padrão copiado de tabelas que têm `deleted_at`
para uma que não tem. Exclusão de item aqui é `ativo = false`.

### O catálogo vazio ganhou saída

Quando não há item nenhum, a tela dizia “Acrescente o que está saindo com o
funcionário” — e o botão abria um seletor sem nenhuma opção. A pessoa descobria
o beco **depois de entrar nele**.

Agora o beco é dito antes, com a saída junto: *“Não há nenhum item no catálogo
(…) o item é o modelo, e as peças pendem dele.* **Cadastre aqui.**” E o botão
**Acrescentar item** fica desabilitado, porque só produzia a linha impossível.

### A regra do termo virou fonte única

`podeReceberTermo` e `ehRegularizacao` moram agora em `src/lib/custodia.ts`, com
8 testes. Nasceram duplicadas na 0.85.0 — a tela da peça comparava
`situacao` com `atual === null`, a de novo termo consultava um `Set` — e é a
mesma pergunta. Duas escritas divergem na primeira correção, e a divergência
aqui apareceria como um botão que leva a uma lista onde a peça não está.

Foi o **segundo** caso de regra duplicada no mesmo dia, depois do de
`precisaConferencia`.

### A varredura que pega a próxima

O TypeScript não vê nada disso: o projeto não gera os tipos do Supabase. Então
virou teste, em `colunas-inexistentes.test.ts`, **sem lista a manter** — as
tabelas que têm `deleted_at` são lidas das próprias migrations. Tabela nova com
a coluna passa a valer sozinha; consulta nova numa tabela sem ela reprova.

**Duas vezes a guarda estava errada, e as duas apareceram por eu insistir em
prová-la:**

1. Ela reprovou o arquivo que ela mesma tinha consertado — o comentário lá diz
   literalmente `SEM .is("deleted_at", null)` para explicar o que não fazer, e a
   varredura leu o aviso como se fosse a consulta.
2. Ao apagar os comentários eu deixava a linha em branco — e o recorte de cada
   consulta para justamente em linha em branco. Um comentário entre `.select()`
   e `.is()` partia a cadeia ao meio, e o filtro ficava fora do trecho
   examinado. **Descoberto reintroduzindo o defeito de propósito para ver a
   guarda reprovar: ela passou.**

Corrigido tirando a linha em vez de esvaziá-la. Com o defeito plantado ela
reprova; sem ele, passa.

### Sem migration

Nenhuma. A coluna não precisa existir — a consulta é que não devia citá-la.

## [0.85.0] — 2026-09-07

As 95 máquinas destravadas, e o botão Editar que nunca funcionou.

### O impasse

A pergunta foi “onde eu cadastro a pessoa que está com o equipamento?”. A
resposta era: **em lugar nenhum**.

| Caminho | Por que fechava |
|---|---|
| Emitir termo | a peça precisa estar *Disponível* — e ela consta *Em uso* |
| Marcar como *Disponível* | a matriz de transição exige um **evento**: devolução registrada num termo |
| E o termo… | exige que ela esteja disponível |

A importação do inventário marcou `em_uso` a partir da planilha **sem criar
termo**. E `em_uso` é um estado que a matriz só admite alcançar *pelo* termo, e
do qual só se sai por devolução *num* termo. As 95 ficaram presas dizendo “Sem
registro de posse”, sem lugar onde registrá-la.

### A correção

A guarda certa nunca foi a **situação**, e sim a **posse**: peça sem custódia
aberta não está com ninguém, diga a coluna o que disser.

- `/termos/novo` passa a listar peça *disponível* **ou** *em uso sem posse
  aberta*. A proteção original — não produzir dois termos assinados sobre o
  mesmo patrimônio — continua, e ficou mais precisa.
- A tela da peça oferece **“Registrar quem está com ela”** nesse caso, com rótulo
  próprio: não é uma entrega nova, é regularizar o que a planilha já dizia.
- Se a consulta de custódia falhar, a lista sai **vazia** em vez de oferecer
  tudo — errar para o lado de oferecer produziria termo duplicado.

**Efeito medido:** 128 peças passam a poder receber termo (33 disponíveis + 95
presas), e nenhuma com posse aberta entra na lista.

### O botão Editar

Não fazia nada, e **nunca fez**. Ele nasceu em 03/09 de um relato do próprio
Evandro — *“quem chega ao topo conclui que a peça não é editável”* — como
`<Link href="#cadastro">` do Next.

O docs do Next (`node_modules/next/dist/docs`, que o `AGENTS.md` manda ler)
explica: *“Next.js will scroll to the Page if it is not visible in the viewport
upon navigation”*. A rolagem do roteador compete com a da âncora, e **todos** os
exemplos do próprio docs usam caminho + hash (`/dashboard#settings`), nunca hash
sozinho. Era a única âncora do app inteiro — o padrão nunca tinha sido provado.

Agora é `<a href="#cadastro">` puro: o navegador resolve, e o `scroll-mt-6` no
cartão de destino cuida do deslocamento.

### Sem migration

Nenhuma. O impasse era de interface, não de dados — o banco sempre aceitou
`em_uso → em_uso`, porque `podeTransicionar` devolve `true` quando origem e
destino são iguais.

## [0.84.0] — 2026-09-07

A tela de Frota ganhou a forma do catálogo — **modelo D**, escolhido entre
quatro e desenhado em `docs/superpowers/specs/2026-09-06-frota-modelo-d-design.md`.

### O problema, medido

Sete colunas para 128 peças, e **duas não carregavam informação**: `Estado` com
zero valores distintos, `Categoria` com um só (“TI”, nas 128 linhas). A mesma
doença que a tela de Itens tinha, e a mesma cura: **o que se repete vira
navegação, o que varia vira seção**.

### As três decisões

**Trilho de categoria, e não de obra.** Obra tem 8 valores e não escala;
categoria vai de 1 para 10 com equipamento de obra e veículos — e é o mesmo eixo
de Itens. A obra continua como filtro, que já funcionava.

**Faixa de pendência que some sozinha.** A urgência muda de assunto: hoje são 95
máquinas de TI entregues sem termo; em outubro serão inspeções de PTA; depois,
CRLV vencido. Faixa permanente vira moldura e deixa de ser lida justamente no dia
em que importa. Ela conta a categoria inteira (não a lista já filtrada, senão
apontaria para si mesma) e some quando o próprio filtro dela está aplicado, com
um selo tomando o lugar.

**A coluna que segue o perfil da categoria.** Em TI e veículo a pergunta é *com
quem*; em obra, *onde*. Uma tela só, com “com quem está” vazio em toda betoneira,
ensina a ignorar a coluna.

### O que saiu e o que ficou

Saiu a coluna **Categoria** — virou o trilho. **Ficou `Estado`**: está vazia hoje
porque a importação de TI não a preencheu, mas é onde o equipamento locado volta
marcado como avariado. Apagá-la seria desenhar a tela para o passado — foi o erro
da primeira versão deste desenho, corrigido depois da pergunta sobre equipamento
de obra.

### Detalhes que valem registro

- **`pecasComResponsavel` devolve quem TEM custódia aberta**, e `null` em caso de
  erro — conjunto vazio significaria “ninguém assinou nada” e acenderia a faixa
  para a frota inteira.
- **O grupo “sem tipo” vai por último mesmo sendo o maior**: é lacuna de
  cadastro, e liderar por ser numeroso lhe daria a importância de um tipo.
- Agrupamento e pendência são **funções puras**, com 13 testes. A página só
  orquestra.

### Sem migration

Nenhuma. A tela lê o que já existe.

## [0.83.1] — 2026-09-07

O que foi excluído volta a ficar escondido.

### O defeito, provado

Oito tabelas com exclusão suave tinham **duas** policies permissivas: uma
`..._select`, que esconde `deleted_at`, e uma `..._write` declarada `for all`.

**`for all` inclui SELECT**, e policies permissivas são OR'd. Como o `using` da
`_write` não mencionava `deleted_at`, todo usuário que passa por `pode_operar()`
lia pela segunda porta e **enxergava o que tinha sido excluído**.

Provado contra a produção, em transação com limpeza explícita: duas linhas em
`certificado_equipamento`, uma com `deleted_at` preenchido; sob a sessão de um
usuário que opera, a consulta devolveu **`ZZ_EXCLUIDO, ZZ_VIVO`**. Depois da
correção, `ZZ_VIVO`.

Isso contradizia o que o `AGENTS.md` afirma — *“a policy de SELECT esconde
linhas com `deleted_at`”* — e o que a tela promete a quem clica em excluir. Uma
dessas tabelas guarda **medida disciplinar**; outra, **entrega ao ocupante**.

### Como cheguei nele

Rodando os advisors de **desempenho**, que eu tinha deixado de fora: a auditoria
da 0.82.2 cobriu só segurança. O apontamento era
`multiple_permissive_policies` — um aviso de *performance*, porque o Postgres
avalia as duas policies a cada leitura. Fui ver por que havia duas e encontrei o
furo.

### As tabelas afetadas

`certificado_equipamento` (criada ontem, com o padrão copiado),
`checklist_limpeza`, `devolucao`, `entrega_ocupante`, `medida_disciplinar`,
`recebimento`, `reparo_equipamento`, `tarefa_limpeza`.

### Só no `using`, nunca no `with check`

Pôr `deleted_at is null` também no `with check` recriaria o **incidente da
0.19.4**: o Postgres aplica o `with check` à linha NOVA de um `UPDATE`, e a
linha nova de uma exclusão suave tem `deleted_at` preenchido — o próprio
comando de excluir abortaria.

`using` decide **quais linhas o comando enxerga**; `with check`, **como a linha
pode ficar**. Só a primeira pergunta estava errada.

Conferido antes de mexer: **não existe caminho de “restaurar”** em nenhuma das
oito. `restaurarTemplate` é de template de documento, e o “Restaurar” da peça
mexe em `situacao`.

### A trava contra a décima

O padrão errado é o mais natural de escrever — foi assim que se espalhou por
oito tabelas, e eu o copiei para a nona. Agora há teste: **nenhuma migration
posterior à correção** pode criar `for all` que ignore `deleted_at`.

A fronteira é o **nome do arquivo que corrigiu**, e não um número solto: se ele
mudar de lugar, um segundo teste reclama em vez de a varredura silenciar.
Migration aplicada é história e não se reescreve — por isso a varredura olha só
para a frente.

### Desempenho

- `certificado_equipamento.unidade_id` é chave estrangeira com `on delete
  cascade` e não tinha índice que a cobrisse. O `idx_certificado_atual` começa
  por `org_id`, então não serve. Pagavam por isso a exclusão de uma peça (o
  cascade varria a tabela) e a seção Certificados da tela da peça.

### Desempenho da RLS

Três policies antigas chamavam `auth.uid()` e `current_org_id()` soltas, e o
Postgres as **reavaliava para cada linha examinada**. Envolvidas em
`(select ...)`, ele resolve uma vez, como InitPlan. O projeto já escreve assim
desde as policies mais novas; estas eram sobreviventes das primeiras migrations.

O ganho hoje é pequeno — `perfil` tem onze linhas — mas
`perfil_select_same_org` é avaliada em toda consulta que junta perfil, e são
muitas: o nome de quem fez alguma coisa aparece em quase toda tela.

Conferido depois de aplicar, sob a sessão de um usuário real: ele continua vendo
a si, os onze perfis da organização e os vinte vínculos de obra. Policy de
`perfil` errada é ninguém entrando no sistema.

**Advisor de desempenho: `auth_rls_initplan` foi de 3 para 0.**

### O que ficou, e por quê

`multiple_permissive_policies` segue em 44. A correção acima resolveu o que ele
escondia — o furo da exclusão suave — mas as tabelas continuam com duas
policies permissivas para SELECT, e é isso que o advisor conta.

Colapsar exigiria trocar cada `for all` por **três policies separadas**
(INSERT, UPDATE, DELETE), porque o Postgres não aceita várias operações numa
policy só: vinte e sete policies novas em nove tabelas, mexendo em RLS de
produção. O ganho seria uma avaliação de predicado a menos em tabelas de dezenas
de linhas. Não compensa.

### Migrations

- `0091_write_policy_esconde_apagados.sql` — corrige as nove por `alter policy`,
  reaproveitando a condição existente em vez de transcrevê-la (são nove `using`
  diferentes, e é transcrevendo que se perde um `is_member_of_obra` no caminho).
  Aborta se sobrar alguma.
- `0092_indice_da_fk_do_certificado.sql` — o índice por `unidade_id`.
- `0093_initplan_nas_tres_ultimas.sql` — as três policies, com conferência que
  aborta se alguma seguir com a chamada solta.

## [0.82.3] — 2026-09-07

Faxina de segurança nas funções do banco.

### De onde veio

Uma auditoria de segurança rodada depois das nove migrations do dia. O linter
do Supabase aponta **22 funções `security definer` que o papel `anon` pode
executar** via `/rest/v1/rpc/...`.

Três delas são irmãs do `soft_delete` e repetem o caso que a migration 0042 já
tinha resolvido para ele — nasceram depois e não receberam o mesmo tratamento:
`soft_delete_devolucao`, `soft_delete_recebimento` e
`soft_delete_reparo_equipamento`.

**Não era vulnerabilidade.** As três exigem sessão, recusam com “Sessão
inválida” sem JWT e conferem o papel antes de tocar em qualquer linha —
verificado no corpo de cada uma. Uma chamada anônima não fazia nada. Mas função
com privilégio elevado não deve ficar exposta a quem não entrou, e foi essa a
palavra da 0042.

### Por que só três, e não as 22

Porque revogar as outras quebraria o sistema. Medido nas policies desta base:

| Função | Usada em policies |
|---|---|
| `current_org_id` | **136** |
| `pode_operar` | 43 |
| `is_member_of_obra` | 25 |
| `pode_gerir_cadastros` | 24 |
| … e mais oito | 1 a 23 |

Policy roda com os privilégios de **quem consulta**. Tirar o `EXECUTE` do `anon`
faria toda policy que chama `current_org_id()` estourar em requisição anônima —
e há uma página pública neste sistema: `/assinar/[token]`, onde o funcionário
assina o termo pelo celular com a chave anônima. “Resolver o aviso” custaria a
assinatura à distância inteira.

Outras seis são funções de **trigger**: devolvem `trigger`, o PostgREST não as
expõe, e não há como chamá-las por RPC. E `termo_do_link`,
`conferir_cpf_do_link` e `assinar_termo_por_link` ficam acessíveis ao `anon`
**de propósito** — são a página de assinatura.

O raciocínio está escrito dentro da migration, porque o linter vai continuar
apontando as 19 e a tentação de “limpar o aviso” volta a cada auditoria.

### Um erro no caminho

A primeira versão revogava só `from anon`, e **não tirou nada**: o Postgres
concede `EXECUTE` de toda função ao papel `PUBLIC` por padrão, e o `anon` herda
dali. É por isso que a 0041 e a 0042 precisaram ser duas migrations. A
conferência no fim do próprio arquivo pegou — abortou com “3 função(ões)
continuam executáveis pelo anon”.

### E a passagem de higiene que a 0.45.x deixou marcada

O changelog da 0.45.x (01/09) termina assim: *“as outras quatro funções de
trigger do projeto têm o mesmo apontamento (…) e ficam para uma passagem própria
de higiene.”* É esta — e hoje são **cinco**, porque `sincronizar_situacao_peca`
nasceu depois.

São funções que devolvem `trigger` e **nunca puderam ser chamadas por RPC**:
quem tentasse receberia *“trigger functions can only be called as triggers”*.
Não havia brecha. Mas cinco apontamentos permanentes e inócuos num relatório de
segurança são cinco linhas que ninguém lê — e o dia em que aparecer um
apontamento de verdade, ele vai estar no meio delas.

O padrão já estava provado nesta base: três funções de trigger já haviam sido
fechadas, com os triggers seguindo ativos. O Postgres confere o `EXECUTE` ao
**criar** o trigger, não a cada disparo.

Depois: **0 funções de trigger expostas** (eram 5) e **84 triggers ativos**
intactos. As 17 `security definer` que continuam alcançáveis pelo `anon` são
exatamente as que precisam: 14 helpers de RLS e as 3 da página de assinatura.

### A guarda que faltava

Comentário em migration é lido por quem abre a migration — e quem vai “resolver
o apontamento” abre o painel do Supabase, não o arquivo SQL. Então a regra virou
**teste**, em `migrations-seguranca.test.ts`, ao lado da varredura de
`security_invoker` que já existia:

- **12 helpers de RLS**: reprova qualquer migration que revogue o EXECUTE deles,
  com a razão na mensagem do erro.
- **3 funções da página de assinatura**: o invariante não é “ninguém revoga” —
  é “precisa acabar concedida ao anon”. A 0077 revoga de `public` e concede a
  `anon` logo depois, que é o padrão correto de endurecimento; a primeira versão
  da guarda olhava só o revoke e **reprovou as três estando certas**.
- E um teste que confere que a varredura **enxerga o que existe**, porque uma
  guarda que nunca reprova é uma guarda que não existe.

### Migration

- `0089_revoke_anon_soft_delete_irmaos.sql` — revoga de `public, anon`, garante
  `authenticated`, e **aborta nos dois sentidos**: se alguma seguir aberta ao
  anônimo, ou se alguma tiver ficado inacessível a quem opera. O segundo erro
  seria pior: ninguém mais conseguiria excluir uma devolução, e o motivo não
  apareceria em lugar nenhum.
- `0090_higiene_funcoes_de_trigger.sql` — as cinco de gatilho, com a conferência
  em duas metades: fechadas **e** ainda disparando. Fechar sem conferir os
  triggers seria trocar um apontamento de linter por uma numeração de documento
  que parou de acontecer — e ninguém descobriria até o próximo recebimento
  nascer sem número.

## [0.82.1] — 2026-09-07

Conferir os e-mails deduzidos, de uma vez.

### Por que esta tela existe

Ela destrava uma corrente inteira, e a corrente foi medida:

```
95 peças em uso sem responsável
  └─ exige custódia de funcionário
       └─ exige TERMO com termo_id      ← trava do banco, migration 0059
            └─ exige ASSINATURA
                 └─ presencial, ou convite por link
                      └─ exige E-MAIL CONFIRMADO
                           └─ 0 de 97 confirmados   ← o elo que faltava
```

O importador do inventário deduziu 97 endereços no padrão
`nome.sobrenome@sistenge.com`. A regra da 0.69.0 recusa enviar termo para
endereço deduzido enquanto ninguém conferir — e a conferência só existia **um
funcionário por vez**. Para 97 pessoas, 97 navegações.

Medido na produção: **97 de 97** dos endereços não confirmados são deduzidos.
**Nenhum** foi digitado à mão.

### Adicionado

- **Funcionários → Conferir e-mails**: nome, cargo e endereço lado a lado, uma
  caixa por linha, uma barra de salvar grudada embaixo. Com 97 linhas, um botão
  no fim da página obrigaria a rolar de volta.
- O botão de entrada **só aparece quando há o que conferir**, e diz quantos são.
  Um botão permanente que leva a uma tela vazia ensina a não clicar nele.

### Decisões que valem registro

- **Não existe “marcar todos”**, e é a decisão central. A regra existe para que
  alguém *olhe* cada endereço; um botão que marca 97 de uma vez a transformaria
  em formalidade, e o primeiro endereço errado mandaria um documento assinável
  para fora da empresa. Por isso nome e e-mail ficam na mesma altura: conferir
  “Elaine Silva → elaine.silva@sistenge.com” vira um movimento do olho.
- **A tela lista só endereço DEDUZIDO.** A dedução é recalculada e comparada com
  o gravado: se não bate, alguém digitou — e digitar já é conferir. Encher a
  lista de linhas em que não há nada a fazer é como uma tela de conferência
  deixa de ser conferida.
- **A confirmação em lote só LIGA, nunca desliga.** O que não foi marcado é
  “ainda não conferi”, não “está errado”. Desconfirmar em lote apagaria a
  conferência de quem já tinha olhado, sem ninguém saber.
- **Ação própria, e não 97 chamadas a `salvarFuncionario`.** Aquela grava o
  cadastro inteiro a partir do formulário: usá-la aqui reescreveria nome, cargo,
  matrícula e obra a partir de campos que esta tela nem mostra — e campo ausente
  viraria nulo.
- **Não envia nada.** Confirmar é dizer que o endereço foi lido; o convite de
  assinatura continua sendo outro ato, com outro botão.

### Corrigido no mesmo dia

- **A regra nasceu duplicada.** O contador do botão e o filtro da tela faziam a
  mesma comparação em dois arquivos. Duas cópias divergem na primeira correção,
  e a divergência aqui apareceria como um botão dizendo “conferir 97” abrindo
  uma tela com 94 linhas. Agora é `precisaConferencia()` em `src/lib/termo.ts`,
  com 9 testes — incluindo acento no nome, caixa diferente e nome do meio.

### Sem migration

Nenhuma. `email_confirmado` existe desde a 0074.

## [0.81.1] — 2026-09-06

Placa e chassi no cadastro do veículo, e a contração do medidor.

### Alterado

- No cadastro de uma peça de categoria com perfil **veículo**, os dois campos
  nativos mudam de nome: **Placa** e **Chassi**. São as mesmas colunas
  `identificador` e `numero_serie` — a placa **é** o patrimônio do carro e o
  chassi **é** o número de série dele, então duplicar em coluna nova criaria dois
  lugares para digitar a mesma coisa. O que muda é como se chama para quem
  preenche.

### Migration

- `0088_contracao_do_medidor.sql` — a segunda metade do expande-e-contrai:
  derruba os dois triggers de ponte e as colunas
  `intervalo_manutencao_h` e `tem_horimetro`, agora que a v0.81.0 está
  publicada e nada mais as lê. Confere a coerência das duas formas **antes** de
  perder o dado, e a conferência é guardada por um `if` — ela lê justamente as
  colunas que derruba, e sem a guarda a segunda execução quebraria num arquivo
  cujo trabalho já estava feito.

## [0.81.0] — 2026-09-06

O medidor passou a ter unidade.

### O problema

`tipo_equipamento.intervalo_manutencao_h` tinha a unidade **no nome** — e a
frota de veículos revisa por quilometragem. Gravar 10.000 ali seria o sistema
afirmando “dez mil horas”, e a conta de revisão erraria por um fator de cem.
`equipamento_unidade.tem_horimetro` tinha o mesmo defeito: carro não tem
horímetro, tem hodômetro.

`apontamento_uso.leitura` já era genérica de propósito — “o número do
mostrador”. Ela serve os dois sem mudar. O que faltava era dizer **qual**
mostrador.

### Por que uma coluna com unidade, e não duas colunas

Nenhum equipamento tem os dois: gerador conta horas, carro conta quilômetros, e
nenhum conta ambos. Duas colunas nulas em alternância convidam a preencher as
duas — e aí a conta teria de escolher uma, em silêncio.

### Feito por expansão, e não por renomeação

A produção no ar lia `intervalo_manutencao_h` e `tem_horimetro` em **11
arquivos**. Renomear e migrar no mesmo passo derrubaria a tela de Configurações
até o deploy seguinte.

Então a `0087` **acrescenta** `intervalo_manutencao`, `unidade_medidor` e
`tem_medidor`, preenche a partir das antigas, e instala dois triggers que mantêm
as duas formas em acordo enquanto as duas versões do código convivem. **Quem
mudou vence**: o código velho escreve `_h` e o novo acompanha; o novo escreve a
unidade e o antigo acompanha.

**O caso que importa:** quando a unidade é `km`, `intervalo_manutencao_h` fica
**nulo**. Copiar 10.000 para uma coluna que diz horas faria o código velho
anunciar “revisão vencida” em toda a frota. Nulo é honesto — ele mostra “sem
intervalo definido”, que é o que de fato sabe.

A migration de **contração**, depois deste deploy, derruba triggers e colunas
antigas.

### Alterado

- O formulário do tipo ganhou o seletor de unidade **ao lado do número**, e não
  numa configuração à parte: 250 e 10.000 são o mesmo campo com sentidos
  opostos, e separá-los deixaria o número sozinho sem dizer o que conta.
- A tela da peça segue a unidade do tipo em todos os rótulos — leitura,
  histórico, período e o aviso de medidor trocado.
- `horasDesdeRevisao` e `horasAteRevisao` viraram `usoDesdeRevisao` e
  `faltaAteRevisao`. A conta é a mesma para horas e quilômetros; o nome não
  podia continuar prometendo horas.
- “Sem leitura do horímetro” virou “Sem leitura do medidor”.
- **CARRO** e **CAMINHONETE** nascem com 10.000 km. **CAMINHÃO** fica sem:
  intervalo de pesado varia demais com motor e uso, e chutar produziria alarme
  errado em todos eles.

### Segurança

- Intervalo e unidade **só entram juntos**, travado no banco e no schema. Um
  número sem unidade ninguém sabe ler.

### Migration

- `0087_medidor_com_unidade.sql` — colunas novas, preenchimento, os dois
  triggers de ponte, o intervalo dos veículos, e uma conferência que **aborta**
  se sobrar tipo com as duas formas em desacordo.

## [0.80.0] — 2026-09-06

A frota ganhou veículos.

### A ironia que começou isto

Em português, **frota** é a palavra para conjunto de veículos. A tela se chamava
Frota e não tinha um único carro dentro — nem categoria de transporte, nem
coluna de placa. São ~20 carros mais caminhão e caminhonete, próprios **e**
locados: pesa quase tanto quanto as 128 peças de TI.

### São três frotas, e cada uma pergunta outra coisa

| | TI | Obra | Veículos |
|---|---|---|---|
| “Onde está” quer dizer | com **quem** | em qual **obra** | quem **dirige** |
| Documento que a rege | termo | contrato + certificado | CRLV, seguro, **e a CNH** |
| Mede uso por | — | horímetro (horas) | hodômetro (**km**) |

### O que já servia, e por isso não precisou de linha nova

A placa é o `identificador`, o chassi é o `numero_serie`, o ano é o `ano`, quem
dirige é `custodia_peca` — o mesmo modelo do notebook, com termo assinado — e
**CRLV e seguro são `certificado_equipamento`**, a estrutura que nasceu de manhã
para a inspeção de PTA. Ela serve o carro inteiro sem alteração.

### Adicionado

- Categoria **Veículos** (ordem 75, entre Medição e ensaio e TI) com perfil
  próprio, e os tipos **CARRO**, **CAMINHONETE** e **CAMINHÃO**.
- Ficha dos leves: renavam, combustível, câmbio e cor. O **caminhão** acrescenta
  capacidade de carga e eixos — e não ganha ficha própria, porque dois campos a
  mais não justificam manter duas fichas em sincronia. Pô-los na ficha dos leves
  deixaria dois campos vazios em vinte carros.
- Espécies **Licenciamento** e **Seguro** no vocabulário de certificado, e os
  três tipos já nascem exigindo as duas, anuais. `licenciamento` e não `crlv`: o
  documento mudou de nome duas vezes e vai mudar de novo — a obrigação é
  licenciar, o papel é detalhe.
- **CNH, categoria e validade** no funcionário, com a categoria em lista fechada
  na forma da resolução do Contran.

### Segurança

- **Número de CNH e validade só entram juntos**, travado no banco e no schema.
  Número sem validade faria a tela dizer “habilitado” sem saber até quando — e
  entregar carro a quem está com a habilitação vencida faz a autuação cair na
  empresa, que é a proprietária.
- A CNH é **do funcionário e não da peça**. Amarrá-la a um `certificado_equipamento`
  faria a mesma habilitação ser recadastrada a cada troca de veículo, e as
  cópias divergiriam na primeira renovação.

### O que ficou de fora, de propósito

- **A revisão por quilometragem.** `intervalo_manutencao_h` é `h` no nome e na
  conta, e `tem_horimetro` também. Os dois aparecem em **11 arquivos** que a
  produção no ar lê agora — renomear junto derrubaria Configurações até o deploy
  seguinte. Vai em fatia própria, por expansão: colunas novas, código migrado,
  deploy, e só então as antigas saem. Consequência assumida: os tipos de veículo
  nascem **sem** intervalo de manutenção, porque é melhor nascer sem do que
  nascer com 10.000 gravado numa coluna que diz horas.
- **Multas e abastecimento.** Não existem em lugar nenhum e podem esperar.

### Migrations

- `0085_frota_de_veiculos.sql` — perfil `'veiculo'`, as duas espécies de
  certificado, a categoria e os três tipos.
- `0086_cnh_do_funcionario.sql` — CNH, categoria e validade, com a trava cruzada
  e o índice que serve ao alerta de vencimento.

## [0.79.0] — 2026-09-06

A revisão preventiva zera a contagem.

### O defeito, medido

`horasAteRevisao(leituraAtual, intervalo, leituraUltimaRevisao)` foi escrita
certa e testada — e os **dois** lugares que a chamavam passavam `0` no terceiro
argumento, porque não havia de onde tirar o número. Com zero, a conta virava
`intervalo - leituraAtual`: um gerador de intervalo 250 h com o horímetro em
1.200 aparecia como “revisão vencida em 950 h”, e continuava assim depois da
revisão, e da seguinte. Pior, toda máquina usada vinda da planilha de coleta
nasceria em vermelho.

### A correção não é guardar a leitura da revisão — é contar horas

Guardar “revisou na leitura 1.000” quebra na troca de horímetro: o mostrador
novo começa em zero e 1.000 vira número de outra escala. A coluna `horas` já
existe, já é calculada pelo trigger da 0071 e já trata a troca (período com
`reiniciado` conta zero). Faltava só a **marca**: em qual apontamento a revisão
foi feita — daí a coluna `revisao` da migration 0084, que espelha `reiniciado`
por ser um fato sobre *aquela leitura*, não sobre a peça.

A marca vai no apontamento e não em `reparo_equipamento`: troca de óleo
preventiva quase nunca abre OS, e amarrá-la à ordem de reparo faria o sistema
enxergar só a manutenção que já deu problema — justamente a que a preventiva
existe para evitar.

### Adicionado

- Caixa “Revisão preventiva feita nesta leitura” no formulário de apontamento,
  e selo `Revisão` na linha correspondente do histórico da peça.
- `apontamento_uso.revisao` (migration 0084), com índice parcial
  `(unidade_id, data desc) where revisao` para a pergunta “qual foi a última
  revisão desta peça”, feita por linha na tela e no relatório.

### Corrigido

- A contagem para a próxima revisão agora recomeça na revisão marcada.
- `sem_leitura` deixou de se disfarçar de `sem_intervalo`: a peça recém-cadastrada
  com 250 h definidas no tipo dizia “sem intervalo definido”, mandando a pessoa
  conferir um campo já preenchido.
- O popup do `<select>` nativo não é alcançável por classe: Chrome e Edge o
  pintam a partir do `background-color` do próprio `<select>`, que é
  translúcido (`bg-transparent` + `dark:bg-input/30`, para casar com o Input).
  No tema escuro o composite dessa translucidez devolvia um cinza-azulado fora
  da paleta, e a opção marcada quase não se distinguia das demais. `option` e
  `optgroup` passam a usar os tokens `--popover`, e `option:checked` usa
  `--accent` — pelo shorthand `background`, porque o UA do Chrome marca o item
  selecionado com um `background-image` em gradiente que só o shorthand zera.
  Vale para todo `<select>` nativo do app, inclusive o de
  `/termos/funcionarios`, que ainda é uma tag crua.

### Alterado

- O relatório de uso acumula a contagem no laço em vez de chamar
  `horasDesdeRevisao` — aquela consulta já vem em ordem crescente, e zerar na
  revisão é a mesma conta sem guardar o histórico de cada peça em memória. E
  ignora o filtro de período de propósito: o estado da revisão é sobre a
  máquina **hoje**, e recortar por mês diria que uma escavadeira revisada em
  janeiro nunca foi revisada.

## [0.78.0] — 2026-09-06

O item não conta mais em dois lugares.

### O defeito, medido

O modelo **Dell Optiplex 380** tinha `tipo_id` = DESKTOP (que pertence a TI) e
`categoria_id` **nulo**. Na tela de Itens ele aparecia agrupado sob DESKTOP na
lista **e** contado em “Sem categoria” no trilho — o mesmo item em dois lugares
que se contradizem. Por isso TI mostrava 26 modelos num catálogo de 27.

### A causa não é digitação, é estrutural

Todo tipo pertence a exatamente uma categoria, então `item_catalogo.categoria_id`
é **redundante** desde que o nível TIPO nasceu (0.63.0 / migration 0069) — e o
que é redundante diverge. O formulário do item nem pergunta a categoria: ele
oferece “TI › DESKTOP” e grava só o tipo. Quem preenchia `categoria_id` era o
importador de inventário, e o que ele não tocou ficou para trás.

Com a planilha de coleta chegando e dezenas de cadastros novos, isso divergiria
mais.

### Corrigido

- `categoria_id` passa a ser **derivada do tipo por trigger**, no banco.
  Escrevem em `item_catalogo` a action do formulário, o importador e o que vier
  depois da planilha — se a regra morasse na action, bastaria um caminho novo
  esquecer a linha para a divergência voltar, que é exatamente como ela nasceu.
- Mover um **tipo** de categoria leva junto os modelos dele. O trigger do item
  só olha a linha do item, e ninguém toca no item nessa operação.
- Item **sem tipo** mantém a categoria que tiver: `tipo_id` é nulável de
  propósito e permanentemente — é o cadastro rápido que a obra faz com o
  caminhão no portão.
- O trilho de Itens ordena por **`ordem`**, não por nome. A coluna existia e não
  fazia nada ali: a view `categoria_resumo` nem a expunha. A lista da Frota já
  ordenava assim, e as duas telas mostravam as mesmas categorias em ordens
  diferentes. Configurações → Categorias e tipos entrou na mesma ordem.

### Migration

- `0083_categoria_derivada_do_tipo.sql` — alinha o que está gravado, cria as
  duas triggers, recria `categoria_resumo` com `ordem` (`security_invoker = on`)
  e **aborta** se sobrar item com categoria diferente da do tipo.

## [0.77.0] — 2026-09-06

O certificado vencendo avisa sozinho.

### O aviso entra no cron que já existe

`api/cron/vencimentos` já reúne devolução, fim de contrato, pagamento, fim de
contrato de imóvel, reajuste e imóvel sem contrato; agrupa por obra; escalona
pelos prazos configurados; deduplica por `notificacao_log`; e manda o resto à
lista central. Certificado entrou ali como **mais duas fontes de candidato** —
não é cron novo nem e-mail separado.

### As duas fontes, e por que têm naturezas diferentes

- **`certificado_vence`** tem data e escalona normalmente. A referência é o
  **certificado**, e não a peça: renovado, o próximo tem id novo e a dedupe
  deixa o aviso sair de novo no ano seguinte.
- **`certificado_ausente`** não tem data. Segue o padrão que o imóvel sem
  contrato estabeleceu — uma vez por mês, dia 1º, `dias = 0`. Sem isso, ou
  avisaria todo dia até alguém resolver, ou nunca. O `tipo` **inclui a espécie**
  (`certificado_ausente:pmoc`): duas exigências ausentes na mesma peça são dois
  avisos, e com uma chave só a dedupe descartaria a segunda como repetida.

**O vencido não insiste.** Ele já foi avisado quando estava vencendo; repetir
todo dia até alguém agir é exatamente como um alerta deixa de ser lido. A tela
mostra; o e-mail não.

### A tradução saiu da rota

`candidatosDeCertificado` vive em `src/lib/certificado.ts`, e não dentro da rota
de 500 linhas. É a única parte daquele arquivo que dá para provar sem subir o
Next inteiro — e a que erra em silêncio. São 8 casos de teste, incluindo as duas
bordas da janela e a chave composta da dedupe.

### Adicionado

- Filtro **Certificado** e selo na lista da Frota. O selo é o **pior** estado da
  peça; certificado em dia não ganha selo nenhum.
- Migration `0082`: PTA exige inspeção periódica anual, ar-condicionado exige
  PMOC. São as duas que a lei nomeia sem margem (NR-12/NR-18 e Lei
  13.589/2018); as demais dependem de como a Sistenge opera e entram pela tela.
  A migration **não sobrescreve** exigência já configurada à mão.

## [0.76.0] — 2026-09-06

Certificados do equipamento — o vencimento que é **data**, e não horímetro.

### O problema

O Loca já avisava revisão **por uso**: 250 h de óleo no gerador, com a leitura
do horímetro e o selo na tela. A metade que custa multa não era essa. Inspeção
de PTA, PMOC de ar-condicionado, teste de carga de talha e calibração de
instrumento vencem por **calendário** — 12 meses depois da última, tenha a
máquina trabalhado 2.000 horas ou ficado parada no pátio.

### O desenho

O **tipo declara** o que exige; a **peça acumula** os certificados; uma view
cruza os dois. Cruzar é o ponto: sem a declaração no tipo, o sistema não
distingue “não exige inspeção” de “ninguem lançou a inspeção” — e o segundo é
o que gera interdição.

### Adicionado

- **Configurações → Categorias e tipos → Exigências**: sete espécies de
  documento (inspeção periódica, PMOC, teste de carga, calibração, ART, laudo
  elétrico, outro) com periodicidade em meses.
- **Seção Certificados na peça**: uma linha por exigência, com validade, selo de
  situação e histórico de emissões. Vem **antes** da manutenção: reparo é
  histórico, certificado vencido é impedimento.
- **“Sem certificado”** como estado próprio, mais grave que “vencido” — numa
  exigência vencida alguém ao menos sabia que ela existia.
- **Laudo em PDF** anexado ao certificado, em bucket próprio, com download por
  link temporário assinado em lote.

### Decisões que valem registro

- **Renovar não substitui.** Cada renovação é uma linha nova, e a tabela não tem
  unicidade por (peça, espécie): o acúmulo é o recurso.
- **O vencimento é proposto, nunca calculado.** A validade impressa no laudo
  manda — inspeção feita com atraso costuma valer 12 meses a partir da vistoria.
- **O dia do vencimento ainda vale.** Marcá-lo como vencido tiraria de operação
  uma máquina legal.
- **Nada bloqueia.** Certificado vencido não impede locar nem mover a peça.
  Interditar equipamento é decisão de gente, e um bloqueio automático em cima de
  dado recém-cadastrado pararia obra por erro de digitação.

### Migration

- `0081_certificado_equipamento.sql` — coluna no tipo, tabela, view
  `certificado_pendencia` (com `security_invoker = on`), bucket `certificados` e
  o ramo do certificado em `soft_delete`.

## [0.75.0] — 2026-09-06

O catálogo saiu da TI e chegou à obra.

### Por que agora

Sete das oito categorias estavam **vazias** — só TI tinha tipos. E
ar-condicionado não tinha categoria nenhuma: não é acesso, não é energia, não é
ferramenta. Ficaria em “sem categoria”, o balde onde o item some.

O levantamento das locações foi cobrado das obras com retorno para 25/09. A
estrutura precisa existir antes do dado chegar, ou a planilha volta e não há
onde pôr.

### Por que apenas cinco tipos

Quais famílias a Sistenge realmente aluga é **o que a planilha responde**.
Semear as trinta por adivinhação encheria o seletor de tipos que ninguém
escolhe, e cada um seria uma correção a mais depois. Entraram as cinco que o
e-mail de cobrança nomeou — PTA, andaime, betoneira, gerador e ar-condicionado
— porque é sobre elas que o responsável vai responder. O resto entra por
Configurações → Catálogo, conforme o dado chegar.

### Adicionado

- Categoria **Climatização**, na ordem 65 — ao lado de Energia, com que divide
  instalação predial. TI segue por último, a única que não é de obra.
- **PTA** (Acesso e altura, 250 h de revisão): formato — tesoura, articulada,
  telescópica —, altura de trabalho, capacidade e tração. Um tipo só, e não
  três: o que muda entre elas é exatamente o que a ficha pergunta, e três tipos
  exigiriam manter três fichas iguais em sincronia.
- **ANDAIME** (Acesso e altura), controlado por **quantidade**: aluga-se por
  painel e devolve-se contando painel. Ficha vazia é a afirmação correta — não
  há peça com patrimônio onde gravar valor.
- **BETONEIRA** (Concretagem): capacidade em litros, acionamento e tensão. Sem
  intervalo por horímetro — a maioria não tem horímetro.
- **GERADOR** (Energia, 250 h): potência em kVA, combustível, cabinado e tanque.
  Cabinado não é detalhe estético: gerador aberto não opera perto de frente de
  serviço por ruído, e é a primeira pergunta de quem procura um.
- **AR-CONDICIONADO** (Climatização): capacidade em BTU/h, formato, ciclo,
  tensão e **gás refrigerante**. O gás entra porque decide o custo da
  manutenção: R-22 está em descontinuação e recarregar custa mais que o
  conserto.

### O que ficou de fora, de propósito

- **Ano, número de série, patrimônio e estado** têm coluna nativa em
  `equipamento_unidade`, com campo próprio no formulário da peça. Repeti-los na
  ficha criaria dois lugares para digitar a mesma coisa — a mesma regra da
  0.70.0, onde a memória RAM ficou de fora.
- **Inspeção anual, PMOC e teste de carga** não entraram como campo `data`.
  Campo de ficha é inerte: ninguém lê, nada avisa, e a renovação sobrescreve a
  anterior sem deixar histórico. São certificados, e ganham estrutura própria
  na fatia seguinte.

### Migration

- `0080_catalogo_de_obra.sql` — idempotente por `on conflict`, e aborta se
  alguma peça sob estes tipos já tiver ficha preenchida: o `do update`
  redefiniria os campos e orfanaria os valores em silêncio.

## [0.74.0] — 2026-09-06

Trilho de categorias na tela de Itens — **modelo C**, escolhido entre três.

### Por que agora

O agrupamento por tipo da 0.73.0 funciona com **3 tipos**. O catálogo inteiro
tem 8 categorias e cerca de 30 tipos: trinta seções empilhadas numa página só.
A categoria precisava virar navegação antes de PTA, andaime e ar-condicionado
entrarem.

### Adicionado

- **View `categoria_resumo`** (migration 0079), com `security_invoker = on`.
  Contar na aplicação obrigaria a trazer o catálogo inteiro a cada visita, só
  para somar oito números.
- **`TrilhoCategorias`** — server component, feito de links e não de estado: o
  botão "voltar" funciona e a URL pode ser colada para alguém.

### Decisões

- **O trilho é navegação, não filtro**, e a diferença aparece nos números: cada
  linha mostra o total *daquela* categoria mesmo quando outra está selecionada.
  Quem está em "Acesso e altura" precisa ver que TI tem 27 modelos para decidir
  ir até lá. Um trilho que espelhasse o filtro corrente só repetiria a lista.
- **Categoria vazia mostra travessão, não zero.** `0` convida a clicar para ver
  nada; o travessão diz que não há o que ver.
- **A linha "Sem categoria" vem de uma contagem à parte**, porque a view parte de
  `categoria_equipamento` e item sem categoria não pertence a linha nenhuma dela.
  Ele existe — o item de teste é um — e sumiria da tela se ninguém contasse.
- **O trilho fica fora do bloco que depende do filtro.** Quando a busca não acha
  nada, é por ele que a pessoa sai de onde está.
- **No celular vira faixa horizontal.** Uma coluna de 180 px num telefone de
  360 px comeria metade da tela para mostrar o que não se está olhando.

### Não verificado

A tela não foi aberta num navegador.

## [0.73.0] — 2026-09-06

A tela de Itens, reformulada. Modelo escolhido pelo Evandro entre três:
**agrupado por tipo**.

### O diagnóstico, medido e não opinado

Das seis colunas da tela anterior, **quatro repetiam a mesma palavra nas 27
linhas**:

| Coluna | Valores distintos |
|---|---|
| Tipo (`Equipamento`) | 1 |
| Unidade (`un`) | 1 |
| Status (`Ativo`) | 1 |
| Categoria (`TI`) | 2 — e a segunda é o item de teste |

Metade da largura não carregava informação. A tela não estava cheia: estava
**vazia com aparência de cheia**.

E a coluna rotulada "Tipo" mostrava a **natureza**. O tipo de verdade —
`NOTEBOOK`, `DESKTOP`, `SERVIDOR`, o nível 2 do catálogo de quatro níveis —
estava preenchido nos 27 itens e **não aparecia em lugar nenhum**: `tipo_id` era
lido na consulta e descartado na montagem. Justamente a dimensão que varia
(15 notebooks, 10 desktops, 2 servidores).

O comentário em `src/lib/itens.ts` já dizia *"dois campos Tipo na mesma tela
seria um desastre"*. A renomeação aconteceu na biblioteca e não chegou à tela.

### Alterado

- **A tela tem a forma do catálogo:** seções por tipo, cada uma com modelos,
  peças, em uso e livres. `<details>` nativo — abre e fecha sem JavaScript.
- **O que se repetia virou filtro** (tipo e categoria no topo); **o que varia
  virou seção**.
- **Cada modelo mostra quantas peças estão em uso**, não só quantas existem.
  `17 un.` como texto cinza não distinguia 17 parados de 17 em campo.
- **A paginação saiu.** Agrupar e paginar brigam: uma seção partida entre duas
  páginas mostra o total do tipo com metade dos modelos embaixo, e quem lê não
  sabe se o resto existe. No lugar, um teto de 500 com aviso na tela — e se um
  dia isso apertar de verdade, o certo **não** é aumentar o número, é voltar a
  paginar por seção.
- **`listarItens` foi removida** por ter ficado sem chamador. Duas leituras do
  mesmo catálogo é como as duas divergem.

### Adicionado

- **View `item_parque`** (migration 0078), com `security_invoker = on`. Contar
  por situação não existe na API do PostgREST: ou se traz toda peça para a
  aplicação e conta lá, ou o banco conta. O banco conta.
- **Seção "Equipamento sem tipo"**, com a consequência dita: esses itens não
  aparecem para quem filtra por tipo.

### Não verificado

A tela nova não foi aberta num navegador.

## [0.72.0] — 2026-09-06

Fase C.2 — assinatura à distância. **A primeira rota pública deste sistema que
carrega dado.**

### O peso da coisa

O middleware liberava `/login`, `/auth` e `/offline`. Nenhuma rota do Loca jamais
devolveu dado a quem não entrou. Por isso o desenho aqui é mais apertado que o
de qualquer outra parte.

**A prova.** A pergunta que sustenta o termo é *"como se sabe que foi ele quem
assinou?"*. No presencial a resposta é "o operador estava presente", e um link
some com isso. A resposta escolhida: **o link vai ao e-mail corporativo
conferido E a pessoa digita o próprio CPF**. Dois fatores fracos que juntos
sustentam a afirmação.

**Nasce inerte, e isso está dito no código:** dos 118 funcionários,
**nenhum tem CPF cadastrado**. O sistema recusa gerar o link nesse caso, em vez
de criar um que nunca destrava — link que a pessoa tenta, falha e passa a
desconfiar do sistema em vez do cadastro.

### Adicionado

- **`termo_link`** (migration 0077), com validade, uso único e revogação.
- **`/assinar/[token]`** — página pública, fora do grupo `(app)`: sem menu, sem
  navegação, sem link para lugar nenhum.
- **Bloco "Assinar à distância"** no rascunho, com os três impedimentos
  nomeados: sem e-mail, e-mail por conferir, sem CPF.
- **Template `conviteAssinatura`**, que **não leva o PDF anexo** — o documento
  ainda não está assinado, e um anexo circulando antes da assinatura é o que a
  numeração existe para impedir.

### Segurança

- **O token não é gravado — só o `sha256` dele.** O token em claro existe no
  e-mail e em lugar nenhum mais: se o banco vazar, os links não vazam junto. O
  preço é que ele não pode ser recuperado, e a tela diz isso.
- **A leitura pública NÃO usa `createAdminClient()`.** A regra do `AGENTS.md`
  existe porque o isolamento por organização depende de RLS, e um handle admin
  genérico numa rota pública é a pior versão desse furo. Três funções
  `security definer` com `search_path = ''` recebem o hash e devolvem
  exclusivamente o termo que aquele link destrava; a aplicação nunca ganha o
  handle.
- **Link inexistente, vencido, usado e revogado devolvem o mesmo `null`.**
  Distinguir "não existe" de "venceu" diria a um curioso que aquele hash já foi
  um link bom.
- **CPF errado NÃO queima o link.** Um dígito trocado não pode custar o
  documento — a conferência é separada da assinatura por isso.
- **O CPF não volta na resposta.** O nome vai, para a pessoa reconhecer o
  documento como seu; devolver o CPF transformaria a conferência em cópia e
  colagem.

Verificado em produção numa transação revertida, sem resíduo:

| Cenário | Resultado |
|---|---|
| Hash desconhecido | `null` |
| Link bom | devolve o termo, sem vazar CPF |
| CPF sem pontuação | aceito |
| CPF errado | recusado, **link segue vivo** |
| Assinar com IP malformado | assina; IP vira nulo |
| Reusar o link | recusado, leitura vira `null` |

### Corrigido

- **`emitirTermo` não grava uma segunda assinatura** de quem já assinou à
  distância. Sem isso o PDF mostraria duas linhas para a mesma pessoa, e quem
  confere não saberia qual traço vale.

### Não verificado

Nenhuma tela autenticada foi aberta num navegador, **a página pública nunca foi
aberta**, e nenhum e-mail foi disparado de verdade.

## [0.71.0] — 2026-09-06

Fase C.1 do inventário de TI. O termo de responsabilidade chega a quem assinou.

### O que isto é, e o que não é

O termo é assinado **na tela, na hora**, com imagem da assinatura e IP
registrado. O e-mail **não é o ato** — é a entrega da cópia a quem já assinou. O
texto do e-mail diz isso na primeira linha, porque um e-mail com um termo anexo
é naturalmente lido como "assine e devolva", e quem lê assim guarda o anexo
esperando um passo que não existe.

### Adicionado

- **`termo_equipamento.email_enviado_em`** (migration 0076). Carimbo, não
  condição: se o Resend cair, o termo continua emitido e assinado com a coluna
  nula, e a tela mostra "via não enviada" com botão de reenviar.
- **Bloco "Via do funcionário"** na tela do termo, com três estados que exigem
  coisas diferentes de quem opera: *enviada*, *sem endereço cadastrado* e
  *endereço por conferir*.
- **`reenviarTermo`**, porque a emissão é irreversível e o envio não. Reenviar
  uma via já enviada é permitido de propósito.
- **Template de e-mail `termoFuncionario`**, registrado no catálogo da galeria
  de pré-visualização.

### Segurança

- **Endereço não conferido não recebe termo.** A fase B deduziu 97 endereços de
  `nome.sobrenome`, que é palpite e não fato. Sem esta trava o primeiro envio em
  massa descobriria os erros entregando o termo de responsabilidade de uma
  pessoa na caixa de outra. A tela aponta o conserto em vez de deixar tentar.

### Alterado

- **A montagem do PDF do termo saiu da rota** para
  `src/lib/documentos/frm-eq-001-render.tsx`. O mesmo PDF agora sai por dois
  caminhos — download e anexo —, e duas montagens fariam a via recebida por
  e-mail divergir da baixada na tela, num papel com valor de prova. Uma função,
  dois chamadores.
- **Falha no envio não desfaz nada.** A emissão devolve `ok` com aviso dizendo o
  que faltou, em vez de a tela dizer "tudo certo" sobre uma via que não saiu.

### Não verificado

Nenhuma tela autenticada foi aberta num navegador, e **nenhum e-mail de termo
foi disparado de verdade** — o caminho foi exercitado só por tipos e testes.

## [0.70.0] — 2026-09-06

Fase B do inventário de TI. **127 máquinas** da aba `ATIVAS.` de
`Máquinas Sistenge.xlsx`.

### Adicionado

- **Migration 0075** — índice único em `item_catalogo (org_id, lower(descricao))`
  e os tipos NOTEBOOK, DESKTOP e SERVIDOR.

  O índice não é enfeite: o importador resolve o item pela descrição, e sem a
  trava a segunda execução criaria 26 modelos duplicados **em silêncio**.
  "Rodar duas vezes não duplica" é o critério de pronto desta fase.

  Os três tipos compartilham a **mesma** ficha de seis campos. Três fichas
  separadas seriam três cópias que divergem quando alguém acrescentar um campo.

- **`scripts/db/importar-inventario-ti.mjs` reescrito** para a planilha nova e
  para o catálogo de quatro níveis. Prévia obrigatória: sem `--aplicar` só
  imprime o plano e as pendências.

| | |
|---|---|
| Modelos no catálogo | 26 |
| Peças | 127 — 96 notebooks, 29 desktops, 2 servidores |
| Alugadas | 27, sem contrato (fase D) |
| Frentes na obra 800 | 11 |
| Funcionários criados | 22 |
| E-mails deduzidos | 97, todos **por conferir** |
| Custódias criadas | **0** |

### O que a prévia pegou antes de gravar

| Pendência | Linhas |
|---|---|
| `LIVRE` com nome de gente junto | 6 |
| Departamento que diz um lugar sem dizer qual | 4 |
| Coluna deslocada (RAM com data, HD com "8 GB") | 2 |
| Chave de licença do Windows no lugar da TAG | 2 |
| Tipo divergente do modelo (OptiPlex declarado notebook) | 2 |
| Obra 685 (ELEA) remapeada para 659 | 2 |
| Modelo incompleto (ThinkBook sem número) | 1 |

**"Sem obra" e "pendência de lugar" são coisas diferentes de propósito.**
`RESERVA` e `N/A` estão corretamente sem obra — a máquina está na prateleira.
`OBRA` e `PASELI` *deveriam* dizer um lugar e não dizem. Misturar os dois
esconderia as pendências dentro de um monte de máquinas que estão certas.

### Corrigido

- **A importação criava duas fichas para a mesma pessoa** quando o nome
  aparecia com e sem acento. O cadastro já tinha `Joao Lirio` de julho;
  comparar por `nome.toLowerCase()` fez `João Lirio` entrar como pessoa nova —
  e um termo de responsabilidade poderia sair no registro errado.

  A comparação passou a ignorar acento. **Isto resolve acento, e só:**
  `Cleide Miriam` e `Cleide Mirian` continuam sendo dois registros, e devem
  continuar. Decidir que são a mesma pessoa é juízo humano, não normalização.

### Decisões registradas no código

- **Custódia não nasce de importação.** `custodia_funcionario_exige_termo`
  (0059) exige termo assinado, e a regra está certa: ninguém assinou nada ao
  digitar aquela célula. O detentor fica na observação da peça.
- **A memória RAM não entrou na ficha** — tem coluna nativa (`memoria_gb`) com
  campo próprio no formulário da peça. Repeti-la criaria dois lugares para
  digitar a mesma coisa. Isto **removeu** o campo "Memória RAM" que existia no
  tipo DESKTOP; nenhuma peça tinha valor nele.
- **A regra de e-mail tem UMA implementação.** `src/lib/email-corporativo.ts`
  não importa nada, e o Node 24 remove os tipos na importação — é o que permite
  o script `.mjs` usar a mesma função da tela. Duas cópias divergiriam do jeito
  mais caro: o termo de uma pessoa indo para a caixa de outra.

### Não verificado

Nenhuma tela autenticada foi aberta num navegador.

## [0.69.0] — 2026-09-05

Fase A do inventário de TI
(`docs/superpowers/specs/2026-09-05-inventario-ti-design.md`). Duas correções
que a importação das 127 máquinas precisa prontas.

### Corrigido

- **A chave da ficha era a primeira letra do rótulo.** O editor derivava a chave
  enquanto `campo.chave === ""`. Na PRIMEIRA tecla a chave virava `"m"` e
  deixava de ser vazia, então as letras seguintes não realimentavam mais.

  Não é cosmético: acrescente "Modelo" a um tipo que já tem "Memória RAM" e as
  duas chaves são `"m"` — o salvamento é recusado com *"Há dois campos com a
  mesma chave"*, uma chave que ninguém digitou. A mensagem é verdadeira e
  inútil.

  A informação "este campo é novo" não pode sair do VALOR da chave; sai de onde
  o campo nasceu. `CampoEmEdicao` carrega `gravado`.

  **O teste que prova a correção digita o rótulo caractere a caractere.** Sem
  isso ele passaria com o código defeituoso: um único `comRotulo(c, "Memória
  RAM")` devolve a chave certa mesmo com a regra errada.

- **Migration 0073** corrige o que já estava gravado — o tipo DESKTOP tinha
  `m`, `p`, `a`. Casa em `(chave, rótulo)` e não no nome do tipo, aborta se
  alguma peça tiver ficha preenchida sob chave de uma letra, e aborta de novo
  se sobrar qualquer chave de uma letra desconhecida. `with ordinality`
  preserva a ordem dos campos.

### Adicionado

- **`funcionario.email` e `funcionario.email_confirmado`** (migration 0074).

  O e-mail fica no **funcionário**, não na peça. São 127 máquinas para cerca de
  110 pessoas, e quando a máquina troca de mão o e-mail que está NELA é o do
  detentor **anterior** — que é para onde a cópia do termo sairia.

  `email_confirmado` existe porque o e-mail **vai ser adivinhado**: a fase B
  deriva `nome.sobrenome@sistenge.com`, que é palpite e não fato. A coluna
  sustenta a regra de que nenhum termo sai para endereço não confirmado.

- **`emailDerivado`** devolve `null` em vez de chutar: nome de uma palavra só
  (`Lourival`), vazio, ou com algarismo (`Monitor 0109947` é uma LINHA da
  planilha, não uma pessoa).

- **`confirmacaoDoEmail`** fecha um buraco que só aparece pensando no caminho
  errado: sem ela, editar o **cargo** de alguém reenviaria o e-mail derivado
  inalterado e ele viraria "conferido" sem ninguém ter olhado. Confirmar é
  digitar **outro** endereço ou marcar a caixa.

- **Edição de funcionário**, que não existia. `FuncionarioForm` só era usado
  para criar, então a caixa de confirmação nunca renderizaria e a fase B
  produziria ~110 endereços marcados "Por conferir" **sem nenhum caminho para
  conferi-los**. Coluna, regra e selo apontando para um beco sem saída.

### Alterado

- A mensagem de `23505` distingue CPF de e-mail. Agora são dois índices únicos,
  e dizer "CPF" para uma colisão de e-mail manda conferir o campo errado.

### Não verificado

Nenhuma tela autenticada foi aberta num navegador.

## [0.68.0] — 2026-09-05

Fase 3b — **a última do módulo de equipamento**.

### O que destravou

A pergunta que a segurava era "a frente já existe em algum lugar — orçamento,
cronograma, avanço — ou seria cadastro novo?". Criar um cadastro que duplica
conceito existente é o defeito que custou caro várias vezes nesta sessão.

**A resposta veio do banco, não de suposição:**

| Onde | O que tem |
|---|---|
| `avanco_obra` | percentual da OBRA INTEIRA por semana. Sem etapa |
| `orcamento_locacao` | itens locados. Sem frente |
| `etapa_obra` | não existe |

A frente **não vive em lugar nenhum do Loca**. Não há o que duplicar aqui
dentro.

E o desenho sobrevive à outra pergunta — se as frentes são estáveis ou
informais. O cadastro é **por obra e criado na hora de usar**: estáveis são
cadastradas uma vez e reusadas; informais, cada obra cria o que precisa.

### Adicionado

- **`frente_obra`** (migration 0072), por obra. "Fundação" na obra A e
  "Fundação" na obra B são frentes diferentes, com equipe, prazo e custo
  próprios — uma lista global obrigaria a inventar nomes únicos
  ("Fundação — Unimed Maceió") e o seletor de cada obra ofereceria as frentes de
  todas as outras.
- **`item_locado.frente_id`** — o que FAZ O CUSTO DESCER.
- **`apontamento_uso.frente_id`** — a hora trabalhada também desce ao serviço.
- **Relatório "Custo por frente"**, com a linha `(sem frente)` deliberada:
  ela mostra quanto do custo ainda não desceu, e é ela que diz se vale confiar
  no resto. Escondê-la faria um rateio parcial parecer completo.

### Segurança

- **Trigger recusa frente de outra obra**, nas duas pontas. Sem ele, o relatório
  somaria despesa de uma obra dentro de outra, em silêncio. É trigger e não FK
  composta porque a obra do `item_locado` vem pelo CONTRATO — não há coluna
  `obra_id` nele para uma chave composta apontar.
- **Frente com item alocado não se exclui** — desativa-se. A FK é `set null`, então
  excluir não quebraria nada: os itens só perderiam a alocação em silêncio, e o
  relatório encolheria sem explicação.

Verificado em produção numa transação revertida:

| Cenário | Resultado |
|---|---|
| Frente da mesma obra | aceita |
| Frente de outra obra | recusada |
| Duas "Fundação" na mesma obra | recusada |
| "Fundação" em duas obras diferentes | aceita |

### Alterado

- `item_locado.frente_id` é **opcional e permanentemente**: obra sem frentes
  continua funcionando como antes, e o custo continua sendo da obra. O seletor
  nem aparece quando a obra não tem frentes cadastradas — um campo vazio que só
  serve para ser ignorado é pior que campo nenhum.

## [0.67.0] — 2026-09-05

Fase 3a, construída sob duas suposições declaradas: quais peças têm horímetro se
marca no cadastro (começando desmarcado), e a leitura é semanal — o desenho de
menor atrito, que absorve o caso "o encarregado, de memória, uma vez por
semana".

Depois da resposta **"todos os contratos são por calendário"**, o apontamento
deixou de ser dado financeiro. A diária corre trabalhando a máquina ou não.
Sobraram duas justificativas, e as duas valem: **manutenção preventiva por uso**
e **ociosidade real**.

### Adicionado

- **`apontamento_uso`** (migration 0071). O que se grava é a LEITURA DO
  MOSTRADOR, acumulada — não "horas trabalhadas". Quem lê o horímetro copia um
  número; quem estima horas de memória inventa. E a leitura é auditável: dá para
  conferir contra a máquina a qualquer momento.
- **`equipamento_unidade.tem_horimetro`**, nascendo falso. Gerador e compressor
  costumam ter; betoneira e vibrador quase nunca. Ligado para todas, a tela de
  apontamento viraria ruído no primeiro dia.
- **`tipo_equipamento.intervalo_manutencao_h`.** Vive no TIPO porque o intervalo
  é do fabricante e vale para toda a família — repetir por peça faria cada
  cadastro pedir um número que ninguém lembra, e metade ficaria zero.
- **Relatório "Uso do equipamento"**, com horas no período, dias sem leitura e
  situação da revisão.

### O cálculo mora no banco

`horas` é a diferença para a leitura anterior DA MESMA PEÇA, e "anterior"
depende da DATA — não da ordem de digitação. Alguém lança a leitura de segunda
depois de já ter lançado a de quarta, e a action teria de recalcular as duas.

Dois gatilhos resolvem: um calcula, outro **recalcula o apontamento seguinte**
quando um é inserido no meio ou excluído. Sem o segundo, lançar segunda depois
de quarta deixaria quarta contando as horas de segunda também — o total do mês
ficaria certo por acaso e a distribuição no tempo, errada.

Verificado em produção numa transação revertida, com seis cenários:

| Cenário | Resultado |
|---|---|
| Primeira leitura | horas = 0 |
| Lançar dia 08 entre 01 e 15 | dia 15 recalculou 40 → 20 |
| Excluir o dia 08 | dia 15 voltou a 40 |
| Leitura menor sem marcar troca | recusada |
| Horímetro trocado, marcado | horas = 0 |

### Detalhes

- **Horímetro trocado zera.** Sem a marca `reiniciado`, a leitura seguinte seria
  menor que a anterior e o lançamento recusado para sempre. Marcado, o período
  conta zero — a leitura de um horímetro novo não é hora trabalhada.
- **`obra_id` é fotografada no lançamento**, não derivada depois: a peça circula,
  e daqui a três meses a obra atual seria outra — o apontamento diria que a
  máquina trabalhou onde ela nem estava.
- **`unique (unidade_id, data)`.** Duas leituras da mesma peça no mesmo dia são
  sempre erro de digitação, e a segunda substituiria a primeira sem que ninguém
  soubesse qual valia.
- **O aviso de revisão começa a 10% do intervalo**, não num número fixo: 25 h de
  antecedência é muito para 50 e pouco para 500.
- **`faltam` é negativo quando venceu.** "Passou 30 h" é o que faz alguém agir;
  truncar em zero esconderia há quanto tempo.

### Simplificação declarada

`leituraUltimaRevisao` é **zero**: a ordem de reparo ainda não registra a leitura
do horímetro no momento do serviço. Enquanto não registrar, o intervalo conta
desde o começo da vida da máquina — o que **acusa revisão vencida cedo demais**,
e não tarde demais. Errar para o lado do alarme é o lado certo de errar aqui.

## [0.66.0] — 2026-09-05

Fase B do catálogo — o construtor de formulário. Fecha a spec
`2026-09-05-catalogo-quatro-niveis-design.md`.

### Adicionado

- **`equipamento_unidade.ficha`** (jsonb, migration 0070), com índice GIN
  `jsonb_path_ops` — metade do tamanho do padrão e mais rápido para `@>`, que é
  o único operador que estas buscas usam.
- **Construtor de campos por tipo.** Cinco formatos: texto, número (com
  unidade), data, lista de opções e sim/não.
- **A ficha aparece no cadastro da peça**, montada a partir do que o tipo define.

### Por que jsonb e não colunas

`memória` e `disco` **não existem num andaime**. Colunas em
`equipamento_unidade` encheriam de nulo toda betoneira e escora do sistema, e
cada tipo novo pediria uma migration. Filtrar continua funcionando — o Postgres
indexa e consulta jsonb.

### Segurança

- **A ficha gravada é montada a partir dos campos DO TIPO**, não do payload.
  Chave que o tipo não conhece é descartada; sem isso, uma requisição forjada
  gravaria qualquer coisa no jsonb, e ela viraria uma coluna fantasma que
  nenhuma tela mostra, nenhum campo edita e nenhuma consulta espera.
- **Chave duplicada é recusada no schema.** Em jsonb, duas chaves iguais fariam
  a segunda sobrescrever a primeira ao gravar — o valor do primeiro campo
  sumiria sem erro.
- **`sim_nao` vira booleano de verdade.** A string `"false"` é truthy em
  JavaScript; guardá-la como texto faria toda consulta dar verdadeiro para os
  dois valores.
- Definição com forma inválida (gravada por SQL) **não derruba** a tela nem o
  salvamento da peça: vale como ficha vazia e o erro vai para o log.

### Detalhes de desenho

- **A chave é derivada do rótulo e depois congelada.** "Memória RAM" vira
  `memoria_ram`; sem a normalização, toda consulta teria de escrever
  `ficha->>'Memória RAM'` — que se digita errado uma vez e o filtro devolve
  vazio para sempre, sem erro. Mudar a chave depois orfanaria os valores já
  gravados.
- **Um teste garante que `chaveDeRotulo` e `campoFichaSchema` concordam.** São
  duas regras separadas, e nada obrigava a que a chave gerada pelo sistema
  passasse na validação do próprio sistema.
- **A lista inteira é salva de uma vez**, porque a ordem faz parte da definição.
  Por isso o botão só habilita quando há mudança, e a tela avisa quando há
  mudança não salva.

## [0.65.0] — 2026-09-05

Fase A da spec `2026-09-05-catalogo-quatro-niveis-design.md`. A hierarquia já
existia — escrita como prosa dentro de um campo de texto.

### Adicionado

- **`tipo_equipamento`** (migration 0069), sob `categoria_equipamento`, com
  `natureza_padrao`, `ativo` e `campos_ficha` (jsonb, para a fase B).
  `item_catalogo.tipo_id` é nulável e permanentemente: um modelo pode existir
  antes de alguém decidir seu tipo, e exigir travaria o cadastro rápido que a
  obra faz com o caminhão parado no portão.
- **`unidade_medida`**, semeada com as oito sugestões que viviam cravadas em
  `src/lib/itens.ts`.
- **Configurações › Catálogo** — árvore de categorias e tipos, e não duas listas
  lado a lado: o tipo só existe DENTRO de uma categoria, e duas listas fariam a
  pessoa escolher a categoria num seletor toda vez, deixando o erro de pôr
  NOTEBOOK em Concretagem entrar por descuido.
- **Configurações › Unidades de medida.**

### Corrigido

- **O formulário do item nascia se contradizendo.** O padrão de fábrica era
  `Tipo = Equipamento` — cuja ajuda diz "controlado por unidade" — com
  `Controle no recebimento = Por quantidade`. Dois campos diziam a mesma coisa
  por caminhos diferentes e nada os mantinha de acordo.

  `controle` passa a ser derivado da natureza por trigger. A coluna continua
  existindo (dezenas de consultas a selecionam), mas deixa de ser escolhida à
  mão, e a tela DIZ a consequência em vez de perguntar de novo.

### Alterado

- **`item_catalogo.tipo` renomeada para `natureza`.** No desenho novo, TIPO é a
  família; manter o nome antigo poria dois campos "Tipo" na mesma tela.
- `TIPO_ITEM` → `NATUREZA_ITEM`, `TipoItem` → `NaturezaItem`,
  `TIPOS_ITEM` → `NATUREZAS_ITEM`.
- A unidade de medida virou seletor de lista fechada.

### Nota

A trava de colisão de nomes de schema, criada na 0.60.0, **pegou sozinha a
terceira ocorrência**: `categoriaSchema` passou a existir em `catalogo.ts` e em
`frota.ts`.

## [0.64.0] — 2026-09-05

O levantamento por trás desta versão: dos 37 fornecedores, **37 tinham CNPJ e 1
tinha e-mail**. Contato, telefone e observações estavam vazios em 36. E o e-mail
é o campo que faz a fase 2 funcionar — sem ele o romaneio e o termo de devolução
não saem, o registro fecha, e ninguém é avisado de nada.

### Corrigido

- **O sistema era mudo sobre o e-mail ausente.** Agora dói em três lugares: o
  contador no cabeçalho da lista (conta a organização inteira, não a página), a
  marca em cada linha, e o aviso no formulário enquanto o campo está em branco.
- A coluna **Contato** da listagem deu lugar ao **e-mail**. Ela mostrava o nome
  de quem atende e estava vazia em 36 das 37 linhas — largura ocupada sem
  informar. Nome e telefone continuam, em segunda linha, quando existem.

### Alterado

- **As obras do fornecedor passam a incluir as que vêm de CONTRATO.** O sistema
  já sabia onde ele atua; manter uma segunda lista à mão é como as duas
  divergem.

  É união, e não substituição, por um motivo medido: os dois conjuntos hoje são
  **disjuntos** — 8 vínculos manuais, nenhum com contrato correspondente, porque
  o cadastro de contratos ainda está no começo (2 no sistema inteiro). Derivar
  só do contrato apagaria a informação que existe. A união deixa o contrato
  assumir sozinho à medida que forem cadastrados.
- **O painel de caixas de obras saiu do corpo do formulário** e virou seção
  recolhida, junto com observações. Ele crescia em linha reta com o número de
  obras.
- O e-mail subiu para o topo e sozinho; contato e telefone viraram opcionais
  explícitos, numa fileira de dois.

## [0.63.0] — 2026-09-05

Fase 4 sobre o dado que a fase 2 criou. Em `src/lib/relatorios-equipamento.ts`,
não em `relatorios.ts` — aquele já passava de novecentas linhas.

### Adicionado

- **Conferência pendente.** O relatório que mais vale dinheiro dos três:
  recebimentos e devoluções em rascunho, e fechados sem aviso, ordenados por
  dias parados. Uma coluna diz o EFEITO de cada pendência, não só o nome dela —
  sem isso o relatório é uma lista de tarefas administrativas; com ela, é a
  conta que está correndo.
- **Equipamento em conserto.** Peças fora da obra, com dias fora e atraso sobre
  o prazo prometido. Não aceita recorte por obra, e é deliberado: a peça é da
  organização e circula, então filtrar por obra esconderia justamente o conserto
  da máquina que aquela obra vai receber.
- **Custo de manutenção por peça**, com total, número de ordens e média por
  ordem. Só ordens CONCLUÍDAS — valor de ordem aberta é estimativa, e somar
  estimativa com realizado produz um total que não bate nem com o financeiro nem
  com a nota da oficina.

### Segurança

- **Trava contra tipo de relatório sem despacho.** `gerarRelatorio` é uma escada
  de `if` que termina num `return` SEM condição: acrescentar um tipo e esquecer
  o `if` não quebra typecheck nem lint — o usuário escolhe "Custo de manutenção"
  e recebe as linhas de caução de imóvel, sob o título certo. A varredura
  percorre `TIPOS_RELATORIO` (a mesma fonte do seletor) e acusa dois tipos que
  devolvam o mesmo título. Provada contra o defeito real antes de ser aceita.
- A varredura também confere que `grafico.labelKey`, `grafico.valorKey` e
  `agruparPor` apontam para colunas que existem. Fora delas, nada estoura: o
  gráfico sai com todas as barras em zero, e o agrupamento junta tudo num
  subtotal de rótulo vazio.

## [0.62.0] — 2026-09-05

Subprojeto 2c, que fecha a fase 2. Equipamento em conserto deixa de sumir.

### Adicionado

- **`reparo_equipamento`** (migration 0068), com prefixo **RPE** — REP já é de
  `reparo_imovel`, e dois tipos no mesmo prefixo tornariam o número ambíguo.
- **A ordem nasce numerada, sem rascunho.** É ela que autoriza a peça a sair da
  obra, e um rascunho de autorização não autoriza nada.
- **A situação da peça segue a ordem por TRIGGER**, não por código de action.
  A peça em conserto tem de aparecer como "manutenção" em toda tela que a
  mostra; na action, bastaria um caminho novo de escrita esquecer a linha para a
  peça ficar "disponível" com a máquina na oficina — e alguém a entregaria a um
  funcionário que iria procurá-la e não achar.
- **`aberto` e `em_execucao` são estados separados**, porque é entre os dois que
  a peça deixa a obra. A ordem pode ser emitida hoje e a máquina sair na quinta.
- **Três assinaturas no PDF**: autorizou, transportou, recebeu na oficina. É o
  único documento do sistema que viaja com a máquina.
- **`avaria_id` é nulável**: manutenção preventiva não vem de dano nenhum, e
  exigir uma avaria obrigaria a inventar um problema para registrar a revisão.
- **A responsabilidade é importada de `avaria.ts`**, não recriada. Quando o
  reparo vem de um dano, "quem paga" é uma pergunta só, e dois vocabulários
  produziriam relatórios que não batem.
- Bloco de Manutenção na peça, com o gasto acumulado em conserto.
- Aula de ordens de reparo na trilha de Frota, que sobe para a versão 2.

### Corrigido

- **Colisão de nomes de schema**: `reparoSchema` passou a existir em `imoveis.ts`
  e em `reparo.ts`. A trava criada na 0.60.0 pegou sozinha e nomeou o conserto —
  as duas amostras agora são qualificadas por módulo.

## [0.61.0] — 2026-09-05

Subprojeto 2b. A avaria deixa de ser uma linha de texto e vira apuração com
documento.

### Adicionado

- **Laudo de avaria**, com PDF. `avaria` ganha `unidade_id`, `devolucao_id`,
  `data`, `responsabilidade` e `laudo` (migration 0066).
- **`responsabilidade` nasce `indefinida`**, e é o ponto do conjunto: o laudo é
  emitido para APURAR. Um enum sem "a apurar" forçaria quem preenche a apontar
  um culpado no momento da constatação — que é exatamente quando ainda não se
  sabe, e o palpite viraria o registro oficial com nome de pessoa dentro.
- **Fechar uma devolução abre as avarias dos itens ressalvados**, dentro da
  MESMA transação (migration 0067). Fora dela, uma falha deixaria o termo já
  entregue ao fornecedor com ressalvas impressas e o sistema sem nenhuma delas.
  `faltante` não vira avaria: item que não voltou não tem dano a periciar.
- **Tela `/vistorias/avarias`**, com o custo em aberto somado e o filtro "a
  apurar". Mora sob `/vistorias` para herdar a liberação do módulo — separar as
  permissões só produziria telas meio visíveis.
- **Laudo e custo são formulários separados.** A apuração vem de quem foi a
  campo; o custo chega depois, num orçamento do fornecedor, por outra pessoa.
  Num formulário único, o segundo sobrescreveria o texto do primeiro.
- Aula do laudo na trilha de Vistorias, que sobe para a versão 2 — sem o bump,
  quem já concluiu continuaria marcado como "concluída" sem nunca ver a aula.

### Segurança

- **Avaria cobrada não aceita laudo novo**, com trava também contra corrida
  (`.neq("status", "cobrada")` no update). O lançamento financeiro nasceu
  apoiado naquele texto, e é ele que alguém vai ler se a cobrança for
  contestada.
- A peça informada no laudo tem de pertencer ao contrato da avaria. A tela já
  oferece só as certas, mas a tela pode ser contornada.

### Corrigido

- **`STATUS_AVARIA` existia duas vezes**, em `vistoria.ts` e no novo
  `avaria.ts`, e as duas já divergiam: `aberta` era `default` numa e `secondary`
  na outra — a mesma avaria com cor diferente em duas telas. `vistoria.ts` passa
  a reexportar de `avaria.ts`.

## [0.60.0] — 2026-09-05

A ponta oposta do recebimento. Subprojeto 2a da spec
`docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md`.

### Adicionado

- **A devolução virou documento.** `devolucao` + `devolucao_item`, com número
  DEV, termo em PDF e aviso ao fornecedor. Antes cada item devolvido era uma
  `movimentacao` solta: cinco andaimes no mesmo caminhão produziam cinco
  registros e nenhum comprovante.
- **Fechamento atômico no banco** (`fechar_devolucao`, migration 0065). Conferir
  saldo, lançar o razão, marcar os itens devolvidos e numerar são quatro
  escritas dependentes; encadeadas na action, cada emenda seria uma janela para
  documento fechado com saldo não baixado — e é sobre o saldo que corre o custo
  de locação.
- **Conferência de saldo no fechamento, com recusa inteira.** A mensagem nomeia
  o item e as quantidades. Gravar só o que cabe produziria devolução parcial que
  ninguém pediu, num documento que já sairia com a lista completa.
- **Condições próprias da volta**: conforme, com avaria e não devolvido. O
  conjunto é diferente do recebimento de propósito — lá existe "divergência",
  que na devolução não faz sentido.
- **Ressalvas em seção própria** do termo e do e-mail, não numa célula da
  tabela.
- Tela `/devolucoes`, com filtro de rascunho e marca de "fornecedor não
  avisado".
- Reenviar o aviso e reabrir a devolução (só Master). Reabrir DESFAZ a baixa de
  saldo — sem isso, a próxima devolução do mesmo item seria recusada por saldo
  insuficiente sem explicação.
- Trilha de treinamento da devolução.
- `src/lib/documentos/inspecionar.tsx` — lê o TEXTO de um documento antes de ele
  virar PDF. Os testes de documento contavam páginas, e foi assim que o rodapé
  "Recursos Humanos" chegou a um fornecedor e que onze termos saíram com as
  listas fundidas (0.58.1).

### Alterado

- `movimentacao` perde o gatilho de numeração e ganha `devolucao_id` nulável. O
  prefixo DEV passa ao documento, que é quem precisa dele;
  `movimentacao.numero_registro` não era exibido em tela nenhuma. Os números já
  emitidos ficam, e o contador novo é semeado a partir deles.
- `movimentacao` continua sendo o razão de saldo. Nenhuma leitura de saldo,
  custo ou fluxo de caixa foi tocada.
- A varredura de schemas passou a aceitar amostras qualificadas por módulo e a
  acusar colisão de nomes. `AMOSTRAS` é um literal de objeto: dois módulos com
  schemas de mesmo nome faziam o segundo sobrescrever o primeiro em silêncio, e
  o schema perdedor era verificado contra a amostra do outro.

## [0.59.0] — 2026-09-05

Fecha as duas pendências registradas na 0.52.0.

### Adicionado

- **Reenviar o aviso ao fornecedor.** O fechamento é irreversível e o envio não:
  se o Resend cair, o recebimento fica fechado com `aviso_enviado_em` nulo. Sem
  este caminho, a única saída era mandar o romaneio por fora do sistema —
  perdendo o registro de que o fornecedor foi avisado. Reenviar um aviso já
  enviado é permitido de propósito: pode ter ido para a caixa errada.
- **Reabrir um recebimento fechado**, só Master e com motivo obrigatório de ao
  menos 10 caracteres, que entra nas observações e na auditoria.

### O que reabrir NÃO desfaz, e por quê

- `numero_registro` **fica**. Devolvê-lo à fila abriria o buraco que o contador
  gapless da 0048 existe para evitar — e o número pode já estar num romaneio
  impresso na mão do fornecedor. Ao fechar de novo, é o mesmo número.
- `aviso_enviado_em` **fica**. O e-mail saiu; fingir que não levaria alguém a
  reenviar um romaneio que o fornecedor já tem.
- `data_retirada` nos itens **fica**. O equipamento chegou à obra — é um fato
  físico, e não muda porque o registro voltou a ser editável.

O que se ganha ao reabrir é poder corrigir os itens e o cabeçalho. É só isso, e
é o suficiente.

### Interno

- O envio do romaneio virou `avisarFornecedor`, usado pelo fechamento e pelo
  reenvio. Duplicar as sessenta linhas de montagem de PDF e e-mail garantiria
  que as duas cópias divergissem — e a divergência apareceria como dois
  romaneios diferentes do mesmo recebimento na caixa do fornecedor.

## [0.58.1] — 2026-09-05

### Corrigido

- **Listas fundidas em onze documentos.** `Bloco` guardava `texto[]` e `itens[]`
  em baldes separados e não conseguia representar "parágrafo, lista, parágrafo,
  lista": todos os textos saíam primeiro, todas as listas depois, numa numeração
  corrida.

  No FRM-EQ-001 isso imprimia "Comprometo-me a:" e "Estou ciente de que:"
  colados, seguidos de uma lista única de 11 itens — de modo que "o desgaste
  natural é responsabilidade da empresa", que é uma CIÊNCIA, aparecia sob os
  COMPROMISSOS, num documento que declara ser parte do contrato de trabalho.

  Onze textos de template têm a mesma estrutura: a política de alojamento, a
  medida disciplinar, os termos de chaves e kit.

  `Bloco` passou a guardar partes NA ORDEM, e um parágrafo fecha a lista aberta.

- **Item de lista em caixa alta era engolido como título.**
  `ehSubtitulo("— PROIBIDO FUMAR")` devolvia `true` e o item sumia da lista. O
  prefixo `— ` agora vence: quem o escreveu quis um item.

Achado ao gerar exemplos do termo e LER o PDF. Typecheck, lint e os testes
passavam todos.

## [0.58.0] — 2026-09-05

Importação do parque de TI e a navegação que o catálogo maior exigiu. Escrita
como 0.51.0 e renumerada no rebase: a `main` andou até a 0.57.2 enquanto o PR
esperava.

### Adicionado

- **Importador do inventário de TI** (`scripts/db/importar-inventario-ti.mjs`).
  Dois níveis, como o resto do sistema: o MODELO vira `item_catalogo` e cada
  MÁQUINA vira `equipamento_unidade`. Prévia por padrão, grava só com
  `--aplicar`, e é idempotente — rodar de novo não duplica.
- **Funcionários no menu principal.** O cadastro vive em `/termos/funcionarios`
  para herdar a liberação do módulo Termos, mas não tinha entrada própria: quem
  via "Sem registro de posse" numa peça não adivinhava onde cadastrar a pessoa.
- **Coluna e filtro de categoria em Itens.** O catálogo passou de 5 para 33
  itens; a categoria deixou de ser detalhe e virou o primeiro corte. Inclui
  "Sem categoria", que é o estado dos itens antigos.

### Melhorado

- Botão **Editar** no topo da peça, ancorado no formulário que já existia no fim
  da página, depois da linha do tempo.
- Na tela do item, o identificador de cada peça virou link para `/frota/[id]`.
  Antes a única ação ali era excluir.

### Corrigido

- A descrição de Itens dizia "catálogo de equipamentos e materiais que a
  organização aluga" — falso desde que o patrimônio próprio entrou.

## [0.57.2] — 2026-09-05

Fecha o que a 0.57.1 deixou declarado em aberto, e transforma em teste a regra
que a 0.57.1 encontrou violada. Nenhuma migration.

### A trava do client admin

`src/lib/admin-client.test.ts` varre o código atrás de `createAdminClient()`
tocando tabela da aplicação. A regra está no AGENTS.md desde sempre — e foi
violada mesmo assim: `sincronizarObras` escrevia em `obra_usuario` com service
role, e só apareceu numa varredura manual. **Regra escrita não impede nada.**

Três decisões de desenho da varredura, cada uma por um motivo:

- **Segue a variável, não o texto.** Acha o que foi atribuído de
  `createAdminClient()` e procura `.from(` nela, atravessando quebras de linha
  — que é exatamente como o caso real estava escrito (`await admin` numa linha,
  `.from("obra_usuario")` na seguinte). Um grep simples nunca o teria achado, e
  não achou: foi preciso ler o arquivo.
- **A exceção é por arquivo E por tabela.** Fosse só por arquivo,
  `usuarios/actions.ts` viraria zona franca — e é justamente ali que o bug
  vivia. Hoje ele libera `perfil` (bootstrap de linha com `org_id` nulo, que
  nenhuma policy alcança) e mais nada.
- **Permissão que ninguém exerce é removida.** Um teste cobra que toda tabela
  liberada continue sendo tocada. Exceção esquecida na lista é a porta aberta
  para o dia em que alguém voltar a passar por ela.

Provada por inversão contra o bug REAL: reintroduzindo
`admin.from("obra_usuario")` no arquivo onde ele existia, a varredura falha e
nomeia arquivo, variável e tabela.

### Corrigido

- Alternar "pago" de uma conta de consumo e mudar o status de uma avaria eram
  as duas últimas ações sem canal de retorno. Novo componente
  `FormComErro` intercepta o submit, lê o resultado do server action e mostra o
  erro — o `<form action={…}>` nativo do React descarta o retorno, e era por
  isso que as duas ficavam mudas.

### Não coberto, de propósito

`restaurarTemplate` continua sem mensagem na tela: ele é um `formAction` dentro
de um formulário que já usa `useActionState`, e convertê-lo mexeria no editor
de templates inteiro. Zero linhas ali é caso legítimo (a organização nunca
customizou o documento) e a causa vai para o log.

## [0.57.1] — 2026-09-04

Varredura de **falhas silenciosas**: escrita no banco cujo erro era descartado,
e `UPDATE`/`DELETE` que atinge zero linhas sem erro. Nenhuma migration.

A classe já tinha aparecido três vezes em versões diferentes — `excluirItem` na
0.54.0, `moverPeca` na 0.50.0, `equip_unidade_update` na 0.49.0 —, sempre em
ação secundária, sempre com a tela anunciando sucesso. Esta versão varre as 157
gravações do sistema: **37 descartavam o resultado. Agora são zero.**

### `erroDeEscrita`, em `src/lib/acoes.ts`

As duas lições passaram a viver num lugar só, com teste próprio:

- **Capturar o erro não basta.** `UPDATE`/`DELETE` de zero linhas NÃO é erro
  para o PostgREST: uma policy de RLS que filtra a linha devolve `error: null`
  com nada alterado. Por isso o julgador exige o `.select("id")` no call site e
  trata "nenhuma linha" como falha.
- **Olhar só o erro também não.** Violação de chave estrangeira (`23503`) tem
  significado oposto conforme a ação: ao excluir, o registro **já foi usado**;
  ao salvar, é a **referência que não existe**. Dizer a errada manda a pessoa
  procurar o problema no lugar errado.

Onde zero linhas é legítimo — sincronização N:N, restaurar template padrão — o
que se checa é o erro, e isso está escrito em cada um desses pontos.

### Corrigido

- **Exclusões** (fornecedor, item de contrato, documento, contrato de imóvel,
  conta de consumo, reparo, ocorrência, vistoria, ocupante, foto, avaria,
  documento da biblioteca): o diálogo de confirmação passou a mostrar o motivo
  e a permanecer aberto. Antes fechava como se tivesse excluído.
- **Vínculo com obras** (fornecedor e usuário): o `delete` limpava e o `insert`
  falhava, deixando o cadastro sem obra nenhuma — anunciado como "atualizado".
  Agora devolve `aviso`: o cadastro foi salvo, e a ressalva aparece em toast.
- **Anexos e fotos**: o arquivo subia ao Storage e a linha no banco podia
  falhar, deixando arquivo órfão que nenhuma tela mostra. Uploader de contrato,
  de vistoria e de imóvel agora avisam.
- **Redefinição de senha**: se o carimbo `senha_temporaria` falhasse, a senha
  escolhida pelo master virava a definitiva da pessoa, sem troca obrigatória.
- **Contrato de imóvel vigente**: falhar ao encerrar a vigência do anterior
  deixava DOIS contratos vigentes, e o imóvel somava dois custos mensais na
  lista, no relatório e no fluxo de caixa. Agora nada é salvo.
- **Cobrança de avaria**: sem marcar a avaria como cobrada, o botão continuava
  disponível e o segundo clique criava uma segunda conta a pagar.
- **Contas recorrentes**: a falha redirecionava para o Financeiro como se
  tivesse gerado. Agora volta com aviso na própria tela.
- **Devolução de item locado**: o item podia ficar com saldo zero e status "em
  uso", acumulando custo estimado para sempre.

### Segurança

- `sincronizarObras` usava `createAdminClient()` — **service role sobre
  `obra_usuario`, que é tabela da aplicação**. O AGENTS.md proíbe isso porque o
  isolamento por organização depende da RLS. O fluxo de edição já usava o
  client normal; era só a criação que furava a regra. Agora os dois usam o
  client normal, e a falha é reportada em vez de engolida.
- O `update` do perfil na criação de usuário **continua** com client admin, e
  agora está escrito por quê: o perfil nasce com `org_id` nulo pelo trigger, e
  nenhuma policy escopada por organização o alcança. É bootstrap, não bypass.
- Se esse update falhar, a conta recém-criada é **desfeita**. Antes ficava uma
  conta órfã — entra no sistema, não vê nada, e recriar responde "já existe um
  usuário com este e-mail".

### Onde a mensagem ainda não chega ao usuário

Três ações são `<form action={…}>` simples, e o React exige retorno `void`
nesse caminho: alternar "pago" da conta de consumo, mudar o status de uma
avaria e restaurar um template padrão. Nelas a causa vai para o log e o valor
volta ao anterior na revalidação — feedback fraco, mas não silêncio. Surfacear
exigiria transformar cada linha num componente cliente, o que não cabia nesta
correção.

## [0.57.0] — 2026-09-04

Última onda de conteúdo: **Imóveis, Financeiro e Relatórios**. Com ela, os 13
módulos do Loca têm trilha — 14 no total, contando Primeiros passos, com 65
aulas e 61 perguntas. Nenhuma migration.

### Adicionado

- Trilha **Imóveis e alojamentos**: a lista com o custo mensal do filtro, o
  contrato (e o total mensal que é uma soma, com o seguro fiança somado só
  quando for mensal), consumo e reparos, ocupantes e entregas de chave e kit, e
  por que encerrar não é excluir — o botão de excluir apaga o imóvel **e todos
  os contratos dele**.
- Trilha **Financeiro**: o vínculo com o contrato como a coisa que decide se a
  despesa entra no realizado da obra; competência contra vencimento; a baixa
  com multa e juros **sugeridos** pela praxe (2% e 1% ao mês) e editáveis; o
  rateio por item; e o fluxo de caixa, onde "Projetado" vem de contrato e não
  de lançamento.
- Trilha **Relatórios**: os doze relatórios e quais ignoram o período (itens em
  aberto e ociosidade são retratos de agora); por que esta é a única tela com
  botão de aplicar; e uma aula inteira sobre o que um número estranho está
  dizendo — quase sempre lançamento faltando, não erro de cálculo.

### Testes

- **A trava que fecha o conjunto:** todo módulo de `MODULO_CHAVES` precisa ter
  uma trilha que o ensine, e nenhuma trilha pode apontar para módulo
  inexistente. A varredura lê as chaves de módulo em vez de uma lista escrita à
  mão, então módulo novo entra na checagem por existir — a mesma forma da
  varredura de rotas, e pelo mesmo motivo: lista escrita à mão envelhece em
  silêncio. Provada por inversão, com um módulo fictício.
- A guarda de gabarito criada na 0.54.0 **pegou o meu próprio conteúdo**: as
  quatro respostas certas da trilha de Imóveis caíram todas na segunda posição.
  Corrigido. Era exatamente o caso para que ela foi escrita — questionário com
  o gabarito sempre na mesma letra é passável sem ler nada.
- A fixture "módulo sem trilha" deixou de existir por mérito: com as 13
  trilhas escritas, não há mais módulo sem trilha, e o caso que sobra é o
  usuário sem módulo algum.

## [0.56.0] — 2026-09-04

Onda de conteúdo da **cadeia da locação**: Fornecedores, Contratos,
Recebimentos e Vistorias. Nenhuma migration.

E o achado desta onda é o maior de todos: **o item “Recebimentos” do menu
apontava para uma rota sem página, e caía em 404 desde a 0.39.0.**

### A rota fantasma

`src/app/(app)/recebimentos/` existia — com `[id]/page.tsx` dentro — mas nunca
teve `page.tsx` na raiz. Consequência: o módulo estava declarado em `MODULOS`,
o item aparecia no menu para quem tinha o módulo liberado, e clicar nele dava
página não encontrada. A conferência era alcançável só de dentro do contrato.

A varredura de rotas que existe desde a 0.32.0 não pegou, e o motivo é
instrutivo: ela verificava se a **pasta** existia. Pasta é o que o
desenvolvedor cria; `page.tsx` é o que o usuário abre. A trava nova é sobre o
segundo, e falha se qualquer módulo do menu perder a página da raiz.

### Adicionado

- **Tela de Recebimentos** (`/recebimentos`): lista da organização, do mais
  recente para o mais antigo, com busca por registro, nota ou conferente e
  filtros de obra e situação. O cabeçalho conta quantos rascunhos há na página.

  O que ela responde e nenhuma outra respondia: **quais conferências ficaram em
  rascunho**. Rascunho não numerou, não avisou o fornecedor e não carimbou a
  retirada nos itens do contrato — então o custo daquele equipamento está
  ausente do contrato e do orçamento, e a obra parece mais barata do que é.
- `listarRecebimentosDaOrganizacao` em `src/lib/data/recebimentos.ts`, com
  `createClient()` — o recorte por obra continua na RLS (migration 0049, via
  `obra_do_contrato`), e não é redecidido na leitura.
- Trilha **Fornecedores**: o CNPJ alfanumérico, o aviso de CNPJ duplicado que
  deixa a decisão com quem cadastra, e o e-mail do contato como destinatário do
  romaneio — não como agenda.
- Trilha **Contratos de locação**: cadência e pró-rata, o valor por período (e
  o erro de digitar o valor mensal num contrato semanal), a data de retirada
  como marco do custo, e a devolução parcial que congela a cobrança da parcela.
- Trilha **Recebimento e conferência**: a data da entrega contra a data do
  lançamento, avaria contra divergência, e os quatro efeitos irreversíveis do
  fechamento.
- Trilha **Vistorias**: os dois momentos de vistoriar, a foto que só vale
  quando está na vistoria, e a cobrança de avaria que exige permissão
  financeira.

### Testes

- Guarda nova em `src/lib/modulos.test.ts`: todo módulo do menu precisa de
  `page.tsx` na **raiz** da rota. Provada por inversão — removendo a página
  nova, o teste falha e nomeia o módulo.

### Varredura de permissões

Comparei o `pode*` exigido por cada server action com o `pode*` que a tela usa
para decidir o que mostrar, em todas as rotas. **Não há um quarto caso** da
classe "tela oferece o que a ação recusa" — os três corrigidos na 0.54.0 e na
0.55.0 eram o conjunto.

Uma divergência benigna fica registrada: o botão de excluir lançamento
financeiro aparece para administrador e a ação é só do master. Ela responde com
"Somente o Master pode excluir lançamentos" dentro do próprio diálogo, que
permanece aberto — mensagem imediata e correta, no lugar certo. Ensina a regra
em vez de esconder o caminho, e por isso ficou como está.

## [0.55.0] — 2026-09-04

Onda de conteúdo do grupo **Obra**: trilhas de Obras e de Avanço. E, pela
segunda versão seguida, escrever o treinamento expôs telas que ofereciam o que
não entregavam — desta vez duas que **devolviam a pessoa ao ponto de partida**.
Nenhuma migration.

- **O lápis da lista de obras.** `/obras/[id]` redireciona para `/obras` quem
  não é master ou administrador, mas o botão de editar era oferecido a todos os
  perfis. Gestor e operador clicavam e voltavam para a mesma lista, sem uma
  palavra de explicação.
- **A grade de avanço.** `salvarAvancos` exige `podeEditarCadastros`, e a tela
  mostrava os campos a qualquer um com o módulo. A pessoa digitava o avanço de
  todas as obras e descobria no botão que não podia salvar. Agora a tela tem
  duas formas: com campos para quem lança, e somente leitura para quem
  acompanha — que é o que um gestor precisa fazer ali.

### Corrigido

- **Conteúdo publicado errado na 0.53.0.** A aula `achar-obra`, da trilha
  Primeiros passos — a única que todo perfil faz —, mandava clicar no código da
  obra (o código não é link; o link era um lápis na coluna de ações) e prometia
  "as seções de contratos, orçamento e avanço" numa tela chamada "Editar obra"
  que não tem seção de contratos. Pior: o passo era **impossível** para gestor
  e operador, que são a maioria de quem faz a trilha.

  A trilha foi para a **versão 2** e a aula reescrita. O bump é o mecanismo
  funcionando como projetado: quem concluiu a v1 vê "atualização pendente" e
  relê apenas a aula que mudou — há teste sobre o conteúdo real provando que
  `aulasQueMudaram` devolve exatamente `achar-obra`.
- Na lista de obras, o botão de editar passou a respeitar
  `podeEditarCadastros`, como o botão de excluir ao lado dele já fazia.

### Adicionado

- Trilha **Obras** (módulo `obras`): a lista e o que ela mostra a cada perfil;
  o cadastro e o período, que é o denominador de três indicadores; orçado
  contra realizado com o veredito em uma frase; a leitura dos cinco
  indicadores de avanço; e o fechamento mensal como fotografia da competência.
- Trilha **Avanço** (módulo `avanco`): a semana que começa na segunda e fecha
  no domingo, o percentual acumulado, a linha em branco que é descartada em vez
  de virar zero, o desvio calculado enquanto se digita, e os dois indicadores
  da ficha da obra que dependem exclusivamente deste lançamento.

### Alterado

- A tela de Avanço das obras é somente leitura para gestor e operador, com o
  percentual da semana em texto e um aviso de quem lança.

### Testes

- Teste novo sobre o conteúdo real: quem concluiu a v1 de Primeiros passos relê
  exatamente uma aula. É o que prova que uma correção de conteúdo chega a quem
  já tinha concluído.
- A fixture de `resumirPendencias` passou a derivar a versão da própria trilha,
  em vez de um `1` escrito à mão. O literal fazia o teste quebrar a cada bump
  de conteúdo, apontando para o lugar errado — foi o que aconteceu aqui.

## [0.54.0] — 2026-09-04

Onda de conteúdo do grupo **Equipamento**: quatro trilhas de treinamento
(Catálogo, Frota, Termo de responsabilidade e Estoque), cada uma restrita a
quem tem o módulo liberado. A máquina do treinamento não mudou — só o
conteúdo entrou. Nenhuma migration.

Escrever o treinamento expôs duas telas que prometiam o que não entregavam, e
as duas foram fechadas nesta versão. Treinar sobre um furo é pior que o furo:
a aula precisaria ensinar o caminho que não existe.

- **Estoque sem estorno.** A tela dizia, por escrito, que "o lançamento não
  pode ser editado nem apagado depois — correção é estorno". Mas não havia
  botão nenhum: `estornarMovimento` estava escrita, testada pela action e
  inalcançável pela interface. Quem digitasse 100 no lugar de 10 não tinha
  caminho de volta.
- **Exclusão de item em silêncio.** `excluirItem` fazia `delete` e descartava o
  erro. Item já usado em peça, contrato ou movimento é recusado pela chave
  estrangeira — e a janela de confirmação fechava como se tivesse excluído,
  com o item ainda na lista e nenhuma palavra de explicação.

### Adicionado

- Trilha **Catálogo de itens** (módulo `itens`): a diferença entre tipo e peça,
  a escolha de controle que decide em que tela o item aparece, o cadastro das
  unidades e a diferença entre inativar e excluir.
- Trilha **Frota** (módulo `frota`): achar a peça pelos quatro filtros, ler
  "com quem está" e "há quanto tempo", movimentar entre obra, almoxarifado e
  fornecedor, a matriz de situações e os campos de TI (IMEI, linha, service
  tag, memória).
- Trilha **Termo de responsabilidade** (módulo `termos`): cadastro de quem
  assina, o passo a passo em três etapas, o que a assinatura muda, a devolução
  em partes e o encerramento com pendência registrada.
- Trilha **Estoque** (módulo `estoque`): os cinco tipos de movimento, a
  correção por estorno e a leitura dos indicadores na ordem certa.
- **Estorno de movimento de estoque** na tela: botão na lista de últimos
  movimentos, com motivo obrigatório. Grava o movimento contrário apontando
  para o original; as duas linhas ficam riscadas e visíveis no razão.

### Corrigido

- Excluir item do catálogo já usado agora devolve o motivo dentro da janela de
  confirmação e sugere deixar o item inativo. O `.select("id")` transforma
  "não apagou nada" em erro: DELETE de zero linhas não é erro para o
  PostgREST, então uma policy que filtra a linha devolvia `error: null` com
  nada apagado.

### Alterado

- O formulário de lançar movimento de estoque só aparece para quem tem
  permissão de lançar (operador, administrador ou master), como já era o
  padrão do bloco Movimentar da peça. Antes o gestor preenchia seis campos
  para receber "sem permissão" no fim.

### Testes

- A varredura de integridade do conteúdo passou a cobrir cinco trilhas: ids
  únicos, quatro alternativas, `correta` inteira e no intervalo, pergunta
  apontando para aula existente e toda aula declarando ao menos uma rota.
- Fechado o débito registrado na 0.53.0: o ramo de módulo de
  `trilhasDoUsuario` agora é exercitado pelo **conteúdo de produção**, e não
  só por trilha sintética. Enquanto a única trilha real tinha `modulo: null`,
  nenhuma trilha de produção passava por esse ramo — a regra estava testada, o
  conteúdo não.
- Guarda nova: o gabarito não pode ficar todo na mesma posição. Questionário
  com a resposta certa sempre na mesma letra é passável sem ler nada, e o
  comprovante sai assinado igual.

## [0.53.0] — 2026-09-04

Fatia 1 do módulo de treinamento. Duas decisões de desenho sustentam o
módulo: o conteúdo das trilhas mora no código-fonte, versionado junto do
resto do sistema, não numa tabela editável; e o manual (`/ajuda`) e a trilha
(`/treinamento/[trilha]`) leem a mesma fonte de conteúdo, só em ordens
diferentes — uma por aula, em sequência; a outra por tela, sob demanda.

A migration `0063_treinamento_conclusao.sql` já está aplicada em produção: a
tabela do registro, a regra de aprovação no próprio banco
(`acertos = total_perguntas`), a chave única por versão de conteúdo, escrita
restrita à própria pessoa e nenhuma policy de exclusão.

### Adicionado

- Tela de Treinamento (`/treinamento`), com trilhas que ensinam o sistema
  passo a passo — cada passo diz o que fazer e o que deve acontecer.
- Trilha **Primeiros passos**, com 6 aulas: entrar, trocar a senha, entender
  por que o menu varia por usuário, achar uma obra, filtrar uma lista e
  pedir o acesso que falta.
- Questionário de 4 perguntas ao final da trilha, corrigido no servidor.
  Errar não tem custo: o sistema explica a resposta certa, aponta a aula e
  deixa tentar de novo. É preciso acertar todas para concluir.
- Comprovante em PDF (`FRM-TR-001`), assinado na tela, com número de
  registro, pela rota `/api/treinamento/[trilha]/comprovante`.
- Tela de Ajuda (`/ajuda`), com o mesmo conteúdo do treinamento organizado
  por tela, para consulta pontual.
- Cálculo de pendência: quando uma trilha muda, quem já concluiu a versão
  anterior vê só as aulas que mudaram desde então.
- Painel `/treinamento/pendentes`, para quem administra o sistema acompanhar
  quem treinou e quem falta. Treinamento pendente não bloqueia nenhum
  acesso — o painel serve para cobrar, não para trancar.
- Itens de navegação **Treinamento** e **Ajuda**, junto de Novidades e
  Configurações — fora dos grupos de área de trabalho.

## [0.52.0] — 2026-09-04

Fase 1b da spec do recebimento de equipamento. **Sem migration** — todas as
colunas necessárias entraram na 0049.

### Adicionado

- **Fechamento do recebimento.** Numera pelo contador gapless da 0048, congela o
  registro, carimba `data_retirada` nos `item_locado` do contrato, gera o
  romaneio e avisa o fornecedor.
- **Romaneio de recebimento em PDF**, dos primitivos de `pdf-form`. Identificação,
  tabela de itens com patrimônio e condição, seção de ressalvas e assinaturas do
  conferente e do entregador.
- **E-mail ao fornecedor** com o romaneio anexo, usando o template
  `recebimentoFornecedor` e a trava de modo de teste da v0.38.0.
- **Rota `/api/recebimentos/[id]/pdf`** — o romaneio a qualquer momento depois do
  fechamento. Rascunho responde 409: ele não tem número, e documento sem número
  circulando é o que a numeração existe para impedir.

### Decisões

- **A ordem do fechamento é deliberada:** valida → numera → fecha → carimba →
  avisa. Do aviso para trás nada é desfeito. Se o Resend cair, o recebimento
  CONTINUA FECHADO com `aviso_enviado_em` nulo e a tela mostra "fornecedor não
  avisado". Uma entrega física que já aconteceu não deixa de ter acontecido
  porque um serviço de e-mail está fora do ar — e desfazer devolveria um número
  já gasto, abrindo o buraco que o contador existe para evitar.
- **`ActionResult` ganhou `aviso`** para o caso "deu certo, mas com ressalva".
  Devolver `ok: false` quando o fechamento aconteceu seria mentira.
- **A confirmação é validada no servidor**, não só no cliente: confirmação só no
  navegador é decoração, qualquer requisição forjada passa por cima.
- **`.eq("status", "rascunho")` no UPDATE de fechamento** é a trava contra o
  duplo clique — dois fechamentos simultâneos gastariam dois números.

### Corrigido

- **O rodapé de todo PDF dizia "Recursos Humanos".** Estava fixo no primitivo
  `Documento`, herdado dos seis documentos do alojamento. O romaneio vai para um
  fornecedor de equipamento. Virou prop, com o padrão anterior preservado.

  Só apareceu ao **renderizar e ler o PDF** — typecheck, lint, contagem de
  páginas e os cinco testes do romaneio passavam todos. É a terceira vez que a
  regra "olhar o PDF, não só contar páginas" paga o próprio custo.

### Verificação

- 597 testes. Cinco novos para o romaneio: soma das larguras de coluna, caso
  simples, com ressalvas, trinta itens em várias páginas, e todos os opcionais
  vazios.
- PDF renderizado e **lido** duas vezes — antes e depois da correção do rodapé.

### Ainda não feito

- Reabrir um recebimento fechado (só master) e reenviar o aviso quando o e-mail
  falha. Os dois estão previstos na spec e não entraram nesta fatia.

## [0.50.0] — 2026-09-02

Fatia 1 da custódia da peça. O achado que ordenou a fatia: a peça não podia
ser alterada — `adicionarUnidade` gravava situação e obra no cadastro e
nenhum caminho humano os alterava depois, então "com quem ficou" não era só
falta de tela, faltava o próprio ato de mover.

### Adicionado

- Tela própria da peça (`/frota/[id]`), com o histórico completo de posse:
  quem ficou com o equipamento e por quanto tempo.
- `moverPeca`, `editarPeca` e `mudarSituacao` (`src/app/(app)/frota/actions.ts`)
  — o ato de mover a peça entre obra e almoxarifado, ou para manutenção em
  fornecedor, que não existia.
- Livro `custodia_peca`, somente-inclusão: movimentação registrada não pode
  ser editada nem apagada — corrigir é encerrar a posse e abrir a seguinte.
- Campos de TI na peça (IMEI duplo, número de linha, operadora, service tag,
  memória, configuração), com perfil de campos por categoria.
- Emitir, devolver, encerrar e cancelar termo passam a abrir e fechar posse
  de funcionário sozinhos, sempre na data do documento — não na data do
  lançamento.

### Corrigido

- A devolução de um item do termo aceitava data anterior à da entrega. Agora
  recusa.
- O encerramento de um termo com devolução parcial anterior gravava uma
  linha duplicada, de duração zero, no livro de custódia. Corrigido.
- Excluir uma peça que já tem histórico de custódia não funcionava e não
  dizia nada: o `on delete cascade` do livro dispara a guarda de
  imutabilidade e aborta o delete, e `excluirUnidade` descartava o erro.
  Agora a recusa é explicada, com o caminho certo (baixar a peça).
- A data do fim da posse saía de `.slice(0, 10)` sobre `timestamptz`, que é
  a data UTC do instante: das 21h à meia-noite em Brasília, o dia seguinte.
  A posse de almoxarifado nascia no futuro e travava a peça até o dia virar.
- Cancelar um termo já encerrado duplicava a posse de almoxarifado ("do
  almoxarifado para o almoxarifado"). A guarda passa a cobrir também a peça
  já solta pelo encerramento — e, de graça, a mesma peça repetida em duas
  linhas do mesmo termo.
- UPDATE que atinge zero linhas não é erro para o PostgREST: os cinco
  updates de `equipamento_unidade` desta fatia (`abrirCustodia`, `moverPeca`,
  `mudarSituacao`, `moverPecasDoTermo` e `liberarPecas`) ganharam
  `.select("id")` e tratam lista vazia como falha. Divergência silenciosa virou erro visível,
  independentemente da migration 0061.
- As falhas do livro de custódia deixam de ser descartadas nas quatro actions
  do termo (e o ramo `fim < inicio` passa a logar): termo retrodatado ficava
  assinado sem linha de custódia, sem erro e sem rastro.

### Alterado

- `custodia_peca.detentor_rotulo` (migration **0062**, no repositório e
  **não aplicada**): o nome do detentor é congelado na abertura da posse. O
  embed que resolvia o rótulo respeita a RLS da tabela embutida — para
  gestor/operador não membro da obra o nome voltava nulo — e `soft_delete`
  de obra apagava o nome dela de todo o histórico, para todo mundo.

### Segurança

- Migrations 0059 (livro `custodia_peca`, campos de TI, perfil de campos da
  categoria) e 0060 (revoke do guard) aplicadas em produção. **A migration
  0061 (alarga a policy de RLS de atualização de unidade) está no
  repositório e pendente de aplicação** — depende de uma decisão ainda não
  tomada; não presuma que já vale em produção.

## [0.49.1] — 2026-09-02

### Corrigido — segurança

A view `termo_equipamento_situacao` (migration 0056) nasceu com
`security_invoker` desligado, que é o padrão do Postgres 15+: ela executava com
os privilégios do DONO (`postgres`), não de quem consulta. Como o dono ignora
RLS, qualquer usuário autenticado podia ler pela view o id e a situação de todo
termo de TODAS as organizações, sem passar pela policy `termo_select` — o mesmo
tipo de furo que o AGENTS.md descreve para o `createAdminClient()`, por outra
porta.

Apontado pelo advisor de segurança do Supabase (lint 0010, nível ERROR) e
confirmado por `reloptions` nulo em `pg_class`. Corrigido pela migration 0058;
verificado depois que `reloptions` passou a `security_invoker=on` e que o
advisor não reporta mais nenhum ERROR.

Nenhum termo real havia sido emitido em produção entre a 0.49.0 e esta
correção.

### Adicionado

- `src/lib/migrations-seguranca.test.ts` — varredura das migrations, sem lista
  de nomes a manter: toda view precisa declarar `security_invoker = on` e
  nenhuma migration pode desligar RLS. Verificado que a guarda reprova o estado
  anterior à 0058.

## [0.49.0] — 2026-09-02

Termo de responsabilidade por uso de equipamento (FRM-EQ-001). O equipamento
saía do almoxarifado para a mão do funcionário sem documento nenhum: quando
sumia ou voltava quebrado, não havia papel dizendo quem estava com ele, em que
estado saiu e quando deveria voltar.

### Adicionado

- Módulo **Termos** — lista, assistente de emissão e tela de detalhe.
- Cadastro de **funcionários** que recebem equipamento (CPF, função,
  matrícula, obra).
- **Assinatura na tela** (dedo ou mouse) impressa no PDF, com hora e IP
  registrados por assinatura — `SignaturePad` promovido para
  `components/shared/` e `Assinaturas` do `pdf-form` ganhou `modo="imagem"`.
- **Devolução parcial**, item a item, sem assinatura por item; a assinatura é
  do encerramento. Exigi-la a cada furadeira que volta faria o almoxarife
  perseguir o funcionário o dia inteiro, e o resultado seria ninguém registrar
  devolução nenhuma.
- **Documento FRM-EQ-001** (`src/lib/documentos/frm-eq-001.tsx`) com rota
  `/api/termos/[id]/pdf`. A devolução é COLUNA na tabela de itens, não um
  segundo documento: quem confere a volta vê, na mesma linha, em que estado a
  peça saiu e em que estado voltou.
- Tipo de template `termo_equipamento` — as cláusulas são editáveis em
  Configurações › Templates, como o FRM-RH-001. Revisar cláusula é assunto do
  Jurídico e não pode exigir deploy.
- Migration `0056_termo_equipamento` — 4 tabelas, a view
  `termo_equipamento_situacao` e o prefixo `TRM` na numeração de registros.

### Integração com a Frota

Emitir um termo move a peça para `em_uso`; devolver, encerrar ou cancelar a
devolve para `disponivel`. As transições passam pela matriz única de
`src/lib/frota.ts`, com origem `evento` — peça que volta com avaria vai para
`disponivel`, e não para `manutencao`: quem decide mandar para conserto é quem
olha para ela, na tela de Frota.

### Segurança

- Termo emitido **cancela**, com motivo, e continua no histórico. A guarda da
  exclusão está no banco (`.is("emitido_em", null)`), não só na tela — a tela
  pode estar velha, e apagar um termo emitido apagaria um documento assinado.
- Emissão e encerramento são idempotentes: dois cliques não emitem duas vezes
  nem estouram erro de unique na cara de quem está com o funcionário na frente.

## [0.48.0] — 2026-09-02

Módulo Estoque. Antes de construir, a auditoria mostrou que boa parte de um
módulo de estoque JÁ existia no Loca:

| Função | Onde já estava |
|---|---|
| Entrada | `recebimento` + `recebimento_item` (0049) |
| Saída para contrato | `item_locado` (0006) |
| Saída para pessoa | `termo_equipamento_item` (0056) |
| Devolução | `movimentacao` (0006) |
| Baixa e perda | `equipamento_unidade.situacao` (0055) |
| Onde está | `equipamento_unidade.obra_id` (0055) |

O que NÃO existia é **saldo por quantidade**. Esta fatia é esse razão.

### Adicionado

- **`movimento_estoque`** — razão append-only. Entrada, saída, ajuste positivo,
  ajuste negativo e baixa, com origem (manual, recebimento, termo, contrato,
  inventário) e estorno apontando para o movimento original.
- **`item_catalogo.estoque_minimo`** — ponto de pedido.
- **`/estoque`** — saldo por item com classe ABC, quatro KPIs de atenção,
  formulário de lançamento e os últimos 50 movimentos.

### Decisões

- **NÃO cria controle paralelo de equipamento por peça.** Isso daria ao sistema
  duas verdades sobre onde a betoneira está — "em uso" na frota e "disponível"
  no estoque — e ninguém saberia em qual acreditar. Peça continua em `/frota`.
- **Não há coluna de saldo.** Coluna de saldo é a fonte clássica de divergência:
  qualquer escrita que esqueça de atualizá-la faz o número mentir para sempre, e
  ninguém descobre até o inventário.
- **Quantidade é sempre positiva; o TIPO dá o sinal.** Guardar negativo obriga
  toda consulta a lembrar da convenção, e a primeira que esquecer soma saída
  como entrada.
- **Saldo negativo é PERMITIDO e destacado.** Travar em zero esconderia
  exatamente o erro de lançamento que o razão existe para revelar — e a tela põe
  os negativos acima de tudo, porque contaminam o consumo e a curva ABC.
- **O razão é imutável.** Trigger recusa `UPDATE` e `DELETE` com mensagem que
  ensina o caminho: registre um estorno. As duas linhas ficam visíveis e
  riscadas.
- **Consumo conta só `saida`.** Ajuste de inventário e baixa reduzem saldo mas
  não são consumo; misturá-los inflaria a curva ABC e o giro com correção de
  erro.
- **Item sem mínimo não entra em ruptura.** Sem parâmetro não há ruptura, e
  apontar todo item sem configuração faria a lista nascer inútil.

### Corrigido durante a implementação

- **A curva ABC classificava errado.** Eu usava o acumulado DEPOIS de somar o
  item, então o item que cruza os 80% caía na classe seguinte: com dois itens em
  que o maior era 99,9% do consumo, justamente ele virava C. A convenção de
  Pareto é o contrário — o item que LEVA ao corte pertence à classe superior. O
  teste pegou.

### Testes

- `estoque.test.ts` — 29 casos: o sinal de cada tipo, saldo negativo permitido,
  precisão de 3 casas, os cortes de Pareto em 80 e 95, empate mantendo ordem
  alfabética, giro sem divisão por zero, e ruptura ignorando item sem mínimo.
- Migration validada num Postgres descartável com sete comportamentos, entre
  eles o saldo somado dando exatamente o mesmo 67 do teste puro, `UPDATE` e
  `DELETE` recusados pelo trigger, e estorno aceito uma única vez.

## [0.47.0] — 2026-09-01

Modularização: fechar o buraco de acesso e organizar o menu que cresceu.

### Segurança

- **`/recebimentos` era acessível a qualquer usuário autenticado.** A rota existe
  desde a 0.39.0 e nunca foi registrada em `MODULOS`. O middleware só checa
  permissão quando `moduloDaRota` devolve algo; para uma rota não registrada
  devolve `null`, e o acesso passa direto. Nenhum teste pegava, porque a tela
  funcionava perfeitamente — para todo mundo.

### Adicionado

- **Varredura de rotas contra módulos** em `modulos.test.ts`. Lê o diretório
  `src/app/(app)` em vez de uma lista escrita à mão: rota nova entra na
  checagem por EXISTIR. A única forma de escapar é declará-la em `SEM_MODULO`
  **com o motivo** — decisão consciente, não esquecimento. Mais duas travas: a
  lista de exceções não pode conter rota que já não existe, e todo módulo
  declarado tem de ter pasta no disco.
- **Grupos no menu** — Obra, Equipamento, Imóveis, Financeiro. O grupo é só
  rótulo visual; quem controla acesso continua sendo `modulo`.

### Decisões

- **O grupo não é um nível de permissão.** Seria tentador liberar "Equipamento"
  inteiro de uma vez, mas isso trocaria 7 decisões explícitas por 1 grosseira —
  e quem precisa ver Frota não necessariamente pode ver Contratos.
- **Rótulo de grupo aparece só com a sidebar expandida.** Recolhida só há espaço
  para o ícone, e um rótulo cortado é pior que nenhum.
- **`termos` foi registrado e depois removido** no mesmo trabalho: a varredura
  acusou "módulo aponta para rota que não existe". Volta quando a Task 5 do
  termo criar `/termos` — que é o teste funcionando como projetado.

### Verificado

A varredura foi testada removendo `recebimentos` de propósito: acusa com o nome
da rota órfã e a explicação de por que aquilo é um problema. 482 testes.

## [0.46.0] — 2026-09-01

Fatia 1 de `docs/superpowers/specs/2026-08-31-cadastro-frota-design.md`: "onde
está e com quem". Valor, NF e especificação técnica são a fatia 2; capacitação e
inspeção periódica, a 3.

### Adicionado

- **`categoria_equipamento`** — tabela semeada com 8 categorias em ordem de
  obra, não alfabética. Categoria em texto livre viraria "Ferramenta elétrica",
  "ferramentas eletricas" e "Fer. Elétr." em seis meses, e nenhum relatório
  fecharia.
- **Seis colunas em `equipamento_unidade`** — `propriedade`, `situacao`,
  `obra_id`, `numero_serie`, `ano`, `estado`. A peça tinha DOIS campos úteis; é
  lá que faltava tudo.
- **`/frota`** — lista de peças, não de modelos, com filtros ao vivo por
  situação, propriedade, categoria e obra. É a tela que entrega o valor: sem
  ela, os campos novos ficariam cadastrados e ilegíveis.
- **A matriz de transição** em `src/lib/frota.ts`, fonte única.

### Decisões

- **`em_uso` só muda por evento**, nunca à mão. E peça em uso **não pode** ir
  para manutenção, baixada nem perdida — nem por evento. É a linha que dá
  sentido a todas as outras: marcar "perdida" com a peça em uso apagaria em
  silêncio o fato de alguém ter ASSINADO por ela.
- **Defaults honestos:** `locada` e `disponivel` descrevem exatamente o que já
  estava cadastrado — o Loca só teve equipamento de terceiro, e nenhuma peça
  está registrada como entregue. Nada migra.
- **`obra_id` nulo é o almoxarifado central**, um estado legítimo, e a tela
  escreve isso em vez de mostrar travessão.
- **`estado` entra numa fatia sobre localização** porque sem ele `disponivel`
  passa a mentir: o sistema ofereceria para entrega uma furadeira quebrada.
- **Leitura livre na organização**, exceção consciente ao escopo por obra: um
  gestor precisa ver que a betoneira está na Obra B justamente para ir buscá-la.
- **`unidadeSchema` saiu de `itens/actions.ts`** para `src/lib/frota.ts`. Estava
  dentro de um arquivo `"use server"` — inalcançável para componente cliente e
  invisível para a varredura de schemas.
- **O formulário continua em `useActionState`.** São 7 campos, mas nenhuma
  validação cruzada, e a regra do AGENTS.md pede resolver só com ≥3 campos E
  validação cruzada.

### Testes

- `frota.test.ts` — 20 casos: a matriz inteira, incluindo as seis transições
  bloqueadas, e o schema com string vazia virando null, ano fora da faixa e
  idempotência.
- Migration validada num Postgres descartável com **duas organizações e uma peça
  pré-existente**, provando seis comportamentos: a peça antiga sobreviveu com
  defaults honestos, a semeadura acertou as duas organizações, reaplicar não
  duplica, situação e ano fora do check são recusados, e apagar categoria não
  apaga o item.

### Corrigido — a suíte, que ficou instável nesta fatia

Os testes que renderizam PDF de verdade passaram a falhar por TIMEOUT, de forma
intermitente (1 a 4 falhas em 477, em cerca de uma rodada em três). Não era
asserção errada: os 12 casos de `pdf-form.test.tsx` passam em **6,2s isolados** e
estouravam o teto global de 30s na suíte completa.

Causa: `renderToBuffer` é CPU-bound e disputa com os outros arquivos em paralelo.
Esta fatia acrescentou 5 arquivos de teste (23 → 28), e o render de PDF, que já
estava na fronteira desde que o teto subiu de 5s para 30s, perdeu a disputa.

Diagnóstico registrado, porque descarta as saídas fáceis: limitar `maxWorkers`
para 4 e para 6 **não** estabilizou, e a mesma suíte completou em 33s numa rodada
e em 231s em outra, sem mudança de código. Sete vezes de variação — a máquina
oscila, e nenhum teto fixo modesto sobrevive a isso.

Correção: `vi.setConfig({ testTimeout: 120_000 })` nos três arquivos que
renderizam PDF. Não é mascarar. O que esses testes afirmam é contagem de páginas,
não velocidade; o timeout existe para pegar travamento, e 120s continua pegando.
Quando a máquina está saudável o teste termina em 6s de qualquer jeito. E um
teste que falha por contenção treina a equipe a ignorar a suíte, o que é pior que
não ter o teste.

Verificado: três suítes completas seguidas, 477/477.

## [0.45.1] — 2026-09-01

### Segurança

- **`guard_fechamento_imutavel` deixou de ser executável via API.**
  `get_advisors` apontou a função de trigger da 0053 como `SECURITY DEFINER`
  chamável por `anon` e `authenticated` em `/rest/v1/rpc`. Chamá-la direto
  falharia ("trigger functions can only be called as triggers"), mas função de
  trigger não tem motivo nenhum para estar no PostgREST.

  **A primeira tentativa não funcionou, e a verificação foi o que pegou.**
  Revogar de `anon, authenticated` não surtiu efeito algum: o `EXECUTE` de
  função é concedido a `PUBLIC` por padrão e os dois papéis herdam dali.
  `has_function_privilege` continuava devolvendo `true` depois da migration
  "bem-sucedida". Corrigido revogando de `public`, e confirmado: os dois papéis
  sem `EXECUTE`, trigger ativo, e o apontamento fora da lista de advisors.

  Registrado no arquivo da migration o que NÃO se deve replicar: revogar
  `EXECUTE` de `current_org_id`, `current_papel`, `is_member_of_obra` ou
  `pode_*` quebraria a RLS inteira, porque essas são avaliadas dentro das
  policies com o privilégio de quem consulta.

  As outras quatro funções de trigger do projeto têm o mesmo apontamento, de
  antes desta fatia, e ficam para uma passagem própria de higiene.

## [0.45.0] — 2026-09-01

Subprojeto D, o último do pedido da diretoria. "Abater o saldo dos contratos ao
fim do mês" não pedia uma conta nova — pedia PARAR DE RECALCULAR.

### Adicionado

- **`fechamento_mensal`** — a fotografia da competência. Orçado, realizado do
  mês, acumulado, saldo, consumo e avanço ficam GRAVADOS, com autor e data.
- **Trigger `guard_fechamento_imutavel`** — recusa `UPDATE` em fechamento não
  reaberto, com mensagem legível: "Competência fechada em 09/2026 não pode ser
  alterada. Reabra o fechamento primeiro."
- **Reabertura registrada** — `reaberto_em` e `reaberto_por`. É o único `UPDATE`
  que o trigger aceita numa linha fechada; depois dela, a linha aceita correção.
- **Bloco de fechamento** no detalhe da obra, com a variação em pontos contra o
  mês anterior.

### Decisões

- **Se o fechamento fosse consulta, não seria fechamento.** Mudar um preço em
  outubro reescreveria setembro em silêncio, o e-mail que o diretor tem na caixa
  deixaria de bater com o sistema, e a partir daí nenhum número do histórico
  seria defensável.
- **O saldo é sobre o ACUMULADO, não sobre o mês.** Ninguém orça locação por
  mês; orça a obra. Saldo mensal seria uma fração sem significado.
- **O avanço fotografado é o do FIM da competência**, não o de hoje. Fechar
  setembro em outubro tem de registrar o avanço de setembro.
- **`check (extract(day from competencia) = 1)`** impede competência no meio do
  mês, que geraria duas fotografias do mesmo período.
- **A sugestão de competência é o mês ANTERIOR.** Fechar o mês corrente
  fotografaria um período que ainda vai receber lançamento.
- **Variação `null` sem mês anterior fechado.** Melhor que mostrar 62 pontos de
  variação que só existem porque não havia base.

### Testes

- `fechamento.test.ts` — 15 casos: saldo sobre o acumulado, saldo negativo,
  orçado zero sem divisão por zero, o lixo de ponto flutuante, a virada de ano
  na competência anterior, e a variação com e sem base.
- Migration validada num Postgres descartável com cinco comportamentos, sendo o
  terceiro o que justifica a tabela: alterar mês fechado é recusado pelo
  trigger; reabrir é aceito; e depois de reaberta a linha aceita correção.

## [0.44.0] — 2026-09-01

Subprojeto C: o elo que faltava entre a nota e o equipamento.
`lancamento_financeiro` se liga ao CONTRATO, e um contrato de R$ 40.000 com
betoneira, gerador e 200 escoras era uma linha só no financeiro.

### Adicionado

- **`lancamento_item`** — o valor de cada item, GRAVADO. `cascade` do lançamento
  (parcela não tem vida própria) e `restrict` da linha do contrato (apagá-la
  apagaria a explicação do custo).
- **`/financeiro/[id]/rateio`** — editor de rateio, com o botão "Ratear
  proporcionalmente" que pré-preenche pelo custo mensal contratado.
- **Bloco "Custo por item"** no detalhe da obra: orçado (do subprojeto B) contra
  realizado (do rateio), do maior desvio para o menor.

### Decisões

- **Não existe regra oculta de rateio.** O valor por item é gravado
  explicitamente; o proporcional é só pré-preenchimento. Rateio automático
  invisível produz um número que ninguém explica quando o diretor pergunta "por
  que a betoneira deu isso?" — valor gravado se explica olhando a linha.
- **A última parcela absorve o arredondamento.** Dividir R$ 100 entre 3 itens
  daria 33,33 × 3 = 99,99 e sobraria um centavo órfão, que num painel é a linha
  que ninguém concilia.
- **Peso total zero devolve divisão igual** — é o único palpite defensável sem
  peso, e melhor que devolver vazio.
- **Atribuição parcial é permitida, e o resto é exibido.** Sem trigger de
  fechamento: forçar a vírgula obrigaria a detalhar tudo ou nada.
- **Item sem orçamento vai para o FIM da tabela.** "Não orçado" não é "dentro do
  orçamento".
- **O confronto é por item do CATÁLOGO, não por linha de contrato** — é a
  betoneira que a diretoria reconhece, não a linha 3 do contrato 7.
- **O rateio é substituído por inteiro** ao salvar. Diferenciar o que mudou
  criaria bug de parcela órfã quando alguém remove uma linha.
- **Parcela zero não é gravada:** "não atribuí" e "atribuí R$ 0,00" são a mesma
  coisa, e a segunda só polui a leitura.

### Testes

- `custo-item.test.ts` — 17 casos: proporcional com fechamento exato, divisão
  igual sem peso, o resto positivo e negativo, o lixo de ponto flutuante, a
  ordenação com item sem orçamento no fim, e a recusa de item repetido com a
  mensagem na linha.
- Migration validada num Postgres descartável com cinco comportamentos:
  atribuição parcial aceita, item repetido recusado, valor negativo recusado,
  `restrict` protegendo a linha do contrato e `cascade` levando o rateio.

## [0.43.0] — 2026-09-01

Subprojeto F do pedido da diretoria: o painel e os indicadores quinzenais. Não
tem migration — é agregação do que as fatias A, E e B já gravam.

### Adicionado

- **`src/lib/painel.ts`** — a linha do painel de cada obra, montada a partir de
  `avanco.ts` e `orcamento.ts`, e **ordenada por gravidade**. A ordenação é a
  razão de o módulo existir: um diretor com 7 obras não lê 7 linhas procurando o
  problema.
- **Card "Situação das obras"** na tela de Início, com os três percentuais,
  projeção, itens em aberto e o veredito de cada obra. Respeita o filtro de obra
  da própria tela.
- **E-mail `indicadores-quinzenais`** e cron `0 7 1,16 * *`, para
  `config_alerta.destinatarios`. Leva o que a diretoria pediu: percentuais por
  obra, quantidade de itens locados, previsão de desembolso até o fim dos
  contratos e o estouro projetado somado.

### Decisões

- **Quinzenal são dias fixos (1 e 16), não "a cada 14 dias".** Dias fixos tornam
  a primeira e a segunda metade do mês comparáveis mês a mês; a cada 14 dias a
  janela deriva pelo calendário e a comparação morre — que é justamente o que um
  indicador de diretoria existe para permitir.
- **Obra sem dado nenhum vai para o FIM da ordenação, não para o topo.** "Não se
  sabe" não é "está mal", e enterrar uma obra saudável embaixo de uma
  desconhecida seria pior.
- **Gravidade prioriza estouro em reais** sobre qualquer percentual: é o número
  sobre o qual a diretoria decide.
- **`entradasPainel` LANÇA em erro de leitura**, em vez de devolver vazio. A
  regra de devolver `[]` vale para tela de listagem, onde vazio é honesto; aqui
  o agregado alimenta e-mail de diretoria, e um `[]` silencioso viraria "nenhuma
  obra com problema" — plausível e errado. Mesma regra de `gerarRelatorio`.
- **Painel e e-mail declaram quantas obras estão sem diagnóstico.** É o número
  que impede o conjunto de mentir por otimismo.
- **Previsão até o fim usa `Math.max(0, …)` nos meses restantes.** Contrato
  vencido não gera desembolso futuro, e sem a trava a previsão sairia negativa —
  aparecendo como crédito no e-mail.

### Testes

- `painel.test.ts` — 10 casos: o cruzamento completo, obra sem orçamento, sem
  avanço e sem período, a ordenação com estouro no topo, a obra sem dado no fim,
  e os totais do resumo.
- Cron exercitado ponta a ponta com a trava de e-mail em "bloqueado": 401 sem
  segredo, período correto, zero envios, e o agregado lido contra o schema real
  de produção sem lançar.

## [0.42.0] — 2026-09-01

Subprojeto B de `docs/superpowers/specs/2026-09-01-orcamento-locacao-design.md`.
Fecha o terceiro percentual do pedido da diretoria: com prazo, avanço e consumo
na mesma tela, dois números viram diagnóstico.

### Adicionado

- **`orcamento_locacao`** — orçamento por obra, **versionado**. Revisão cria
  versão nova e aposenta a anterior; um índice parcial garante um único vigente
  por obra. Sobrescrever faria o orçamento perseguir o realizado: nunca haveria
  estouro, porque o alvo se move.
- **`orcamento_item`** — detalhamento opcional por item do catálogo. `cascade`
  do orçamento (item de orçamento não tem vida própria) e `restrict` do catálogo
  (apagar item orçado apagaria história).
- **Projeção de estouro** — `projecaoFinal` faz a regra de três entre consumo e
  entrega: 62% de orçamento com 31% de obra projeta 200%. É o número que muda
  decisão.
- **Veredito em uma frase** — consumindo mais rápido que entrega, entregando
  mais que consome, ou alinhado, com margem de 10 pontos para não oscilar por
  arredondamento.
- **Os três percentuais juntos** no bloco de avanço da obra.

### Decisões

- **Realizado é `valor`, não `valor_pago`.** Orçamento é consumido quando o custo
  é incorrido; tratar nota pendente como não consumida faria o percentual
  despencar todo mês e subir na data de pagamento, sem nada mudar na obra.
- **Realizado conta só lançamento com `contrato_id`.** `lancamento_financeiro`
  não tem categoria de custo — `origem` diz como o lançamento nasceu, não de que
  tipo é — e a única distinção entre locação de equipamento e aluguel de imóvel
  é o FK.
- **A tela confessa o dado faltante.** Hoje nenhum lançamento tem contrato
  vinculado, então o bloco declara em reais quanto foi lançado sem vínculo, para
  o 0% ser lido como "falta vincular" e não como "não gastamos".
- **A soma dos itens pode divergir do total, e a diferença é exibida.** Forçar
  igualdade obrigaria a detalhar tudo ou nada.
- **`percentualConsumido` não trava em 100.** Travar esconderia o estouro: obra
  em 130% precisa aparecer como 130%.
- **`projecaoFinal` devolve nada sem avanço.** Obra em 0% que já gastou
  projetaria infinito, e "estouro de ∞" destrói a confiança no painel inteiro.

### Testes

- `orcamento.test.ts` — 25 casos: divisão por zero em orçado e em avanço, o caso
  62/31, obra eficiente, o veredito nos quatro quadrantes, valor com vírgula, e a
  recusa de item repetido com a mensagem na linha do item.
- Migration validada num Postgres descartável antes de produção, com seis
  comportamentos provados: dois vigentes recusados, duas versões convivendo,
  item repetido recusado, valor negativo recusado, `restrict` protegendo o
  catálogo e `cascade` levando os itens.
- `get_advisors` de segurança não aponta nada nas duas tabelas novas.

### Nota sobre o estado dos dados

O realizado começa em zero: nenhum dos lançamentos existentes tem contrato
vinculado. Não é defeito da fatia — é o hábito que precisa mudar, e a tela diz
isso em vez de esconder atrás de um percentual.

## [0.41.0] — 2026-09-01

Primeira fatia de `docs/superpowers/specs/2026-08-31-avanco-obra-design.md`.
Entrega dois dos três percentuais que a diretoria pediu — prazo decorrido e
avanço físico — sem tocar em dinheiro. O terceiro (orçamento consumido) vem nas
fatias B, C e D.

### Adicionado

- **Período da obra** — `data_inicio`, `data_fim_prevista` e `data_fim_real`.
  Todas opcionais: nenhuma obra cadastrada tinha estas datas, e exigi-las
  quebraria todas de uma vez. A validação de "fim previsto não antes do início"
  vive nos dois lados — `check` na migration e `superRefine` no schema. A
  duplicação é deliberada: o banco recusaria com erro cru, sem nome de campo, e
  o formulário não teria onde pendurá-lo.
- **`avanco_obra`** — avanço físico ACUMULADO, um lançamento por obra por
  semana, com `unique (obra_id, semana)`. Acumulado e não incremental porque se
  autocorrige: semana esquecida não corrompe o total, e semana esquecida é
  certeza num processo semanal, não hipótese. O `unique` é o que torna relançar
  uma correção em vez de duplicata.
- **Tela `/avanco`** — uma linha por obra ativa, todas na mesma página. Não é
  conveniência, é a condição de existência do dado: 8 navegações por semana
  matam a rotina no segundo mês. Mostra os pontos de atraso ao vivo enquanto o
  número é digitado.
- **Bloco de avanço** no detalhe da obra, com avanço, prazo, desvio, previsão de
  término e as últimas 8 semanas.
- **E-mail semanal** (`avanco-obra`, cron de segunda 08:20) para os
  destinatários de cada obra, mais a cobrança consolidada das obras sem
  lançamento para `config_alerta.destinatarios`.

### Decisões

- **`previsaoTermino` devolve `null` com ritmo zero ou negativo**, e a tela diz
  "ritmo insuficiente para projetar". Obra parada dividiria por zero e correção
  para baixo projetaria data no passado; "término em 2183" destrói a confiança
  no painel inteiro. A janela do ritmo é de LANÇAMENTOS, não de semanas de
  calendário — semana não informada não pode virar ritmo zero, senão a projeção
  mente para pior exatamente quando o dado está faltando.
- **Linha em branco na tela em lote é descartada, não vira zero.** Como o avanço
  é acumulado, salvar zero apagaria o progresso real de toda obra não
  preenchida.
- **Obra sem período e sem lançamento não recebe e-mail.** Sairia com cinco
  travessões e uma bronca, para quem talvez não saiba que a tela existe. Ruído
  no primeiro contato queima a credibilidade do aviso.
- **Aritmética de data em UTC** em `src/lib/avanco.ts`: os valores são dia de
  calendário, e conta em horário local faria o horário de verão comer ou
  inventar um dia. "Hoje" é sempre `hojeISOSaoPaulo()`.

### Corrigido durante a execução

- A policy da migration usava `current_papel() in ('master','admin','gestor')`.
  `admin` **não existe** desde a 0011 — papel inexistente em policy não dá erro,
  só nega tudo em silêncio. E usava `has_obra_access()`, superada pela 0004 por
  recursão de RLS. Agora usa `is_member_of_obra()` e `pode_gerir_cadastros()`.
- A cobrança das obras sem lançamento estava indo no e-mail de cada obra, e a
  spec dizia "ao administrativo". Passou a ser envio único à organização.

### Testes

- `avanco.test.ts` — 26 casos: canonização da segunda-feira em todo dia da
  semana (inclusive domingo, que a conta ingênua erra), obra de um dia sem
  divisão por zero, clamp em 0 e 100, ritmo zero e negativo, e a janela de
  lançamentos.
- `obra.test.ts` — novo: o módulo não tinha teste próprio. Exige que o erro de
  período saia NO CAMPO, não na raiz — erro de raiz não é renderizado por campo
  nenhum.
- Migration validada executando num Postgres descartável antes de ir a
  produção, e `get_advisors` de segurança não aponta nada em `avanco_obra`.
- Cron exercitado ponta a ponta com a trava de e-mail em "bloqueado": zero
  envios, 401 sem segredo, semana correta.

## [0.40.0] — 2026-08-31

### Corrigido

- **O botão "Registrar recebimento" não criava nada.** A guarda de data em
  `criarRascunhoRecebimento` foi escrita como `/^d{4}-d{2}-d{2}$/` — sem as
  contrabarras. O regex continua VÁLIDO, compila, passa por typecheck, lint e
  build, e recusa toda data. A action retornava cedo, em silêncio, sem erro na
  tela.

  A correção não foi reescrever o regex: foi tirá-lo dali. A verificação passou
  a ser `ehDataISO()`, exportada de `locacao.ts` a partir do `SO_DATA` que já
  existia — uma implementação, sem contrabarra para perder numa próxima edição.

### Adicionado

- **Campo "Controle no recebimento" no cadastro de item**: por quantidade
  (andaime, escora) ou por peça com patrimônio (betoneira, gerador). A coluna
  existe desde a migration 0049 e não tinha tela: os itens controlados por peça
  eram inalcançáveis pela interface, e metade da conferência ficava sem uso.
- **`regex-integridade.test.ts`** — varre o código-fonte procurando
  quantificador de dígito sem contrabarra. É a segunda vez que esta classe
  aparece: `intervaloDoMes` saiu com o mesmo defeito na 0.34.0, pego pelos
  testes do helper antes de chegar ao usuário; esta chegou à produção porque a
  action não tinha teste. O detector foi provado contra o defeito real antes de
  entrar — um teste que nunca viu a falha não prova nada.

De 298 para 303 testes. Sem migration.

## [0.39.1] — 2026-08-31

### Corrigido

- **Sete cadastros não criavam registro novo.** Reportado no cadastro de itens:
  clicar em Salvar não gravava, não navegava e não mostrava mensagem nenhuma. O
  mesmo defeito estava em obra, imóvel, contrato de imóvel, contrato de locação,
  fornecedor e lançamento. Editar sempre funcionou.

  Causa: todo formulário que cria E edita no mesmo componente carrega o id num
  `<input type="hidden" {...register("id")} />`. Num cadastro novo o
  `defaultValue` é `undefined`, e aí o react-hook-form semeia os valores do form
  com o valor do DOM — que é `""` (`updateValidAndValue`). O schema declarava
  `id: z.string().uuid().optional()`, que **recusa `""`**; o `handleSubmit`
  abortava antes de chamar a action. Em silêncio, porque nenhum desses forms
  renderiza `errors.id`.

  Correção: `idOpcional` em [`src/lib/campos.ts`](src/lib/campos.ts) — uma
  implementação, na fonte única de campos opcionais, usada pelos sete schemas.

### Alterado

- **Formulário nenhum reprova em silêncio.** Corrigir a causa não fechava o
  mecanismo que a escondeu: `handleSubmit(onSubmit)` devolve sem chamar nada
  quando a validação reprova, e o que o usuário vê depende de o form renderizar
  `errors.<campo>` daquele campo — para campo oculto, ninguém renderiza. Os 19
  formulários com `react-hook-form` passaram a usar
  `handleSubmit(onSubmit, aoInvalidar(setErroServidor))`
  ([`src/lib/validacao-form.ts`](src/lib/validacao-form.ts)), que joga a primeira
  mensagem no `FormError` que todos já tinham. Quando o campo também mostra a
  mensagem, ela aparece duas vezes — de propósito: o bloco fica onde o olho está
  no instante do clique, e em form longo a mensagem do campo pode estar fora da
  tela.

### Testes

- `schemas-varredura.test.ts` ganhou a segunda propriedade: todo schema que
  aceita a amostra mínima sem `id` tem de aceitar `id: ""`, que é o que o
  browser manda. A varredura só checava idempotência, e a amostra mínima omite
  o `id` — foi o furo por onde este defeito passou.
- `src/app/(app)/itens/item-form.test.tsx` — primeiro teste com DOM do projeto
  (`jsdom` por arquivo; a suíte segue em `node`). Monta o formulário, digita,
  aperta Salvar e exige que a action seja chamada. Prova o sintoma, não só a
  propriedade do schema: quem manda o `""` é biblioteca de terceiro, e uma
  atualização pode mudar isso de novo. Cobre também a rede: submit reprovado tem
  de escrever o motivo na tela.
- `validacao-form.test.ts` — a busca da primeira mensagem na árvore de
  `FieldErrors`, incluindo a trava de não descer no `ref` (que é nó do DOM, e
  tem ciclo).


## [0.39.0] — 2026-08-24

Fase 1a de `docs/superpowers/specs/2026-08-23-recebimento-equipamento-design.md`.
O fechamento, o romaneio em PDF e o e-mail ao fornecedor vêm na 1b.

### Adicionado

- **Recebimento como evento.** Até aqui ele não existia em lugar nenhum:
  `movimentacao` só grava devolução, e a retirada era implícita em
  `item_locado.data_retirada`. O papel que circulava na obra era o do fornecedor.
- **Seção Recebimentos** no detalhe do contrato e tela de conferência em
  `/recebimentos/[id]`.
- **Granularidade mista** — `item_catalogo.controle` (`peca` | `quantidade`).
  O formulário troca o campo conforme o item: seletor de patrimônio ou
  quantidade. Sem isso, o conferente de uma betoneira digitaria "1" e o sistema
  não saberia QUAL betoneira chegou.
- **`item_locado.unidade_id`** — o vínculo que faltava. `equipamento_unidade`
  existia desde a migration 0005 e estava **órfã**: única por organização, e
  nenhuma tabela a referenciava.

### Decisões

- **`recebimento_item.item_locado_id` é nulável de propósito.** Nulo = chegou
  algo fora do contrato. Sem isso o conferente teria de mentir no documento para
  conseguir salvar, e mentira em documento de conferência é pior do que
  divergência registrada.
- **`recebido_em` é campo, não `now()`.** Obra grande lança com o caminhão
  parado; obra pequena manda a nota ao escritório e alguém digita três dias
  depois. Com `now()`, o segundo caso produziria um documento com a data errada
  — e é o documento que vai ao fornecedor.
- **O rascunho nasce sem número.** Esta é a única tabela do sistema sem o
  trigger `trg_numero_registro` da 0048: o número sai no fechamento. Rascunho
  numerado que é excluído deixa exatamente o buraco que o contador gapless
  existe para evitar.
- **`fornecedor_id` vem do CONTRATO, não do formulário.** Aceitá-lo do cliente
  permitiria gravar um recebimento apontando para um fornecedor que não é o do
  contrato — e é ele que receberá o aviso na 1b.
- **Avaria e divergência exigem descrição.** Sem ela o fornecedor recebe "1 item
  com avaria" e não sabe qual nem o quê.

### Verificação

Migration 0049 validada no Postgres local em oito casos, inclusive os três que
devem **recusar**: quantidade zero, condição inválida e número repetido na mesma
organização. Dois rascunhos com `numero_registro` nulo convivem sem colidir no
`unique`.

Rota verificada no servidor de desenvolvimento: `/recebimentos/[id]` responde
307 para `/login` sem sessão, sem erro no log.

**Não verificado num navegador** — as telas não foram abertas com sessão real.

### Ainda não disponível

O botão de fechar. A tela avisa, em vez de deixar o usuário procurar: enquanto a
1b não chega, o recebimento é registro interno e nada sai do sistema.

## [0.38.0] — 2026-08-24

Identidade visual Sistenge em toda a comunicação por e-mail. Um layout só —
cartão branco sobre fundo cinza, cabeçalho em bloco slate-900 com o logotipo em
negativo — escolhido entre três candidatos renderizados lado a lado.

### Adicionado

- **`src/lib/emails/`**: `layout.ts` (o desenho), `templates.ts` (os nove
  e-mails), `base.ts` (primitivos e escape), `contexto.ts` (remetente lido de
  `organizacao`), `relatorio.ts` (adaptador do domínio) e `galeria.ts`
  (pré-visualização local dos dez cenários, sem disparar nada).
- **Logotipo em PNG para e-mail**, gerado por `scripts/gen-logo-email.mjs` a
  partir dos paths de `src/lib/pdf-logo.tsx` — uma cópia só da marca. O fundo vai
  assado no arquivo: com transparência, o Outlook em modo escuro põe preto atrás
  e o wordmark slate-900 desaparece.
- **Quatro templates novos**, prontos e ainda sem gatilho: recebimento de
  equipamento, documento gerado ao terceiro, avaria cobrada do fornecedor e
  fluxo de caixa mensal.
- **`EMAIL_REPLY_TO`** e parte `text/plain` em todo envio.

- **Modo de teste interno** (`EMAIL_MODO_TESTE` + `EMAIL_TESTE_DESTINO`). Fica no
  transporte, o único ponto por onde todo envio passa: desvia os destinatários,
  prefixa o assunto com quem teria recebido e deixa o corpo intacto — é o corpo
  que está sendo avaliado. Ligar sem destino **bloqueia** o envio em vez de cair
  para os destinatários reais.
- **`notificacao_log` suspenso em modo de teste.** A gravação é o que impede o
  reenvio; em teste ela marcaria como "já enviado" um aviso que só chegou às
  caixas de teste, e o destinatário real nunca o receberia. O teste não encheria
  a caixa de ninguém — esvaziaria, em silêncio.
- **`POST /api/dev/emails`** dispara os dez cenários com dados de exemplo, sem
  tocar no banco. Protegida por `CRON_SECRET` e recusa funcionar fora do modo de
  teste. `?somente=<id>` reenvia um só; `GET` lista os ids.

### Corrigido

- **Linhas de subtotal e total do e-mail de relatório não tinham fundo.** A cor
  era interpolada dentro de uma string de aspas duplas, então o HTML recebia o
  texto literal `${SLATE_100}` e o navegador descartava a declaração.
- **Dado do banco entrava cru no HTML.** Um fornecedor cadastrado como
  `Móveis & Equipamentos` já produzia marcação inválida; com `<` no nome,
  engoliria o resto da tabela. Todo dado dinâmico passa por `esc()`.
- **Os avisos de vencimento não tinham identidade nenhuma** — eram os dois
  únicos e-mails que não usavam o layout compartilhado.
- **`NEXT_PUBLIC_APP_URL` sem `https://` quebrava o logotipo de todo e-mail.**
  Em desenvolvimento ela vale `http://localhost:3000`, que nenhuma caixa de
  entrada resolve. Para e-mail, valor que não é `https://` passou a valer como
  valor ausente.

### Alterado

- `enviarEmail` recebe o `EmailPronto` inteiro em vez de assunto e HTML soltos.
  O assunto estava escrito no call site, longe do corpo que anuncia, e já havia
  divergido entre as rotas.
- `src/lib/email.ts` ficou só com o transporte.

## [0.37.0] — 2026-08-24

Fase 0 de `docs/superpowers/specs/2026-08-23-recebimento-equipamento-design.md`.
Vai a produção sozinha e é pré-requisito das outras duas fases.

### Adicionado

- **Número de registro em onze tabelas**: contrato de equipamento (`CTR`),
  contrato de imóvel (`CTI`), devolução (`DEV`), vistoria (`VIS`), vistoria de
  imóvel (`VIM`), avaria (`AVA`), reparo (`REP`), medida disciplinar (`MED`),
  entrega ao alojado (`ENT`), folha de limpeza (`LIM`) e ocorrência (`OCO`).
  Formato `PREFIXO-ANO-0000`, reiniciando a cada ano.
- **Numeração retroativa.** O que já existia foi numerado na ordem de
  `created_at` e no ano de criação. Um livro que começa no meio obriga a
  explicar para sempre por que metade dos registros não tem número.
- **Busca por número na listagem de contratos**, pelos dois números — o do
  fornecedor e o do Loca. Digitar `9` acha o `0009`: ninguém digita
  `AVA-2026-0009` inteiro.

### Decisões

- **Dois números, sempre.** `contrato_locacao.numero` é o número DO FORNECEDOR:
  digitado, pode repetir, pode vir em branco. Não foi tocado. O número do Loca é
  `numero_registro` e vive ao lado. Conflatá-los é o erro clássico.
- **Sem buracos, por decisão.** Uma `sequence` do Postgres seria mais rápida e é
  a escolha óbvia — e está errada aqui: transação abortada queima o número e o
  livro fica sem o `REC-2026-0008` sem que ninguém saiba por quê. O contador é
  uma tabela com `on conflict do update`, que faz o lock de linha sozinho.
- **Trigger, não chamada em cada action.** São onze tabelas escritas por dezenas
  de actions; bastaria uma esquecida para nascer registro sem número. No banco,
  não há como escapar.
- **O ano é o de São Paulo.** `extract(year from now())` daria o ano em UTC, e
  das 21h à meia-noite de 31 de dezembro o primeiro registro de 2027 sairia
  numerado no dia 31/12/2026. Mesma regra do `hojeISOSaoPaulo()`.
- **Fora de propósito:** `lancamento_financeiro` (é linha de conta a pagar, não
  documento que circula) e `item_locado` (a retirada ganha número na fase 1,
  como `recebimento`; numerá-la agora daria dois números ao mesmo evento).

### Verificação

A migration é de DADOS, não só de esquema — roda uma vez e é difícil de
desfazer. Testada contra o Postgres local com duas organizações, dois anos e
linhas fora de ordem de inserção:

| Caso | Resultado |
|---|---|
| Retroatividade por `created_at`, ano e organização | ✓ |
| Contador parado no último de cada (org, ano) | ✓ |
| Insert novo continua a sequência sem colidir | ✓ |
| **Transação abortada não queima o número** (`0002` → `0003`) | ✓ |
| Rodar a retroatividade de novo não renumera | ✓ |
| Cada organização tem o seu `0001` | ✓ |

`registros.test.ts` lê o SQL da migration e compara os prefixos com o mapa do
TypeScript: divergir faria a tela chamar de `CTR` o que o banco gravou como
outra coisa, e nada acusaria.

### Ainda não exposto

O número existe e é único nas onze tabelas, mas só aparece na **listagem de
contratos**. As demais telas e os PDFs continuam sem exibi-lo — é trabalho de
superfície, não de modelo, e vem depois.

## [0.36.0] — 2026-08-24

### Corrigido

**Seis schemas recusavam o próprio output.** Toda action re-valida o que recebe,
e o que ela recebe é a saída do mesmo schema — o zodResolver já transformou no
cliente. O jeito ingênuo de escrever campo opcional quebra isso:

```ts
z.string().trim().max(200).optional().transform((v) => v || null)
//         ↑ aceita string | undefined            ↑ produz null
```

Na segunda passagem o `null` é recusado com *"Invalid input: expected string,
received null"* — o erro cru do zod, sem nome de campo, na tela do usuário.

Estavam quebrados **ao mesmo tempo**, em produção:

| Schema | Efeito |
|---|---|
| `empresaSchema` | Salvar dados da empresa sem razão social, CNPJ, UF, CEP… |
| `fornecedorSchema` | Salvar fornecedor sem CNPJ ou sem e-mail de contato |
| `contratoSchema` | Salvar contrato de equipamento sem observações |
| `itemLocadoSchema` | Item locado sem devolução prevista ou sem identificação |
| `lancamentoSchema` | Lançamento sem contrato vinculado |
| `editarUsuarioSchema` | Redefinir senha de usuário |
| `configRelatorioSchema` | Salvar o relatório automático por e-mail |

O último é de outra forma — `destinatarios` transforma `string` em `string[]` e
recusava o array na re-validação.

### Por que voltou três vezes

O defeito já tinha chegado à produção em `imoveis.ts` (0.23.0 → 0.31.x) e em
`obra.ts` (0.35.0). Cada correção era numa **cópia privada** do mesmo helper de
três linhas, e `schemas-idempotencia.test.ts` cobria uma **lista escrita à mão**
— schema novo nascia fora dela.

Duas mudanças estruturais:

- **`src/lib/campos.ts`** é agora a fonte única: `opcional`, `textoOpcional`,
  `dataOpcional`, `enumOpcional`, `numeroOpcional`, `emailOpcional`,
  `ufOpcional`, `cepOpcional`. Os oito módulos de domínio apontam para ele.
- **`src/lib/schemas-varredura.test.ts`** não tem lista. Importa os módulos de
  domínio, encontra todo export terminado em `Schema` e exige a propriedade de
  todos. Um schema sem amostra **reprova** em vez de ser ignorado — acrescentar a
  amostra passa a ser parte de criar o schema.

De 175 para 221 testes.

## [0.35.0] — 2026-08-24

Implementa `docs/superpowers/specs/2026-08-23-alertas-por-obra-design.md`.

### Adicionado

- **Avisos de vencimento por obra.** Onde saía um e-mail com todas as obras
  para uma lista fixa, passam a sair N+1: um por obra, com o que é dela, e um
  central com tudo agrupado por obra.
- **Destinatários da obra derivados de `obra_usuario`** — a mesma fonte que a
  RLS usa para o acesso. Uma lista digitada seria segunda verdade: tirar alguém
  da obra não tiraria os alertas dela, e a pessoa continuaria recebendo por
  e-mail o que já não pode ver na tela.
- **`obra.destinatarios_alerta`** para quem não tem login — mestre de obra,
  encarregado terceirizado, e-mail do almoxarifado. O formulário mostra quem já
  é coberto pelo vínculo, para evitar o endereço digitado duas vezes.
- **Obra sem destinatário cai na central, sinalizada.** Sem esse fallback a
  mudança seria uma regressão disfarçada de recurso: hoje o alerta chega a
  alguém, depois dela chegaria a ninguém.

### Corrigido

- **`obraSchema` não era idempotente.** A action re-valida o output do próprio
  schema, e `textoOpcional` produzia `null` aceitando só `string | undefined`.
  Salvar uma obra sem endereço, sem responsável ou sem centro de custo falhava
  com "Dados inválidos" sem dizer qual campo. Mesmo defeito de `imoveis.ts`,
  corrigido na 0.31.x — aqui passou batido porque nenhum teste exercitava a
  segunda passagem. `obraSchema` entrou na suíte de idempotência.
- **O insert em `notificacao_log` não tratava erro.** Se falhasse, os e-mails
  já tinham saído e nada ficava registrado — e o mesmo aviso era reenviado no
  dia seguinte, e no outro, sem que nada acusasse.
- **Falha de envio numa obra não derruba mais as outras nem a central.**

### Banco

- `obra.destinatarios_alerta text[]`.
- `notificacao_log.obra_id` — nulo significa envio para a central. Sem ele, a
  mesma referência gravada para a obra e para a central violaria o `unique`,
  abortando o lote e fazendo a central parar de receber em silêncio. O índice
  usa `coalesce` porque, em Postgres, `null` não é igual a `null`.
- **Drift registrado:** `notificacao_log.dias` é lida e gravada pelo cron desde
  a fase 5 e nunca foi versionada. Produção tem a coluna — senão o cron falharia
  todo dia —, mas um banco criado a partir das migrations não teria e o cron
  quebraria no primeiro disparo. Mesmo caso do `config_alerta.dias_alerta` da
  migration 0029. Adicionada de forma idempotente.

### Atenção operacional

O volume de e-mails cresce de 1 para N+1 por dia. Com 20 obras ativas são 21
disparos diários no Resend — vale conferir o plano contratado.

## [0.34.0] — 2026-08-23

### Adicionado

- **Barras do gráfico da home clicáveis.** Cada mês leva a
  `/financeiro?mes=yyyy-MM`, carregando junto o filtro de obra quando há um
  ativo — sem ele a lista viria de todas as obras e o total não bateria com a
  barra que acabou de ser clicada. A coluna inteira é a área de clique: a barra
  pode ter 3px num mês quase vazio.
- **Filtro por mês de vencimento no Financeiro**, um `<input type="month">` na
  barra de filtros. Não é um `<select>` de 12 meses de propósito: quem procura
  uma conta de março do ano passado precisa alcançá-la.
- **Meses da tabela do fluxo de caixa** também levam aos lançamentos.

### Notas

- O recorte é por **vencimento**, não por competência: o vencimento é o eixo do
  gráfico, e clicar numa barra tem de trazer exatamente as linhas que a compõem.
- Com o mês filtrado, a tela **avisa** que a projeção dos contratos não aparece
  na lista. A barra soma pago + pendente + projetado, e o projetado é estimativa
  de contrato em mês sem lançamento próprio — não existe como linha em lugar
  nenhum. Quem clicasse numa barra de R$ 45 mil e encontrasse R$ 12 mil de
  linhas concluiria, com razão, que um dos números está errado.
- O filtro entrou no `aplicarFiltros` compartilhado de `lib/data/financeiro.ts`,
  então listagem e indicadores usam o mesmo recorte. Escrever a condição duas
  vezes é como os KPIs já discordaram da tabela em silêncio antes.

### Corrigido antes de sair

- `intervaloDoMes` nasceu com `/^d{4}-d{2}$/` no lugar de `/^d{4}-d{2}$/` —
  as contrabarras se perderam na escrita do arquivo. O regex recusava **todo**
  mês válido, e o filtro simplesmente nunca se aplicaria: a tela ignoraria o
  parâmetro sem erro nenhum. Pego pelos testes do helper.

## [0.33.0] — 2026-08-23

### Adicionado

- **Fechamento da semana de limpeza.** `auxiliar_nome`, `avaliacao` e
  `observacoes` existiam em `checklist_limpeza` desde a migration 0045 e eram
  lidos pela tela, mas nada os escrevia: abrir a semana registrava que a folha
  fora impressa e a conferência da sexta não tinha onde ser gravada. Toda semana
  aparecia como "Sem avaliação", para sempre.
- **Catálogo de limpeza editável** em Configurações → Catálogo de limpeza. Texto,
  ambiente, frequência e ordem das 44 tarefas do FRM-RH-005. A ordem é a do
  percurso pelo alojamento, não a alfabética — por isso ela é editável e visível.
- **Ocultar tarefa sem apagar.** Alojamento sem lavanderia não precisa da tarefa
  do tanque; apagá-la tiraria o item da folha de todas as outras obras e deixaria
  as semanas já marcadas sem referência.
- **Upload do documento assinado** na medida disciplinar (FRM-RH-002), na entrega
  ao alojado (FRM-RH-003 e 004) e na folha da semana (FRM-RH-005). A coluna
  `documento_path` existia nas três tabelas desde as migrations 0044 e 0045 e
  nenhum código escrevia nela: o sistema gerava o PDF, a obra imprimia, colhia a
  assinatura — e o papel assinado terminava numa gaveta, que é exatamente o
  problema que originou este módulo.

### Alterado

- O nome do ambiente do catálogo aceita 80 caracteres, não 60. O ambiente mais
  longo do catálogo embutido — "QUARTOS / DORMITÓRIOS (áreas comuns — não
  pertences do alojado)" — tem 62, e com o limite antigo seis tarefas semeadas
  pelo próprio sistema seriam impossíveis de reeditar pela tela. Achado por um
  teste que passa as 44 tarefas embutidas pelo schema da tela.
- `semearTarefasLimpeza` saiu de `imoveis/actions.ts` para
  `configuracoes/limpeza-actions.ts`. O catálogo é cadastro da organização — a
  policy `tarefa_limpeza_write` exige `pode_gerir_cadastros()` — e manter a
  criação num lugar e a edição em outro era convidar as duas a divergirem.

### Notas técnicas

- Os dois formulários novos chamam a server action dentro de um `useTransition`
  em vez de `useActionState`: fechar o painel a partir do estado exigiria um
  `useEffect` que chama `setState`, e `react-hooks/set-state-in-effect` reprova.
  O resultado da action chega ao mesmo escopo que fecha o painel.
- Nenhuma migration. As três colunas e o `soft_delete` de `tarefa_limpeza` já
  estavam no banco desde 0044 e 0045.

## [0.32.0] — 2026-08-23

### Alterado

- **Telas de autenticação no padrão do SST Manager**: coluna única centralizada
  sobre fundo claro — logo, nome do produto, cartão do formulário e rodapé. Vale
  para `/login`, `/auth/recuperar` e `/auth/nova-senha`, que compartilham o
  `AuthShell`.
- Saiu o split-screen com painel escuro de apresentação. Ele era vitrine para
  quem já sabe o que o sistema faz: quem chega ali é empregado da Sistenge indo
  trabalhar, não visitante a ser convencido.
- **Tema claro forçado no elemento raiz**, não só no cartão. Antes do login não
  há preferência de tema conhecida, e sobraria o `prefers-color-scheme` do
  sistema operacional — metade das pessoas veria a tela escura e a outra clara.
- O ano do rodapé usa `hojeISOSaoPaulo()`: renderiza no servidor, que roda em
  UTC, e na virada de 31 de dezembro mostraria o ano seguinte.

## [0.31.1] — 2026-08-23

### Alterado

- **Imóvel encerrado não aparece por padrão** na listagem. Sem isso a lista
  cresce para sempre: uma obra entregue deixa dezenas de imóveis que ninguém
  gerencia no meio dos que estão em uso. Continua acessível pelo filtro de
  Status, e continua existindo para contrato e financeiro, que apontam para ele.
- O filtro usa `neq("status", "encerrado")` e não uma lista de status ativos: se
  um status novo surgir, ele aparece por padrão. Só "encerrado" é escondido de
  propósito.
- O placeholder do filtro passou a dizer **"Ativos e em desocupação"** — com
  "Todos" o usuário leria que nada está sendo filtrado e não entenderia por que o
  imóvel que ele encerrou sumiu.

## [0.31.0] — 2026-08-23

### Adicionado

- **Versão e data de publicação no cabeçalho** de toda página de todo documento
  (`Versão 1.2 · 22/08/2026`). O `.docx` original trazia isso e a primeira
  transcrição perdeu — num documento que sustenta justa causa, "ele assinou o
  termo" vale menos que "ele assinou a versão 1.2". O cabeçalho é `fixed`, então
  folha solta continua rastreável.
- Campo **versão** no editor de template, com validação de formato numérico.
  `resolverTemplate()` junta o salvo com o padrão em um lugar só, em vez de
  repetir a decisão em seis rotas.
- Migration `0046`: coluna `versao` em `documento_template`. A **data não é
  campo** — vem de `updated_at`, então revisar a cláusula reata a data sozinho.

### Corrigido

- **A matriz de responsabilidades estava errada.** Eu havia entregado uma lista
  de papel → atribuições em prosa, que é o *Detalhamento* do original — não a
  matriz. A original cruza **atividade × papel** com R/A/C/I, e essa distinção é
  quem responde pelo quê. Refeita com as 12 atividades, e o detalhamento entra
  logo abaixo no mesmo anexo.
- A data de publicação saía em **ISO** (`2026-08-22`) num documento brasileiro.

### Alterado

- Tabelas no formato dos originais do RH: cabeçalho com fundo cheio e texto
  claro, linhas alternadas, grade completa, primeira coluna em negrito.

### Notas de desempenho

- Renderizar o grid do FRM-RH-005 (45 × 10, com 315 caixas desenhadas) custa
  ~5s. Medido: as bordas por célula são **de graça** (1677ms contra 1696ms
  isolado); o custo é o desenho das caixas, que existe porque o Helvetica não tem
  o glifo `☐`. `testTimeout` subiu para 30s.
- Os arrays de estilo passaram a ser **pré-computados fora do map**. Criar array
  novo por linha e por célula derrotava o cache do `@react-pdf` e levava o mesmo
  grid de ~4,5s para ~10s.

## [0.30.0] — 2026-08-23

### Corrigido

- **As tabelas da POL-RH-001 apareciam duas vezes.** O conversor de texto
  descartava fragmento curto de célula ("RH", "SST") mas deixava passar a célula
  longa, então os itens 10 e 11.3 carregavam uma transcrição embaralhada das
  tabelas — e elas saíam corretas no fim. 41 parágrafos de lixo removidos, mais
  as linhas soltas do bloco de assinatura do item 16.
- **Campo opcional em branco fazia a action falhar** com erro genérico. Ver a
  nota de idempotência abaixo — é o mesmo defeito da 0.29.1, agora com os
  schemas todos cobertos.
- **Fornecedores: nome e ações nunca visíveis juntos.** Colunas fixas.

### Alterado

- As duas tabelas da política são **Anexo I** e **Anexo II**, cada um em página
  própria, citados pelos itens 10 e 11.3. Não é arrumação: revisar a tabela
  deixa de exigir mexer na cláusula que a invoca.
- No **FRM-RH-001**, a tabela de penalidades virou **Anexo I** — o empregado
  assina declarando ciência de um anexo identificável, o que em audiência vale
  mais que "a tabela da página 2". O termo passou de 3 para 4 páginas, e a
  quarta é o anexo.
- Primitivo `Anexo` em `pdf-form.tsx`. **Anexo é para o que se lê, não para o
  que se preenche:** o checklist de conservação do FRM-RH-003 e a folha do
  FRM-RH-005 seguem inline, porque são preenchidos com o Encarregado e o alojado
  olhando o item.
- `agruparBlocos` estava duplicado entre `frm-rh-001.tsx` e `blocos.tsx`. Agora
  há um só, e o termo usa `Narrativa` como os outros documentos.

## [0.29.1] — 2026-08-23

Fecha pendências que a fase 3 deixou: código escrito e nunca ligado.

### Adicionado

- Rota **`/api/entregas/[id]/pdf`** — FRM-RH-003 ou FRM-RH-004 preenchido a
  partir do registro, decidido pelo `tipo` da entrega. `buscarEntrega()` existia
  desde a 0.27.0 sem nenhum consumidor.
- Botão de **desfazer aceite**, restrito a quem gere cadastros.
  `desfazerAceiteTermo` também era código morto.

### Corrigido

- **A caixa do lençol nunca era marcada** no FRM-RH-004 preenchido: o formulário
  gravava `"Lençol (par)"` e o PDF comparava com
  `"Lençol (par — inferior e superior)"`. Tipo, lint, teste e build passavam
  todos. `ITENS_ENTREGA` passa a ser fonte única das duas pontas, e um teste
  trava a coincidência.

### Notas

- O **checklist de conservação** (FRM-RH-003) e a **conferência de devolução**
  (FRM-RH-004) saem em branco mesmo no documento preenchido, e há teste que
  garante isso. São vistoria conjunta feita com Encarregado e alojado olhando o
  item; pré-marcá-las a partir do sistema inventaria uma conferência que não
  aconteceu — e avaria não registrada na entrada vira cobrança indevida na saída.

## [0.29.0] — 2026-08-22

Fase 5 — última — dos **documentos do alojamento**: o aceite eletrônico.

### Adicionado

- `registrarAceiteTermo` e `desfazerAceiteTermo`, e o botão correspondente na
  lista de ocupantes. O `TermoCompromisso` aceita `aceite` e troca o `modo` do
  primitivo `<Assinaturas>` de `manual` para `aceite`.
- **Nenhuma migration.** As colunas `aceite_em` e `aceite_ip` entraram nulas na
  `0043`, na fase 1, e o primitivo já previa o modo — esta fase foi troca de
  props, exatamente como a spec projetou.

### Segurança

- O aceite **não sobrescreve** um já registrado (`.is("aceite_em", null)` no
  update): regravar apagaria a prova do momento original.
- O IP vem de `x-forwarded-for` e **não prova identidade** — prova que a
  confirmação partiu daquela sessão autenticada, naquele momento. O termo em
  papel segue sendo o documento de referência até parecer do Jurídico; o registro
  eletrônico é complemento.

## [0.28.0] — 2026-08-22

Fase 4 dos **documentos do alojamento**: a rotina semanal de limpeza.

### Adicionado

- Tabelas **`tarefa_limpeza`** (catálogo por organização) e
  **`checklist_limpeza`** (uma linha por imóvel/semana), migration `0045`, com
  ramos em `soft_delete`, auditoria e RLS.
- Seção **Limpeza do alojamento** na tela do imóvel: semeadura do catálogo,
  abertura da semana, histórico das últimas 12 semanas e download da folha.
- A folha impressa passa a usar o **catálogo da organização** quando ele existe;
  sem ele, cai no embutido — melhor entregar a folha padrão à obra do que uma
  folha vazia porque ninguém abriu Configurações.
- `?semana=yyyy-mm-dd` imprime a folha já com o período no cabeçalho.

### Notas

- `semana_inicio` é sempre a **segunda-feira**, calculada a partir de
  `hojeISOSaoPaulo()`. O cálculo roda em UTC de propósito: a entrada já é data de
  calendário, e reinterpretá-la num fuso local a deslocaria de um dia. O domingo
  recua seis dias — o caso que quebra quase toda implementação ingênua — e tem
  teste próprio.
- `unique (imovel_id, semana_inicio)` impede a duplicata que aparece quando duas
  pessoas abrem a folha da mesma semana. Colisão é tratada como no-op: o estado
  desejado já vale.

## [0.27.0] — 2026-08-22

Fase 3 dos **documentos do alojamento**: os registros transacionais.

### Adicionado

- Tabelas **`medida_disciplinar`** e **`entrega_ocupante`** (migration `0044`),
  com os ramos correspondentes em `soft_delete`, triggers de auditoria e RLS.
- Seção **Alojamento** na tela do imóvel: registro e listagem de medidas
  disciplinares e de entregas (chaves e kit), em `react-hook-form`.
- Rota **`/api/medidas/[id]/pdf`** — o FRM-RH-002 preenchido a partir do
  registro. É o **mesmo componente** que gera a folha em branco: sem `dados`
  sai vazio, com `dados` sai preenchido. Duplicá-lo garantiria que uma das
  versões ficasse para trás na primeira revisão de cláusula.

### Segurança

- `medida_disciplinar` é a **primeira tabela do schema cuja leitura é restrita
  por papel**: só quem gere cadastros lê. Acesso à obra não implica acesso à
  advertência de um colega. A rota de PDF responde 404 — e não 403 — quando o
  usuário não pode ler o registro, para não confirmar que ele existe.
- Excluir medida disciplinar exige master, como contrato e lançamento
  financeiro: apagar advertência remove prova de pasta funcional.
- O teto de 30 dias da suspensão (CLT, art. 474) é validado no formulário **e**
  por `check constraint` no banco.

### Corrigido

- **Caixas marcadas saíam vazias** nos documentos preenchidos: o X era maior que
  a área interna da caixa e ficava recortado. Segundo defeito de geometria
  invisível neste primitivo — agora há teste que confere se a marca cabe.

## [0.26.0] — 2026-08-22

Fecha a fase 2 dos **documentos do alojamento**: a POL-RH-001 gerada pelo sistema.

### Adicionado

- **POL-RH-001** composta a partir do template, com as 16 seções em **7 páginas**
  (o original tem 14) — sem cortar conteúdo, só com o padrão tipográfico.
- As **duas tabelas da política** (matriz de responsabilidades e tabela de
  infrações e penalidades) vivem em código, como estrutura. Não foi escolha
  estética: a extração automática embaralha as linhas 8 a 15 da tabela de
  penalidades, e uma penalidade trocada num normativo disciplinar é erro que se
  paga em audiência. Transcritas do PDF original conferindo página a página.

### Notas

- Resíduo conhecido de conversão: no item 2, o subtítulo "Princípios
  orientadores" ficou absorvido no fim de um item da lista. Cosmético, e
  corrigível editando o texto em Configurações.

## [0.25.0] — 2026-08-22

Fase 2 dos **documentos do alojamento**: os quatro formulários compostos em
branco e acessíveis pela tela do módulo.

### Adicionado

- **FRM-RH-002 a 005** compostos a partir dos primitivos, imprimíveis em branco
  por `Imóveis → Documentos`. FRM-RH-002/003/004 em 2 páginas; FRM-RH-005 em 3
  páginas paisagem (semanal) e 1 página (mensal).
- **Rota `/api/documentos/[tipo]/pdf`**, que usa o texto customizado da
  organização quando existe. `?variante=mensal` gera a folha mensal do checklist
  de limpeza.
- **Primitivos `Colunas` e `Tabela densa`**, ambos nascidos de medição no
  FRM-RH-005: em paisagem a altura útil é de 527pt contra 782pt de largura, e
  empilhar blocos estreitos gastava a dimensão escassa.

### Corrigido

- **Checkboxes invisíveis em todos os formulários.** O Helvetica não tem o glifo
  U+2610 (`☐`), então toda caixa de marcação sumia: opções viravam texto solto e
  as colunas OK/Avaria saíam vazias. Passaram a ser desenhadas, o que independe
  de fonte.

### Notas

- O **FRM-RH-005 semanal fecha em 3 páginas**, não nas 2 previstas: o grid de 44
  linhas ocupa 2 folhas sozinho e o apêndice a terceira. Tentados e descartados
  coluna de tarefa mais larga, tabela densa e retirar as boas práticas — abaixo
  disso o checkbox fica impossível de marcar à mão.
- A **POL-RH-001 fica para a próxima entrega**: suas duas tabelas (matriz de
  responsabilidades e tabela de infrações) são estrutura e precisam ser
  compostas, não convertidas em prosa.

## [0.24.0] — 2026-08-22

Primeira fase dos **documentos do alojamento**: os oito primitivos de formulário
em PDF e o FRM-RH-001 provado de ponta a ponta.

### Adicionado

- **Termo de Compromisso de Alojamento (FRM-RH-001)** como texto padrão do termo
  do ocupante, substituindo a versão genérica anterior: 22 regras de convivência,
  consentimento informado de CFTV (LGPD), cláusula de armário individual, tabela
  de penalidades (CLT, arts. 474 e 482) e o canal de denúncias exigido pela Lei
  14.457/2022. Nenhuma linha de `documento_template` é tocada — quem customizou
  o texto continua com o dele.
- **Primitivos de formulário em PDF** (`src/lib/pdf-form.tsx`): `Documento`,
  `Secao`, `CampoGrid`, `Lista`, `OpcoesCheck`, `Tabela`, `AreaTexto` e
  `Assinaturas`. `CampoGrid` com valor nulo desenha linha para preenchimento
  manual; `Assinaturas` já aceita `modo="aceite"` para a fase de assinatura
  digital.
- **Colunas `cargo`, `quarto` e `armario`** em `ocupante_imovel`, com
  `aceite_em`/`aceite_ip` nulas reservadas (migration `0043`).

### Alterado

- A tela **Configurações → Templates de documentos** agrupa por módulo.
- `DocumentoInfo` ganhou `modulo`, `categoria` e `preenchimento`, tornando o
  catálogo de `templates.ts` a fonte única de documentos do sistema.
- O formulário de ocupante migrou para `react-hook-form` + `zodResolver` (8
  campos e validação cruzada de datas) e `salvarOcupante` passou a devolver
  `ActionResult` em vez de redirecionar.
- Contratos e termos passaram a desenhar o logotipo no lugar da palavra
  `SISTENGE`.

### Corrigido

- Rodapé com paginação (`Página 2 de 3`) em documentos de várias folhas. Ele não
  era desenhado: com `lineHeight` no estilo da `Page`, o `@react-pdf/renderer`
  4.5 ignora todo filho `position: absolute` + `fixed`, sem erro. O
  entrelinhamento passou para os estilos de texto e um teste guarda a regra.
- A tabela de penalidades do FRM-RH-001 quebrava com título e cabeçalho órfãos no
  pé da página.

### Notas

- O FRM-RH-001 fecha em **3 páginas**, não nas 2 previstas para formulários: o
  texto sozinho (44 cláusulas, 7.270 caracteres) já ocupa 2 páginas a 8,5pt, e
  comprimir mais exigiria corpo abaixo de 7,5pt num documento que sustenta justa
  causa. Um teste trava esse limite.

## [0.23.0] — 2026-08-07

Conclusão da Fase 3 da migração para a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase3-paginas-data-forms.md`).

### Corrigido

- **Segunda forma do bug de fuso, agora no cálculo de dinheiro.** A 0.22.0
  corrigiu `new Date().toISOString().slice(0, 10)`; esta corrige passar
  `new Date()` cru para funções que comparam **dia de calendário** com uma data
  vinda do banco. `new Date()` é um instante, as datas do banco chegam por
  `dataDeISO` (meia-noite), e o dia de calendário do instante é lido no fuso do
  runtime — que na Vercel é UTC. Das 21h à meia-noite em Brasília,
  `differenceInCalendarDays` conta um dia a mais. Efeitos: **um período inteiro
  a mais no custo estimado do contrato**; a coluna "Custo até hoje" e "dias em
  atraso" de dois relatórios (que vão para Excel e para a diretoria); a projeção
  do fluxo de caixa começando do mês seguinte no último dia do mês; a janela
  "vence nos próximos 7 dias" do painel deslocada; competência e vencimento da
  cobrança de avaria; e a numeração anual do contrato em 31/12.
  Novo `hojeSaoPaulo()` com quatro testes de relógio fixo, incluindo o que trava
  a cobrança do período extra.
- **Ordem das seções na tela do contrato.** A ordem visual vinha de classes
  `order-1..order-6` sobre uma ordem de DOM diferente, e `AtividadeTimeline` —
  sem classe de ordem, portanto `order: 0` — era renderizada acima do resumo do
  contrato. Agora a ordem de DOM é a ordem de leitura.
- **Contraste dos avisos em amarelo.** Usavam `text-warning` sobre
  `bg-warning/10`: o mesmo amber a 50% de luminosidade sobre um tint de 10% dele
  mesmo, ~1,9:1. Novo token `--warning-strong` como a variante legível sobre o
  próprio tint, em light e dark.

- **Indicadores podiam discordar da tabela em Financeiro e Imóveis.** As duas
  telas montavam o recorte de filtro **duas vezes** — uma na query paginada da
  lista, outra na query dos indicadores, que soma o filtro inteiro. Um filtro
  novo esquecido num dos lados fazia os KPIs somarem um recorte diferente do que
  a tabela mostrava, sem erro nenhum. Agora as duas passam pelo mesmo
  `aplicarFiltros` dentro do leitor de domínio.
- **`not-found.tsx` da raiz não existia.** Uma URL que não casa com nenhuma rota
  caía na tela padrão do Next — em inglês e sem estilo. A de `(app)` não cobre o
  caso: ela vive dentro do grupo, atende só ao `notFound()` de uma rota do grupo
  e herda o shell, que exige sessão.

### Segurança

- **Vazamento de UI de permissão em `imoveis/[id]`.** Nas listas de reparos e
  ocorrências, "Anexar" e o botão de excluir apareciam para quem só tem leitura
  — as duas únicas listas da página sem o gate `podeEditar`. As actions já
  recusavam, mas os controles não deviam estar visíveis.

### Alterado

- **As três páginas gigantes foram decompostas** em `_components/` + `<Suspense>`,
  cada seção buscando os próprios dados: `imoveis/[id]` 684 → 117 linhas + 6
  seções, `contratos/[id]` 602 → 189 + 5, `vistorias/[id]` 410 → 178 + 3. Antes
  cada página esperava todas as consultas em série antes do primeiro byte de
  HTML.
- **`obterItensLocadosCalculados`** (`src/lib/data/contratos.ts`) sob `cache()`:
  três seções de `contratos/[id]` consomem o mesmo resultado (custo do resumo,
  tabela de itens, histórico de devoluções), então sem o cache a decomposição
  triplicaria a consulta mais pesada da rota. Chaveado por três primitivos de
  propósito — `cache()` compara identidade de argumento.
- **URLs assinadas por seção** em `imoveis/[id]`: três lotes em vez de um, mas
  correndo em paralelo em vez de depois de todas as consultas. O que importava
  era não voltar a assinar uma URL por arquivo, e cada lote continua em lote.
- **`ReparoForm` em react-hook-form** — último dos 13 forms do plano, fechando 14
  em RHF + zodResolver. `salvarReparo` passa a `(raw) => ActionResult` e perde o
  `redirect()`. `reparoSchema` novo: o `valor` era gravado por
  `num(...) ?? 0`, que transformava texto inválido em R$ 0,00 em silêncio num
  campo de dinheiro.
- **Camada de leitura para as 8 listagens** em `src/lib/data/<dominio>.ts`, com
  `import "server-only"`, tipo de retorno **plano** e `{ itens, total }` — o
  total vindo do `count: "exact"` do PostgREST, não de `array.length`, porque as
  listas paginam em 20. Achatar o retorno removeu 6 `as unknown as Row` e um
  `obras!.map` das páginas: a ambiguidade `T | T[] | null` dos embeds do
  PostgREST para de atravessar o boundary. Os leitores de lista deliberadamente
  **não** usam `cache()` — ele chaveia por identidade de argumento e estes
  recebem um objeto literal montado a cada chamada, então o cache nunca
  acertaria.
- **Regra do `createAdminClient()` no `AGENTS.md` corrigida.** Estava absoluta
  demais ("só em `api/cron/*`") e proibia um uso legítimo e necessário: as
  chamadas `auth.admin.*` de `usuarios/actions.ts` exigem service role e
  `auth.users` não é tabela da aplicação. O invariante real é que o client admin
  nunca faz `.from(...)` em tabela da aplicação, porque é aí que o RLS — e com
  ele o isolamento por organização — desaparece.

## [0.22.0] — 2026-08-06

Primeira parte da Fase 3 da migração para a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase3-paginas-data-forms.md`).

### Corrigido

- **"Hoje" era calculado em UTC em nove lugares**, enquanto `hojeISOSaoPaulo()`
  já existia e era usado em quatro. `toISOString()` devolve a data em UTC, então
  entre 21h e a meia-noite em Brasília (BRT = UTC−3) todos enxergavam o dia
  seguinte. Efeitos: conta com vencimento hoje entrava no total "Vencido"; o
  cálculo de multa e juros da baixa contava um dia a mais de atraso; os quatro
  PDFs saíam datados de amanhã; a data padrão da devolução vinha errada.
  Coberto por testes com clock fixo, com uma asserção travando explicitamente o
  comportamento errado ao lado do certo.
- `formatarData` devolvia "Invalid Date" para timestamp completo: `dataDeISO`
  faz split manual em `-`, então `"2026-03-10T12:00:00Z"` produzia
  `Number("10T12:00:00Z")` = `NaN`. Agora há guard por regex.
- `ObraFilter` montava a URL só com `?obra=`, **descartando os demais
  parâmetros** — filtrar por obra em /contratos apagava a busca por número.
- Mudar filtro sem voltar para a primeira página deixava a lista vazia (pedido
  da página 3 num resultado com uma só). Os três filtros novos apagam `page`.

### Adicionado

- `src/lib/data/storage.ts` com `assinarUrls` e `TTL_URL_ASSINADA` — o primeiro
  arquivo da camada de leitura.
- `src/lib/acoes.ts` com o tipo `ActionResult` compartilhado.
- `src/components/shared/`: `campo.tsx`, `list-search.tsx` (reescrito),
  `select-filter.tsx`, `list-filters.tsx`.
- **CI** em `.github/workflows/ci.yml` — o projeto não tinha nenhuma. Node 22,
  `npm ci` → typecheck → lint → test → build.
- Seção **"Convenções de código"** no `AGENTS.md`, fixando a regra PT-BR
  inviolável, a restrição do token `--brand`, `createAdminClient()` só em cron,
  `soft_delete` obrigatório, "uma action ou redireciona ou devolve ActionResult",
  quando usar react-hook-form, e a exceção justificada de /relatorios.
- 23 testes novos (de 30 para 53): `hojeISOSaoPaulo`, `formatarData`,
  `formatarBRL` e `src/lib/lista.test.ts` cobrindo `parseListParams` e `termoOr`
  — que são controle de segurança (allowlist do `.order()` e sanitização do
  `.or(ilike)`) e estavam sem nenhum teste.
- Stub de `server-only` no vitest, para a camada de leitura.

### Alterado

- **Anexos assinados em lote.** `imoveis/[id]` fazia dois `Promise.all` de
  `createSignedUrl` individuais: um imóvel com 3 contratos, 8 reparos e 12 fotos
  disparava ~25 requisições ao Storage antes do primeiro byte de HTML. Agora uma
  por bucket, via `createSignedUrls`. O TTL também foi unificado (era 600 em um
  lugar e 3600 em dois).
- `formatarBRL` e o formatador de data içados para constante de módulo — eram
  reconstruídos a cada chamada, centenas por render em /relatorios e /fluxo.
- **Perfil e obras deduplicados por requisição.** `getCurrentPerfil()` (102
  chamadas em 47 arquivos) passou a ser `cache()`ado, e o `(app)/layout.tsx`, que
  fazia seu próprio `getUser()` + SELECT para a mesma informação, passou a usá-lo
  — cada render gastava duas idas ao Auth e duas ao banco. O mesmo
  `select("id, codigo, nome")` de obra, repetido em 18 páginas, virou
  `listarObrasParaFiltro()` em `src/lib/data/obras.ts`, também `cache()`ada. O
  parâmetro dela é um booleano primitivo de propósito: `cache()` chaveia por
  identidade de argumento, e um objeto de opções construído em dois lugares seria
  *miss* e duplicaria a consulta.
- **Busca ao vivo** com debounce de 300ms e botão de limpar. Enter continua
  aplicando na hora.
- Os dois `<form method="get">` de /financeiro e /imoveis viram
  `ListFilters` + `ListSearch` + `SelectFilter`.
- Os 7 `<Card className="border-dashed">` viram `EmptyState`, com descrição
  explicando para que serve o cadastro.
- As duas funções `Kpi` locais viram `KpiCard` com ícone e variante de cor. A
  prop booleana `alerta` era a proliferação que o `variant` resolve.
- Três helpers locais idênticos de par rótulo/valor (`Info` × 2 e `Campo`) viram
  `src/components/shared/campo.tsx`.

### Removido

- `src/components/obra-filter.tsx` e `src/components/list-search.tsx`,
  substituídos pelos equivalentes em `shared/`.

## [0.21.0] — 2026-08-06

Fase 2 da migração para a identidade e a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase2-shell.md`).

### Adicionado

- **Sidebar de 72px que expande a 240px** no hover, com cross-fade entre o
  símbolo e o logotipo. `fixed`, com a coluna principal compensando em
  `md:pl-18`. Acréscimo sobre o People: expande também no `focus-within`, senão
  quem navega por Tab percorre 11 ícones sem rótulo nenhum. O foco usa
  `ring-inset`, porque a `<aside>` tem `overflow-hidden` e um ring com offset
  seria cortado na borda de 72px.
- **Header sticky de 64px** com `backdrop-blur`, em três zonas.
- **`Breadcrumb`** derivado do pathname — é ele que substitui a prop `eyebrow`
  removida na 0.20.0. Segmentos dinâmicos (UUID) são omitidos; estáticos ganham
  rótulo em PT-BR por mapa, e um segmento não mapeado também é omitido.
- **`CommandPalette`** (Ctrl/⌘+K), sem `cmdk`: Dialog + Input + lista filtrada,
  com navegação por ↑/↓ e agrupamento "Páginas"/"Ações". Diverge do People, que
  indexa só páginas: aqui entram 8 ações rápidas, cada uma condicionada ao
  módulo e ao papel via `src/lib/permissoes.ts`.
- **`MobileNav`** — gaveta sobre o `Dialog` do Base UI, substituindo a barra
  inferior que reaproveitava a lista vertical da sidebar num `overflow-x-auto`.
- **`AuthShell`** — split-screen para `/login`, `/auth/recuperar` e
  `/auth/nova-senha`, com o cartão em `data-theme="light"` (escopo criado na
  0.20.0 e que estreia aqui).
- **`loading.tsx` por rota** em 8 listagens e 3 telas de detalhe, com as formas
  em `src/components/shared/skeletons.tsx`.
- **`(app)/not-found.tsx`** — não existia. `notFound()` caía no 404 padrão do
  Next: página branca, sem shell e em inglês.

### Alterado

- **`src/lib/nav.ts` vira dado puro**: `icon` passa de `LucideIcon` a uma união
  de strings, com o lookup em `src/components/layout/nav-icon.tsx`, e a
  filtragem por permissão sai do client para o server. Não conserta bug — a
  sidebar era client e importava `NAV_ITEMS` ela mesma, então o boundary nunca
  era cruzado. É escolha de arquitetura: filtra uma vez em vez de duas, o bundle
  do cliente deixa de listar `/configuracoes` para todo mundo, e o arquivo fica
  utilizável em qualquer runtime, como `src/lib/modulos.ts` já era.
- **`UserMenu` reconstruído sobre `ui/dropdown-menu.tsx`**, que estava no
  projeto com 268 linhas e zero imports. Absorveu o rodapé rico da sidebar
  (avatar, nome, papel, "Meu perfil", "Sair"), que não caberia em 72px. `w-64` é
  obrigatório no `Content`: o primitivo usa `w-(--anchor-width)`, ou seja,
  dimensiona pela largura do gatilho — aqui um avatar de 32px.
- **`main` perde o `overflow-y-auto`**: quem rola é o documento. Com ele, `main`
  seria um segundo container de scroll — barra dupla e momentum scroll quebrado
  no iOS.
- `(app)/loading.tsx` deixa de ser um esqueleto de tabela em `max-w-5xl`, que
  disparava em toda navegação do grupo (inclusive nas 17 páginas de formulário),
  e passa a ser o spinner neutro.
- `(app)/error.tsx` ganha o painel do People, o `error.digest` em monoespaçada,
  `render={<Link/>}` no lugar de `window.location.href` e log pelo `logger.ts`.
- `/offline` recebe a paleta nova e modo escuro via `<style>` com
  `prefers-color-scheme` — não via classe `.dark`, porque a folha de CSS não
  está no PRECACHE e o script do next-themes não roda offline.
- `bar-chart.tsx` e a barra horizontal de `/relatorios` passam de `bg-primary`
  para `bg-foreground` com opacidade: com a paleta nova o primary inverte para
  slate-50 no tema escuro, o que daria barras de branco puro.
- `public/sw.js`: `CACHE` de `loca-v1` para `loca-v2`, obrigatório porque
  `/offline` mudou e o `install` só refaz o PRECACHE quando o nome do cache muda.

### Removido

- `src/components/layout/sidebar.tsx`, substituída por `nav-link.tsx` mais a
  `<aside>` do layout.
- O `<Card>` de dentro dos três forms de autenticação: a moldura precisa ser
  dona do wrapper para aplicar o `data-theme` nele.
- O branch morto de item "em breve" no nav (todos os itens estão implementados).

### Interno

- `MobileNav` fecha ao trocar de rota ajustando estado durante o render, o
  padrão que o React documenta. Um `useEffect` seria reprovado por
  `react-hooks/set-state-in-effect` e custaria um render extra; um `onClick` no
  `Link` deixaria a gaveta aberta quando a navegação vem do botão voltar.
- A gaveta é montada sobre os primitivos do Base UI, não sobre `ui/dialog.tsx`:
  o `DialogContent` dele embute `top-1/2 -translate-y-1/2`, e o `tailwind-merge`
  não considera `top-1/2` conflitante com `inset-y-0` — as duas viriam.
- Verificado com uma rota de inspeção temporária e screenshots em light/dark,
  desktop/mobile: `scrollWidth === clientWidth`, sem overflow horizontal, com a
  tabela de 7 colunas contida pelo `overflow-x-auto`. Isso confirma que
  `TableCell p-4` (0.20.0) cabe e não precisa virar `p-3`.

## [0.20.0] — 2026-08-06

Fase 1 da migração para a identidade e a construção do **Sistenge People**
(referência: `docs/superpowers/plans/people-fase1-fundacao-design.md`).

### Adicionado

- **Identidade Sistenge 2026**: `src/app/globals.css` reescrita com a paleta
  slate do Sistenge People — `--primary` slate-900, cards brancos com
  `shadow-sm`, `--radius: 0.625rem` — e as famílias novas `--success`,
  `--warning`, `--info` e `--brand`. O vermelho `#BE3A31` deixa de ser a cor
  primária e passa a ser o token `--brand`, de uso restrito a logotipo e badges
  de crítico.
- **Modo escuro**, com `ThemeProvider` (next-themes) e `ThemeToggle` no header.
  O pacote já estava instalado desde a v0.13, mas nunca foi montado: a classe
  `.dark` jamais chegava ao `<html>`, então todo o bloco `.dark` era código
  morto e o `useTheme()` de `ui/sonner.tsx` sempre caía no default.
- Escopo `[data-theme="light"]`, para forçar tokens claros numa região sobre
  fundo escuro (o card do `/login` na Fase 2).
- Compartilhados em `src/components/shared/`: `PageHeader` (reescrito),
  `EmptyState`, `KpiCard`, `ConfirmDialog` e `ThemeToggle`.
- Primitivos `ui/skeleton.tsx` e `ui/native-select.tsx`.
- `SistengeIcon` — só o símbolo, recortado do mesmo viewBox do logotipo, para a
  sidebar colapsada da Fase 2.
- `src/lib/brand-colors.ts` — paleta em hex para os três consumidores que não
  resolvem CSS custom properties (PDF, e-mail, `global-error.tsx`).
- Headers de segurança e CSP em `next.config.ts`, que estava vazio.
- Script `npm run typecheck` e regras de ESLint do Sistenge People.

### Alterado

- **Tipografia**: Barlow + Barlow Condensed → **Inter + JetBrains Mono**. O
  token `--font-heading` foi removido em vez de apontar para o Inter: um alias
  no-op mentiria sobre a intenção. Os números de KPI saem de `text-5xl` em
  Barlow Condensed para `text-2xl tabular-nums`.
- **Primitivos alinhados ao People**: Button `h-8`→`h-10` (e `sm` `h-7`→`h-9`,
  `icon-sm` `size-7`→`size-9`), Input/Textarea `h-8`→`h-10`, `TableHead`
  `h-10 px-2` uppercase → `h-12 px-4`, `TableCell` `p-2`→`p-4`, Badge
  `rounded-full`, Dialog `p-6`/`rounded-lg`/`shadow-lg`. As variantes
  `destructive` de Button e Badge passam de tonais a sólidas.
- **`Card` adota o modelo clássico** e aposenta `--card-spacing`, a moldura
  `.blueprint` e as marcas de registro nos cantos. Isso conserta 26 call sites
  que eram no-ops: 21 `<CardContent className="pt-6">` só fazem sentido com
  `CardContent p-6 pt-0`, e 5 `<CardHeader className="flex-row space-y-0">` só
  com `CardHeader flex flex-col`. Efeito colateral desejado: os 12
  `<CardContent className="p-0">` que embrulham tabelas ficam flush com a
  borda, equivalendo ao `<div className="rounded-md border">` do People.
- **`PageHeader` com a API do People**: `children` → `acoes`, `descricao`
  aceita `ReactNode`, e a prop `eyebrow` foi removida — em 24 dos 26 casos
  repetia o pai que o breadcrumb da Fase 2 vai mostrar. As props foram
  removidas do tipo de propósito, para `tsc --noEmit` enumerar os 39 call
  sites; o projeto não tem nenhum teste de UI.
- **`NativeSelect` unifica os 38 selects.** A mesma string de classe estava
  duplicada em 20 arquivos, em 5 variações divergentes — a maior duplicação do
  repositório, que punha selects de alturas diferentes ao lado dos campos.
- **`ConfirmDelete` sobre `ConfirmDialog`** em vez de `window.confirm()`. Os
  props foram mantidos, então os 18 call sites em 9 arquivos não mudaram. O
  `ConfirmDialog` re-lança erros com `digest` começando em `NEXT_`: engoli-los
  transformaria o `redirect()` das actions de exclusão num erro falso na tela.
- `ACENTO` dos PDFs e o botão de CTA dos e-mails passam de vermelho a
  slate-900. O símbolo da marca em `pdf.tsx` segue vermelho, agora no `#BE3A31`
  do Manual em vez do `#cf2927`.
- `signature-pad.tsx`: canvas sempre `bg-white` com traço escuro. Ele é
  exportado por `toDataURL()` e embutido num PDF de fundo branco — é papel, não
  interface, e seguir o tema deixaria a assinatura invisível no modo escuro.
- `viewport.themeColor` passa a ser um par light/dark em slate, alinhado ao que
  `manifest.webmanifest` já declarava.

### Removido

- Classes `.blueprint` e `.eyebrow`, a regra `h1..h6 { Barlow Condensed }`, o
  token `--font-heading` e `--radius: 0`.
- Tokens sem nenhum consumidor: `--surface`, a rampa `--accent-300..800`,
  `--neutral-*` e os 8 `--sidebar-*` (× 2 escopos).
- `CardAction` e a prop `size` do `Card`; variantes `ghost` e `link` do
  `Badge` — todos sem call site, confirmado por `tsc`.
- `toastOptions.classNames.toast = "cn-toast"` em `ui/sonner.tsx`: a classe não
  era definida em nenhum arquivo do projeto.

### Interno

- `@source not "../../docs"` em `globals.css`: exemplos de código em markdown
  (`bg-[url(...)]`, `from-[#1A1D24]`) eram lidos pelo Tailwind v4 como
  utilities reais e o Turbopack tentava resolver `url(...)` como módulo,
  quebrando o build.
- Tokens em `hsl()` completo, nunca triplet cru. O Tailwind v4 compila
  `bg-x/10` para `color-mix()`, que exige um `<color>` válido no primeiro
  termo; com triplet a declaração é descartada em silêncio e todo o vocabulário
  de opacidade dos primitivos deixa de pintar.
- `ThemeToggle` usa `useSyncExternalStore` com snapshots diferentes por
  ambiente para detectar hidratação, em vez de `useState` + `useEffect`
  (reprovado por `react-hooks/set-state-in-effect` no React 19).

## [0.19.4] — 2026-07-29

### Corrigido

- **Exclusão de registros não funcionava** em imóveis, obras, contratos e
  lançamentos financeiros: a tela recarregava e o registro permanecia na lista.
  As policies de SELECT criadas em `0033`/`0034` exigem `deleted_at is null` e o
  Postgres aplica essa policy também à **nova** linha de um `UPDATE`, abortando
  o próprio comando que marca a exclusão (`new row violates row-level security
  policy`). A exclusão passa a usar a função `public.soft_delete` (SECURITY
  DEFINER, migration `0041`), que valida organização, papel e escopo de obra.

### Melhorado

- Exclusão recusada (permissão, registro inexistente) agora mostra o motivo em
  um aviso na tela — antes o erro do banco era descartado silenciosamente.
- Excluir contrato passa a pedir confirmação, como nas demais telas.

### Segurança

- `public.soft_delete` (SECURITY DEFINER) deixa de ter `execute` para o papel
  `anon` (migration `0042`). Sem sessão a função já recusava, mas função com
  SECURITY DEFINER não deve ficar exposta a chamadas anônimas.

## [0.19.3] — 2026-07-27

### Melhorado

- Tela de Configurações reorganizada em duas seções — **Organização** (atalhos:
  empresa, templates, usuários, auditoria, como lista de linhas clicáveis) e
  **Automações de e-mail** (alertas e relatório) — com layout mais limpo.

## [0.19.2] — 2026-07-27

### Corrigido

- Barras do gráfico "Desembolso previsto" do painel não apareciam (altura em `%`
  colapsava dentro do contêiner flex). Agora a altura é calculada em pixels.

## [0.19.1] — 2026-07-27

### Melhorado

- E-mail de avisos de vencimento agora inclui as colunas **Obra** e **Custo
  mensal** de cada item (contratos, imóveis, devoluções e pagamentos).

## [0.19.0] — 2026-07-27

### Melhorado

- Novo contrato de locação já vem com número sugerido automaticamente
  (`CT-<ano>-<sequência>`), editável pelo usuário.

## [0.18.0] — 2026-07-27

### Adicionado

- Service worker com uso offline básico: navegação usa network-first e, sem
  conexão, exibe uma página `/offline` amigável. Estáticos com
  stale-while-revalidate. Registro best-effort.
- Ícones PNG 192/512 do PWA (gerados por `scripts/gen-icons.mjs`) referenciados
  no manifest e no `<head>` (incl. apple-touch-icon).

### Interno

- `apresentacao-loca.html` (arquivo avulso) adicionado ao `.gitignore`.

## [0.17.0] — 2026-07-27

### Adicionado

- Linha do tempo de auditoria por entidade (contrato de locação e imóvel):
  quem criou/alterou/excluiu e quando. Visível ao Master (RLS).

### Melhorado

- Logs do servidor em formato estruturado (JSON por linha) via `src/lib/logger.ts`,
  aplicados às rotinas de cron; preparação para APM (Sentry via `SENTRY_DSN`).

## [0.16.0] — 2026-07-27

### Adicionado

- Botão "Gerar cobrança" na avaria: cria uma conta a pagar com o custo estimado,
  marca a avaria como "cobrada" e vincula os dois (idempotente).

### Melhorado

- Aviso ao cadastrar/editar fornecedor com CNPJ já usado por outro fornecedor,
  com opção de "salvar mesmo assim".

## [0.15.0] — 2026-07-27

### Adicionado

- Geração do contrato de locação de equipamento em PDF, com template editável
  (variáveis) em Configurações → Templates e a lista de itens do contrato.

### Melhorado

- Termo de responsabilidade passa a citar a Política de Alojamento (POL-RH-001)
  e a obrigação de entrega das chaves na devolução.

## [0.14.0] — 2026-07-27

### Segurança

- Troca de senha obrigatória no primeiro acesso e após redefinição pelo
  administrador (flag `senha_temporaria` + guarda no middleware).
- Dados sensíveis (CPF, conta bancária e chave PIX) exibidos mascarados na tela,
  com opção de revelar sob demanda.

## [0.13.0] — 2026-07-27

### Adicionado

- Filtro por obra no painel inicial; todos os indicadores e o gráfico passam a
  respeitar a obra escolhida.
- Gráfico de desembolso previsto (12 meses) no painel, com pago, pendente e
  projeção dos contratos (equipamentos e imóveis).
- Indicadores de imóveis no painel: quantidade e custo mensal dos contratos
  vigentes.

## [0.12.0] — 2026-07-26

### Melhorado

- Busca por texto nas listas de obras, itens, contratos, fornecedores, imóveis
  e financeiro.
- Ordenação por coluna (clique no cabeçalho) e paginação em todas as listas
  principais, preservando busca e filtros na URL.
- Desempenho: as listas carregam por página (20 itens) em vez de trazer todos
  os registros de uma vez.

## [0.11.0] — 2026-07-26

### Adicionado

- Reajuste do aluguel por percentual, com efeito imediato no valor e registro
  no histórico do contrato (adianta a próxima data de reajuste).
- Aditivo de contrato de imóvel: altera valor de aluguel e/ou prazo (data fim)
  preservando o histórico de mudanças.
- Encerramento/distrato do contrato de imóvel com data e motivo; encerra a
  vigência e o contrato deixa de projetar no fluxo de caixa.
- Histórico versionado do contrato (timeline de aditivos, reajustes e
  encerramentos) na tela do imóvel.

## [0.10.0] — 2026-07-26

### Adicionado

- Geração de contas a pagar recorrentes a partir dos contratos de imóvel e de
  locação (uma parcela por mês, idempotente — não duplica meses já gerados).
- Baixa de conta com conciliação: valor efetivamente pago, data do pagamento,
  número da NF e anexo do comprovante no Storage.
- Cálculo de multa (2%) e juros (1% a.m. pró-rata) por atraso, com sugestão
  aplicável na tela de baixa.

## [0.9.1] — 2026-07-26

### Melhorado

- Documentos da biblioteca do alojamento agora podem ter nome, descrição e
  categoria editados.

## [0.9.0] — 2026-07-26

### Adicionado

- Biblioteca de documentos do alojamento no módulo Imóveis (normativos,
  formulários e placas), com categorias, upload por administradores e download
  para toda a equipe. Arquivos no Storage.

## [0.8.0] — 2026-07-26

### Segurança

- Imóveis e relatórios passam a respeitar o acesso por obra do usuário (correção
  de vazamento entre obras).

### Adicionado

- Identificação do equipamento (nº de série/registro/tag) nos itens do contrato.
- Aditivos e renovações: anexar novos documentos ao contrato além do original.

### Melhorado

- Nova disposição da tela do contrato (adicionar item → itens → relatório de
  retirada → documentos do contrato).

## [0.7.0] — 2026-07-26

### Adicionado

- Página **Novidades** com o histórico de versões e melhorias, acessível pelo menu.
- Número da versão visível no rodapé do menu.

### Melhorado

- Processo de versionamento (SemVer) documentado para todas as alterações futuras.

## [0.6.0] — 2026-07-26

### Segurança

- Correção crítica: impedida a autopromoção de usuário a "master".

### Adicionado

- Trilha de auditoria (quem criou/alterou/excluiu), com tela em Configurações.

### Melhorado

- Exclusões reversíveis (soft-delete) em obras, contratos, lançamentos e imóveis.
- Alertas por e-mail mais robustos (isolamento de erro + fuso de São Paulo).
- Integridade de dados: número de contrato único por organização e índices.
- Acessibilidade nos filtros de relatórios e indicador de carregamento.

### Corrigido

- Custo de devolução parcial (não cobra mais a quantidade cheia), na tela do
  contrato e no fluxo de caixa.

## [0.5.0] — 2026-07-26

### Adicionado

- Cadastro completo da empresa usado nos contratos.
- Templates de documentos editáveis com variáveis (contrato de imóvel e termo).
- Acesso modular por usuário.
- Fornecedores vinculados a obras, com busca e filtro.
- IPTU, seguro fiança e dados bancários no contrato do imóvel.

### Melhorado

- Imóveis no fluxo de caixa; edição de contratos de imóvel; subtotal por obra no
  relatório de custo; logo da Sistenge nos PDFs.

## [0.4.0] — 2026-07-25

### Adicionado

- Módulo de Imóveis: cadastro, contratos, consumo, vistorias, reparos,
  ocorrências, ocupantes, emissão de contrato/termo, alertas e relatórios.

## [0.3.0] — 2026-07-24

### Adicionado

- Relatórios v2: ociosidade, custo por fornecedor, avarias, filtros, subtotais,
  gráficos e envio automático por e-mail.

### Corrigido

- Menu do usuário que quebrava ao abrir.

## [0.2.0] — 2026-07-24

### Adicionado

- Fluxo de caixa, gestão de usuários, meu perfil, filtro por obra, e-mails de
  acesso, login com logo e recuperação de senha, múltiplos prazos de aviso.

### Melhorado

- Identidade visual da Sistenge e data/hora nas assinaturas de vistoria.

## [0.1.0] — 2026-07-23

### Adicionado

- MVP: obras, fornecedores, itens, contratos, movimentação com devolução
  parcial, vistorias com fotos e avarias, financeiro, alertas de vencimento,
  relatórios em PDF/Excel e PWA instalável.
