// Trilha dos serviços e licenças de TI.
//
// Esta trilha gira em torno de UM número: as licenças ociosas. Todo o resto da
// tela existe para que esse número seja confiável — e ele é o único do sistema
// em cima do qual alguém toma uma decisão que custa dinheiro imediatamente
// (cancelar assinatura). Por isso a aula da conferência não é acessório: um
// número de ociosas desatualizado é pior que nenhum, porque parece útil.

import type { Trilha } from "./tipos";

export const SERVICOS: Trilha = {
  chave: "servicos",
  titulo: "Serviços e licenças: quanto custa, quem usa, o que sobra",
  resumo:
    "Cadastrar assinatura recorrente, atribuir licença a quem usa, ler o rateio por centro de custo e manter a contagem de ociosas confiável.",
  modulo: "servicos",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "servicos-lista",
      titulo: "A lista, e a coluna que importa",
      resumo:
        "O que cada coluna responde, e por que 'Ociosas' é a única destacada em vermelho.",
      rotas: ["/servicos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/servicos",
          acao: "Abra Serviços e licenças e olhe as colunas Contratadas, Em uso e Ociosas.",
          esperado:
            "Contratadas é o que a empresa paga. Em uso é quantas pessoas têm a licença atribuída aqui no Loca. Ociosas é a diferença — e é dinheiro saindo sem ninguém do outro lado.",
        },
        {
          onde: "/servicos",
          acao: "Repare que Ociosas só fica em vermelho quando é maior que zero.",
          esperado:
            "Zero é o estado saudável e aparece apagado. O destaque existe para o caso em que há algo a fazer, não para colorir a tela.",
        },
        {
          onde: "/servicos",
          acao: "Filtre por categoria — Licença, Conectividade, Segurança ou Outro.",
          esperado:
            "A lista filtra ao vivo. Conectividade é link de internet e telefonia; Segurança é antivírus e firewall; Licença é assinatura de software.",
        },
      ],
      atencao: [
        "O valor da coluna é o custo do PERÍODO do contrato (quantidade × valor unitário), não o valor de uma licença.",
      ],
    },
    {
      id: "servicos-cadastro",
      titulo: "Cadastrar uma assinatura",
      resumo:
        "Os campos que decidem o rateio e o alerta, e a diferença entre vencimento e renovação automática.",
      rotas: ["/servicos/novo", "/servicos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/servicos/novo",
          acao: "Informe nome, fornecedor, quantidade contratada e o valor de UMA licença.",
          esperado:
            "O total do contrato é calculado — quantidade × valor unitário. É esse total que o sistema divide entre os centros de custo.",
        },
        {
          onde: "/servicos/novo",
          acao: "Preencha o início da vigência e, se houver, o fim.",
          esperado:
            "Contrato sem data de fim é vigência indeterminada, e é o caso comum em assinatura mensal. Ele não gera aviso de renovação, porque não há data para avisar.",
        },
        {
          onde: "/servicos/novo",
          acao: "Marque ou desmarque 'renova automaticamente'.",
          esperado:
            "Muda o que o aviso vai dizer. Com renovação automática, o aviso cobra a decisão de CANCELAR antes que renove sozinho; sem ela, cobra a decisão de renovar antes que vença. São ações opostas.",
        },
      ],
      atencao: [
        "Não existe contrato de zero licenças — o sistema recusa, porque o rateio precisa dividir por alguma coisa.",
      ],
    },
    {
      id: "servicos-atribuicao",
      titulo: "Atribuir a licença a quem usa",
      resumo:
        "É a atribuição que define de quem é o custo — e é o que faz a licença ociosa aparecer.",
      rotas: ["/servicos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/servicos",
          acao: "Abra um serviço e atribua uma licença a uma pessoa.",
          esperado:
            "O custo daquela licença passa a cair no centro de custo em que a pessoa está lotada. Não há campo de centro de custo aqui: ele vem da pessoa, e muda sozinho se ela for transferida.",
        },
        {
          onde: "/servicos",
          acao: "Devolva uma licença, informando a data.",
          esperado:
            "A atribuição sai da contagem de 'em uso' e continua no histórico. A mesma pessoa pode receber a licença de novo depois — as duas passagens ficam registradas.",
        },
      ],
      atencao: [
        "A mesma pessoa não ocupa duas licenças abertas do mesmo contrato. Para isso, o certo é a quantidade contratada refletir o uso real.",
        "Pessoa sem centro de custo cadastrado aparece no rateio numa linha própria, sem dono. Ela não some: sumir faria o total não fechar.",
      ],
    },
    {
      id: "servicos-rateio",
      titulo: "Ler o rateio, e o que ninguém paga",
      resumo:
        "Como o custo se divide, por que ele muda todo mês, e por que a licença ociosa fica sem dono.",
      rotas: ["/servicos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/servicos",
          acao: "Na ficha de um serviço, leia o bloco de rateio.",
          esperado:
            "Cada centro de custo aparece com quantas pessoas tem e quanto isso custa. A soma das partes bate exatamente com o total do contrato, ao centavo.",
        },
        {
          onde: "/servicos",
          acao: "Procure a linha das ociosas.",
          esperado:
            "As licenças que ninguém usa aparecem separadas, sem centro de custo. Elas não são distribuídas entre os departamentos de propósito: diluídas, ninguém as veria, e ninguém cancelaria assinatura nenhuma.",
        },
      ],
      atencao: [
        "O rateio muda quando alguém entra, sai ou é transferido. Isso é correto: o custo segue quem usa, e um rateio que não muda é um rateio que parou de refletir a empresa.",
      ],
    },
    {
      id: "servicos-conferencia",
      titulo: "Conferir contra o provedor",
      resumo:
        "Por que o Loca pergunta quando você conferiu pela última vez — e por que um número velho é pior que nenhum.",
      rotas: ["/servicos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/servicos",
          acao: "Olhe a coluna 'Conferido em'.",
          esperado:
            "Ela mostra o dia em que alguém comparou a lista do Loca com a do provedor. Passados 90 dias, ela fica em vermelho com um aviso.",
        },
        {
          onde: "/servicos",
          acao: "Abra o portal do provedor, compare com a lista de atribuições e marque como conferido.",
          esperado:
            "A data é atualizada. Enquanto ela estiver em dia, o número de ociosas merece confiança.",
        },
      ],
      atencao: [
        "Contrato nunca conferido aparece como vencido, não como neutro: é onde o número tem MENOS chance de estar certo.",
        "O Loca não conversa com o provedor. A atribuição é digitada, e é por isso que a conferência periódica existe — sem ela, alguém cancelaria uma assinatura que na verdade está em uso.",
      ],
    },
  ],
  perguntas: [
    {
      id: "srv-ociosas",
      enunciado:
        "Um contrato tem 50 licenças contratadas e 43 atribuídas. O que o Loca faz com as 7 restantes?",
      alternativas: [
        "Distribui o custo delas entre os centros de custo que têm pessoas",
        "Mostra numa linha própria, sem centro de custo",
        "Desconta do total do contrato",
        "Ignora, porque ninguém as usa",
      ],
      correta: 1,
      porque:
        "Diluir as ociosas entre os departamentos faria elas desaparecerem — cada um pagaria um pouco a mais sem saber por quê, e ninguém jamais cancelaria assinatura nenhuma. Numa linha própria e sem dono, elas são o número em cima do qual alguém decide.",
      aula: "servicos-rateio",
    },
    {
      id: "srv-centro-custo",
      enunciado:
        "De onde sai o centro de custo que paga por uma licença?",
      alternativas: [
        "De um campo preenchido na ficha do serviço",
        "Do fornecedor do contrato",
        "Da lotação da pessoa a quem a licença foi atribuída",
        "É sempre o centro de custo da TI",
      ],
      correta: 2,
      porque:
        "Não há campo de centro de custo na ficha do serviço de propósito: ele vem da pessoa. Se alguém é transferido de departamento, o custo da licença acompanha sozinho, sem ninguém ter de lembrar de ajustar o contrato.",
      aula: "servicos-atribuicao",
    },
    {
      id: "srv-conferencia",
      enunciado:
        "Um contrato nunca foi conferido contra o provedor. Como o Loca trata isso?",
      alternativas: [
        "Como neutro — sem conferir não dá para dizer se está certo ou errado",
        "Como vencido, com aviso na tela",
        "Bloqueia a atribuição de novas licenças",
        "Esconde a contagem de ociosas",
      ],
      correta: 1,
      porque:
        "Um contrato que ninguém nunca conferiu é justamente onde o número tem MENOS chance de estar certo, e não mais. Tratar isso como neutro deixaria alguém cancelar uma assinatura que está em uso, com base num número que nunca foi checado.",
      aula: "servicos-conferencia",
    },
    {
      id: "srv-renovacao",
      enunciado:
        "O que muda no aviso quando o contrato está marcado como 'renova automaticamente'?",
      alternativas: [
        "Nada: o aviso é o mesmo, só muda a data",
        "O aviso deixa de existir",
        "O aviso passa a cobrar a decisão de cancelar, em vez de a de renovar",
        "O aviso vai para o fornecedor",
      ],
      correta: 2,
      porque:
        "São ações opostas. Vencimento cobra que alguém renove antes que acabe; renovação automática cobra que alguém decida cancelar antes que renove sozinha. Trocar as duas frases empurra a pessoa para o lado errado — ela não faz nada e a assinatura se renova.",
      aula: "servicos-cadastro",
    },
    {
      id: "srv-devolucao",
      enunciado:
        "Uma pessoa devolve a licença e, meses depois, recebe de novo. O que acontece com o histórico?",
      alternativas: [
        "A atribuição antiga é sobrescrita",
        "As duas passagens ficam registradas",
        "O sistema recusa a segunda atribuição",
        "A contagem de 'em uso' passa a ser 2",
      ],
      correta: 1,
      porque:
        "A devolução marca a data de saída e a linha continua como histórico — é o que responde 'desde quando ela usa isto'. Só as atribuições abertas contam para 'em uso' e para o rateio.",
      aula: "servicos-atribuicao",
    },
  ],
};
