# Assinatura do termo depois da emissão

**Data:** 2026-09-09
**Estado:** aguardando revisão

## O pedido

1. Ao emitir o termo, a via tem de ser enviada ao funcionário.
2. A assinatura do funcionário passa a ser **opcional** na emissão.
3. Cobrança recorrente até que ele assine.

## O que já existe (e por que o item 1 quase não é trabalho)

`emitirTermo` **já** envia a via do funcionário: a última etapa chama
`enviarViaDoFuncionario`, que gera o mesmo PDF da rota de download e o anexa
ao e-mail. A falha no envio não desfaz a emissão e volta como `aviso` com o
motivo exato — e-mail não cadastrado, e-mail deduzido e não conferido, PDF que
não gerou.

O que impediu isso de acontecer na prática foi o item 2: o formulário barrava a
emissão sem assinatura (`termo-wizard.tsx:198`), então nunca se chegava ao
envio. É por isso que o e-mail "não estava funcionando".

**Consequência de escopo:** o item 1 se resolve destravando o item 2, mais uma
mudança no conteúdo do e-mail (levar o link junto). Não há envio novo a
construir.

## A descoberta que muda a classificação

A regra "assina antes de emitir" **não é do formulário. É do banco.**

- `enviarLinkDeAssinatura` (`termos/actions.ts:65`) recusa termo já emitido.
- **Migration 0077**, função `assinar_termo_por_link`: `if v_termo.emitido_em is
  not null or v_termo.cancelado_em is not null then` — em **dois** pontos, o que
  lê o link e o que grava a assinatura. É função com `revoke all ... from
  public`, ou seja, a trava que decide quem pode assinar um documento de
  responsabilidade.

Emitir sem assinatura e colher depois exige afrouxar essa invariante. Isso mexe
na validade de um documento e numa RPC de segurança — daí este spec existir em
vez de eu ter ido direto ao código.

## Abordagem escolhida: recorte estreito, não porta aberta

**Permitir a assinatura pós-emissão apenas enquanto faltar a assinatura do
funcionário no momento `entrega`.**

Alternativa recusada: trocar o guard por "termo emitido é editável". Abriria a
porta para alterar assinatura já colhida, que é justamente o que um termo de
responsabilidade não pode permitir.

Alternativa recusada: criar `momento: 'ratificacao'`. Mais registro histórico,
mas desnecessário — `termo_assinatura` já grava `assinado_em` e `assinado_ip`
por linha, então a data em que a assinatura veio (depois da emissão) já fica
registrada sem coluna nem enum novo.

A condição em SQL, nas duas funções da 0077, passa de

```sql
if v_termo.emitido_em is not null or v_termo.cancelado_em is not null then
```

para: cancelado continua barrando sempre; emitido só barra se **já existir**
assinatura de funcionário no momento `entrega` para aquele termo. Um termo
emitido e assinado volta a ser intocável — que é o estado final desejado.

## As quatro partes

### 1. Assinatura opcional na emissão

- `termo-wizard.tsx:198` e `termo-emissao.tsx:50`: o bloqueio vira **aviso**.
  Emitir sem a assinatura do funcionário é permitido e anunciado, não impedido.
- `emitirTermo`: hoje exige `assinaturaSchema` quando não houve assinatura à
  distância. Passa a aceitar a ausência — a assinatura da **empresa** continua
  sendo gravada, como já é.
- O `termo-devolucao.tsx:88` (assinatura do encerramento) **não** muda. É outro
  momento e outro pedido; encerrar sem assinatura é decisão separada.

### 2. O e-mail de emissão leva a via **e** o link

- `enviarViaDoFuncionario` passa a gerar um link de assinatura quando falta a
  assinatura do funcionário, e a incluí-lo no corpo.
- Termo já assinado continua recebendo só a via: link de assinatura num termo
  assinado é convite a confusão.
- **Pré-requisitos herdados do link**, e eles são reais: exige e-mail
  **conferido** e **CPF** no cadastro (é o CPF que destrava o link à distância).
  Sem CPF, a emissão continua valendo, a via sai, e o aviso diz que o link não
  pôde ser gerado e por quê.

### 3. Pendência marcada na lista e no PDF

- **Lista de termos:** selo "Sem assinatura", no padrão dos selos que a lista já
  usa.
- **PDF (`frm-eq-001`)**: tarja no cabeçalho, no mesmo desenho que o relatório
  de vistoria já tem ("PENDENTE DE ASSINATURA DO REPRESENTANTE SISTENGE"). Um
  termo de responsabilidade sem assinatura que não se anuncia como tal é um
  papel que parece valer e não vale — é a mesma regra que fez o painel de
  fechamento do recebimento parar de mentir na 0.90.3.
- A tarja desaparece sozinha quando a assinatura entra: ela é derivada da
  ausência de `termo_assinatura`, não um campo à parte que alguém mantém.

### 4. Cobrança a cada 3 dias

- Rota nova `/api/cron/termos-sem-assinatura`, `vercel.json` com
  `"schedule": "40 8 * * *"` — roda **todo dia** e decide por termo, porque
  "a cada 3 dias" é por termo e não por calendário global.
- Critério: termo emitido, não cancelado, sem assinatura de funcionário no
  momento `entrega`, e último aviso há 3 dias ou mais.
- Dedupe por `notificacao_log`, com `tipo = 'termo_assinatura_pendente'` e
  `referencia_id = termo_id`. A chave única é
  `(org_id, tipo, referencia_id, data_referencia)`; `data_referencia` recebe a
  data do envio, e o intervalo de 3 dias sai de uma consulta ao último
  `enviado_em`.
- **Cada aviso REVOGA o link anterior antes de gerar o novo**, via
  `revogarLinksDoTermo`. O link vale 7 dias e a cadência é 3: sem revogar,
  haveria dois links válidos ao mesmo tempo e a pergunta "qual link eu uso?".
  Um link válido por vez, sempre o mais recente.
- **Resumo para a administração:** um e-mail com a lista de todos os termos
  pendentes, e não um aviso por termo. Vai junto no mesmo cron.
- O cron respeita `emTeste()` como os outros: com a trava de teste ligada, não
  grava em `notificacao_log` — senão o teste marcaria como avisado um termo que
  ninguém foi avisado.

## Migration

`0098_assinatura_pos_emissao.sql`: `create or replace` das duas funções da 0077
com o guard estreitado. Sem coluna nova, sem tabela nova.

## Testes

- **Puro, por TDD:** a decisão "este termo deve ser cobrado hoje?" — recebe
  emitido/cancelado, existência de assinatura e data do último aviso; devolve
  sim/não. É onde mora a regra dos 3 dias.
- **Guard do SQL:** teste que lê a migration e exige que a condição de
  `cancelado_em` continue barrando incondicionalmente. É o furo mais fácil de
  abrir por descuido ao mexer nessas duas funções.
- **Documento:** o PDF de termo sem assinatura de funcionário contém a tarja; o
  assinado, não. Via `contemTexto` de `inspecionar.tsx`.
- `emitirTermo` sem assinatura devolve `ok: true`.

## O que este spec NÃO faz

- Não mexe na assinatura de **encerramento/devolução** do termo.
- Não torna o termo emitido editável em nada além da assinatura ausente do
  funcionário.
- Não altera a validade de 7 dias do link.

## Riscos

1. **Afrouxar guard de documento legal.** Mitigado pelo recorte (só quando falta
   a assinatura) e pelo teste que fixa a parte que não pode afrouxar.
2. **Termo emitido sem assinatura e sem cobrança**, se o funcionário não tiver
   e-mail conferido ou CPF. A emissão vale, a pendência aparece na lista, e o
   resumo para a administração é o que evita o esquecimento — é o caminho de
   escape para o caso em que o automático não alcança.
3. **A tarja no PDF muda documento já emitido.** Um termo emitido hoje sem
   assinatura passa a imprimir a tarja em downloads futuros. É o comportamento
   correto — o papel passa a dizer a verdade sobre si —, mas é mudança visível
   em documento existente e precisa ser dita.
