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
export const APP_VERSION = "0.9.1";

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
