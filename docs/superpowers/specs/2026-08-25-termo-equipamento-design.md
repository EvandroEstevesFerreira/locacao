# Termo de responsabilidade por uso de equipamento

**Data:** 2026-08-25
**Status:** desenho aprovado, aguardando plano de implementação
**Escopo:** fatia do subprojeto 3 do módulo de equipamento locado

## Objetivo

Hoje o equipamento sai do almoxarifado para a mão do funcionário sem documento
nenhum. Quando some ou volta quebrado, não há papel que diga quem estava com ele,
em que estado saiu e quando deveria voltar — a conversa vira memória contra
memória.

Esta entrega cria o registro e o documento dessa passagem: quem recebeu, o que
recebeu, em que estado, até quando, com assinatura na tela e devolução no mesmo
papel.

A spec do recebimento (2026-08-23) lista "apontamento de uso, termo do operador,
alocação por frente" como subprojeto 3 e prevê que ele se decomponha. Esta é a
primeira fatia: **só o termo**. Horímetro e alocação por frente nascem de specs
próprias — são problemas diferentes, com públicos diferentes.

## Estado atual

### O que já existe e será usado

| Existe | Onde | Papel nesta entrega |
|---|---|---|
| `item_catalogo.controle` (`peca`/`quantidade`) | 0049 | Decide se o item exige patrimônio |
| `equipamento_unidade` | 0005 | O patrimônio entregue |
| `item_locado` com `unidade_id` | 0006 + 0049 | Vínculo opcional ao contrato |
| `numero_sequencia`, `proximo_numero`, `prefixo_registro` | 0048 | `TRM-2026-0001` |
| Primitivos de PDF | `src/lib/pdf-form.tsx` | O termo sai deles, sem componente novo |
| `documento_template` com versão | 0026 + 0046 | Texto das cláusulas, editável pelo Master |
| `Assinaturas` (`manual`/`aceite`), `aceite_em`/`aceite_ip` | 0043 + pdf-form | Padrão de trilha; **ganha um modo novo** (ver passivo 2) |
| Captura de assinatura desenhada | `vistorias/actions.ts` | O componente de desenho já existe e é reaproveitado |
| `soft_delete`, RLS por obra, `audit_log` | 0041, 0034, 0031 | Segurança e trilha |
| `MODULOS` / `moduloDaRota` | `src/lib/modulos.ts` | Liberação por usuário, de graça |

### Os dois passivos que esta entrega encontra

1. **Não existe cadastro de pessoas no sistema.** `perfil` são os usuários com
   login (sete pessoas); `ocupante_imovel` é uma ocupação de alojamento, com
   quarto e armário, não um registro de pessoa — quem não mora em alojamento não
   tem linha lá. O funcionário que opera equipamento é um terceiro conjunto, e
   precisa nascer aqui.

2. **A assinatura desenhada é capturada e nunca impressa.** A `vistoria` guarda
   `assinatura_empresa_img` e `assinatura_retirante_img` (PNG data URI) desde a
   0012, e nenhum PDF do sistema renderiza essas imagens: `Assinaturas` só sabe
   desenhar linha em branco (`manual`) ou o registro de data/hora e IP
   (`aceite`). Quem assina na tela hoje assina no vazio — o traço fica no banco e
   some do papel. Esta entrega acrescenta `modo="imagem"` ao primitivo, o que de
   quebra permite ao PDF de vistoria passar a imprimir o que já guarda (fora do
   escopo aqui, mas destravado).

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Recibo x termo | **Um papel só**, com bloco de devolução no mesmo documento |
| Quem recebe | **Cadastro próprio de funcionários** |
| Vínculo com contrato | **Opcional** — vale para equipamento alugado ou próprio |
| Assinatura | **Desenhada na tela + trilha** (nome, CPF, hora, IP) |
| Logotipo | **`LogoSistenge` vetorial que já existe**, via primitivo `Documento` |
| Formulário | **Passo a passo, 3 etapas** |
| Documento | **Ficha operacional**: devolução é coluna na tabela de itens |
| Emissão | **Dois botões**: assinar agora ou salvar sem assinar |
| Devolução parcial | **Registrada sem assinatura**; o encerramento é que é assinado |
| Número | **`TRM-` no fechamento**, não no rascunho (precedente do `recebimento`) |

## Modelo de dados

> **Número da migration:** atribuído na implementação. Esta fatia é a ÚLTIMA das
> três pendentes — vem depois de `2026-08-31-avanco-obra-design.md` e de
> `2026-08-31-cadastro-frota-design.md`, que é quem cria `estado_equipamento`.



```sql
-- `estado_equipamento` NÃO nasce aqui: é criado pela migration do cadastro de frota. Esta migration apenas o usa.

create table public.funcionario (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  nome text not null,
  cpf text, cargo text, matricula text, telefone text,
  obra_id uuid references public.obra (id) on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- unique parcial: dois cadastros do mesmo CPF na mesma organização é erro,
-- mas CPF em branco é permitido (nem toda obra tem o dado na hora).
create unique index on public.funcionario (org_id, cpf) where cpf is not null;

create table public.termo_equipamento (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  numero_registro text,                    -- TRM-2026-0001, gravado na emissão
  funcionario_id uuid not null references public.funcionario (id) on delete restrict,
  obra_id uuid references public.obra (id) on delete set null,
  contrato_id uuid references public.contrato_locacao (id) on delete set null,
  data_entrega date not null,
  previsao_devolucao date,
  emitido_em timestamptz,                  -- null = rascunho
  encerrado_em timestamptz,
  cancelado_em timestamptz, motivo_cancelamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, numero_registro)
);
-- SEM trg_numero_registro, de propósito: rascunho não gasta número. O
-- `proximo_numero` é chamado na action de emissão, como no `recebimento`.

create table public.termo_equipamento_item (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  termo_id uuid not null references public.termo_equipamento (id) on delete cascade,
  item_id uuid not null references public.item_catalogo (id) on delete restrict,
  unidade_id uuid references public.equipamento_unidade (id) on delete restrict,
  item_locado_id uuid references public.item_locado (id) on delete set null,
  quantidade numeric(14,2) not null default 1,
  estado_entrega public.estado_equipamento not null,
  estado_devolucao public.estado_equipamento,
  data_devolucao date,
  observacoes text
);

create table public.termo_assinatura (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  termo_id uuid not null references public.termo_equipamento (id) on delete cascade,
  momento text not null check (momento in ('entrega','devolucao')),
  papel   text not null check (papel   in ('funcionario','empresa')),
  nome text not null, cpf text,
  imagem text,                             -- PNG data URI, desenhado na tela
  assinado_em timestamptz not null default now(),
  assinado_ip inet,
  unique (termo_id, momento, papel)
);
```

Mais: `prefixo_registro` ganha `when 'termo_equipamento' then 'TRM'`; triggers de
`updated_at` e de `audit_log` nas tabelas novas.

### Por que tabela de assinatura em vez de colunas

A `vistoria` guarda assinatura em colunas soltas e funciona — com duas. Aqui são
quatro (funcionário e empresa, na entrega e na devolução), cada uma com nome,
CPF, imagem, hora e IP: vinte colunas quase idênticas. A tabela mantém a trilha
uniforme, dá `unique (termo, momento, papel)` de graça e abre espaço para
testemunha sem migration de esquema.

### Situação, derivada e não guardada

View `termo_equipamento_situacao`, nesta ordem de precedência: `cancelado` →
`rascunho` (sem `emitido_em`) → `devolvido` (encerrado, ou todos os itens com
`data_devolucao`) → `devolvido_parcial` (algum item devolvido) → `em_uso`.

Coluna `status` guardada mente depois de uma devolução parcial; derivar não tem
esse defeito.

### RLS

Espelha imóveis e contratos: master/administrador veem tudo; gestor e operador,
só os termos das obras a que têm acesso (`is_member_of_obra(obra_id)`). Escrita
com `pode_operar()`. `funcionario` é visível para a organização inteira — precisa
aparecer na lista de escolha — com escrita por `pode_operar()` e exclusão só para
master/administrador.

## Telas

| Rota | O que é |
|---|---|
| `/termos` | Lista: busca por funcionário, filtros de obra, situação e período |
| `/termos/novo` | Passo a passo de 3 etapas |
| `/termos/[id]` | Detalhe, assinatura, devolução, cancelamento, PDF |
| `/termos/funcionarios` | Cadastro de funcionários |
| `/api/termos/[id]/pdf` | O documento |

Módulo novo `termos` em `MODULOS` (href `/termos`) — o cadastro de funcionários
fica sob a mesma rota justamente para herdar a liberação por usuário sem uma
segunda chave.

### O passo a passo

1. **Quem e quando** — funcionário (busca, com criação inline), obra (vem da obra
   do funcionário), data de entrega, previsão de devolução, contrato (opcional)
2. **Itens** — item do catálogo; se `controle = 'peca'`, o patrimônio é
   **obrigatório** e a lista mostra só unidades livres; se `quantidade`, pede a
   quantidade. Estado na entrega por item
3. **Conferir e assinar** — resumo em leitura, duas áreas de assinatura, e os
   dois botões

Nada é gravado antes do botão final: quem abre e desiste não deixa rascunho
órfão. O termo salvo sem assinatura fica como rascunho e é assinado depois pela
tela de detalhe — o caso real é o termo ser preparado de manhã e o funcionário só
aparecer no fim do dia.

### Devolução

"Registrar devolução" marca os itens que voltaram, com data e estado de cada um.
Devolução parcial não é assinada; o **encerramento** é, e pode acontecer a
qualquer momento — itens que não voltaram ficam registrados como pendência. Isso
resolve o caso de o funcionário devolver dois de três itens e ser desligado: o
termo encerra com a pendência visível, em vez de ficar aberto para sempre.

## O documento

Ficha de uma página, montada com os primitivos existentes:

`Documento` (logo, `TRM-2026-0001`, data) → `CampoGrid` (funcionário, CPF, cargo,
obra, previsão) → `Tabela` (item, patrimônio, qtd, estado na entrega, coluna de
devolução em branco) → cláusulas vindas de `documento_template` tipo
`termo_equipamento` → `Assinaturas` → `Caixa` com o bloco de devolução.

O único componente novo é o `modo="imagem"` do `Assinaturas`: imprime o PNG
desenhado acima da linha, com nome, papel e a trilha (data/hora e IP) embaixo.
Termo ainda não assinado sai em `modo="manual"`, com a linha em branco — é o
mesmo papel, serve para assinar à caneta quando não houver tela na frente.

A coluna de devolução ao lado da de entrega, na mesma linha do item, é o ponto do
layout: "saiu bom, voltou com avaria" fica legível sem cruzar dois papéis — e é
esse par que sustenta uma cobrança de avaria.

## Erros

- Toda action devolve `ActionResult`; nenhuma engole `error` (lição da v0.19.4).
- Emissão é transacional: se `proximo_numero` falhar, não nasce termo sem número.
- Rascunho é apagado de verdade. Termo emitido **não se exclui** — só cancela,
  com motivo. Documento assinado que some destrói a confiança no controle.
- Patrimônio já vinculado a termo em aberto não aparece na lista do passo 2.

## Testes

- Schemas dos dois formulários entram em `schemas-varredura.test.ts` e
  `schemas-mensagens.test.ts` — a rede criada na v0.36.0 depois de o mesmo
  defeito de campo em branco voltar três vezes.
- `controle = 'peca'` sem patrimônio é recusado — no schema, não só na tela.
- Situação derivada: nenhum item devolvido, alguns, todos, e encerrado com
  pendência.
- Unicidade de assinatura por (termo, momento, papel).
- Numeração em `registros.test.ts`: `TRM-` só nasce na emissão, e rascunho
  apagado não deixa buraco na sequência.
- `Assinaturas modo="imagem"` em `pdf-form.test.tsx`: o PNG aparece no documento
  — é justamente o defeito que a vistoria tem hoje, e o teste existe para ele não
  se repetir.
- PDF por `contarPaginas` **e inspeção do conteúdo** — a lição registrada na spec
  do recebimento é que contar página não prova que o documento está certo.

## Faseamento

| Fase | Entrega | Migrations |
|---|---|---|
| 1 | Migration desta fatia, cadastro de funcionários, CRUD do rascunho | 1 |
| 2 | Passo a passo, emissão com número, assinatura na tela, PDF | 0 |
| 3 | Devolução, encerramento com pendência, cancelamento | 0 |

## Riscos assumidos

- **`funcionario` e `ocupante_imovel` guardam pessoas em tabelas diferentes.** A
  mesma pessoa pode existir nas duas. Unificar agora obrigaria a mexer no
  alojamento, que está recém-entregue. A costura fica anotada: um
  `ocupante_imovel.funcionario_id` resolve depois, sem perder dado.
- **`item_locado.unidade_id` não é obrigatório** nem para item `peca` (risco
  herdado da 0049). Termo de item vindo de contrato antigo pode não achar o
  patrimônio; o passo 2 permite escolher a unidade manualmente.
- **A trilha de assinatura não é assinatura digital com valor jurídico.** É
  evidência razoável para uso interno. Se um dia precisar de ICP-Brasil ou de um
  provedor de e-signature, é outro projeto.

## Fora de escopo, de propósito

- Item devolvido `com_avaria` **não** gera avaria nem lançamento financeiro
  automático. A maquinaria existe (`status_avaria`, `avaria_lancamento`), mas é
  outro fluxo, com regra de cobrança própria — subprojeto 2.
- Apontamento de horímetro e alocação por frente (resto do subprojeto 3).
- Relatórios sobre termos (subprojeto 4).
