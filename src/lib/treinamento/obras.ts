// Trilha da obra — o centro do sistema, e o painel que a diretoria lê.
//
// Duas coisas separam esta trilha das outras. A primeira é que a ficha da obra
// só abre para master e administrador, então boa parte do conteúdo é para quem
// administra; a aula da lista é a que serve a todo mundo, e vem primeiro por
// isso. A segunda é que aqui quase todo indicador pode aparecer VAZIO, e o
// vazio tem significado: é dado que falta, e a tela diz qual. Ensinar a ler o
// vazio é metade desta trilha.

import type { Trilha } from "./tipos";

export const OBRAS: Trilha = {
  chave: "obras",
  titulo: "Obras: cadastro, orçamento e indicadores",
  resumo:
    "Achar e cadastrar obra, ler o orçamento contra o realizado e entender por que um indicador aparece em branco.",
  modulo: "obras",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "obra-lista",
      titulo: "A lista de obras",
      resumo:
        "O que a lista mostra a todos os perfis, e por que a ficha da obra não abre para todo mundo.",
      rotas: ["/obras"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras",
          acao: "Abra Obras e busque por código, nome ou responsável.",
          esperado:
            "A lista filtra ao vivo. As colunas são código, nome, responsável e status — Ativa, Pausada ou Encerrada.",
        },
        {
          onde: "/obras",
          acao: "Ordene por status, clicando no título da coluna.",
          esperado:
            "As obras se agrupam por situação. É o jeito rápido de separar o que está em andamento do que já encerrou.",
        },
        {
          onde: "/obras",
          acao: "Repare na coluna de ações, na ponta da linha.",
          esperado:
            "O botão de editar aparece para master e administrador. Nos outros perfis a coluna fica vazia — a ficha da obra devolveria a pessoa para esta mesma lista, e um botão que não leva a lugar nenhum é pior que a ausência dele.",
        },
      ],
      atencao: [
        "Status Encerrada não apaga nada: a obra sai das listas de trabalho do dia a dia e continua inteira nos relatórios e no histórico.",
        "Nos perfis de gestor e operador, o que está numa obra se vê pelas telas que penduram nela — Frota filtrada por obra, Estoque filtrado por local, Avanço das obras.",
      ],
    },
    {
      id: "obra-cadastro",
      titulo: "Cadastrar a obra, e o campo que quase todos deixam em branco",
      resumo:
        "Código, nome e status são o mínimo. O período é o que faz metade dos indicadores existirem.",
      rotas: ["/obras/nova", "/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/nova",
          acao: "Preencha o código (OB-001) e o nome da obra.",
          esperado:
            "São os dois obrigatórios. O código é o que aparece em todo o resto do sistema — nos filtros, nos documentos, nos relatórios.",
        },
        {
          onde: "/obras/nova",
          acao: "Preencha Início da obra e Fim previsto.",
          esperado:
            "Salva. São opcionais no formulário, mas sem eles o sistema não tem como calcular prazo decorrido, desvio de avanço nem previsão de término — três indicadores ficam em branco de uma vez.",
        },
        {
          onde: "/obras/[id]",
          acao: "No encerramento, preencha o Fim real e mude o status para Encerrada.",
          esperado:
            "O fim real é a data que aconteceu, não a que estava prevista. É a diferença entre as duas que responde se a obra atrasou.",
        },
        {
          onde: "/obras/[id]",
          acao: "Olhe o campo “E-mails extras para avisos”.",
          esperado:
            "Um endereço por linha, e só para quem NÃO tem login no Loca — mestre de obra terceirizado, por exemplo. Quem está vinculado à obra já recebe automaticamente, e a tela lista quem são.",
        },
      ],
      atencao: [
        "O vínculo entre usuário e obra é feito em Usuários, pelo master. É ele que faz a pessoa receber os avisos daquela obra — e digitar o mesmo endereço nos e-mails extras faz a pessoa receber dois e-mails iguais.",
        "Fim previsto anterior ao início é recusado. A mesma regra está no banco: a tela dá a mensagem, o banco garante que não passa por outro caminho.",
      ],
    },
    {
      id: "obra-orcamento",
      titulo: "Orçamento contra realizado",
      resumo:
        "Quatro números e um veredito em uma frase. O veredito é o que se lê primeiro.",
      rotas: ["/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/[id]",
          acao: "Vá ao bloco Orçamento de locação e leia os quatro números.",
          esperado:
            "Orçado (com a versão do orçamento), Realizado (e quanto já foi pago), Consumido em percentual e Projeção final.",
        },
        {
          onde: "/obras/[id]",
          acao: "Leia a frase de veredito, embaixo dos números.",
          esperado:
            "Uma de três: “Consumo alinhado ao avanço”, “Entregando mais que consome” ou “Consumindo mais rápido que entrega” — esta última em vermelho. Ela cruza o dinheiro gasto com a obra entregue.",
        },
        {
          onde: "/obras/[id]",
          acao: "Procure a linha que fala de lançamentos sem contrato.",
          esperado:
            "Quando existe, ela diz quanto foi lançado na obra sem vínculo a contrato — e esse valor NÃO entra no realizado. O dinheiro saiu; ele só não está atribuído a nada.",
        },
        {
          onde: "/obras/[id]",
          acao: "Abra o detalhamento do orçamento, quando houver.",
          esperado:
            "Mostra quanto de cada item foi previsto, e quanto do total ainda está sem detalhamento. Detalhar é opcional: o total é o que manda.",
        },
      ],
      atencao: [
        "Consumido passa de 100% sem travar, de propósito. Uma obra em 130% precisa aparecer como 130% — travar em 100 esconderia exatamente o que interessa.",
        "O veredito tem uma margem de 10 pontos antes de mudar de diagnóstico. Sem ela, uma obra com 45% de consumo e 44% de avanço trocaria de diagnóstico toda semana por arredondamento, e diagnóstico que oscila deixa de ser lido.",
      ],
    },
    {
      id: "obra-indicadores",
      titulo: "Ler os indicadores, inclusive quando estão vazios",
      resumo:
        "Cinco números no bloco de avanço. Cada branco aponta um dado que falta, e a tela diz qual.",
      rotas: ["/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/[id]",
          acao: "No bloco Avanço da obra, leia Avanço físico e Prazo decorrido.",
          esperado:
            "Avanço físico é o último percentual lançado, com a semana. Prazo decorrido é quanto do período da obra já passou — e mostra “período não informado” quando falta data no cadastro.",
        },
        {
          onde: "/obras/[id]",
          acao: "Leia o Desvio.",
          esperado:
            "A diferença em pontos entre prazo e avanço, com o rótulo “de atraso”, “adiantada” ou “no prazo”. É o número da reunião semanal.",
        },
        {
          onde: "/obras/[id]",
          acao: "Leia a Projeção final e a Previsão de término.",
          esperado:
            "Projeção final é uma regra de três: se 31% de obra custou 62% do orçamento, 100% custará 200%. Sem avanço lançado ela fica vazia dizendo isso — porque projetar sobre 0% de obra daria infinito.",
        },
        {
          onde: "/obras/[id]",
          acao: "Veja o bloco Custo por item.",
          esperado:
            "Orçado contra o já atribuído a cada item, do maior desvio para o menor. Item que aparece sem orçamento próprio não está dentro do orçamento — ele está sem orçamento, e a tela diz isso.",
        },
      ],
      atencao: [
        "Indicador em branco nunca é falha da tela: é dado faltando, e a ordem em que a tela reclama diz o que preencher primeiro — sem orçamento não há nada a diagnosticar, mesmo com prazo e avanço completos.",
        "“Ritmo insuficiente para projetar” na previsão de término significa menos de dois lançamentos de avanço. Obra parada dividiria por zero, e uma data absurda num painel de diretoria derruba a confiança em tudo que está ao lado.",
      ],
    },
    {
      id: "obra-fechamento",
      titulo: "Fechamento mensal: a fotografia da competência",
      resumo:
        "Fechar o mês grava os valores. Sem isso, um preço corrigido hoje muda o número que já foi apresentado.",
      rotas: ["/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/[id]",
          acao: "No bloco Fechamento mensal, olhe a competência sugerida.",
          esperado:
            "Vem o mês ANTERIOR, não o corrente. Fechar o mês em curso fotografaria uma competência que ainda vai receber lançamento.",
        },
        {
          onde: "/obras/[id]",
          acao: "Clique em Fechar competência.",
          esperado:
            "Aparece “Competência fechada”. Os valores daquele mês ficam gravados e não mudam mais quando um preço for corrigido depois.",
        },
        {
          onde: "/obras/[id]",
          acao: "Reabra uma competência fechada, se precisar corrigir.",
          esperado:
            "Aparece “Competência reaberta. A correção fica registrada.” Reabrir é permitido — e deixa rastro, que é o que separa correção de reescrita.",
        },
      ],
      atencao: [
        "Fechamento é o que permite comparar meses. Sem ele, o relatório de março muda sozinho quando alguém corrige um lançamento em setembro — e ninguém consegue explicar a diferença para o diretor que leu o número antigo.",
      ],
    },
  ],
  perguntas: [
    {
      id: "obr-periodo",
      enunciado:
        "Uma obra está sem data de início e sem fim previsto. Qual é a consequência?",
      alternativas: [
        "Nenhuma: as datas são só informativas",
        "A obra não aparece na lista de obras ativas",
        "Prazo decorrido, desvio e previsão de término ficam em branco",
        "O orçamento da obra não pode ser cadastrado",
      ],
      correta: 2,
      porque:
        "O período é o denominador do “prazo decorrido”, e o desvio e a previsão de término são calculados a partir dele. Três indicadores caem de uma vez, e a tela mostra “período não informado” em vez de inventar um número. É por isso que vale insistir nesses dois campos, mesmo sendo opcionais no formulário.",
      aula: "obra-cadastro",
    },
    {
      id: "obr-veredito",
      enunciado:
        "O bloco de orçamento mostra, em vermelho, “Consumindo mais rápido que entrega”. O que isso quer dizer?",
      alternativas: [
        "A obra estourou o orçamento",
        "O percentual de orçamento consumido está bem acima do percentual de obra entregue",
        "Os pagamentos estão atrasados",
        "Faltam lançamentos de avanço nesta obra",
      ],
      correta: 1,
      porque:
        "É a comparação entre dois percentuais: quanto do dinheiro já foi usado e quanto da obra já foi entregue. Não significa estouro — a obra pode estar em 60% do orçamento e 30% entregue, dentro do valor e no caminho de estourar. O veredito antecipa; o estouro já aconteceu.",
      aula: "obra-orcamento",
    },
    {
      id: "obr-projecao-vazia",
      enunciado:
        "A Projeção final está vazia, dizendo que não há avanço lançado. Por que o sistema não projeta?",
      alternativas: [
        "Porque a projeção só é calculada no fechamento do mês",
        "Porque o orçamento ainda não foi aprovado",
        "Porque a conta divide pelo avanço físico, e sobre 0% de obra o resultado seria infinito",
        "Porque a obra precisa ter pelo menos três meses",
      ],
      correta: 2,
      porque:
        "A projeção é uma regra de três sobre o avanço físico. Uma obra em 0% que já gastou R$ 10.000 projetaria infinito, e “estouro de ∞” num painel de diretoria destrói a confiança em todos os outros números da tela. Admitir o dado que falta vale mais que exibir um número.",
      aula: "obra-indicadores",
    },
    {
      id: "obr-sem-contrato",
      enunciado:
        "A tela avisa que R$ 40.000 lançados na obra não estão vinculados a contrato e não entram no realizado. O que fazer com essa informação?",
      alternativas: [
        "Ignorar: são lançamentos de outra natureza",
        "Entender que o realizado está subestimado nesse valor, e vincular os lançamentos ao contrato certo",
        "Refazer o orçamento somando esse valor",
        "Reabrir a competência e apagar os lançamentos",
      ],
      correta: 1,
      porque:
        "O dinheiro saiu, ele só não está atribuído a contrato nenhum — então o consumido e a projeção estão menores do que a realidade. O aviso existe justamente porque um “0% consumido” com dinheiro gasto seria mentira por omissão, e quem lê o painel precisa saber que falta amarrar lançamento a contrato.",
      aula: "obra-orcamento",
    },
    {
      id: "obr-fechamento",
      enunciado: "Para que serve fechar a competência de uma obra?",
      alternativas: [
        "Para impedir novos lançamentos na obra",
        "Para gravar os valores do mês, de modo que uma correção posterior de preço não mude um número já apresentado",
        "Para encerrar a obra",
        "Para gerar o relatório mensal automaticamente",
      ],
      correta: 1,
      porque:
        "Cada competência fechada é uma fotografia. Sem ela, o relatório de março muda sozinho quando alguém corrige um lançamento em setembro, e não há como explicar a diferença para quem leu o número antigo. Reabrir é possível e fica registrado — é o que separa correção de reescrita silenciosa.",
      aula: "obra-fechamento",
    },
  ],
};
