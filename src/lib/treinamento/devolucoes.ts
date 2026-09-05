// Trilha da devolução — a conferência do que volta ao fornecedor.
//
// É a irmã do recebimento, e a diferença mais cara está no fechamento: aqui ele
// MOVE O SALDO do contrato. Enquanto uma devolução fica em rascunho, o
// equipamento já saiu da obra e o sistema continua cobrando diária por ele.
//
// Por isso a trilha insiste em três coisas: a data é a da saída, o saldo é
// conferido de novo no fechamento (e recusa inteiro se não couber), e a
// ressalva de avaria é o que sustenta a discussão de reposição depois.

import type { Trilha } from "./tipos";

export const DEVOLUCOES: Trilha = {
  chave: "devolucoes",
  titulo: "Devolução de equipamento",
  resumo:
    "Registrar o que volta ao fornecedor, encerrar a cobrança de diárias e emitir o termo que prova que o equipamento saiu da obra.",
  modulo: "devolucoes",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "devolucao-por-que-documento",
      titulo: "Por que a devolução virou documento",
      resumo:
        "Antes ela era um lançamento por item, sem papel nenhum. Quem entregava não tinha o que assinar.",
      rotas: ["/devolucoes", "/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/[id]",
          acao: "No contrato, vá à seção Devoluções e registre uma nova.",
          esperado:
            "A devolução nasce ligada àquele contrato e àquele fornecedor, em rascunho. Um documento só, para tudo o que sai no mesmo caminhão.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Compare com a seção “Histórico de devoluções”, mais abaixo.",
          esperado:
            "São coisas diferentes. A seção Devoluções é o controle dos DOCUMENTOS; o Histórico é toda baixa de saldo já lançada, inclusive as antigas, de antes de existir documento.",
        },
        {
          onde: "/devolucoes",
          acao: "Abra Devoluções no menu e filtre a situação por Rascunho.",
          esperado:
            "Aparecem as devoluções que ninguém fechou. É a razão de existir desta lista.",
        },
      ],
      atencao: [
        "Rascunho NÃO baixa saldo. Enquanto ele estiver aberto, o equipamento já saiu da obra e o contrato continua contando diária — a obra fica mais cara do que é, e ninguém vê.",
        "Um ícone de envelope na coluna Situação marca as devoluções fechadas cujo fornecedor não foi avisado. Ele não sabe que o equipamento voltou, e é isso que ele vai alegar ao cobrar.",
      ],
    },
    {
      id: "devolucao-saldo",
      titulo: "O saldo: o número que decide se o fechamento passa",
      resumo:
        "Só se devolve o que ainda está em aberto — e a conta é refeita na hora de fechar.",
      rotas: ["/devolucoes/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/devolucoes/[id]",
          acao: "No bloco “O que voltou”, clique em Lançar item e abra o seletor.",
          esperado:
            "Só aparecem itens DO CONTRATO, e só os que ainda têm saldo. Ao lado de cada um, quanto está em aberto.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Escolha um item e leia a linha abaixo do seletor.",
          esperado:
            "Ela mostra os três números: contratado, já devolvido e em aberto. A quantidade vem preenchida com o saldo inteiro, que é o caso comum.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Lance o item e tente lançar o mesmo item de novo.",
          esperado:
            "Ele não aparece mais no seletor. Cada item entra uma vez só por documento — para devolver mais, edite a quantidade da linha que já existe.",
        },
      ],
      atencao: [
        "O saldo mostrado é o do MOMENTO, e serve de orientação. A conferência que vale é feita no fechamento, porque entre montar o rascunho e fechá-lo outra pessoa pode ter devolvido o mesmo item.",
        "Se algum item não couber no saldo, o fechamento é recusado INTEIRO e nada é gravado. É de propósito: devolução gravada pela metade é pior do que devolução recusada.",
      ],
    },
    {
      id: "devolucao-condicao",
      titulo: "Conforme, com avaria, não devolvido",
      resumo:
        "Três estados, e os dois últimos custam dinheiro. A descrição é o que sustenta a discussão depois.",
      rotas: ["/devolucoes/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/devolucoes/[id]",
          acao: "Ao lançar um item, abra o campo Condição.",
          esperado:
            "Conforme (voltou em ordem, com o desgaste normal), Com avaria (voltou danificado) e Não devolvido (extraviado ou consumido em obra).",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Escolha Com avaria e veja o campo de observações.",
          esperado:
            "Ele passa a ser obrigatório, e o rótulo muda para “O que foi encontrado”. Sem descrição, o fornecedor recebe “1 item com avaria” e não sabe qual peça nem qual dano.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Abra o relatório fotográfico da devolução e anexe as fotos.",
          esperado:
            "Ele foi criado junto com o rascunho, justamente para que as fotos entrem ANTES do fechamento.",
        },
      ],
      atencao: [
        "“Não devolvido” baixa o saldo e encerra a cobrança de diária, mas o fornecedor vai cobrar a REPOSIÇÃO do item. Não é o mesmo que devolver — é assumir a perda por escrito.",
        "Foto que chega depois do fechamento não prova nada sobre o estado em que o equipamento foi entregue. O documento já saiu.",
        "A ressalva aparece em seção PRÓPRIA do termo, não escondida numa coluna da tabela. É sobre esse texto que a cobrança de reposição vai ser discutida.",
      ],
    },
    {
      id: "devolucao-fechar",
      titulo: "Fechar: o saldo se move e o fornecedor é avisado",
      resumo:
        "A tela lista o que vai acontecer antes de você confirmar. Leia a lista.",
      rotas: ["/devolucoes/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/devolucoes/[id]",
          acao: "Confira a data no bloco “Dados da devolução”.",
          esperado:
            "A tela avisa: é a data em que o equipamento SAIU DA OBRA, não a do lançamento — ela encerra a contagem de diárias.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Clique em “Fechar devolução” e leia a lista.",
          esperado:
            "Ela enumera: a devolução ganha número e deixa de ser editável; os itens baixam do saldo e param de acumular custo; o saldo é reconferido e o fechamento é recusado inteiro se não couber; um e-mail com o termo em PDF sai para o fornecedor.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Marque a caixa de ciência e confirme.",
          esperado:
            "O botão só habilita depois da caixa marcada. A devolução passa a Fechada, com número, e o botão Termo abre o mesmo PDF que foi ao fornecedor.",
        },
        {
          onde: "/devolucoes/[id]",
          acao: "Se o aviso não tiver saído, use “Reenviar aviso”.",
          esperado:
            "O termo é gerado e enviado de novo. Reenviar um aviso já enviado é permitido — o e-mail pode ter ido para a caixa errada.",
        },
      ],
      atencao: [
        "Confira o cadastro do fornecedor ANTES de fechar. Sem e-mail, a devolução fecha do mesmo jeito e a tela avisa que ninguém foi comunicado.",
        "Reabrir uma devolução fechada é só do Master, exige motivo, e DESFAZ a baixa de saldo — os itens voltam a acumular custo. Ao fechar de novo, sai um número NOVO: o documento mudou, então é outro documento.",
      ],
    },
  ],
  perguntas: [
    {
      id: "dev-data",
      enunciado:
        "O caminhão levou o equipamento na terça e você está lançando a devolução na sexta. Que data usar em “Devolvido em”?",
      alternativas: [
        "A de sexta, que é quando o lançamento está sendo feito",
        "A de terça, que é a data em que o equipamento saiu da obra",
        "Tanto faz, é só informativo",
        "A data da contra-nota do fornecedor",
      ],
      correta: 1,
      porque:
        "É essa data que ENCERRA a contagem de diárias do item. Lançar com a data de hoje uma retirada de três dias atrás cobra três diárias que não existiram — no contrato e no orçamento da obra. A tela avisa isso embaixo do campo.",
      aula: "devolucao-fechar",
    },
    {
      id: "dev-rascunho",
      enunciado:
        "Uma devolução ficou em Rascunho por dez dias. Qual é o prejuízo?",
      alternativas: [
        "Nenhum: ela fecha quando alguém lembrar",
        "O fornecedor não recebeu a contra-nota",
        "O saldo não baixou, então o contrato continuou cobrando diária de equipamento que já saiu da obra",
        "Os itens ficam bloqueados para outros contratos",
      ],
      correta: 2,
      porque:
        "Rascunho não move saldo — de propósito, para que um rascunho abandonado não baixe estoque que nunca voltou. O efeito colateral é este: enquanto ele não fecha, o custo de locação segue correndo sobre coisa que está no pátio do fornecedor. É para achar esses que a lista tem filtro de situação.",
      aula: "devolucao-por-que-documento",
    },
    {
      id: "dev-saldo-estourado",
      enunciado:
        "Você montou o rascunho com 10 escoras, mas outra pessoa devolveu 6 delas nesse meio-tempo. O que acontece ao fechar?",
      alternativas: [
        "As 4 que cabem são gravadas e as 6 restantes são descartadas",
        "O fechamento é recusado inteiro, sem gravar nada, dizendo qual item não coube",
        "O sistema aceita e o saldo fica negativo",
        "O fechamento é adiado até alguém aprovar",
      ],
      correta: 1,
      porque:
        "A conferência é refeita no momento do fechamento, dentro de uma transação, e a recusa é total. Gravar só o que cabe produziria uma devolução parcial que ninguém pediu — num documento que já sairia com a lista completa para o fornecedor.",
      aula: "devolucao-saldo",
    },
    {
      id: "dev-nao-devolvido",
      enunciado:
        "Quatro módulos de andaime sumiram na frente de serviço e não vão voltar. Como registrar?",
      alternativas: [
        "Conforme, para não travar o fechamento",
        "Com avaria, porque houve perda",
        "Não devolvido, descrevendo o que aconteceu",
        "Não lançar, e deixar o saldo em aberto",
      ],
      correta: 2,
      porque:
        "“Não devolvido” é o estado que só existe na volta: baixa o saldo e encerra a diária, mas registra por escrito que o item não voltou — e é sobre isso que o fornecedor vai cobrar a reposição. Deixar em aberto seria pior: o contrato seguiria cobrando diária eterna de coisa que não existe mais.",
      aula: "devolucao-condicao",
    },
    {
      id: "dev-reabrir",
      enunciado:
        "Uma devolução foi fechada com o item errado. O Master reabre. O que acontece com o saldo?",
      alternativas: [
        "Nada: o saldo continua baixado e o documento vira editável",
        "As baixas são desfeitas e os itens voltam a acumular custo de locação",
        "O contrato é cancelado",
        "O saldo só volta depois que a devolução for fechada de novo",
      ],
      correta: 1,
      porque:
        "Reabrir sem desfazer a baixa deixaria o saldo consumido com o documento editável, e a PRÓXIMA devolução do mesmo item seria recusada por saldo insuficiente sem que nada explicasse por quê. Por isso reabrir desfaz o razão — e por isso é restrito ao Master e exige motivo registrado.",
      aula: "devolucao-fechar",
    },
  ],
};
