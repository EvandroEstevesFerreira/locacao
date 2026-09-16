# Movimentação de peça: uma porta só — desenho

> Data: 16/09/2026 · Status: aprovado, não implementado

## O problema, na voz de quem usa

> "Essa rotina de movimentação ainda está bem confusa. Ao devolver um
> equipamento devemos selecionar se ele fica disponível. Estando disponível,
> temos que ter a opção de entregar para alguém."

A ficha da peça tem hoje **três portas** para mexer na posse, cada uma com
regra própria, e nenhuma faz o que a frase acima descreve.

| Porta | Onde | Destinos | Quando aparece |
| --- | --- | --- | --- |
| Card **Movimentar** | ficha da peça | obra, almoxarifado, fornecedor | sempre que há permissão |
| **Transferir custódia** | botão | encadeia para termo | só se `atual.tipo === "funcionario"` |
| **Novo termo** | botão | funcionário | só se `podeReceberTermo(posse)` |

Entregar a uma pessoa **não está no formulário que se chama "Movimentar"** e
que pergunta "Para onde vai". É natural procurar a pessoa ali; ela não está.

E "Transferir custódia" só aparece quando a peça já está com alguém — ou seja,
some exatamente na peça que está pronta para ser entregue.

## O que já está certo, e não vamos mexer

Três coisas foram medidas antes de desenhar, e desmentem suspeitas razoáveis:

- **`abrirCustodia` já encerra a posse anterior** (`custodia-servidor.ts:183`).
  Não há risco de duas posses abertas; o índice parcial `idx_custodia_aberta`
  garante isso no banco.
- **Cancelar termo não deixa posse órfã.** Medido em 16/09/2026: 48 posses
  ligadas a termos cancelados, **todas encerradas**. As "3 posses de termos
  cancelados" que a tela mostra recolhidas são histórico honesto, não defeito.
- **`moverPeca` já define `situacao = manutencao`** para destino fornecedor
  (`frota/actions.ts:66`).

## A virada: a situação já queria ser deduzida

A matriz de `src/lib/frota.ts` **já proíbe** passar para `em_uso` à mão, e diz
o porquê em texto de usuário:

> "«Em uso» é definido pelo termo de responsabilidade, não à mão."

O repositório já decidiu que `em_uso` é consequência, não escolha. O que ficou
pela metade é o outro lado: `moverPeca` recusa mexer em peça `em_uso`
("Peça em uso não se move pela Frota: alguém assinou por ela"), porque não
sabia encerrar termo. Essa é a parede que o usuário bate.

**A porta única derruba a parede sem afrouxar a regra**, porque passa a saber
encerrar o termo antes de mover.

## O desenho

### Uma porta: o card "Movimentar"

"Para onde vai" passa a ter **quatro** destinos:

```
Funcionário  |  Obra  |  Almoxarifado central  |  Manutenção em fornecedor
```

Escolher **Funcionário** revela, no mesmo formulário, o seletor de pessoa e a
assinatura. Os outros três mostram só data e observações.

**Um formulário, sem troca de página** — e essa decisão não é nova. Ela está
escrita em `transferir-form.tsx`:

> "um formulário só, e não um passo a passo: são cinco campos, e quem está com
> o funcionário na frente não deve navegar entre telas para registrar uma coisa
> que acontece num minuto."

A decisão foi tomada uma vez e não foi aplicada ao card. Aplicamos agora.

Os botões **"Transferir custódia"** e **"Novo termo"** saem da ficha. A rota
`/frota/[id]/transferir` deixa de ser necessária.

### A assinatura segue a pessoa, nos dois sentidos

| Situação | Assinatura |
| --- | --- |
| sai de uma pessoa | sim — quem devolve assina, e o termo dela é encerrado |
| vai para uma pessoa | sim — termo novo emitido e assinado |
| entre obra, almoxarifado e fornecedor | não — não há pessoa física responsável |

Transferir de uma pessoa para outra colhe **duas** assinaturas no mesmo
formulário: a de quem entrega e a de quem recebe. É um movimento, uma tela.

`motivo_sem_assinatura` continua existindo para o caso de a pessoa não estar
presente — é o que o `transferir-form.tsx` já faz, e não se perde.

### A situação passa a ser deduzida — os dois estados que dá para deduzir

| Posse aberta | Situação |
| --- | --- |
| nenhuma, ou almoxarifado | `disponivel` |
| funcionário, obra | `em_uso` |
| fornecedor | `manutencao` |

Esses três deixam de ser escolha do usuário. `baixada` e `perdida` continuam
manuais, porque não se deduzem de posse nenhuma — são decisões.

**Na devolução, a escolha que o usuário pediu:** ao trazer a peça de volta, o
formulário pergunta se ela volta **disponível** ou vai para **baixada** /
**perdida**. É o "selecionar se ele fica disponível" do pedido, oferecido só
onde a escolha é real.

### A sequência, sempre a mesma

```
1. encerra a posse aberta        (fecharCustodia, já existe)
2. se quem entregava é pessoa    → encerra o termo dela, com assinatura
3. abre a posse nova             (abrirCustodia, já existe)
4. se o destino é pessoa         → emite termo novo, com assinatura
5. grava a situação deduzida
```

Uma action, `movimentarPeca`, faz os cinco passos. Ela **reaproveita**
`fecharCustodia` e `abrirCustodia` de `src/lib/custodia-servidor.ts`, e a
emissão de termo que `termos/actions.ts` já tem. Nada de escrita de custódia é
reimplementado — copiar o escritor é como as duas cópias divergem, e a
divergência num livro de custódia aparece como equipamento que consta com duas
pessoas.

### A ordem dos passos não é arbitrária

A posse é encerrada **antes** de o termo ser emitido. Invertido, uma falha na
emissão deixaria a peça com duas verdades: termo novo dizendo que está com
Fulano, posse antiga dizendo que está com Beltrano. Como `abrirCustodia` já
encerra a anterior, o ponto de atenção é o termo: se a emissão falhar depois de
a posse ter mudado, a action devolve `ok: true` com `aviso` — a posse mudou de
fato, e dizer `ok: false` seria mentira.

## A limpeza

### 1. `liberarPecas` para de creditar a devolução ao termo da entrega

`src/app/(app)/termos/actions.ts:912` abre a posse de almoxarifado passando
`termoId` — **o termo da entrega, que está sendo encerrado naquele instante**.
A posse nasce apontando para o documento que diz o contrário dela.

Medido em 16/09/2026: é a única posse de almoxarifado com `termo_id` no banco
inteiro (1 em 144), e produziu a única anomalia existente — um termo
`encerrado` com posse ainda **aberta**, na peça `14L4594` / `TRM-2026-0040`.
É a peça do print que abriu esta conversa.

A posse de devolução passa a nascer **sem termo**. Uma varredura passa a cobrar
isso, no espírito de `custodia-invariante.test.ts`, que já existe e já varre as
chamadas de `abrirCustodia`.

### 2. A migration que desamarra `14L4594`

Uma linha: zerar o `termo_id` da posse aberta cuja peça é `14L4594` e cujo
termo está encerrado. **Escrita por condição, não por id literal** — id de
linha não sobrevive a um restore, e a condição descreve a anomalia.

Não apaga a posse: a peça **está** no almoxarifado, e isso é verdade. O que
sai é a amarração falsa.

### 3. As Observações herdadas da planilha

O campo mostra "Com: Andre Piva (conforme planilha) · Departamento: DIRETORIA ·
Garantia: Expirada 23 OUT. 2027" numa peça que o livro de custódia diz estar no
almoxarifado. O texto contradiz o sistema e nada o atualiza.

**Não apagamos** — é dado de origem, e apagar destrói o dado bom, a mesma regra
que vale para `nf_numero` na conciliação. A ficha passa a exibi-lo sob o rótulo
**"Importado da planilha"**, separado dos campos vivos, para ninguém o ler como
estado atual.

## Fora de escopo, de propósito

- **Mudar `baixada` e `perdida` para deduzidas.** Não se deduzem de posse.
- **Assinatura em destino que não é pessoa.** Na prática alguém assinaria por
  todos, e a assinatura perderia o sentido.
- **Mexer no mutirão de custódia** (`frota/custodia/`). É outra tela, outro
  fluxo, e funciona.
- **Reescrever o histórico das 48 posses de termos cancelados.** São
  consistentes.
- **Apagar o texto importado da planilha.**

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Movimentação de peça | Desenho aprovado e escrito | Plano, action única, formulário, situação deduzida, as três limpezas, testes | 10% |

Próximo passo único: escrever o plano de implementação.
