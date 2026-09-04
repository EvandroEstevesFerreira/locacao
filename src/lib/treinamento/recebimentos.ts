// Trilha do recebimento — a conferência do que o fornecedor entregou.
//
// É a trilha com o passo mais irreversível do sistema: fechar o recebimento
// numera o registro, congela a conferência, carimba a data de retirada nos
// itens do contrato e dispara o romaneio por e-mail ao fornecedor. Quatro
// coisas de uma vez, e nenhuma delas se desfaz.
//
// Por isso as aulas insistem em duas conferências ANTES do fechamento: a data
// da entrega e a condição de cada item.

import type { Trilha } from "./tipos";

export const RECEBIMENTOS: Trilha = {
  chave: "recebimentos",
  titulo: "Recebimento e conferência",
  resumo:
    "Conferir o que chegou do fornecedor, registrar avaria e divergência, e fechar o recebimento — que é irreversível.",
  modulo: "recebimentos",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "recebimento-onde-nasce",
      titulo: "Onde o recebimento nasce, e onde se acham os pendentes",
      resumo:
        "Ele nasce dentro do contrato. A lista existe para achar o que ficou em rascunho.",
      rotas: ["/recebimentos", "/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/[id]",
          acao: "No contrato, vá à seção de recebimentos e crie um novo.",
          esperado:
            "O recebimento nasce ligado àquele contrato e àquele fornecedor — é dali que ele sabe o que era esperado.",
        },
        {
          onde: "/recebimentos",
          acao: "Abra Recebimentos no menu.",
          esperado:
            "A lista de toda a organização, do mais recente para o mais antigo: registro, data, obra, fornecedor, conferente, itens e situação.",
        },
        {
          onde: "/recebimentos",
          acao: "Filtre a situação por Rascunho.",
          esperado:
            "Aparecem as conferências que ninguém fechou. É a razão de existir desta lista.",
        },
      ],
      atencao: [
        "Rascunho é conferência que não terminou: não gerou número, não avisou o fornecedor e NÃO carimbou a retirada nos itens do contrato. Enquanto isso, o custo daqueles itens não começa a contar.",
        "Registrar e fechar recebimento é de operador, administrador e master.",
      ],
    },
    {
      id: "recebimento-conferir",
      titulo: "A conferência: a data certa e a condição de cada item",
      resumo:
        "Dois campos que quase sempre são preenchidos no automático, e não deveriam.",
      rotas: ["/recebimentos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/recebimentos/[id]",
          acao: "No bloco “Dados da conferência”, confira a data.",
          esperado:
            "A tela avisa: a data é a da ENTREGA, não a do lançamento. Quem digita dias depois precisa corrigi-la — ela é o que vai virar a data de retirada no contrato.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Preencha o conferente e o número da nota do fornecedor.",
          esperado:
            "Salva. O conferente é quem responde pela conferência; a nota é o que amarra o recebimento ao documento fiscal.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "No bloco “O que chegou”, confirme cada item que o contrato prevê.",
          esperado:
            "Item controlado por patrimônio EXIGE a peça — você escolhe qual unidade chegou. Item por quantidade pede o número.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Marque a condição de cada linha.",
          esperado:
            "Três opções: Conforme (chegou como esperado), Com avaria (chegou danificado) e Divergência (quantidade, modelo ou item diferente do contratado). O cabeçalho passa a contar quantos itens têm ressalva.",
        },
      ],
      atencao: [
        "Avaria e divergência não são a mesma coisa. Avaria é dano: veio o que se pediu, quebrado. Divergência é o que veio diferente: outro modelo, outra quantidade, outro item. Trocar as duas na conferência muda a conversa que a empresa vai ter com a locadora.",
        "A ressalva registrada aqui aparece no romaneio que o fornecedor recebe. É o que transforma uma reclamação em documento.",
      ],
    },
    {
      id: "recebimento-fechar",
      titulo: "Fechar o recebimento: quatro coisas de uma vez, e nenhuma se desfaz",
      resumo:
        "O passo mais irreversível do sistema. A tela lista o que vai acontecer antes de você confirmar.",
      rotas: ["/recebimentos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/recebimentos/[id]",
          acao: "Clique em “Fechar recebimento” e LEIA a lista que aparece.",
          esperado:
            "Ela diz, em letras: fechar é irreversível. E enumera — o recebimento ganha número e deixa de ser editável; os itens viram a data de retirada no contrato, que alimenta o cálculo de custo; um e-mail com o romaneio em PDF sai para o fornecedor.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Veja para qual e-mail o romaneio vai sair.",
          esperado:
            "A tela mostra o endereço. Quando o fornecedor não tem e-mail cadastrado, ela avisa que ele não será comunicado — e o recebimento fecha do mesmo jeito.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Confira o aviso de itens com ressalva, quando houver.",
          esperado:
            "Diz quantos vão com avaria ou divergência, e lembra que o fornecedor vê isso no romaneio.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Marque a caixa de ciência e confirme.",
          esperado:
            "O botão só habilita depois da caixa marcada. O recebimento passa a Fechado, com número, e a tela mostra a data do fechamento e se o fornecedor foi avisado.",
        },
      ],
      atencao: [
        "Confira o cadastro do fornecedor ANTES de fechar. E-mail errado ou faltando significa romaneio não entregue, e não há como reenviar refazendo o fechamento.",
        "Fechar carimba a retirada nos itens do contrato — e a retirada é o marco de onde o custo de locação começa a contar. Data de entrega errada aqui é custo errado no contrato e no orçamento da obra.",
      ],
    },
    {
      id: "recebimento-romaneio",
      titulo: "O romaneio",
      resumo:
        "O PDF do que foi conferido, com as ressalvas. Serve à empresa e ao fornecedor.",
      rotas: ["/recebimentos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/recebimentos/[id]",
          acao: "Num recebimento fechado, clique em Romaneio.",
          esperado:
            "Abre o PDF com o que chegou, em que condição, quem conferiu e o número do registro. É o mesmo arquivo que foi por e-mail ao fornecedor.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Leia o resumo por condição, no fim da página.",
          esperado:
            "Quantos itens conformes, com avaria e com divergência. É a leitura rápida de quem vai cobrar a locadora.",
        },
      ],
      atencao: [
        "O romaneio é a prova de que a empresa apontou o problema na entrega, e não semanas depois. Avaria registrada no recebimento é discussão com data; avaria descoberta depois é palavra contra palavra.",
      ],
    },
  ],
  perguntas: [
    {
      id: "rec-data",
      enunciado:
        "A entrega foi na segunda e você está lançando o recebimento na quinta. Que data usar em “Recebido em”?",
      alternativas: [
        "A de quinta, que é quando o lançamento está sendo feito",
        "A de segunda, que é a data da entrega",
        "Tanto faz, é só informativo",
        "A data da nota do fornecedor",
      ],
      correta: 1,
      porque:
        "A tela avisa isso em letras, e não é detalhe: ao fechar, essa data vira a data de RETIRADA nos itens do contrato — o marco de onde o custo de locação começa a contar. Três dias de diferença viram três dias de cobrança que não aconteceram, no contrato e no orçamento da obra.",
      aula: "recebimento-conferir",
    },
    {
      id: "rec-avaria-divergencia",
      enunciado:
        "Você pediu 10 escoras e chegaram 8, todas em bom estado. Como registrar?",
      alternativas: [
        "Com avaria, porque o pedido não foi cumprido",
        "Conforme, e depois pedir as 2 que faltam",
        "Divergência, porque a quantidade veio diferente do contratado",
        "Não registrar e refazer o recebimento quando as 2 chegarem",
      ],
      correta: 2,
      porque:
        "Avaria é dano — veio o que se pediu, quebrado. Divergência é o que veio diferente: quantidade, modelo ou item. A distinção define a conversa com a locadora: uma cobra reparo, a outra cobra a entrega do que falta. E a ressalva aparece no romaneio, com data.",
      aula: "recebimento-conferir",
    },
    {
      id: "rec-fechar",
      enunciado: "O que acontece ao fechar um recebimento?",
      alternativas: [
        "Ele apenas ganha um número de registro",
        "Ganha número, deixa de ser editável, carimba a retirada nos itens do contrato e envia o romaneio ao fornecedor",
        "Os itens entram no estoque",
        "O contrato é encerrado",
      ],
      correta: 1,
      porque:
        "São quatro efeitos de uma vez, e a tela os enumera antes de pedir a confirmação — por isso ela exige marcar a caixa de ciência. Nenhum deles se desfaz: é o passo mais irreversível do sistema, e o único cuja preparação (data e e-mail do fornecedor) tem de estar certa ANTES.",
      aula: "recebimento-fechar",
    },
    {
      id: "rec-rascunho",
      enunciado:
        "Um recebimento ficou em Rascunho por duas semanas. Qual é o prejuízo?",
      alternativas: [
        "Nenhum: ele fecha quando alguém lembrar",
        "O fornecedor não recebeu a nota fiscal",
        "A retirada não foi carimbada, então o custo daqueles itens não começou a contar no contrato",
        "Os itens ficam bloqueados para outros contratos",
      ],
      correta: 2,
      porque:
        "Rascunho é conferência que não terminou: não numerou, não avisou o fornecedor e não carimbou a data de retirada. Sem retirada não há períodos decorridos, então o custo daquele equipamento está ausente do contrato e do orçamento da obra — a obra parece mais barata do que é. É exatamente para achar esses que a lista de Recebimentos tem filtro de situação.",
      aula: "recebimento-onde-nasce",
    },
  ],
};
