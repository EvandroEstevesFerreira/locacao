# A tela de Frota, modelo D — trilho de categoria e faixa de pendência

> **Escrita depois do código, e isso é uma dívida.** A convenção do projeto é
> spec → plano → implementação. Aqui a ordem foi invertida porque a tela nasceu
> como *alternativa a um quarto mockup*: depois de três rodadas de desenho, o
> caminho mais curto para uma decisão era construir. O documento existe para que
> a decisão seja tomada sobre argumentos escritos, e não sobre um commit.
>
> **Nada disto está na `main`.** Vive em `feat/frota-modelo-d`.

## O problema, medido

A tela tinha sete colunas para 128 peças. Duas não carregavam informação:

| Coluna | Valores distintos em 128 linhas |
|---|---|
| **Estado** | **0** — nunca preenchida |
| **Categoria** | **1** — “TI” em todas |
| Propriedade | 2 |
| Situação | 2 |
| Onde está | 7 |
| Item | 27 |
| Patrimônio | 128 — é a chave |

É a mesma doença que a tela de Itens tinha: largura gasta repetindo a mesma
palavra. E a correção é a mesma — **o que se repete vira navegação, o que varia
vira seção**.

## O buraco que o layout não conserta

95 peças constam **em uso**. Existem **0 custódias abertas** e **0 termos
emitidos**, com 118 funcionários cadastrados e 97 deles já com e-mail.

A importação do inventário criou as peças já em uso e nunca criou o vínculo com
a pessoa. A tela afirma que a máquina está com alguém e não sabe dizer com quem.
Nenhum arranjo de colunas resolve isso — mas o modelo escolhido pelo menos
**mostra** o buraco em vez de escondê-lo.

## São três frotas, não uma

Foi a pergunta do Evandro — “a frota não é só de TI” e depois “também tenho a
frota de carros” — que derrubou a primeira versão deste desenho.

| | TI (128 hoje) | Obra (setembro) | Veículos (~22) |
|---|---|---|---|
| “Onde está” quer dizer | com **quem** | em qual **obra** | quem **dirige** |
| Documento que a rege | termo | contrato + certificado | CRLV, seguro, CNH |
| Mede uso por | — | horímetro (h) | hodômetro (km) |

A primeira versão propunha **duas abas** — “obra” e “TI”. Com veículos são três
populações, e aba binária quebra. **As abas saíram**: o trilho de categoria já
separa, e a coluna segue o `perfil_campos` da categoria. Menos peça, mais
capacidade — o desenho melhorou por causa da pergunta.

## As três decisões

### 1. Trilho de **categoria**, e não de obra

Obra tem 8 valores e não escala. Categoria vai de 1 para 10 quando equipamento
de obra e veículos entrarem — e é **o mesmo eixo da tela de Itens**, então quem
aprende uma sabe a outra. A obra continua como filtro, que já funcionava.

O trilho conta **peças**, não modelos: em Itens a categoria diz quantos modelos
o catálogo tem; aqui, quantas máquinas existem no pátio.

É navegação e não filtro — cada linha mostra o total *daquela* categoria mesmo
quando outra está selecionada. Quem está em Veículos precisa ver que TI tem 128
peças para decidir ir até lá.

### 2. Faixa de pendência que **some sozinha**

A urgência muda de assunto: hoje são 95 máquinas de TI entregues sem termo; em
outubro serão inspeções de PTA vencidas; depois, CRLV. Por isso a faixa é
montada a partir do que se está olhando, e não de uma lista fixa de checagens.

Não existe versão “tudo em ordem” dela. **Faixa permanente vira moldura**, e
deixa de ser lida justamente no dia em que tem conteúdo.

Duas regras que só apareceram ao reler o código:

- **Conta a categoria inteira**, não a lista já filtrada — senão, ao clicar
  nela, continuaria lá com o mesmo número apontando para si mesma.
- **Some quando o próprio filtro está aplicado**, e um selo com “X” toma o
  lugar. Sem o selo a lista encurtaria de 128 para 95 sem nada dizer por quê.

### 3. A coluna que segue o **perfil**

`categoria_equipamento.perfil_campos` existe desde a migration 0059 e já decide
quais campos nativos o formulário da peça mostra. A tela passa a ler o mesmo
campo: em TI e veículo a pergunta é *com quem*; em obra, *onde*.

Uma tela só, com “com quem está” vazio em toda betoneira, ensina a ignorar a
coluna.

## O que saiu e o que ficou

- **Saiu a coluna “Categoria”** — virou o trilho.
- **Ficou “Estado”.** Está vazia hoje porque a importação de TI não a preencheu,
  mas é onde o equipamento locado volta marcado como avariado. Apagá-la seria
  desenhar a tela para o passado — foi o erro da primeira versão deste desenho,
  corrigido depois da pergunta sobre equipamento de obra.
- **`listarCategorias` foi removida:** virou código morto quando o trilho a
  substituiu.

## Decisões de implementação que valem registro

- **`pecasComResponsavel` devolve quem TEM custódia aberta.** Um
  `pecasSemResponsavel` que devolvesse o conjunto oposto seria um nome
  mentiroso — a falta é derivada por quem tem a lista completa.
- **Ela devolve `null` em erro, não conjunto vazio.** Vazio significaria
  “ninguém assinou nada” e acenderia a faixa para a frota inteira. Nulo faz a
  tela omitir a pendência, que é honesto: ela não sabe.
- **O grupo “sem tipo” vai por último mesmo sendo o maior.** É lacuna de
  cadastro, não família; liderar a lista por ser numeroso lhe daria a
  importância de um tipo de verdade.
- **Agrupamento e pendência são funções puras**, em `src/lib/frota-agrupamento.ts`,
  com 13 testes. A página só orquestra.

## O que NÃO foi verificado

**A tela renderizada.** O servidor local responde às cinco rotas sem erro, mas
todas devolvem 307 — o redirect de login — e não há sessão nesta execução. O
Preview da Vercel builda com `success` e serve **500**, porque o ambiente de
Preview não tem as variáveis do Supabase (vale para qualquer commit, inclusive
os da `main`).

Está provado: o build, os 13 testes das funções puras, a ausência de erro de
servidor. **A tela em si depende de olho humano.**

## Alternativas descartadas, e por quê

| | Princípio | Descartado porque |
|---|---|---|
| A | Trilho de obra | 8 valores, não escala; e para TI a obra é quase sempre a 800 |
| B | Quadro de alocação por obra | É pergunta de gestão, não de consulta — vira relatório quando as locadas tiverem custo mensal |
| C | Trilho de pendência | Tela do problema, não do patrimônio: fica vazia quando tudo estiver em ordem, e tela vazia deixa de ser aberta |

**B não morre** — vira o quadro de alocação em Relatórios, quando houver custo
mensal e as peças paradas puderem ser lidas em reais.

## Como avaliar

O Preview não serve. Duas opções:

```
git checkout feat/frota-modelo-d && npm run dev
```

ou mergear na `main`, que publica para a empresa inteira — e por isso não foi
feito sem aprovação: é uma tela de uso diário mudando de forma.
