// Trilha do estoque — saldo por quantidade, e o razão que explica o saldo.
//
// O erro que esta trilha existe para evitar não é operacional, é de leitura: a
// tela tem quatro indicadores e uma curva ABC, e quem não sabe que "saldo
// negativo" significa "falta lançar uma entrada" lê o painel inteiro tirando
// conclusão de um número que ainda vai mudar.

import type { Trilha } from "./tipos";

export const ESTOQUE: Trilha = {
  chave: "estoque",
  titulo: "Estoque: saldo, movimento e leitura do painel",
  resumo:
    "Lançar entrada, saída, ajuste e baixa; corrigir por estorno; e ler os indicadores sem tirar conclusão errada.",
  modulo: "estoque",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "estoque-o-que-entra",
      titulo: "O que o estoque controla — e o que não controla",
      resumo:
        "Só item por quantidade. Equipamento com patrimônio tem tela própria, de propósito.",
      rotas: ["/estoque"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/estoque",
          acao: "Abra Estoque e leia a linha embaixo do título.",
          esperado:
            "“Saldo dos itens controlados por quantidade · consumo dos últimos 90 dias”. Cimento, escora, EPI e consumível estão aqui; betoneira e notebook, não.",
        },
        {
          onde: "/estoque",
          acao: "Procure um equipamento com patrimônio na lista de saldos.",
          esperado:
            "Ele não está. Item controlado por peça vive em Frota — trazê-lo para cá daria ao sistema duas verdades sobre onde ele está.",
        },
        {
          onde: "/estoque",
          acao: "Use a busca e o filtro Local.",
          esperado:
            "O filtro Local separa o saldo por obra. “Todos os locais” soma o almoxarifado central com todas as obras.",
        },
      ],
      atencao: [
        "Se um item deveria estar aqui e não está, o problema é no catálogo: ele foi cadastrado com controle por peça. Quem corrige é o master ou o administrador, na edição do item.",
      ],
    },
    {
      id: "lancar-movimento",
      titulo: "Os cinco tipos de movimento",
      resumo:
        "Entrada, saída, ajuste positivo, ajuste negativo e baixa. Escolher o tipo errado dá o saldo certo e a explicação errada.",
      rotas: ["/estoque"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/estoque",
          acao: "No bloco Lançar movimento, escolha o item e troque o campo Tipo, um por um.",
          esperado:
            "A ajuda embaixo do campo muda a cada tipo: entrada é compra ou devolução ao almoxarifado; saída é requisição, consumo ou entrega; os ajustes são resultado de inventário; baixa é perda, quebra ou descarte.",
        },
        {
          onde: "/estoque",
          acao: "Digite a quantidade sempre positiva.",
          esperado:
            "Aceita. Quem dá o sinal é o TIPO, não o número — não existe saída de menos dez.",
        },
        {
          onde: "/estoque",
          acao: "Escolha o Local, confira a data e preencha o Documento.",
          esperado:
            "Local vazio é o almoxarifado central. O documento (nota fiscal, requisição) é opcional, mas é o que permite reconstruir o lançamento seis meses depois.",
        },
        {
          onde: "/estoque",
          acao: "Clique em Lançar movimento e repare no que o formulário faz depois.",
          esperado:
            "Item, quantidade e observações são limpos; data e local ficam. Quem lança uma nota inteira lança vários itens seguidos no mesmo dia e no mesmo local.",
        },
      ],
      atencao: [
        "Baixa e saída não são a mesma coisa. Saída é material que foi usado; baixa é material que se perdeu. Somar as duas como saída faz a obra parecer consumir o que ela na verdade quebrou.",
        "Ajuste é para inventário: o sistema dizia 100, a contagem achou 92 — ajuste negativo de 8. Usar entrada ou saída para isso mistura consumo real com erro de registro, e a curva ABC passa a mentir.",
        "Lançar movimento exige perfil de operador, administrador ou master. Gestor lê o painel, mas não lança.",
      ],
    },
    {
      id: "corrigir-lancamento",
      titulo: "Corrigir um lançamento errado: o estorno",
      resumo:
        "O razão não se edita nem se apaga. Corrigir é lançar o contrário, e as duas linhas ficam à vista.",
      rotas: ["/estoque"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/estoque",
          acao: "Em Últimos movimentos, ache um lançamento errado e clique no ícone de estorno, na ponta da linha.",
          esperado:
            "Abre uma janela pedindo o motivo. O motivo é obrigatório: duas linhas contrárias sem explicação são piores que um saldo errado.",
        },
        {
          onde: "/estoque",
          acao: "Escreva o motivo — “eram 10 e não 100” — e confirme.",
          esperado:
            "O sistema grava um movimento CONTRÁRIO apontando para o original. As duas linhas aparecem riscadas na lista: uma anula a outra.",
        },
        {
          onde: "/estoque",
          acao: "Depois de estornar, lance o movimento certo.",
          esperado:
            "O estorno desfaz; ele não corrige. Quem lança o valor certo é você, num movimento novo.",
        },
        {
          onde: "/estoque",
          acao: "Tente estornar o mesmo movimento duas vezes.",
          esperado:
            "O sistema recusa: “Este movimento já foi estornado.” Cada lançamento tem um estorno só.",
        },
      ],
      atencao: [
        "O estorno é lançado com a data de HOJE, não com a do movimento original — ele aconteceu agora, e datá-lo no passado reescreveria um saldo que já foi lido e relatado.",
        "Não use ajuste para corrigir digitação. O ajuste conserta o saldo e diz “o inventário achou diferença”, o que não é verdade — e apaga a única pista de que houve erro de lançamento.",
      ],
    },
    {
      id: "ler-o-painel",
      titulo: "Ler os indicadores na ordem certa",
      resumo:
        "Quatro números no topo e uma curva ABC. Há uma ordem de leitura, e ela começa pelo que estiver vermelho.",
      rotas: ["/estoque"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/estoque",
          acao: "Olhe primeiro o indicador Saldo negativo.",
          esperado:
            "Se for maior que zero, aparece um bloco vermelho no topo listando os itens. Saldo negativo é erro de lançamento, e ele contamina o consumo e a curva ABC — corrija antes de ler o resto.",
        },
        {
          onde: "/estoque",
          acao: "Leia Em ruptura e Sem giro.",
          esperado:
            "Ruptura é saldo abaixo do mínimo — é o que vai faltar. Sem giro é item com saldo e parado há 90 dias — é dinheiro empatado na prateleira.",
        },
        {
          onde: "/estoque",
          acao: "Na tabela Saldo por item, leia a coluna Classe.",
          esperado:
            "A são os itens que somam 80% do que saiu no período; B até 95%; C o resto. A tabela é ordenada por CONSUMO, não por saldo.",
        },
        {
          onde: "/estoque",
          acao: "Compare a coluna Saldo com a coluna Mínimo numa linha de classe A.",
          esperado:
            "Saldo abaixo do mínimo aparece em vermelho. Item de classe A em ruptura é o que para a obra — é a linha mais urgente da tela.",
        },
      ],
      atencao: [
        "Item com saldo enorme e classe C não é item importante: é capital parado. Ordenar por saldo faria exatamente a leitura contrária, e é por isso que a tabela não faz isso.",
        "“Parado há” mostra “nunca movido” quando o item tem cadastro e nenhum lançamento. É diferente de parado há 200 dias.",
      ],
    },
  ],
  perguntas: [
    {
      id: "est-negativo",
      enunciado:
        "O painel mostra dois itens com saldo negativo. O que isso significa, e o que fazer primeiro?",
      alternativas: [
        "O estoque está no vermelho financeiramente; avisar o financeiro",
        "Saiu mais do que entrou: falta lançar uma entrada ou uma saída foi lançada a mais — corrigir antes de ler o resto do painel",
        "Os itens acabaram e precisam ser comprados com urgência",
        "É normal em fim de mês e se resolve sozinho na virada",
      ],
      correta: 1,
      porque:
        "Saldo negativo é impossível no mundo físico: é sempre erro de registro. E como o consumo e a curva ABC são calculados sobre os mesmos lançamentos, ler o painel antes de corrigir é tirar conclusão de números que ainda vão mudar. É por isso que o bloco vermelho vem antes de tudo na tela.",
      aula: "ler-o-painel",
    },
    {
      id: "est-ajuste-x-entrada",
      enunciado:
        "O inventário contou 92 sacos de cimento; o sistema dizia 100. Qual o lançamento correto?",
      alternativas: [
        "Saída de 8, porque o material saiu do estoque",
        "Baixa de 8, porque o material se perdeu",
        "Ajuste negativo de 8",
        "Entrada de 92, para o saldo bater com a contagem",
      ],
      correta: 2,
      porque:
        "Ajuste é exatamente o movimento do inventário: o saldo do sistema divergia da contagem física. Lançar como saída diria que a obra consumiu 8 sacos que ninguém usou, e o consumo do período — que alimenta a curva ABC e a decisão de compra — passaria a mentir. Baixa afirmaria uma perda que ninguém apurou.",
      aula: "lancar-movimento",
    },
    {
      id: "est-estorno",
      enunciado:
        "Você lançou uma saída de 100 quando eram 10. Qual é o caminho?",
      alternativas: [
        "Editar o lançamento e trocar 100 por 10",
        "Lançar uma entrada de 90 para compensar",
        "Estornar o lançamento com o motivo e depois lançar a saída certa de 10",
        "Apagar o lançamento e refazer",
      ],
      correta: 2,
      porque:
        "O razão é somente-inclusão: nenhum lançamento se edita ou se apaga, e o banco recusa as duas coisas. O estorno grava o movimento contrário apontando para o original, e as duas linhas ficam riscadas na lista. Uma entrada de 90 acertaria o saldo e deixaria no razão uma entrada de material que nunca chegou.",
      aula: "corrigir-lancamento",
    },
    {
      id: "est-classe-a",
      enunciado: "Um item aparece com classe A na tabela. O que isso quer dizer?",
      alternativas: [
        "Que ele é o item de maior saldo em estoque",
        "Que ele está entre os itens que somam 80% do consumo do período",
        "Que ele é o item mais caro do catálogo",
        "Que ele está com saldo abaixo do mínimo",
      ],
      correta: 1,
      porque:
        "A curva ABC é calculada sobre o CONSUMO dos últimos 90 dias, não sobre o saldo nem sobre o preço. Classe A é o material que a obra realmente gira, e é onde falta dói. Item com saldo alto e classe C é o contrário: capital parado na prateleira.",
      aula: "ler-o-painel",
    },
  ],
};
