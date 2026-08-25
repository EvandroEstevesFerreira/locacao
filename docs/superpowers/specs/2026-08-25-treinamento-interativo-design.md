# Treinamento interativo do Loca — três trilhas

**Data:** 2026-08-25
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** artefato de capacitação. Nenhuma mudança no app.
**Versão do sistema de referência:** 0.39.0

## Objetivo

O Loca tem oito módulos, quatro perfis de acesso e oito documentos gerados em
PDF. Nada disso tem treinamento válido: o único material que existe,
`docs/manual-treinamento-loca.md`, referencia a **v0.19.3** — vinte versões
menores atrás. Ele não cobre alojamento com documentos, numeração de registros,
recebimento de equipamento, alertas por obra nem os e-mails com identidade.

Na prática, hoje **não existe** treinamento do Loca. As pessoas aprendem por
tentativa, e o sintoma aparece como dado errado no sistema — que é caro de
corrigir depois.

Esta entrega cria um treinamento interativo em HTML, em três trilhas, e
atualiza o manual em Markdown para servir de referência de consulta.

## Por que trilhas separadas

O pedido original foi "separar o controle de ferramentas e locações do controle
de imóveis, porque são controles distintos". A separação é correta, mas não é
limpa: dos oito módulos, **quatro são compartilhados**.

| Trilha | Módulos |
|---|---|
Ferramentas e locações | Itens, Contratos, Recebimentos, Vistorias |
Imóveis e alojamento | Imóveis (+ os sete documentos de alojamento) |
**Compartilhados** | **Obras, Fornecedores, Financeiro, Relatórios** |

Uma obra é obra nos dois controles; um lançamento financeiro é o mesmo objeto.
Repetir a explicação nas duas trilhas criaria duas versões da mesma verdade —
o mesmo passivo que os e-mails tinham antes da 0.38.0, quando o assunto vivia
no call site e já havia divergido.

Daí a **Trilha 0**, feita uma vez por todos, antes das outras duas.

## Estado atual — o que existe para reaproveitar

| Arquivo | Estado | Destino |
|---|---|---|
`docs/manual-treinamento-loca.md` | 372 linhas, 17 seções, conteúdo bom, referência v0.19.3 | **Atualizar** para 0.39.0. É a fonte de conteúdo do HTML e continua como referência de consulta |
`apresentacao-loca.html` | 35 KB, navegável, na raiz e fora do git | **Não reaproveitar o visual.** Usa `#cf2927` — o vermelho errado que `src/lib/brand-colors.ts` documenta como divergência já corrigida no resto do projeto |
`src/lib/nav.ts`, `src/lib/modulos.ts` | Os oito módulos e a navegação real | Fonte da verdade da estrutura do treinamento |
`src/lib/permissoes.ts` | Os quatro perfis e a matriz de permissões | Fonte da marcação "para quem é" |
`src/lib/templates.ts` | Os oito documentos gerados, com módulo e categoria | Conteúdo dos módulos de documento |
`src/lib/brand-colors.ts` | A paleta correta | Identidade visual do HTML |

## Decisões aprovadas

| Decisão | Escolha | Por quê |
|---|---|---|
Formato | **HTML**, não PPT | Interativo de verdade, funciona no celular, atualiza sem reexportar. "Interativo" em PowerPoint é hyperlink entre slides |
Entrega | **Um** Artifact publicado | Um link para compartilhar com a equipe. Três links (um por trilha) obrigariam a trocar de página no meio do caminho |
Módulos compartilhados | Trilha 0, feita uma vez | Evita duas versões da mesma explicação |
Público | Um treinamento, com marcação de perfil por seção | Um mestre de obra e o supervisor administrativo não precisam do mesmo caminho, mas precisam do mesmo vocabulário |
Interatividade | Navegação + verificação + exercício no sistema real | Simulação de tela clicável desatualiza a cada mudança no Loca, e nada avisaria |
Ilustração | Diagramas SVG desenhados | Screenshot ensina mais, mas envelhece rápido e exige alguém capturando trinta telas a cada versão |
Manual `.md` | Atualizado para 0.39.0 | Um manual desatualizado circulando é pior que nenhum |

## Estrutura — três trilhas, 18 módulos

### Trilha 0 · Fundação

1. **O que o Loca resolve — e o que ele não é.** A perspectiva de locatária: o
   sistema controla o que a Sistenge **paga**, não o que ela cobra. As duas dores
   que ele existe para matar: pagar por equipamento parado e aceitar cobrança de
   avaria sem prova.
2. **Primeiro acesso.** Senha temporária, troca obrigatória, instalar no celular
   como aplicativo (PWA), funcionamento sem sinal.
3. **Perfis: quem pode o quê.** Master, Administrador, Gestor, Operador — e o
   acesso por obra, que é o que impede alguém tirado de uma obra de continuar
   vendo o que era dela.
4. **Obras.** O centro de custo de tudo. Por que quase toda tela filtra por obra.
5. **Fornecedores.** Cadastro, contato que recebe e-mail, CNPJ.
6. **Financeiro e Relatórios.** Para onde tudo converge: competência,
   vencimento, baixa, fluxo de caixa, e os doze relatórios (seis de
   equipamento, seis de imóvel — o que já é um argumento a favor das trilhas).

### Trilha A · Ferramentas, materiais e locações

1. **Catálogo de itens.** Equipamento, material retornável, consumível — e por
   que a escolha muda o controle. Controle por peça (patrimônio) x por
   quantidade.
2. **Contrato de locação com o fornecedor.** Obra, cadência de cobrança, itens,
   número do contrato do Loca ao lado do número do fornecedor.
3. **Recebimento.** A seção Recebimentos do contrato: conferir item a item, quem
   conferiu, número da nota do fornecedor, item que chegou fora do contrato,
   avaria já na entrada, e a data da entrega — que não é a data de digitação.
4. **Vistoria de retirada.** O relatório fotográfico. Por que a foto na entrada
   é o que ganha a discussão na saída.
5. **Devolução.** Parcial e total, e o custo que para de correr no dia certo.
6. **Avarias.** Registrar, cobrar do fornecedor, contestar cobrança indevida.

Ao fim da trilha, um bloco marcado **"em construção"**: recibo de ferramenta por
funcionário. Ver "Fora de escopo".

### Trilha B · Imóveis e alojamento

1. **Cadastro do imóvel.** Kitnet, apartamento, casa, galpão, escritório.
2. **Contrato do imóvel.** Caução, reajuste por índice, ciclo de vida na aba de
   ações.
3. **Ocupantes.** Quem mora onde, quarto, armário, cargo, aceite registrado.
4. **Os sete documentos do alojamento.** Termo de compromisso (FRM-RH-001),
   medida disciplinar (FRM-RH-002), entrega de chaves (FRM-RH-003), kit
   (FRM-RH-004), checklist de limpeza (FRM-RH-005), política (POL-RH-001) e o
   contrato de locação de imóvel. Quando cada um sai, quem assina, onde fica.
5. **Contas de consumo.** Água, luz, gás — o que é do proprietário e o que é da
   Sistenge.
6. **Vistorias, reparos e ocorrências.**

## O fio condutor

Uma obra fictícia atravessa os dezoito módulos:

- Obra **Residencial Alto da Serra — Torre B**
- Fornecedor **Locadora Bandeirantes**
- Betoneira **BT-4412**, que chega, é conferida, vistoriada, usada, devolvida
  com a coroa dentada, e a cobrança é contestada
- Alojamento **Rua das Palmeiras, 412**, que recebe um ocupante — termo, chaves,
  kit, checklist semanal

Exemplo solto por módulo ensina telas. Uma história única ensina o
**encadeamento**, que é onde as pessoas de fato erram: a vistoria que ninguém
fez na entrada só cobra o preço na devolução, três meses depois.

Os mesmos nomes já aparecem nos dados de exemplo dos e-mails
(`src/lib/emails/exemplos.ts`), o que é deliberado: quem vê o e-mail de aviso e
depois o treinamento reconhece a mesma obra.

## Anatomia de um módulo — cinco blocos

| Bloco | Conteúdo | Interação |
|---|---|---|
**O problema** | A dor real, em 2-3 frases | — |
**O caminho** | Passo a passo numerado + diagrama da tela | — |
**No exemplo** | O que acontece com a Torre B neste passo | — |
**Faça você** | 2-3 exercícios no Loca real | Caixa de marcar, salva no navegador |
**Confira** | 1-2 perguntas de múltipla escolha | Resposta **comentada**, não só certo/errado |

A resposta comentada é o ponto. "Errado" não ensina; "errado, porque a data de
competência é o mês a que a despesa pertence, e o vencimento é quando ela é
paga" ensina.

Cada módulo carrega a marcação de **para quem é** — um ou mais dos quatro
perfis. O Gestor não precisa do passo a passo de como lançar uma devolução; o
Operador não precisa da configuração de e-mail automático.

## Progresso

Marcações de exercício e respostas de verificação ficam em `localStorage`, por
pessoa e por navegador. Barra de progresso por trilha e um "continuar de onde
parei".

Nada trafega para servidor nenhum: cada um vê só o próprio avanço, e não há
relatório de quem fez o quê. Se alguém abrir em janela privada, começa do zero —
aceitável, porque o valor é a conveniência de retomar, não a auditoria.

Toda leitura e escrita em `localStorage` vai dentro de `try/catch`: em alguns
contextos o acessor lança, e a página tem de renderizar corretamente sem
nenhum valor guardado.

## Diagramas

SVG embutido, sem imagem externa, legível em tema claro e escuro — o Artifact
renderiza no tema de quem abre.

1. **Cadeia de custódia da ferramenta** — os quatro elos (fornecedor → Sistenge
   → funcionário → Sistenge → fornecedor), com o elo do funcionário marcado como
   ainda não existente no sistema
2. **Anatomia de uma tela de lista** — filtro, busca, paginação, estado vazio.
   Ensina uma vez o que se repete em dez telas
3. **Ciclo de vida do contrato de imóvel** — os estados e as transições da aba
   de ações
4. **Matriz de perfis × permissões** — quem pode cadastrar, quem pode operar,
   quem só lê

## Identidade visual

Paleta de `src/lib/brand-colors.ts`, sem exceção:

- `--primary` (slate-900) é a cor de ação
- o vermelho da marca (`#BE3A31`) só no logotipo e em marcação de crítico
- **nunca** `#cf2927`, o vermelho errado que ainda vive no
  `apresentacao-loca.html`

PT-BR acentuado em toda string visível. Layout que funciona em tela de 390px,
porque quem opera está na obra com o celular na mão.

## Entrega

| Onde | O que |
|---|---|
`docs/treinamento/index.html` | O arquivo, versionado junto com o sistema que documenta |
Artifact publicado | O link para abrir no celular e compartilhar |
`docs/manual-treinamento-loca.md` | Atualizado para 0.39.0 |

## Verificação

O ritual de fechamento (`typecheck`, `lint`, `test`, `build`) não olha HTML de
documentação. Um teste pequeno cobre o apodrecimento que de fato acontece:

1. nenhum `undefined`, `NaN` ou `[object Object]` no HTML final
2. todo link interno (`href="#..."`) tem um `id` de destino
3. toda cor hexadecimal usada está numa **lista permitida** = os valores de
   `brand-colors.ts` **mais** um punhado de extras declarados no próprio teste,
   cada um com o comentário de por que existe (o fundo do bloco de erro do
   questionário, os preenchimentos dos diagramas). Exigir que TODA cor viesse de
   `brand-colors.ts` reprovaria cores legítimas — `src/lib/emails/layout.ts` já
   usa `#FEF2F2` literal pelo mesmo motivo. O que o teste tem de garantir é que
   nenhuma cor entre **sem passar por essa decisão**, e em particular que o
   `#cf2927` nunca volte
4. os dezoito módulos declarados aparecem no índice e no corpo
5. auditoria de PT-BR do `AGENTS.md`

Mais a conferência que só uma pessoa faz: abrir no celular e julgar se serve
para quem está na obra.

## Versionamento

Documentação, mas visível ao usuário. Bump para **0.40.0**, com um item `novo`
na tela Novidades apontando o link do treinamento.

O bump entra **depois** de publicar o Artifact, porque o texto precisa da URL.

## Fora de escopo

| O que | Por quê |
|---|---|
**Simulação de tela clicável** | Cada mudança de tela no Loca a desatualizaria, e nada avisaria. O exercício no sistema real ensina o mesmo e nunca envelhece |
**Screenshots** | Envelhecem rápido e exigem alguém capturando trinta telas por versão |
**Vídeo** | Custo de produção e de manutenção fora de proporção |
**Módulo do recibo de ferramenta por funcionário** | O sistema **não faz isso**. Ver abaixo |
**Relatório de quem completou o treinamento** | Exigiria servidor e banco. O progresso é conveniência de quem estuda, não instrumento de cobrança |

### O recibo de ferramenta por funcionário

Pedido junto com este treinamento, e é um **projeto próprio** — não um módulo de
treinamento. Falta ao sistema:

- uma tabela de **colaborador** independente de imóvel (hoje só existe
  `ocupante_imovel`, que existe em função de um alojamento — e nem todo
  funcionário que pega uma furadeira mora em alojamento);
- entrega e devolução por **unidade de equipamento** (`equipamento_unidade`,
  criada na migration 0005, ficou órfã por muito tempo e só agora, com o
  recebimento da 0.39.0, passou a ser referenciada);
- numeração de registro, PDF, RLS e telas.

O padrão já existe e é bom: `entrega_ocupante` (migration 0044) faz exatamente
entrega a uma pessoa, devolução, conferência de avaria e PDF — só está amarrado
a imóvel e restrito a `tipo in ('chaves', 'kit')`.

A dependência que travava esse trabalho — o elo fornecedor → Sistenge — **caiu
com a 0.39.0**. O projeto está desbloqueado e pode ser desenhado em seguida.

O treinamento reserva o lugar dele ao fim da Trilha A, marcado como em
construção, para que ninguém procure tela que não existe.
