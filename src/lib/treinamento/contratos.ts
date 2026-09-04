// Trilha do contrato de locação — onde o dinheiro é decidido.
//
// Duas escolhas do cadastro do contrato governam TODO o cálculo de custo dos
// itens dele: a cadência e o pró-rata. Erradas, o custo estimado sai errado em
// todas as linhas, e o erro sobe para o orçamento da obra e para o painel da
// diretoria sem que nada na tela pareça quebrado.

import type { Trilha } from "./tipos";

export const CONTRATOS: Trilha = {
  chave: "contratos",
  titulo: "Contratos de locação",
  resumo:
    "Cadastrar o contrato, incluir itens locados, entender cadência e pró-rata e registrar devoluções.",
  modulo: "contratos",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "contrato-novo",
      titulo: "Cadastrar o contrato",
      resumo:
        "Obra, fornecedor, número e período. E as duas escolhas que definem o cálculo.",
      rotas: ["/contratos/novo"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/novo",
          acao: "Escolha a obra e o fornecedor.",
          esperado:
            "Os dois vêm de cadastro. Se a locadora não está na lista, ela ainda não foi cadastrada em Fornecedores — ou está inativa.",
        },
        {
          onde: "/contratos/novo",
          acao: "Digite o número do contrato do FORNECEDOR (ex.: CT-2026-001).",
          esperado:
            "É o número que a locadora usa, o que está no papel dela. O Loca gera um número de registro próprio, e a lista mostra os dois — Registro e Nº do fornecedor.",
        },
        {
          onde: "/contratos/novo",
          acao: "Escolha a cadência de cobrança: diária, semanal, quinzenal ou mensal.",
          esperado:
            "Salva. É a unidade de cobrança do contrato, e ela multiplica o valor de todos os itens que você incluir depois.",
        },
        {
          onde: "/contratos/novo",
          acao: "Preencha início e fim previsto, e salve.",
          esperado:
            "O contrato entra na lista com status Ativo, pronto para receber itens.",
        },
      ],
      atencao: [
        "Cadastrar e editar contrato é de operador, administrador e master. Gestor vê a lista e o detalhe.",
        "Excluir contrato é SÓ do master, e o contrato deixa de aparecer nas listas e nos relatórios. Não é o caminho para contrato que acabou — para isso existe o status Encerrado.",
      ],
    },
    {
      id: "contrato-cadencia",
      titulo: "Cadência e pró-rata: as duas escolhas que mexem no dinheiro",
      resumo:
        "Sem pró-rata, meio período é cobrado como período inteiro. Com pró-rata, é proporcional.",
      rotas: ["/contratos/novo", "/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/novo",
          acao: "Leia a explicação da caixa “Cobrança pró-rata”.",
          esperado:
            "Ela diz que a cobrança passa a ser proporcional aos dias usados, em vez de período cheio — meia semana vale metade do valor.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Entenda o efeito de NÃO marcar: o sistema arredonda para cima.",
          esperado:
            "Contrato semanal sem pró-rata, item que ficou 8 dias, custa DUAS semanas — porque 8 dias não cabem em uma. É assim que a maioria das locadoras cobra, e por isso é o padrão.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Confira o selo de Pró-rata ao lado da cadência, no topo do contrato.",
          esperado:
            "Quando o contrato é pró-rata, aparece um selo escrito “Pró-rata”. Sem selo, é período cheio.",
        },
      ],
      atencao: [
        "A cadência e o pró-rata precisam ser os do CONTRATO ASSINADO, não os que parecem mais justos. O custo estimado do Loca só bate com a fatura da locadora se as duas escolhas espelharem o papel.",
        "Mudar a cadência de um contrato que já tem itens recalcula o custo estimado de todos eles. Confira antes de mexer.",
      ],
    },
    {
      id: "contrato-itens",
      titulo: "Incluir os itens locados",
      resumo:
        "Quantidade, valor por período e data de retirada. O custo estimado sai dessas três coisas.",
      rotas: ["/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/[id]",
          acao: "No bloco “Adicionar item”, escolha o item do catálogo e a quantidade.",
          esperado:
            "O item vem do catálogo — se não está na lista, falta cadastrar em Itens, ou ele está inativo.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Preencha o valor unitário por PERÍODO.",
          esperado:
            "É o valor de um item por um período da cadência do contrato. Em contrato mensal, é o valor do mês; em contrato semanal, o da semana. Digitar o valor mensal num contrato semanal multiplica a conta por quatro.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Informe a data de retirada e a devolução prevista.",
          esperado:
            "A retirada é o marco de onde o custo começa a contar. Sem ela não há períodos decorridos, e não há custo estimado.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Leia a tabela “Itens locados”.",
          esperado:
            "Item, quantidade, valor por período, retirada, devolução prevista, saldo, custo estimado e status. O custo é quantidade × valor por período × períodos decorridos.",
        },
      ],
      atencao: [
        "A data de retirada também é carimbada automaticamente quando um recebimento é fechado. Se você vai conferir a entrega em Recebimentos, deixe que o fechamento preencha a retirada — assim a data é a da conferência, não a do palpite.",
      ],
    },
    {
      id: "contrato-devolucao",
      titulo: "Registrar devolução ao fornecedor",
      resumo:
        "Parcial, até zerar o saldo. Cada devolução congela o custo da parcela devolvida.",
      rotas: ["/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/[id]",
          acao: "Na linha do item locado, use a coluna Devolver: confira a quantidade e a data.",
          esperado:
            "A quantidade vem preenchida com o saldo inteiro e aceita menos. A data vem com hoje e aceita a data real da devolução.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Clique em Devolver.",
          esperado:
            "O saldo da linha diminui. O custo estimado daquela parcela para de crescer: ele é calculado até a DATA da devolução.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Devolva o resto em outra data e veja o histórico.",
          esperado:
            "O bloco “Histórico de devoluções” mostra data, item, quantidade devolvida e o relatório fotográfico. Cada parcela tem o seu período de cobrança.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Repare no que o botão de devolver oferece depois de registrar.",
          esperado:
            "Ele abre o relatório fotográfico para anexar as fotos da devolução — a prova de como o equipamento voltou.",
        },
      ],
      atencao: [
        "A data da devolução é o que para o relógio da cobrança. Registrar dias depois com a data de hoje faz o contrato cobrar dias em que o equipamento já estava com a locadora.",
        "Saldo zerado é o que encerra a cobrança de um item. Item com saldo em aberto continua acumulando custo, mesmo que ninguém esteja usando.",
      ],
    },
    {
      id: "contrato-docs",
      titulo: "Documentos, PDF e o histórico do contrato",
      resumo:
        "Onde fica o contrato assinado, o PDF que o Loca gera e quem mexeu no quê.",
      rotas: ["/contratos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/contratos/[id]",
          acao: "No bloco de documentos, anexe o contrato assinado da locadora.",
          esperado:
            "O arquivo fica guardado junto do contrato. É o que se procura quando alguém questiona uma cláusula ou um valor.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Clique em “Gerar contrato (PDF)”.",
          esperado:
            "Abre em outra aba o documento que o Loca monta com os dados do contrato e os itens locados. É diferente do arquivo anexado, que é o papel da locadora.",
        },
        {
          onde: "/contratos/[id]",
          acao: "Vá ao fim da página e leia a linha do tempo de atividade.",
          esperado:
            "Mostra o que mudou no contrato e quem mudou. É por ali que se responde “quem alterou esse valor?” sem depender da memória de ninguém.",
        },
      ],
    },
  ],
  perguntas: [
    {
      id: "con-prorata",
      enunciado:
        "Contrato semanal, SEM pró-rata. Um item ficou 8 dias na obra. Quantas semanas são cobradas?",
      alternativas: [
        "Uma semana e um dia",
        "Duas semanas",
        "Uma semana",
        "Depende do valor do item",
      ],
      correta: 1,
      porque:
        "Sem pró-rata o sistema arredonda para cima: 8 dias não cabem em uma semana, então são duas. É assim que a maioria das locadoras cobra, e por isso é o padrão. Com pró-rata marcado, os mesmos 8 dias sairiam proporcionais — cerca de 1,14 semana.",
      aula: "contrato-cadencia",
    },
    {
      id: "con-valor-periodo",
      enunciado:
        "O contrato é semanal e a locadora cobra R$ 400 por mês pela betoneira. O que se digita em “Valor unit. / período”?",
      alternativas: [
        "400, que é o valor da locadora",
        "O valor correspondente a UMA SEMANA, porque o período do contrato é semanal",
        "400 dividido por 30",
        "O valor total do contrato",
      ],
      correta: 1,
      porque:
        "O campo é o valor de um item por um período da cadência escolhida. Digitar o valor mensal num contrato semanal multiplica a conta por cerca de quatro — e o erro não parece erro na tela: sai como um custo estimado plausível, que sobe para o orçamento da obra e para o painel da diretoria.",
      aula: "contrato-itens",
    },
    {
      id: "con-retirada",
      enunciado:
        "Um item locado está sem data de retirada. Qual é o efeito no custo estimado?",
      alternativas: [
        "O custo é calculado a partir da data de início do contrato",
        "O custo é calculado a partir de hoje",
        "Não há períodos decorridos, então não há custo estimado para a linha",
        "O sistema recusa o cadastro do item",
      ],
      correta: 2,
      porque:
        "A retirada é o marco de onde o relógio da cobrança começa. Sem ela não há períodos decorridos a multiplicar. Fechar um recebimento carimba essa data automaticamente — é o caminho preferível, porque aí a data é a da conferência da entrega, e não um palpite.",
      aula: "contrato-itens",
    },
    {
      id: "con-devolucao-data",
      enunciado:
        "O equipamento voltou para a locadora na terça, e você só foi registrar na sexta. Qual data usar?",
      alternativas: [
        "A de sexta, que é quando o registro foi feito",
        "A de terça, que é quando o equipamento realmente voltou",
        "Tanto faz: o custo é calculado por mês",
        "A do fim previsto do contrato",
      ],
      correta: 1,
      porque:
        "A data da devolução é o que para o relógio da cobrança daquela parcela. Registrar com a data de hoje faz o contrato cobrar três dias em que o equipamento já estava com a locadora — e essa diferença aparece como divergência quando a fatura chegar.",
      aula: "contrato-devolucao",
    },
    {
      id: "con-excluir",
      enunciado: "Um contrato de locação terminou. O que fazer com ele?",
      alternativas: [
        "Excluir, para limpar a lista",
        "Mudar o status para Encerrado",
        "Zerar os valores dos itens",
        "Deixar como está: contrato não tem encerramento",
      ],
      correta: 1,
      porque:
        "Encerrado é o status para contrato que cumpriu seu ciclo — ele sai do trabalho do dia a dia e continua nos relatórios e no custo da obra. Excluir é do master, faz o contrato desaparecer das listas E dos relatórios, e existe para erro de cadastro, não para fim de contrato.",
      aula: "contrato-novo",
    },
  ],
};
