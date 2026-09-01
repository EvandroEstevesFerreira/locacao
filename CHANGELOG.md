# Changelog

Todas as mudanças relevantes do **Loca** ficam aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

> Fonte única para a tela **Novidades**: [`src/lib/changelog.ts`](src/lib/changelog.ts).
> Ao concluir uma alteração, atualize **os dois** (ver processo em `AGENTS.md`).

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
