// Histórico de versões do Loca (fonte única, client-safe).
// Ao concluir qualquer alteração: bump APP_VERSION, adicione um Release no topo
// de CHANGELOG e replique um resumo em CHANGELOG.md + package.json (ver AGENTS.md).

export type TipoMudanca = "novo" | "melhoria" | "correcao" | "seguranca";

export type Mudanca = { tipo: TipoMudanca; texto: string };

export type Release = {
  versao: string; // SemVer, ex.: "0.6.0"
  data: string; // ISO 'yyyy-mm-dd'
  titulo: string;
  mudancas: Mudanca[];
};

/** Versão atual do sistema (mantenha em sincronia com package.json). */
export const APP_VERSION = "0.23.0";

export const TIPO_MUDANCA_INFO: Record<
  TipoMudanca,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  novo: { label: "Novo", variant: "default" },
  melhoria: { label: "Melhoria", variant: "secondary" },
  correcao: { label: "Correção", variant: "outline" },
  seguranca: { label: "Segurança", variant: "destructive" },
};

/** Releases, do mais recente para o mais antigo. */
export const CHANGELOG: Release[] = [
  {
    versao: "0.23.0",
    data: "2026-08-07",
    titulo: "Telas de detalhe mais rápidas e correção na cobrança por período",
    mudancas: [
      { tipo: "correcao", texto: "Entre 21h e a meia-noite, o custo estimado do contrato cobrava um período inteiro a mais, e a coluna \"Custo até hoje\" dos relatórios saía com um dia extra de locação. A causa era a mesma da versão anterior — o sistema já considerava o dia seguinte —, mas em outro ponto do cálculo. O dia passa a ser sempre o de Brasília também aqui." },
      { tipo: "correcao", texto: "No último dia do mês, depois das 21h, a projeção do fluxo de caixa começava do mês seguinte e deixava o mês corrente de fora." },
      { tipo: "correcao", texto: "No dia 31 de dezembro, depois das 21h, um contrato novo era numerado com o ano seguinte." },
      { tipo: "melhoria", texto: "As telas de imóvel, contrato e vistoria abrem muito mais rápido. Antes elas esperavam TODAS as informações — contratos, contas, reparos, fotos, anexos — antes de mostrar qualquer coisa. Agora o cabeçalho e o resumo aparecem de imediato e cada bloco vai chegando à medida que fica pronto." },
      { tipo: "correcao", texto: "Na tela do contrato, o histórico de auditoria aparecia logo abaixo do título, antes do resumo do contrato. Voltou para o fim da página." },
      { tipo: "seguranca", texto: "Nas listas de reparos e ocorrências do imóvel, quem tem acesso somente de leitura via os botões de anexar e de excluir. Eles não funcionavam, mas não deviam estar visíveis — as demais listas da mesma tela já os escondiam." },
      { tipo: "melhoria", texto: "O formulário de reparo do imóvel passou a validar os campos na hora, e o valor não aceita mais texto inválido: antes qualquer coisa que não fosse número era gravada como R$ 0,00, sem avisar." },
      { tipo: "correcao", texto: "Os avisos em amarelo (relatório sem assinatura, CNPJ já cadastrado) estavam com o texto claro demais sobre o fundo e ficavam difíceis de ler." },
    ],
  },
  {
    versao: "0.22.0",
    data: "2026-08-06",
    titulo: "Filtros ao vivo e correção no cálculo de datas",
    mudancas: [
      { tipo: "correcao", texto: "Entre 21h e a meia-noite o sistema considerava o dia seguinte. Isso fazia contas com vencimento para hoje aparecerem como vencidas, cobrava um dia a mais no cálculo de multa e juros da baixa, e imprimia os contratos, termos e laudos com a data de amanhã. O dia passa a ser sempre o de Brasília." },
      { tipo: "melhoria", texto: "A busca das listagens aplica sozinha enquanto você digita, com um botão para limpar — antes era preciso apertar Enter. Quem preferir, Enter continua funcionando." },
      { tipo: "melhoria", texto: "Os filtros ficaram iguais em todas as listas e aplicam na hora, sem botão \"Filtrar\". Um botão \"Limpar\" aparece quando há algum filtro ativo." },
      { tipo: "correcao", texto: "Filtrar por obra deixava de considerar a busca que você já tinha digitado. Agora os filtros se somam." },
      { tipo: "correcao", texto: "Mudar um filtro estando na página 3 mantinha o pedido pela página 3 de um resultado que passou a ter uma só, e a lista aparecia vazia. Agora volta para a primeira página." },
      { tipo: "melhoria", texto: "As telas de imóvel, contrato e vistoria abrem mais rápido: os anexos passaram a ser liberados de uma vez, em vez de um por um." },
      { tipo: "melhoria", texto: "Todas as telas abrem mais rápido: os dados do seu usuário e a lista de obras eram consultados várias vezes para montar uma única página, e agora são consultados uma vez só." },
      { tipo: "melhoria", texto: "As telas sem nenhum registro agora explicam para que serve aquele cadastro, em vez de só dizer que está vazio." },
      { tipo: "melhoria", texto: "Os indicadores de Financeiro e Imóveis ganharam ícone e cor conforme a situação — vencido em vermelho, pago em verde." },
    ],
  },
  {
    versao: "0.21.0",
    data: "2026-08-06",
    titulo: "Nova navegação",
    mudancas: [
      { tipo: "novo", texto: "O menu lateral agora fica recolhido, só com os ícones, e se abre quando você passa o mouse — sobra bem mais espaço para as tabelas e os relatórios." },
      { tipo: "novo", texto: "Busca rápida: aperte Ctrl+K (ou ⌘+K no Mac) em qualquer tela para pular direto para um módulo ou começar um cadastro, navegando pelas setas do teclado." },
      { tipo: "novo", texto: "Uma trilha no topo mostra onde você está — por exemplo “Início › Contratos › Novo” — e leva de volta com um clique." },
      { tipo: "novo", texto: "No celular e no tablet o menu virou uma gaveta que abre pelo botão de três linhas, em vez da faixa de ícones que rolava para o lado no pé da tela." },
      { tipo: "melhoria", texto: "Seu nome, perfil, “Meu perfil” e “Sair” ficam reunidos no menu do avatar, no canto superior direito." },
      { tipo: "melhoria", texto: "O topo da tela acompanha a rolagem, então a busca e o menu do usuário estão sempre à mão." },
      { tipo: "melhoria", texto: "As telas de entrar, recuperar senha e definir nova senha ganharam uma apresentação em duas colunas." },
      { tipo: "melhoria", texto: "Ao abrir uma listagem ou um imóvel, contrato ou vistoria, aparece um esboço da própria tela em vez de um indicador genérico — a página deixa de “saltar” quando os dados chegam." },
      { tipo: "novo", texto: "Endereço inexistente passa a mostrar uma tela própria, dentro do sistema, com atalho de volta ao Início." },
      { tipo: "melhoria", texto: "A tela de erro mostra um código do ocorrido, que você pode informar ao pedir suporte." },
      { tipo: "melhoria", texto: "A tela de “sem conexão” acompanha o tema claro ou escuro do seu aparelho." },
    ],
  },
  {
    versao: "0.20.0",
    data: "2026-08-06",
    titulo: "Nova identidade visual",
    mudancas: [
      { tipo: "novo", texto: "O Loca passa a ter a mesma cara do Sistenge People: fundo claro, cartões brancos com sombra leve, cantos arredondados e o vermelho da Sistenge reservado ao logotipo e às marcações de urgência." },
      { tipo: "novo", texto: "Modo escuro. O botão de sol/lua no topo da tela alterna entre claro e escuro, e por padrão o sistema segue a preferência do seu computador ou celular." },
      { tipo: "melhoria", texto: "Textos e números em tipografia nova (Inter), com os valores em dinheiro alinhados em coluna para facilitar a comparação entre linhas." },
      { tipo: "melhoria", texto: "Campos, botões e listas de seleção ficaram maiores e do mesmo tamanho em todas as telas — antes uma lista de seleção podia aparecer menor que o campo ao lado." },
      { tipo: "melhoria", texto: "Tabelas com mais respiro entre as linhas, ficando mais fáceis de ler em telas grandes." },
      { tipo: "melhoria", texto: "Excluir um registro abre uma janela de confirmação dentro do sistema, e o motivo aparece ali mesmo quando a exclusão é recusada — antes era o aviso cinza do navegador e o motivo surgia num canto da tela." },
      { tipo: "melhoria", texto: "A tela de erro passa a mostrar um código do ocorrido, que você pode informar ao pedir suporte." },
      { tipo: "melhoria", texto: "Contratos, termos e e-mails do sistema seguem a mesma paleta das telas." },
      { tipo: "seguranca", texto: "O sistema passa a enviar cabeçalhos de segurança que impedem que suas telas sejam embutidas em outros sites e restringem de onde o navegador pode carregar conteúdo." },
    ],
  },
  {
    versao: "0.19.4",
    data: "2026-07-29",
    titulo: "Exclusão de registros voltou a funcionar",
    mudancas: [
      { tipo: "correcao", texto: "Excluir imóvel, obra, contrato ou lançamento não tinha efeito: a tela recarregava e o registro continuava na lista. Agora a exclusão é concluída." },
      { tipo: "melhoria", texto: "Se uma exclusão for recusada (por permissão, por exemplo), o motivo aparece na tela em vez de falhar em silêncio." },
      { tipo: "melhoria", texto: "Excluir contrato passa a pedir confirmação, como nas demais telas." },
      { tipo: "seguranca", texto: "A rotina de exclusão do banco deixa de ficar acessível a quem não está autenticado." },
    ],
  },
  {
    versao: "0.19.3",
    data: "2026-07-27",
    titulo: "Tela de Configurações reorganizada",
    mudancas: [
      { tipo: "melhoria", texto: "Configurações agrupadas em “Organização” (atalhos) e “Automações de e-mail”, com layout mais limpo." },
    ],
  },
  {
    versao: "0.19.2",
    data: "2026-07-27",
    titulo: "Correção do gráfico do painel",
    mudancas: [
      { tipo: "correcao", texto: "As barras do gráfico de desembolso do painel voltaram a aparecer (não estavam sendo desenhadas)." },
    ],
  },
  {
    versao: "0.19.1",
    data: "2026-07-27",
    titulo: "E-mail de avisos com obra e custo mensal",
    mudancas: [
      { tipo: "melhoria", texto: "O e-mail de avisos de vencimento agora mostra a obra e o custo mensal de cada item." },
    ],
  },
  {
    versao: "0.19.0",
    data: "2026-07-27",
    titulo: "Numeração automática de contrato",
    mudancas: [
      { tipo: "melhoria", texto: "Novo contrato já vem com um número sugerido (CT-ano-sequência), que você pode ajustar." },
    ],
  },
  {
    versao: "0.18.0",
    data: "2026-07-27",
    titulo: "App instalável com uso offline básico",
    mudancas: [
      { tipo: "novo", texto: "Uso offline básico: ao perder a conexão, o app mostra uma tela amigável em vez de erro." },
      { tipo: "melhoria", texto: "Ícones do aplicativo em alta resolução (192/512) para instalar na tela inicial do celular." },
    ],
  },
  {
    versao: "0.17.0",
    data: "2026-07-27",
    titulo: "Histórico por entidade e logs estruturados",
    mudancas: [
      { tipo: "novo", texto: "Linha do tempo de auditoria na tela do contrato e do imóvel (quem criou/alterou/excluiu), visível ao Master." },
      { tipo: "melhoria", texto: "Logs do servidor em formato estruturado (JSON), facilitando diagnóstico e monitoramento." },
    ],
  },
  {
    versao: "0.16.0",
    data: "2026-07-27",
    titulo: "Cobrança de avaria e aviso de CNPJ duplicado",
    mudancas: [
      { tipo: "novo", texto: "Gerar cobrança (conta a pagar) direto de uma avaria, que passa a “cobrada” e fica vinculada ao lançamento." },
      { tipo: "melhoria", texto: "Aviso ao cadastrar fornecedor com CNPJ já existente, com opção de salvar mesmo assim." },
    ],
  },
  {
    versao: "0.15.0",
    data: "2026-07-27",
    titulo: "Contrato de equipamento em PDF e ajustes de documentos",
    mudancas: [
      { tipo: "novo", texto: "Geração do contrato de locação de equipamento em PDF, com template editável (variáveis) e itens do contrato." },
      { tipo: "melhoria", texto: "Termo de responsabilidade passa a citar a Política de Alojamento e a entrega de chaves." },
    ],
  },
  {
    versao: "0.14.0",
    data: "2026-07-27",
    titulo: "Segurança: senha no primeiro acesso e dados sensíveis ocultos",
    mudancas: [
      { tipo: "seguranca", texto: "Troca de senha obrigatória no primeiro acesso (e após redefinição pelo administrador)." },
      { tipo: "seguranca", texto: "Dados sensíveis (CPF, conta e chave PIX) aparecem mascarados, com opção de revelar sob demanda." },
    ],
  },
  {
    versao: "0.13.0",
    data: "2026-07-27",
    titulo: "Painel com gráfico e filtro por obra",
    mudancas: [
      { tipo: "novo", texto: "Filtro por obra no painel inicial: todos os números e o gráfico respeitam a obra escolhida." },
      { tipo: "novo", texto: "Gráfico de desembolso previsto (12 meses) com pago, pendente e projeção dos contratos." },
      { tipo: "novo", texto: "Indicadores de imóveis no painel: quantidade e custo mensal dos contratos vigentes." },
    ],
  },
  {
    versao: "0.12.0",
    data: "2026-07-26",
    titulo: "Busca, ordenação e paginação nas listas",
    mudancas: [
      { tipo: "melhoria", texto: "Busca por texto nas listas de obras, itens, contratos, fornecedores, imóveis e financeiro." },
      { tipo: "melhoria", texto: "Ordenação por coluna (clique no título) e paginação em todas as listas principais." },
      { tipo: "melhoria", texto: "Desempenho: as listas passam a carregar por página, sem trazer tudo de uma vez." },
    ],
  },
  {
    versao: "0.11.0",
    data: "2026-07-26",
    titulo: "Ciclo de vida do contrato de imóvel",
    mudancas: [
      { tipo: "novo", texto: "Reajuste do aluguel por percentual, com efeito no valor e registro no histórico." },
      { tipo: "novo", texto: "Aditivo de contrato: altera valor e/ou prazo preservando o histórico de mudanças." },
      { tipo: "novo", texto: "Encerramento/distrato do contrato com data e motivo (encerra a vigência e sai da projeção do fluxo)." },
      { tipo: "novo", texto: "Histórico versionado do contrato (timeline de aditivos, reajustes e encerramentos)." },
    ],
  },
  {
    versao: "0.10.0",
    data: "2026-07-26",
    titulo: "Financeiro: contas recorrentes e baixa com conciliação",
    mudancas: [
      { tipo: "novo", texto: "Gerar contas a pagar recorrentes dos contratos de imóvel e de locação (uma parcela por mês), sem duplicar meses já gerados." },
      { tipo: "novo", texto: "Baixa de conta com conciliação: valor efetivamente pago, data, número da NF e anexo do comprovante." },
      { tipo: "novo", texto: "Cálculo automático de multa e juros por atraso, com sugestão aplicável na baixa." },
    ],
  },
  {
    versao: "0.9.1",
    data: "2026-07-26",
    titulo: "Editar documentos da biblioteca",
    mudancas: [
      { tipo: "melhoria", texto: "Agora dá para editar o nome, a descrição e a categoria dos documentos da biblioteca do alojamento." },
    ],
  },
  {
    versao: "0.9.0",
    data: "2026-07-26",
    titulo: "Biblioteca de documentos do alojamento",
    mudancas: [
      { tipo: "novo", texto: "Biblioteca de documentos em Imóveis: normativos, formulários e placas padronizadas para consultar, baixar e imprimir." },
      { tipo: "novo", texto: "Categorias de documentos (normativos, formulários, placas, comunicação) com upload por administradores e download para toda a equipe." },
    ],
  },
  {
    versao: "0.8.0",
    data: "2026-07-26",
    titulo: "Acesso por obra nos imóveis e melhorias no contrato",
    mudancas: [
      { tipo: "seguranca", texto: "Imóveis e relatórios agora respeitam o acesso por obra: cada usuário vê apenas os dados das obras a que tem acesso." },
      { tipo: "novo", texto: "Identificação do equipamento (nº de série/registro/tag) nos itens do contrato." },
      { tipo: "novo", texto: "Aditivos e renovações: é possível anexar novos documentos ao contrato ao longo do tempo, além do original." },
      { tipo: "melhoria", texto: "Nova disposição da tela do contrato: adicionar item e itens primeiro, depois o relatório de retirada e os documentos do contrato." },
    ],
  },
  {
    versao: "0.7.0",
    data: "2026-07-26",
    titulo: "Versionamento e novidades",
    mudancas: [
      { tipo: "novo", texto: "Página “Novidades” com o histórico de versões e melhorias do sistema, acessível pelo menu." },
      { tipo: "novo", texto: "Número da versão visível no rodapé do menu." },
      { tipo: "melhoria", texto: "Processo de versionamento (SemVer) documentado para todas as alterações futuras." },
    ],
  },
  {
    versao: "0.6.0",
    data: "2026-07-26",
    titulo: "Segurança, auditoria e integridade",
    mudancas: [
      { tipo: "seguranca", texto: "Correção crítica: impedida a autopromoção de usuário a “master”." },
      { tipo: "novo", texto: "Trilha de auditoria: registro de quem criou, alterou ou excluiu registros, com tela em Configurações." },
      { tipo: "melhoria", texto: "Exclusões passam a ser reversíveis (soft-delete) em obras, contratos, lançamentos e imóveis." },
      { tipo: "correcao", texto: "Custo de devolução parcial corrigido (não cobra mais a quantidade cheia) — na tela do contrato e no fluxo de caixa." },
      { tipo: "melhoria", texto: "Alertas por e-mail mais robustos: uma falha não interrompe as demais e as datas seguem o fuso de São Paulo." },
      { tipo: "melhoria", texto: "Integridade de dados: número de contrato único por organização e índices de desempenho." },
      { tipo: "melhoria", texto: "Acessibilidade nos filtros de relatórios e indicador de carregamento entre telas." },
    ],
  },
  {
    versao: "0.5.0",
    data: "2026-07-26",
    titulo: "Evolução dos imóveis e da plataforma",
    mudancas: [
      { tipo: "novo", texto: "Cadastro completo da empresa (CNPJ, endereço, representante) usado nos contratos." },
      { tipo: "novo", texto: "Templates de documentos editáveis com variáveis (contrato de imóvel e termo)." },
      { tipo: "novo", texto: "Acesso modular por usuário: cada pessoa vê apenas os módulos liberados." },
      { tipo: "novo", texto: "Fornecedores vinculados a obras, com busca e filtro na lista." },
      { tipo: "novo", texto: "IPTU e seguro fiança no contrato do imóvel, somando ao custo mensal." },
      { tipo: "novo", texto: "Dados bancários do imóvel para pagamento e assinatura no contrato." },
      { tipo: "melhoria", texto: "Imóveis entram no fluxo de caixa (projeção da parcela mensal)." },
      { tipo: "melhoria", texto: "Edição de contratos de imóvel já cadastrados." },
      { tipo: "melhoria", texto: "Relatório de custo de imóveis com subtotal por obra; logo da Sistenge nos PDFs." },
    ],
  },
  {
    versao: "0.4.0",
    data: "2026-07-25",
    titulo: "Módulo de Imóveis",
    mudancas: [
      { tipo: "novo", texto: "Cadastro de imóveis com histórico de contratos, caução, contatos e anexos." },
      { tipo: "novo", texto: "Contas de consumo (água, luz, gás...) mês a mês, com lançamento no financeiro." },
      { tipo: "novo", texto: "Vistorias com fotos, reparos e ocorrências do imóvel." },
      { tipo: "novo", texto: "Ocupantes e emissão de contrato e termo de responsabilidade em PDF." },
      { tipo: "novo", texto: "Alertas de fim de contrato, reajuste e imóvel sem contrato." },
      { tipo: "novo", texto: "Relatórios exclusivos de imóveis (custo, a vencer, consumo, reparos, caução)." },
    ],
  },
  {
    versao: "0.3.0",
    data: "2026-07-24",
    titulo: "Relatórios v2",
    mudancas: [
      { tipo: "novo", texto: "Novos relatórios: ociosidade, custo por fornecedor e avarias." },
      { tipo: "novo", texto: "Filtros por fornecedor, status e período; subtotais e total geral." },
      { tipo: "novo", texto: "Gráficos de barras na tela e no PDF dos relatórios agregados." },
      { tipo: "novo", texto: "Envio automático de relatório por e-mail (semanal ou mensal)." },
      { tipo: "correcao", texto: "Correção do menu do usuário que quebrava ao abrir." },
    ],
  },
  {
    versao: "0.2.0",
    data: "2026-07-24",
    titulo: "Financeiro, usuários e identidade visual",
    mudancas: [
      { tipo: "novo", texto: "Fluxo de caixa com lançamentos e projeção dos contratos." },
      { tipo: "novo", texto: "Gestão de usuários, meu perfil e filtro por obra." },
      { tipo: "novo", texto: "E-mails de acesso (novo usuário e redefinição de senha)." },
      { tipo: "novo", texto: "Login com a logo da Sistenge e recuperação de senha." },
      { tipo: "novo", texto: "Múltiplos prazos de aviso por e-mail (ex.: 30/15/3 dias)." },
      { tipo: "melhoria", texto: "Identidade visual da Sistenge (vermelho da marca) e data/hora nas assinaturas de vistoria." },
    ],
  },
  {
    versao: "0.1.0",
    data: "2026-07-23",
    titulo: "Lançamento (MVP)",
    mudancas: [
      { tipo: "novo", texto: "Controle de locações por obra: obras, fornecedores, itens e contratos." },
      { tipo: "novo", texto: "Movimentação com devolução parcial e saldo por item." },
      { tipo: "novo", texto: "Vistorias com fotos e registro de avarias." },
      { tipo: "novo", texto: "Financeiro (contas a pagar) e alertas de vencimento por e-mail." },
      { tipo: "novo", texto: "Relatórios em PDF e Excel; aplicativo instalável (PWA)." },
    ],
  },
];
