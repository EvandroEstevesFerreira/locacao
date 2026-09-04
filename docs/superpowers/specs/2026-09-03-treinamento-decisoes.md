# Treinamento e manual do Loca — decisões de desenho

**Data:** 2026-09-03
**Estado:** registro de decisões, **não é a spec**. A spec vem depois das
abordagens e do desenho por seções.

Este arquivo existe para as decisões sobreviverem à compactação da sessão. Quem
retomar o trabalho começa por aqui.

## O pedido

Manual de utilização e treinamento completo do sistema Loca. Todos devem fazer
o treinamento para usar o módulo. "Construa tudo."

## Decomposição — são três projetos, não um

| | O que é | Tamanho |
|---|---|---|
| **A. A máquina** | Tabelas, trilha por papel, registro de conclusão, comprovante, painel de quem-treinou-quem-falta | Uma fatia normal |
| **B. O conteúdo** | O texto das aulas para **51 páginas** em **13 módulos** e **4 papéis** | 60 a 100 aulas. É escrita, não código |
| **C. O manual** | Referência por tela, para quem travou | Resolvido dentro de B — ver abaixo |

Ordem: **A** primeiro, depois **B** em ondas. Escrever 80 aulas antes de algo
ficar utilizável é como projeto de documentação morre.

## A decisão estrutural: fonte única para manual e trilha

Manual e treinamento são **a mesma informação em duas ordens**. A trilha
percorre na ordem em que se aprende; o manual indexa por tela, para quem já
sabe e travou.

O conteúdo mora numa fonte única — cada aula com título, passo a passo, "o que
tem de acontecer" e a tela a que pertence — e as duas telas leem dela. Escrevo
uma vez, e **nenhum dos dois desatualiza sem o outro**.

Isso transforma três projetos em dois.

## Onde o conteúdo mora

**No código**, em `src/lib/treinamento/<modulo>.ts`, versionado.

Treinamento de software **é** documentação de software: se a tela muda, a aula
muda no mesmo commit, e o diff mostra as duas coisas lado a lado. No banco, a
tela muda e a aula fica mentindo em silêncio — o mesmo defeito do manual em
Word que o pedido queria evitar, só dentro do sistema.

Custo aceito: mudar uma vírgula exige deploy.

## As quatro decisões do usuário (2026-09-03)

1. **Conclusão = pergunta ao fim da trilha.** Três a cinco perguntas de
   múltipla escolha; erra, revê a aula, tenta de novo. É o que faz "o Fulano
   treinou" ser fato verificável em vez de um clique registrado.
2. **Vence quando o módulo muda.** Cada trilha tem versão. Quando uma tela
   muda e a aula muda, quem treinou na versão anterior fica "pendente de
   atualização" — só nas aulas que mudaram, não do zero. Aproveita o changelog
   que já existe.
3. **Painel para master/administrador e para a própria pessoa.** Gestor por
   obra e e-mail semanal ficaram **fora** — não foram escolhidos.
4. **Ordem do conteúdo:** trilha de primeiros passos (entrar, trocar senha, o
   menu por grupos, achar uma obra, pedir acesso), depois o grupo
   **Equipamento** (Frota, Custódia, Termos, Estoque) — as telas mais novas,
   que ninguém sabe usar.

## Decisões anteriores, da mesma conversa

- O treinamento vive **dentro do sistema**, com registro de conclusão.
- **Não bloqueia** o acesso ao módulo: registra e cobra. No dia em que o
  almoxarife precisar lançar uma saída urgente, ele consegue.
- Escopo: **o sistema todo**, em ondas.
- **Eu escrevo o conteúdo, o Evandro revisa** o vocabulário da Sistenge.

## O que reaproveitar, e não construir de novo

- `SignaturePad` (`src/components/shared/signature-pad.tsx`) e `Assinaturas`
  com `modo="imagem"` (`src/lib/pdf-form.tsx`) — assinatura na tela impressa em
  PDF, prontas desde a 0.49.0.
- `src/lib/modulos.ts` — os 13 módulos liberáveis e a resolução de rota para
  módulo, que o proxy já usa.
- `prefixo_registro` (migration 0056) — numeração de registro por tipo, para o
  comprovante de conclusão.
- As 14 etapas do roteiro de homologação — base do conteúdo prático, já escrito
  no formato "onde clicar / o que fazer / o que tem de acontecer".
- O cron e o Resend dos indicadores quinzenais, se o e-mail entrar depois.

## Próximo passo

Propor 2-3 abordagens para **A (a máquina)**, com recomendação; depois o
desenho por seções; depois a spec em
`docs/superpowers/specs/2026-09-03-treinamento-design.md`; depois o plano.
