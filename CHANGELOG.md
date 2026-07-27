# Changelog

Todas as mudanças relevantes do **Loca** ficam aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento
segue [SemVer](https://semver.org/lang/pt-BR/).

> Fonte única para a tela **Novidades**: [`src/lib/changelog.ts`](src/lib/changelog.ts).
> Ao concluir uma alteração, atualize **os dois** (ver processo em `AGENTS.md`).

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
