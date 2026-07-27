# Manual de Treinamento — Loca (Controle de Locações)

> **Módulo complementar de capacitação.** Este manual cobre **todos os menus, módulos e
> funcionalidades** do Loca, o sistema da Sistenge para controle de locações de
> materiais, equipamentos e imóveis por obra. Use-o como referência de consulta e como
> apoio ao treinamento interativo.
>
> Versão do sistema de referência: **v0.19.3**.

---

## Sumário

1. [Visão geral e conceitos](#1-visão-geral-e-conceitos)
2. [Perfis de acesso e segurança](#2-perfis-de-acesso-e-segurança)
3. [Primeiro acesso e instalação (PWA)](#3-primeiro-acesso-e-instalação-pwa)
4. [Painel inicial](#4-painel-inicial)
5. [Obras](#5-obras)
6. [Fornecedores](#6-fornecedores)
7. [Itens (catálogo)](#7-itens-catálogo)
8. [Contratos de locação (equipamentos)](#8-contratos-de-locação-equipamentos)
9. [Vistorias e avarias](#9-vistorias-e-avarias)
10. [Financeiro](#10-financeiro)
11. [Imóveis](#11-imóveis)
12. [Relatórios](#12-relatórios)
13. [Configurações](#13-configurações)
14. [Recursos gerais de tela](#14-recursos-gerais-de-tela)
15. [Boas práticas por papel](#15-boas-práticas-por-papel)
16. [Glossário](#16-glossário)
17. [Perguntas frequentes (FAQ)](#17-perguntas-frequentes-faq)

---

## 1. Visão geral e conceitos

O **Loca** centraliza o controle de tudo que a Sistenge **aluga** para uso nas obras —
equipamentos, materiais e imóveis (alojamentos, escritórios, galpões). A perspectiva é a
de **locatária**: o sistema controla **o custo pago aos fornecedores/proprietários**, por
obra, e evita duas dores principais:

- **Pagar por equipamento parado** (locação vencida que ninguém devolveu ou renovou).
- **Cobrança indevida de avarias** pelo fornecedor (sem prova do estado do item).

**Conceitos-chave:**

| Conceito | O que é |
|---|---|
| **Organização** | A empresa (Sistenge). Todos os dados pertencem a ela (base multi‑tenant). |
| **Obra** | Canteiro/centro de custo. Quase tudo é filtrável e agrupável por obra. |
| **Fornecedor** | Locadora/proprietário de quem se aluga. |
| **Item** | Equipamento, material retornável ou consumível do catálogo. |
| **Contrato de locação** | Acordo com um fornecedor, vinculado a uma obra, com cadência de cobrança e itens. |
| **Imóvel** | Kitnet, apartamento, casa, galpão ou escritório locado, com seu próprio contrato. |
| **Vistoria** | Registro fotográfico de retirada/devolução, com avarias. |
| **Lançamento financeiro** | Conta a pagar (competência, valor, vencimento, status). |

---

## 2. Perfis de acesso e segurança

O acesso é controlado por **papel** (RBAC) e por **acesso a obras**.

| Papel | O que faz |
|---|---|
| **Master** | Acesso total: usuários, configurações, exclusões e auditoria. |
| **Administrador** | Acesso total, exceto configuração master (usuários e sistema). |
| **Gestor** | Lê tudo e gera relatórios; **não edita**. |
| **Operador** | Opera contratos, movimentações/devoluções e vistorias. |

**Camadas de segurança:**

- **Acesso por obra:** um usuário vinculado apenas à obra "608" vê somente os dados
  (imóveis, contratos, relatórios, financeiro) daquela obra.
- **Módulos por usuário:** o Master pode liberar/bloquear menus por pessoa.
- **Senha no primeiro acesso:** ao entrar pela primeira vez (ou após o Master redefinir a
  senha), o sistema **obriga a criar uma senha pessoal** antes de continuar.
- **Dados sensíveis mascarados:** CPF, conta bancária e chave PIX aparecem ocultos
  (`•••`), com botão de "revelar" sob demanda.
- **Auditoria:** o sistema registra quem criou, alterou ou excluiu cada registro.
- **Exclusão reversível (soft‑delete):** obras, contratos, lançamentos e imóveis excluídos
  podem ser recuperados; a exclusão preserva o histórico.

---

## 3. Primeiro acesso e instalação (PWA)

1. **Receba o e-mail de acesso** com seu login (e-mail) e senha temporária.
2. **Entre** na tela de login com a marca Sistenge. Esqueceu a senha? Use "recuperar senha".
3. **Crie sua senha pessoal** na tela que aparece obrigatoriamente no primeiro acesso.
4. **Instale como aplicativo (PWA):** no celular/desktop, use "Adicionar à tela inicial"/
   "Instalar app". O Loca abre em tela cheia, com ícone próprio.
5. **Uso offline básico:** sem internet, o app mostra uma tela amigável em vez de erro;
   ao voltar a conexão, recarregue para continuar.

---

## 4. Painel inicial

Tela **Início** — visão geral do dia. Recursos:

- **Filtro por obra** (topo): ao escolher uma obra, **todos os números e o gráfico**
  passam a considerar apenas ela.
- **Indicadores (KPIs):** Contratos ativos, Itens em aberto, Imóveis, Avarias abertas.
  Cada card leva à tela correspondente.
- **Gráfico "Desembolso previsto (12 meses)":** série mensal com pago, pendente e a
  projeção dos contratos (equipamentos + imóveis). Mostra o **total previsto** e o
  **custo mensal dos imóveis vigentes**.
- **Contas a pagar:** total pendente e total vencido, com atalho para o Financeiro.
- **Devoluções nos próximos 7 dias:** itens em aberto com devolução prevista chegando.

---

## 5. Obras

Cadastro dos canteiros/centros de custo.

- **Novo/editar obra:** código, nome, responsável, endereço, status (ativa/pausada/encerrada).
- **Lista:** com **busca** (código, nome, responsável), **ordenação por coluna** (clique no
  cabeçalho) e **paginação**.
- Só **Master/Administrador** editam; a exclusão (Master) é reversível.

---

## 6. Fornecedores

Locadoras e proprietários.

- **Cadastro:** nome, **CNPJ** (com validação, inclusive formato alfanumérico), contatos.
- **Vínculo com obras (N:N):** indique de quais obras aquele fornecedor participa — útil
  quando há fornecedores locais em vários estados.
- **Busca e filtro:** barra de pesquisa (nome/CNPJ) + filtro por obra na lista.
- **Aviso de CNPJ duplicado:** ao cadastrar um CNPJ já usado por outro fornecedor, o
  sistema avisa; é possível "salvar mesmo assim" marcando a confirmação.

---

## 7. Itens (catálogo)

Catálogo do que a organização aluga.

- **Tipos:** `equipamento` (por unidade), `material retornável` (por quantidade/saldo) e
  `consumível`.
- **Unidades de equipamento:** para equipamentos, cadastre as unidades físicas
  (nº de série/patrimônio).
- **Lista:** busca por descrição/unidade, ordenação e paginação; status ativo/inativo.

---

## 8. Contratos de locação (equipamentos)

O coração da operação de locação de equipamentos/materiais.

### 8.1 Criar um contrato
- Vincule **obra** e **fornecedor**.
- **Número:** já vem **sugerido automaticamente** (`CT-<ano>-<sequência>`), editável.
- **Cadência de cobrança:** diária, semanal, quinzenal ou mensal — base do cálculo de custo.
- Datas de início e fim prevista; observações; cobrança pró‑rata (opcional).

### 8.2 Itens do contrato
- **Adicionar item:** item do catálogo, quantidade, valor unitário por período e
  **número de série/registro/tag** (identificação do equipamento).
- O custo de cada item = quantidade em aberto × valor × períodos no mês (pela cadência).

### 8.3 Relatório fotográfico de retirada
- Antes de operar, **crie o relatório de retirada** e anexe fotos de **todos os itens**.
- O relatório nasce **"pendente de fotos"** (badge) até ter ao menos uma foto.

### 8.4 Devolução parcial e histórico
- Devolva item a item (ex.: 10 → 3 → 4 → 3), até zerar o saldo.
- Cada devolução **cria um relatório fotográfico** e entra no **histórico** do item.
- O custo respeita o saldo (devolução parcial não cobra a quantidade cheia).

### 8.5 Documentos, aditivos e PDF
- **Anexe o contrato original** e **novos documentos** (aditivos/renovações) ao longo do tempo.
- **Gerar contrato (PDF):** documento com partes, obra, vigência, cadência e itens,
  a partir de um **template editável** (ver Configurações → Templates).

### 8.6 Auditoria do contrato
- No rodapé (visível ao Master), a **linha do tempo** mostra quem criou/alterou/excluiu.

---

## 9. Vistorias e avarias

- **Tipos:** entrada (retirada) e devolução.
- **Fotos obrigatórias:** o relatório fica sinalizado como pendente até ter fotos.
- **Avarias:** registre descrição e **custo estimado**; status aberta/cobrada/resolvida.
- **Avaria → cobrança:** o botão **"Gerar cobrança"** cria uma conta a pagar com o custo,
  marca a avaria como "cobrada" e vincula os dois (evita duplicidade). Requer permissão
  financeira.
- Lista de vistorias com filtro por obra, ordenação por data e paginação.

---

## 10. Financeiro

Contas a pagar das locações (equipamentos e imóveis).

### 10.1 Lista e filtros
- KPIs: **A pagar (pendente)**, **Vencido**, **Pago**.
- **Busca** (descrição), **filtros** (obra e status), **ordenação** e **paginação**.

### 10.2 Fluxo de caixa
- Projeção mês a mês combinando lançamentos reais e a estimativa dos contratos ativos e
  imóveis vigentes sem lançamento próprio no mês.

### 10.3 Contas a pagar recorrentes
- Em **"Gerar recorrentes"**, materialize **uma conta por mês** (até o mês escolhido) para
  cada contrato de imóvel vigente e cada contrato de locação ativo. É **idempotente**: não
  duplica meses já gerados.

### 10.4 Baixa com conciliação
- No ícone **"Dar baixa"** de um lançamento pendente informe:
  - **valor efetivamente pago** (pode diferir do previsto),
  - **data do pagamento** e **nº da NF**,
  - **anexo do comprovante**.
- **Multa e juros por atraso:** o sistema calcula uma sugestão (multa 2% + juros 1% a.m.
  pró‑rata) que você pode **aplicar em um clique**.

---

## 11. Imóveis

Gestão de alojamentos, escritórios e galpões locados.

### 11.1 Cadastro do imóvel
- Tipo, apelido, endereço, cidade/UF, capacidade, obra vinculada, proprietário/imobiliária.
- **Dados bancários** (banco, agência, conta, titular, chave PIX) para pagamento — exibidos
  **mascarados** por segurança.

### 11.2 Contrato do imóvel
- Valores: **aluguel + condomínio + IPTU + seguro fiança** (o seguro pode ou não somar à
  parcela mensal, via flag). Dia de vencimento, índice/data de reajuste, **caução**.
- **Um contrato vigente por vez**; contratos anteriores ficam no histórico.

### 11.3 Ciclo de vida do contrato (aba de ações)
- **Reajuste:** informe o percentual; o aluguel é atualizado, a próxima data de reajuste
  avança ~12 meses e fica registrado no histórico.
- **Aditivo:** altere valor e/ou prazo (com motivo), preservando o histórico.
- **Encerramento/distrato:** informe data e motivo; o contrato encerra a vigência e **sai
  da projeção** do fluxo de caixa.
- **Histórico versionado:** linha do tempo de reajustes, aditivos e encerramentos.

### 11.4 Contas de consumo
- Água, luz, gás, internet, IPTU etc., mês a mês, com opção de **lançar no financeiro**.

### 11.5 Vistorias, reparos e ocorrências
- Vistorias do imóvel com fotos; reparos e ocorrências com anexos.

### 11.6 Ocupantes e documentos em PDF
- Cadastre ocupantes (CPF **mascarado**).
- **Gerar contrato do imóvel** e **termo de responsabilidade** em PDF (templates editáveis;
  o termo cita a Política de Alojamento e a entrega de chaves).

### 11.7 Biblioteca de documentos
- Repositório de **normativos, formulários, placas e comunicação** do alojamento:
  categorizado, com upload por administradores e download para toda a equipe. É possível
  **editar** nome, descrição e categoria de cada documento.

---

## 12. Relatórios

Suíte com filtros (obra, fornecedor, status, período), **subtotais e total geral**, e
exportação em **PDF** (com a logo da Sistenge) e **Excel**.

**Relatórios disponíveis:**

- Itens em aberto
- Contas a pagar
- Custo por obra
- Custo por fornecedor
- Ociosidade
- Avarias
- Imóveis — custo mensal (subtotal por obra)
- Imóveis — contratos a vencer
- Imóveis — sem contrato
- Imóveis — consumo
- Imóveis — reparos
- Imóveis — caução

> Os relatórios respeitam o **acesso por obra** do usuário.

---

## 13. Configurações

Organizada em duas seções.

### 13.1 Organização
- **Dados da empresa:** cadastro completo (CNPJ, endereço, contatos, representante),
  usado nos contratos em PDF.
- **Templates de documentos:** texto de contratos e termos com **variáveis** (ex.:
  `{{aluguel}}`) preenchidas ao gerar o PDF — contrato de imóvel, contrato de equipamento
  e termo de responsabilidade.
- **Usuários:** criar/editar, definir **papel**, **acesso por obra** e **módulos**;
  redefinir senha (que volta a ser temporária).
- **Auditoria:** histórico geral de criações, alterações e exclusões (Master).

### 13.2 Automações de e-mail
- **Alertas de vencimento:** um robô diário verifica devoluções previstas, fins de
  contrato, reajustes e pagamentos a vencer e envia um **resumo por e-mail** aos
  destinatários, com prazos configuráveis (ex.: 30/15/3 dias). O e-mail traz **Tipo,
  Descrição, Obra, Custo mensal e Data**.
- **Relatório por e-mail:** envio automático de um relatório (com PDF anexo), semanal ou
  mensal, para os destinatários escolhidos.

---

## 14. Recursos gerais de tela

- **Busca, ordenação e paginação** em todas as listas principais (20 itens por página),
  preservando filtros na URL.
- **Novidades:** histórico de versões e melhorias, acessível pelo menu; a versão aparece
  no rodapé.
- **Meu perfil:** dados pessoais do usuário.
- **Tema claro/escuro** conforme o dispositivo.

---

## 15. Boas práticas por papel

**Operador**
- Sempre criar o **relatório fotográfico de retirada** com fotos de todos os itens.
- Registrar **devoluções parciais** na hora e fotografar cada devolução.
- Abrir **avaria** com custo estimado quando houver dano — é a prova contra cobrança indevida.

**Administrador/Master**
- Gerar **contas recorrentes** no início do período e dar **baixa com comprovante**.
- Manter **Dados da empresa** e **Templates** atualizados (saem nos contratos).
- Revisar **alertas de vencimento** e destinatários; acompanhar a **auditoria**.
- Cadastrar usuários com **acesso por obra** e **módulos** corretos.

**Gestor**
- Usar **relatórios** e o **painel** (com filtro por obra) para decidir **renovar × devolver**.

---

## 16. Glossário

- **Cadência:** periodicidade de cobrança do contrato (diária/semanal/quinzenal/mensal).
- **Competência:** mês de referência de um lançamento.
- **Caução:** garantia paga ao locador (em aberto/devolvida/retida).
- **Pró‑rata:** cobrança proporcional aos dias.
- **Idempotente:** rodar de novo não duplica o que já existe.
- **PWA:** aplicativo web instalável, com uso offline básico.
- **RLS / acesso por obra:** regra que limita cada usuário aos dados das obras a que tem acesso.

---

## 17. Perguntas frequentes (FAQ)

**Não vejo imóveis/contratos de outras obras. É erro?**
Não. Seu usuário tem **acesso por obra**; você vê apenas o que foi liberado.

**Gerei contas recorrentes duas vezes. Vai duplicar?**
Não. A geração é **idempotente** — meses já criados são ignorados.

**A avaria virou cobrança mas quero desfazer.**
Reabra/ajuste o lançamento no Financeiro; a avaria fica vinculada ao lançamento gerado.

**O e-mail de avisos não chegou.**
Verifique em Configurações se os **alertas estão ativos** e os **destinatários** corretos;
os avisos só são enviados uma vez por marco de prazo.

**Esqueci a senha.**
Use "recuperar senha" no login, ou peça ao Master para redefinir (você criará uma nova no
próximo acesso).

---

*Manual de treinamento do Loca — Sistenge. Material complementar ao treinamento interativo.*
