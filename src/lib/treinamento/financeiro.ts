// Trilha do financeiro — contas a pagar das locações.
//
// O ponto que a trilha existe para ensinar não é como lançar: é o que faz um
// lançamento CONTAR no orçamento da obra. Lançamento sem contrato vinculado
// aparece no financeiro, sai no relatório e NÃO entra no realizado da obra —
// então a obra parece mais barata do que é, e o painel da diretoria mostra
// consumo menor do que o dinheiro que saiu.

import type { Trilha } from "./tipos";

export const FINANCEIRO: Trilha = {
  chave: "financeiro",
  titulo: "Financeiro: contas a pagar",
  resumo:
    "Lançar contas, dar baixa com multa e juros, ratear por item e ler o fluxo de caixa.",
  modulo: "financeiro",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "fin-lancar",
      titulo: "Lançar uma conta, e o campo que decide se ela conta",
      resumo:
        "Obra, contrato, competência e vencimento. O contrato é o que amarra a conta ao orçamento.",
      rotas: ["/financeiro/novo", "/financeiro/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/financeiro/novo",
          acao: "Escolha a obra e, sempre que existir, o CONTRATO.",
          esperado:
            "O contrato é opcional no formulário e decisivo no resultado: é ele que faz a conta entrar no realizado do orçamento daquela obra.",
        },
        {
          onde: "/financeiro/novo",
          acao: "Escreva a descrição com mês e objeto (“Locação betoneira — julho”).",
          esperado:
            "É por ela que se busca depois. Descrição genérica como “locação” em vinte lançamentos torna a busca inútil.",
        },
        {
          onde: "/financeiro/novo",
          acao: "Preencha competência, valor e vencimento, e salve.",
          esperado:
            "A conta entra na lista com status Pendente. Competência é o mês a que a despesa se refere; vencimento é o dia de pagar — e os dois quase nunca são o mesmo mês.",
        },
        {
          onde: "/financeiro",
          acao: "Leia os três indicadores do topo.",
          esperado:
            "A pagar (pendente), Vencido e Pago. Vencido é o que já passou da data e ninguém baixou — é a leitura que abre o dia.",
        },
      ],
      atencao: [
        "Lançar, editar e dar baixa é de master e administrador. Excluir lançamento é SÓ do master — se você é administrador, o botão aparece e a recusa explica isso dentro do próprio diálogo.",
        "Competência e vencimento têm funções diferentes: a competência governa o fechamento mensal da obra; o vencimento governa o fluxo de caixa. Trocar as duas desloca a despesa de mês nos dois relatórios.",
      ],
    },
    {
      id: "fin-contrato-vinculo",
      titulo: "Por que vincular a conta ao contrato",
      resumo:
        "É o que separa uma despesa que aparece no orçamento da obra de uma que não aparece.",
      rotas: ["/financeiro/[id]", "/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/[id]",
          acao: "Na ficha da obra, procure a linha sobre lançamentos sem contrato.",
          esperado:
            "Quando existem, ela diz quanto foi lançado na obra SEM vínculo a contrato — e avisa que esse valor não entra no realizado.",
        },
        {
          onde: "/financeiro/[id]",
          acao: "Abra um desses lançamentos e vincule-o ao contrato correto.",
          esperado:
            "Salva. Na ficha da obra, o realizado e o percentual consumido sobem, e a projeção final passa a considerar o dinheiro que já havia saído.",
        },
      ],
      atencao: [
        "Uma conta sem contrato não é conta perdida: ela está no financeiro, no fluxo de caixa e nos relatórios. O que ela não faz é aparecer no orçamento da obra — que é justamente onde a diretoria olha.",
        "Se a despesa realmente não pertence a contrato nenhum (uma taxa, um frete avulso), deixar sem vínculo é correto. O aviso na obra existe para você DECIDIR, não para zerar.",
      ],
    },
    {
      id: "fin-baixa",
      titulo: "Dar baixa: multa e juros são sugestão, não imposição",
      resumo:
        "O sistema calcula 2% de multa e 1% ao mês de juros pelos dias de atraso, e deixa você editar.",
      rotas: ["/financeiro/[id]/baixa"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/financeiro/[id]/baixa",
          acao: "Abra a baixa de uma conta vencida.",
          esperado:
            "A tela mostra quantos dias de atraso há e sugere multa e juros: 2% sobre o valor, mais 1% ao mês proporcional aos dias.",
        },
        {
          onde: "/financeiro/[id]/baixa",
          acao: "Clique para aplicar a sugestão — ou digite os valores que a locadora realmente cobrou.",
          esperado:
            "Os campos de multa e juros aceitam edição. O que vale é o boleto que chegou, não o cálculo do sistema.",
        },
        {
          onde: "/financeiro/[id]/baixa",
          acao: "Informe o valor pago e confirme a baixa.",
          esperado:
            "O lançamento passa a Pago e sai do indicador de vencido. O valor pago pode diferir do original — é a soma com multa e juros.",
        },
        {
          onde: "/financeiro",
          acao: "Precisa desfazer? Use Reabrir na linha do lançamento pago.",
          esperado:
            "A conta volta para pendente. Diferente do razão de estoque, aqui a baixa é reversível.",
        },
      ],
      atencao: [
        "A sugestão de encargos usa 2% de multa e 1% ao mês, que é a praxe. Contrato com cláusula diferente exige digitar os valores à mão — o sistema não conhece a cláusula.",
      ],
    },
    {
      id: "fin-rateio",
      titulo: "Ratear por item",
      resumo:
        "Distribuir o valor de uma conta entre as linhas do contrato — é o que alimenta o custo por item da obra.",
      rotas: ["/financeiro/[id]/rateio"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/financeiro",
          acao: "Na linha do lançamento, use “Ratear por item”.",
          esperado:
            "Abre a tela de rateio com os itens do contrato vinculado, para atribuir quanto daquela conta pertence a cada um.",
        },
        {
          onde: "/financeiro/[id]/rateio",
          acao: "Tente ratear um lançamento SEM contrato vinculado.",
          esperado:
            "A tela explica que o rateio distribui o custo entre as linhas de um contrato, e oferece o caminho para vincular o lançamento primeiro.",
        },
        {
          onde: "/obras/[id]",
          acao: "Depois de ratear, veja o bloco Custo por item da obra.",
          esperado:
            "Ele compara o orçado de cada item com o que já foi atribuído a ele, do maior desvio para o menor. Sem rateio, esse bloco fica sem o lado do realizado.",
        },
      ],
      atencao: [
        "Item que aparece no custo por item “sem orçamento próprio” não está dentro do orçamento — está sem orçamento. A tela diz isso porque as duas coisas se parecem e significam o contrário.",
      ],
    },
    {
      id: "fin-fluxo",
      titulo: "Fluxo de caixa e contas recorrentes",
      resumo:
        "A projeção de desembolso por mês, e como gerar as contas de aluguel sem digitar doze vezes.",
      rotas: ["/financeiro/fluxo", "/financeiro/recorrentes"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/financeiro/fluxo",
          acao: "Abra Fluxo de caixa.",
          esperado:
            "Total previsto no horizonte e os próximos 3 meses, com barras de desembolso mês a mês. A projeção soma lançamentos com contratos de equipamento e de imóveis.",
        },
        {
          onde: "/financeiro/fluxo",
          acao: "Leia a tabela por mês.",
          esperado:
            "Pago, Pendente e Projetado por mês. Projetado é o que ainda não virou lançamento: vem dos contratos vigentes.",
        },
        {
          onde: "/financeiro/recorrentes",
          acao: "Abra “Gerar contas a pagar recorrentes”.",
          esperado:
            "Lista os contratos de imóvel vigentes e os contratos de locação ativos, e gera uma conta por mês para dar baixa individual. Não duplica meses já gerados.",
        },
      ],
      atencao: [
        "O fluxo mistura o que já foi lançado com o que é projeção de contrato. Contrato encerrado que ficou como ativo continua projetando desembolso que não vai acontecer — o status do contrato mexe no fluxo.",
      ],
    },
  ],
  perguntas: [
    {
      id: "fin-vinculo",
      enunciado:
        "Uma conta de R$ 5.000 foi lançada na obra, mas sem contrato vinculado. O que acontece com ela?",
      alternativas: [
        "Ela é recusada até que um contrato seja escolhido",
        "Ela aparece no financeiro e no fluxo, mas NÃO entra no realizado do orçamento da obra",
        "Ela entra no orçamento como valor não previsto",
        "Ela é rateada automaticamente entre os contratos da obra",
      ],
      correta: 1,
      porque:
        "O vínculo com o contrato é o que faz a despesa contar no realizado da obra. Sem ele, o dinheiro saiu e o orçamento não sabe — a obra parece mais barata do que é. A ficha da obra avisa quanto está nessa situação, justamente para você decidir: às vezes deixar sem vínculo é correto (uma taxa, um frete avulso).",
      aula: "fin-contrato-vinculo",
    },
    {
      id: "fin-competencia",
      enunciado:
        "A locação de julho vence em 10 de agosto. Qual é a competência e qual é o vencimento?",
      alternativas: [
        "Competência agosto, vencimento agosto",
        "Competência julho, vencimento agosto",
        "Competência julho, vencimento julho",
        "Tanto faz: os dois campos são equivalentes",
      ],
      correta: 1,
      porque:
        "Competência é o mês a que a despesa se refere; vencimento é o dia de pagar. A competência governa o fechamento mensal da obra, e o vencimento governa o fluxo de caixa. Preencher os dois com agosto joga a despesa de julho para o mês seguinte no fechamento da obra.",
      aula: "fin-lancar",
    },
    {
      id: "fin-encargos",
      enunciado:
        "Você vai dar baixa numa conta atrasada e o sistema sugere multa e juros. Pode confiar?",
      alternativas: [
        "Sim: o valor é calculado pelo contrato",
        "Sim, e os campos não podem ser alterados",
        "É sugestão pela praxe (2% de multa, 1% ao mês) — o que vale é o que a locadora cobrou, e os campos aceitam edição",
        "Não: multa e juros devem ser lançados como conta separada",
      ],
      correta: 2,
      porque:
        "O sistema não conhece a cláusula do contrato: ele aplica a praxe sobre os dias de atraso e oferece o número. Contrato com multa ou juros diferentes exige digitar o valor real. Aceitar a sugestão sem conferir o boleto é registrar um pagamento que não foi o que aconteceu.",
      aula: "fin-baixa",
    },
    {
      id: "fin-rateio",
      enunciado: "Para que serve ratear um lançamento por item?",
      alternativas: [
        "Para dividir o pagamento em parcelas",
        "Para dividir a conta entre várias obras",
        "Para atribuir quanto daquela conta pertence a cada item do contrato, alimentando o custo por item da obra",
        "Para gerar as contas recorrentes dos próximos meses",
      ],
      correta: 2,
      porque:
        "O rateio distribui o valor entre as linhas do contrato, e é o que dá o lado “realizado” do bloco Custo por item da obra — a comparação entre o que se orçou para cada equipamento e o que ele custou de fato. Sem rateio, o bloco só tem o lado orçado. E rateio exige contrato vinculado: sem ele não há linhas para receber o custo.",
      aula: "fin-rateio",
    },
    {
      id: "fin-fluxo",
      enunciado:
        "No fluxo de caixa, um mês mostra R$ 30.000 em “Projetado”. O que é esse valor?",
      alternativas: [
        "Contas já lançadas e ainda não pagas",
        "Desembolso que vem dos contratos vigentes e ainda não virou lançamento",
        "A média dos meses anteriores",
        "O total já pago naquele mês",
      ],
      correta: 1,
      porque:
        "Pago e Pendente vêm de lançamentos que existem; Projetado é o que os contratos de equipamento e de imóveis ainda vão gerar. Por isso o status do contrato mexe no fluxo: contrato encerrado que ficou marcado como ativo continua projetando desembolso que não vai acontecer.",
      aula: "fin-fluxo",
    },
  ],
};
