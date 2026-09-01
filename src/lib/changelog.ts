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
export const APP_VERSION = "0.42.0";

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
    versao: "0.42.0",
    data: "2026-09-01",
    titulo: "Orçamento de locação, e o estouro previsto antes de acontecer",
    mudancas: [
      { tipo: "novo", texto: "A obra passa a ter orçamento de locação, com detalhamento opcional por item. Revisar o orçamento cria uma nova versão — a anterior fica guardada, para o desvio poder ser explicado depois." },
      { tipo: "novo", texto: "O detalhe da obra mostra os três números juntos pela primeira vez: prazo decorrido, avanço físico e orçamento consumido." },
      { tipo: "novo", texto: "Projeção de estouro: se a obra consumiu 62% do orçamento tendo entregado 31%, o sistema avisa que ela terminaria no dobro do orçado — e diz quanto isso é em reais." },
      { tipo: "novo", texto: "Um veredito em uma frase: consumindo mais rápido que entrega, entregando mais que consome, ou consumo alinhado ao avanço." },
      { tipo: "melhoria", texto: "Quando há lançamentos na obra sem contrato vinculado, a tela informa o valor. Sem isso o consumo apareceria como 0% e pareceria que nada foi gasto." },
    ],
  },
  {
    versao: "0.41.0",
    data: "2026-09-01",
    titulo: "Avanço da obra, semana a semana",
    mudancas: [
      { tipo: "novo", texto: "A obra passa a ter início, fim previsto e fim real. Com isso o sistema calcula sozinho quanto do prazo já correu." },
      { tipo: "novo", texto: "Tela de Avanço: uma linha por obra, todas na mesma página, para lançar o percentual da semana de uma vez só. Lançar de novo na mesma semana corrige o número, não duplica." },
      { tipo: "novo", texto: "Enquanto você digita, a tela já mostra quantos pontos a obra está atrasada — prazo decorrido contra avanço informado." },
      { tipo: "novo", texto: "O detalhe da obra ganhou o bloco de avanço: percentual atual, prazo, desvio em pontos, previsão de término pelo ritmo das últimas semanas e as últimas 8 semanas lançadas." },
      { tipo: "novo", texto: "E-mail de segunda-feira para os responsáveis de cada obra, com prazo contra avanço, previsão de término e quantidade de itens locados em aberto." },
      { tipo: "novo", texto: "Quem lança o avanço recebe, no mesmo dia, a lista das obras que ficaram sem informação — para nenhuma semana passar em branco sem ninguém notar." },
    ],
  },
  {
    versao: "0.40.0",
    data: "2026-08-31",
    titulo: "Correção do botão de recebimento",
    mudancas: [
      { tipo: "correcao", texto: "O botão \"Registrar recebimento\" não criava nada — clicava e não acontecia nada, sem mensagem de erro. Corrigido." },
      { tipo: "novo", texto: "O cadastro de item ganhou o campo \"Controle no recebimento\": por quantidade (andaime, escora) ou por peça com patrimônio (betoneira, gerador). Sem ele, a conferência por patrimônio era inalcançável pela tela." },
    ],
  },
  {
    versao: "0.39.1",
    data: "2026-08-31",
    titulo: "O botão Salvar dos cadastros novos voltou a salvar",
    mudancas: [
      { tipo: "correcao", texto: "Cadastrar um item novo não gravava nada: o botão Salvar não dava erro, não dava aviso e não fazia nada. Corrigido." },
      { tipo: "correcao", texto: "O mesmo defeito impedia CRIAR obra, imóvel, contrato de imóvel, contrato de locação, fornecedor e lançamento financeiro. Editar um registro que já existia sempre funcionou; era só o cadastro novo. Todos os sete estão corrigidos." },
      { tipo: "melhoria", texto: "Nenhum formulário do sistema fica mais em silêncio: se algo impede o envio, o motivo aparece escrito acima dos botões. Era o que faltava para este defeito ter sido visto no primeiro clique, em vez de virar um Salvar que não fazia nada." },
    ],
  },
  {
    versao: "0.39.0",
    data: "2026-08-24",
    titulo: "Recebimento de equipamento",
    mudancas: [
      { tipo: "novo", texto: "O contrato ganhou a seção Recebimentos: registre o que chegou do fornecedor, item a item, com quem conferiu e o número da nota deles." },
      { tipo: "novo", texto: "Equipamento de valor passa a ser conferido por patrimônio — o sistema sabe QUAL betoneira chegou, não só que chegou uma. Material de repetição continua por quantidade." },
      { tipo: "novo", texto: "Dá para registrar que chegou algo fora do contrato, ou com avaria, sem ter de forçar o lançamento para conseguir salvar." },
      { tipo: "melhoria", texto: "A data do recebimento é a da entrega, não a do lançamento: quem digita dias depois no escritório corrige a data na tela." },
    ],
  },
  {
    versao: "0.38.0",
    data: "2026-08-24",
    titulo: "Os e-mails do Loca com a identidade da Sistenge",
    mudancas: [
      { tipo: "novo", texto: "Todo e-mail do Loca passa a sair com o logotipo da Sistenge no cabeçalho e, no rodapé, a razão social e o CNPJ da empresa cadastrados em Configurações." },
      { tipo: "melhoria", texto: "Os avisos de vencimento tinham ficado de fora do desenho: chegavam sem cabeçalho e sem rodapé. Agora são iguais aos outros." },
      { tipo: "melhoria", texto: "Quem responder a um e-mail do Loca agora é atendido: as respostas passam a chegar em uma caixa de verdade, e não no endereço de automação." },
      { tipo: "correcao", texto: "No e-mail de relatório, as linhas de subtotal e de total voltaram a ter fundo destacado. Sem ele, era fácil somar de novo o que já estava somado." },
      { tipo: "correcao", texto: "Fornecedor com \"&\" no nome — \"Móveis & Equipamentos\" — não desmonta mais a tabela do e-mail." },
      { tipo: "melhoria", texto: "Os e-mails passam a levar também uma versão em texto simples, o que reduz a chance de cair na caixa de spam." },
      { tipo: "seguranca", texto: "Modo de teste de e-mail: enquanto ligado, todo e-mail do sistema é desviado para os endereços de teste e nenhum destinatário real recebe nada. Os avisos represados saem normalmente quando o modo é desligado." },
    ],
  },
  {
    versao: "0.37.0",
    data: "2026-08-24",
    titulo: "Todo registro tem número",
    mudancas: [
      { tipo: "novo", texto: "Contratos, devoluções, vistorias, avarias, reparos, medidas disciplinares, entregas, folhas de limpeza e ocorrências passaram a ter número próprio: CTR-2026-0007, AVA-2026-0009, VIS-2026-0022." },
      { tipo: "novo", texto: "Os registros que já existiam foram numerados, na ordem em que foram criados e no ano de criação. O livro começa do começo." },
      { tipo: "novo", texto: "O número reinicia a cada ano e nunca tem buraco — nem quando algo dá errado no meio de um cadastro." },
      { tipo: "melhoria", texto: "Na lista de contratos, o número do Loca aparece ao lado do número do fornecedor. A busca acha pelos dois, e basta digitar \"9\" para achar o 0009." },
    ],
  },
  {
    versao: "0.36.0",
    data: "2026-08-24",
    titulo: "Seis formulários que recusavam campo em branco",
    mudancas: [
      { tipo: "correcao", texto: "Salvar os dados da empresa sem razão social, sem CNPJ ou sem qualquer outro campo opcional dava \"Invalid input: expected string, received null\". Corrigido." },
      { tipo: "correcao", texto: "O mesmo erro impedia salvar fornecedor, contrato de equipamento, item locado sem devolução prevista, lançamento financeiro sem contrato e a redefinição de senha de um usuário." },
      { tipo: "correcao", texto: "Salvar o relatório automático por e-mail não funcionava, pelo mesmo motivo." },
      { tipo: "melhoria", texto: "Agora existe uma verificação que percorre TODOS os formulários do sistema e reprova a entrega se algum voltar a recusar campo em branco. O defeito tinha voltado três vezes." },
    ],
  },
  {
    versao: "0.35.0",
    data: "2026-08-24",
    titulo: "Cada obra recebe o aviso que é dela",
    mudancas: [
      { tipo: "novo", texto: "Os avisos de vencimento passaram a sair por obra: cada obra recebe só o que é dela. Quem está vinculado à obra recebe automaticamente." },
      { tipo: "novo", texto: "A obra ganhou um campo de e-mails extras, para avisar quem não tem login no Loca — mestre de obra, encarregado terceirizado, e-mail do almoxarifado." },
      { tipo: "novo", texto: "A lista de Configurações virou a central: recebe tudo, de todas as obras, agrupado por obra. Quem já estava lá continua recebendo, agora organizado." },
      { tipo: "novo", texto: "Obra sem ninguém para avisar não perde o aviso — ele vai para a central, marcado, para que a falta seja visível." },
      { tipo: "correcao", texto: "Salvar uma obra sem endereço, sem responsável ou sem centro de custo dava \"Dados inválidos\" sem dizer qual campo. Corrigido." },
      { tipo: "correcao", texto: "Se o registro do envio falhasse, o mesmo aviso era reenviado todo dia sem que nada acusasse. Agora a falha é registrada." },
    ],
  },
  {
    versao: "0.34.0",
    data: "2026-08-23",
    titulo: "Clicar no mês abre as despesas dele",
    mudancas: [
      { tipo: "novo", texto: "No gráfico da tela inicial, clicar num mês abre o Financeiro já filtrado pelos lançamentos que vencem naquele mês. Se houver obra selecionada, ela vai junto." },
      { tipo: "novo", texto: "O Financeiro ganhou filtro por mês de vencimento. Vale para qualquer mês, não só os do gráfico — dá para procurar aquela conta do ano passado." },
      { tipo: "novo", texto: "No fluxo de caixa, o nome do mês na tabela também leva aos lançamentos dele." },
      { tipo: "melhoria", texto: "Ao filtrar por mês, o Financeiro avisa que a projeção dos contratos não entra na lista — ela é estimativa, não conta a pagar. Sem isso o total da barra pareceria não bater com a soma da tela." },
    ],
  },
  {
    versao: "0.33.0",
    data: "2026-08-23",
    titulo: "Limpeza fechada e o documento assinado de volta",
    mudancas: [
      { tipo: "novo", texto: "A semana de limpeza agora se fecha: o Encarregado registra quem limpou, como avaliou a semana e o que observou na conferência. Antes toda semana ficava marcada como \"Sem avaliação\" para sempre." },
      { tipo: "novo", texto: "As 44 tarefas da folha de limpeza ficaram editáveis em Configurações → Catálogo de limpeza. Dá para mudar o texto, o ambiente, a frequência e a ordem em que aparecem na folha." },
      { tipo: "novo", texto: "Uma tarefa pode sair da folha impressa sem ser apagada: alojamento sem lavanderia não precisa da tarefa do tanque, e ocultá-la preserva o histórico das semanas que já a marcaram." },
      { tipo: "novo", texto: "O documento assinado volta para o sistema: depois de imprimir, colher a assinatura e digitalizar, o PDF pode ser anexado à medida disciplinar, à entrega ao alojado e à folha da semana." },
      { tipo: "melhoria", texto: "O nome do ambiente aceita até 80 caracteres. Com o limite anterior, seis tarefas criadas pelo próprio sistema não podiam ser reeditadas pela tela." },
    ],
  },
  {
    versao: "0.32.0",
    data: "2026-08-23",
    titulo: "Nova tela de entrada",
    mudancas: [
      { tipo: "melhoria", texto: "As telas de entrada, recuperação e troca de senha passaram a ter o logo da Sistenge sobre fundo claro, com os campos centralizados — o mesmo padrão do SST Manager." },
      { tipo: "melhoria", texto: "A versão do sistema aparece no rodapé da tela de entrada." },
    ],
  },
  {
    versao: "0.31.1",
    data: "2026-08-23",
    titulo: "Imóveis encerrados fora da lista",
    mudancas: [
      { tipo: "melhoria", texto: "A lista de imóveis não mostra mais os encerrados por padrão. Eles continuam acessíveis: basta escolher \"Encerrado\" no filtro de Status. O contador e o custo mensal passam a refletir só o que está em uso." },
    ],
  },
  {
    versao: "0.31.0",
    data: "2026-08-23",
    titulo: "Versão e data nos documentos, e tabelas no padrão do RH",
    mudancas: [
      { tipo: "novo", texto: "Todo documento agora traz a versão do texto e a data de publicação no cabeçalho de cada página — \"Versão 1.2 · 22/08/2026\". É o que identifica qual texto o empregado assinou." },
      { tipo: "novo", texto: "A versão é editável em Configurações → Templates de documentos, junto com o texto: ao revisar uma cláusula, aumente a versão. A data se atualiza sozinha ao salvar, sem depender de alguém lembrar." },
      { tipo: "melhoria", texto: "As tabelas dos documentos ganharam o formato dos originais do RH: cabeçalho com fundo cheio, linhas alternadas, grade completa e primeira coluna em negrito." },
      { tipo: "correcao", texto: "A matriz de responsabilidades da Política de Alojamento estava errada: saía como lista de papel e atribuições, quando a original é uma matriz de atividade por papel (R, A, C, I). Refeita, com o detalhamento por papel logo abaixo." },
    ],
  },
  {
    versao: "0.30.0",
    data: "2026-08-23",
    titulo: "Anexos na Política de Alojamento",
    mudancas: [
      { tipo: "correcao", texto: "Na Política de Alojamento, a matriz de responsabilidades e a tabela de infrações apareciam DUAS vezes: embaralhadas em texto corrido no meio dos itens 10 e 11.3, e corretas no fim do documento. O texto embaralhado saiu." },
      { tipo: "melhoria", texto: "As duas tabelas passaram a ser Anexo I e Anexo II, cada um em página própria, e os itens 10 e 11.3 agora as citam. Revisar uma penalidade deixa de exigir mexer na cláusula que a invoca." },
      { tipo: "melhoria", texto: "No Termo de Compromisso, a tabela de penalidades virou Anexo I, e o empregado assina declarando ciência de um anexo identificável." },
      { tipo: "correcao", texto: "Cadastrar ocupante sem preencher CPF, e registrar reparo sem preencher Executor, falhavam com erro genérico. Qualquer campo opcional deixado em branco causava isso." },
      { tipo: "correcao", texto: "Na lista de fornecedores, o nome e os botões de ação nunca apareciam ao mesmo tempo: rolar até a lixeira empurrava o nome para fora da tela. As duas colunas agora ficam fixas." },
    ],
  },
  {
    versao: "0.29.1",
    data: "2026-08-23",
    titulo: "Entregas com PDF preenchido",
    mudancas: [
      { tipo: "novo", texto: "As entregas registradas passam a gerar o formulário já preenchido — FRM-RH-003 para chaves e FRM-RH-004 para o kit —, como já acontecia com a medida disciplinar. Antes o registro existia no sistema mas a folha saía em branco." },
      { tipo: "novo", texto: "Um aceite registrado por engano pode ser desfeito por quem gere cadastros." },
      { tipo: "correcao", texto: "No formulário do kit, a caixa do lençol nunca era marcada no documento preenchido: o nome do item era escrito de duas formas diferentes no sistema e no PDF." },
    ],
  },
  {
    versao: "0.29.0",
    data: "2026-08-22",
    titulo: "Aceite eletrônico do Termo de Compromisso",
    mudancas: [
      { tipo: "novo", texto: "Na lista de ocupantes é possível registrar o aceite eletrônico do Termo de Compromisso. O termo gerado passa a trazer a data, a hora e o IP do aceite no lugar da linha para assinar à mão." },
      { tipo: "melhoria", texto: "Um aceite já registrado não é sobrescrito: a data do primeiro aceite é a que vale como prova do momento original." },
      { tipo: "seguranca", texto: "O aceite eletrônico é complemento do termo em papel, não substituto: ele comprova que a confirmação partiu daquela sessão autenticada, naquele momento, e não a identidade de quem assinou. O termo assinado continua sendo o documento de referência até parecer do Jurídico." },
    ],
  },
  {
    versao: "0.28.0",
    data: "2026-08-22",
    titulo: "Rotina de limpeza do alojamento",
    mudancas: [
      { tipo: "novo", texto: "A tela do imóvel ganhou o controle da limpeza: abrir a semana, ver as semanas anteriores com a avaliação do Encarregado e baixar a folha já com o período preenchido." },
      { tipo: "novo", texto: "O catálogo de 44 tarefas de limpeza pode ser criado de uma vez, a partir do padrão do FRM-RH-005, e depois fica editável pela organização. A folha impressa passa a usar esse catálogo." },
      { tipo: "melhoria", texto: "A folha semanal traz só as tarefas diárias e semanais; as mensais saem numa folha separada. É o que faz a impressão semanal caber e deixa de gastar papel com o que só se faz uma vez por mês." },
    ],
  },
  {
    versao: "0.27.0",
    data: "2026-08-22",
    titulo: "Medidas disciplinares e entregas ao alojado",
    mudancas: [
      { tipo: "novo", texto: "A tela do imóvel ganhou o registro de medidas disciplinares (advertência e suspensão). O sistema recusa suspensão acima de 30 dias, que é o limite do art. 474 da CLT, e gera o FRM-RH-002 já preenchido para assinatura." },
      { tipo: "novo", texto: "Registro de entregas ao alojado — chaves e kit de alojamento — com data de entrega, data de devolução e tratativa. O que foi entregue e ainda não voltou aparece primeiro na lista." },
      { tipo: "seguranca", texto: "Medidas disciplinares são visíveis apenas para quem gere cadastros. Quem tem acesso à obra não passa a ter, por isso, acesso à advertência de um colega. Excluir uma medida é permitido só ao master, e a ação fica registrada na auditoria." },
      { tipo: "correcao", texto: "Nos documentos preenchidos pelo sistema, as caixas marcadas apareciam vazias: o X era maior que a caixa e ficava recortado." },
    ],
  },
  {
    versao: "0.26.0",
    data: "2026-08-22",
    titulo: "Política de Alojamento no sistema",
    mudancas: [
      { tipo: "novo", texto: "A Política de Alojamento (POL-RH-001) passa a ser gerada pelo próprio sistema, com as 16 seções, a matriz de responsabilidades e a tabela de infrações e penalidades. Fica em Imóveis → Documentos, junto dos formulários." },
      { tipo: "melhoria", texto: "A política caiu de 14 para 7 páginas impressas, sem cortar uma linha do conteúdo — só com o padrão tipográfico do sistema." },
      { tipo: "melhoria", texto: "O texto da política também pode ser revisado em Configurações → Templates de documentos, o que dispensa republicar o arquivo a cada ajuste do Jurídico." },
    ],
  },
  {
    versao: "0.25.0",
    data: "2026-08-22",
    titulo: "Formulários do alojamento prontos para imprimir",
    mudancas: [
      { tipo: "novo", texto: "Quatro formulários do alojamento passam a sair do próprio sistema, no padrão visual da Sistenge: medida disciplinar (FRM-RH-002), entrega e devolução de chaves com checklist de conservação (FRM-RH-003), recebimento e devolução do kit (FRM-RH-004) e o checklist semanal de limpeza (FRM-RH-005). Ficam em Imóveis → Documentos, prontos para baixar e preencher à mão." },
      { tipo: "novo", texto: "O checklist de limpeza tem duas folhas: a semanal, com as tarefas diárias e semanais, e uma folha mensal separada só com as tarefas de frequência mensal — assim a folha que vai para a obra toda semana não carrega o que só se faz uma vez por mês." },
      { tipo: "melhoria", texto: "O texto de qualquer um desses formulários pode ser editado em Configurações → Templates de documentos, sem depender de atualização do sistema." },
      { tipo: "correcao", texto: "As caixas de marcação dos formulários não estavam aparecendo no PDF — as opções saíam como texto solto e as colunas de vistoria, em branco. Agora são desenhadas e imprimem em qualquer leitor." },
    ],
  },
  {
    versao: "0.24.0",
    data: "2026-08-22",
    titulo: "Termo de Compromisso de Alojamento",
    mudancas: [
      { tipo: "novo", texto: "O termo gerado no ocupante do imóvel agora é o Termo de Compromisso de Alojamento (FRM-RH-001) por inteiro: as 22 regras de convivência, o consentimento informado de câmeras (CFTV), a cláusula do armário individual, a tabela de penalidades e o canal de denúncias. Antes saía uma versão curta, com quatro parágrafos genéricos." },
      { tipo: "novo", texto: "O cadastro do ocupante ganhou função, número do quarto e número do armário. Esses dados saem preenchidos no termo; os que o sistema não guarda (RG, data de admissão, encarregado e contato de emergência) saem como linha em branco, para preencher à mão." },
      { tipo: "melhoria", texto: "Os templates de documentos, em Configurações, aparecem agrupados por módulo — fica claro de onde cada documento é gerado." },
      { tipo: "melhoria", texto: "Contratos e termos passaram a sair com o logotipo da Sistenge no cabeçalho, no lugar do nome escrito por extenso." },
      { tipo: "melhoria", texto: "Ao cadastrar um ocupante, o sistema agora avisa se a data de saída for anterior à de entrada, em vez de aceitar em silêncio." },
      { tipo: "correcao", texto: "Os documentos de várias páginas passam a trazer o rodapé com a numeração (\"Página 2 de 3\") em todas as folhas — importante para comprovar que nenhuma página foi retirada." },
    ],
  },
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
      { tipo: "correcao", texto: "Em Financeiro e Imóveis, os indicadores do topo podiam discordar da tabela: as condições dos filtros eram aplicadas em dois lugares separados, e bastava um deles ficar de fora para os totais somarem um recorte diferente do que a lista mostrava." },
      { tipo: "correcao", texto: "Digitar um endereço que não existe levava a uma página em branco com texto em inglês. Agora aparece uma tela em português com um botão para voltar ao início." },
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
