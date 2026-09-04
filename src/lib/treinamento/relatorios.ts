// Trilha dos relatórios.
//
// A trilha mais curta que fecha o conjunto, e a única cujo conteúdo é sobre
// LER, não sobre operar. Ela tem uma tarefa: fazer a pessoa entender que o
// relatório é a foto do que foi lançado — então um número estranho no
// relatório quase sempre é lançamento faltando, não erro de cálculo.

import type { Trilha } from "./tipos";

export const RELATORIOS: Trilha = {
  chave: "relatorios",
  titulo: "Relatórios e exportação",
  resumo:
    "Escolher o relatório certo, filtrar, exportar em PDF ou Excel e saber o que um número estranho está dizendo.",
  modulo: "relatorios",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "rel-escolher",
      titulo: "Escolher o relatório certo",
      resumo:
        "São doze, agrupados por assunto. A escolha do tipo muda as colunas e os filtros que fazem sentido.",
      rotas: ["/relatorios"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/relatorios",
          acao: "Abra Relatórios e percorra o seletor de tipo.",
          esperado:
            "Doze relatórios: itens em aberto, contas a pagar, custo por obra, custo por fornecedor, ociosidade, avarias — e cinco de imóveis (custo mensal, contratos a vencer, sem contrato, consumo, reparos) mais caução.",
        },
        {
          onde: "/relatorios",
          acao: "Troque o tipo e repare que as colunas da tabela mudam.",
          esperado:
            "Cada relatório tem suas próprias colunas e seu próprio formato de valor. Não é a mesma tabela filtrada de jeitos diferentes.",
        },
        {
          onde: "/relatorios",
          acao: "Repare que alguns relatórios ignoram o período.",
          esperado:
            "“Itens em aberto” e “Ociosidade” são retratos de AGORA — não faz sentido pedir o período deles. “Contas a pagar” e “Avarias” usam o período.",
        },
      ],
      atencao: [
        "“Ociosidade” é o relatório que ninguém pede e que mais paga a conta: ele lista item ainda em aberto atrasado ou sem previsão de devolução — equipamento parado gerando custo. Vale rodar toda semana.",
      ],
    },
    {
      id: "rel-filtrar",
      titulo: "Os filtros, e por que aqui existe um botão",
      resumo:
        "Seis controles que valem juntos. É a única tela do sistema em que o filtro não aplica sozinho.",
      rotas: ["/relatorios"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/relatorios",
          acao: "Escolha tipo, obra, fornecedor, status e o período, e clique em Gerar.",
          esperado:
            "O relatório é montado com os seis filtros valendo ao mesmo tempo. Nas outras listas do sistema o filtro aplica na hora; aqui há botão.",
        },
        {
          onde: "/relatorios",
          acao: "Entenda por que: são seis controles que precisam valer juntos.",
          esperado:
            "Aplicar um por um refaria o relatório seis vezes — seis consultas para chegar ao mesmo lugar. O botão é a exceção justificada.",
        },
        {
          onde: "/relatorios",
          acao: "Guarde o endereço da página depois de gerar.",
          esperado:
            "Os filtros ficam no endereço. Dá para salvar nos favoritos o relatório que você roda toda semana, já filtrado.",
        },
      ],
    },
    {
      id: "rel-exportar",
      titulo: "Exportar em PDF ou Excel",
      resumo: "Dois formatos, dois usos. Escolher errado dá retrabalho.",
      rotas: ["/relatorios"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/relatorios",
          acao: "Gere o relatório e clique em PDF.",
          esperado:
            "Abre o documento pronto para imprimir ou anexar em e-mail, com os filtros aplicados registrados nele.",
        },
        {
          onde: "/relatorios",
          acao: "Agora exporte em Excel.",
          esperado:
            "Baixa a planilha com as mesmas linhas. É o formato para quem vai continuar a conta — somar, cruzar, montar gráfico.",
        },
      ],
      atencao: [
        "A exportação leva os filtros que estão na tela. Exportar antes de clicar em Gerar exporta o que está sendo exibido, que pode não ser o que você acabou de escolher nos seletores.",
      ],
    },
    {
      id: "rel-numero-estranho",
      titulo: "Quando o número parece errado",
      resumo:
        "O relatório é a foto do que foi lançado. Número estranho quase sempre é lançamento faltando.",
      rotas: ["/relatorios", "/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/relatorios",
          acao: "Custo por obra muito abaixo do esperado? Confira os lançamentos sem contrato.",
          esperado:
            "Lançamento sem contrato vinculado não entra no realizado da obra. A ficha da obra mostra quanto está nessa situação.",
        },
        {
          onde: "/relatorios",
          acao: "Itens em aberto com custo maior que o esperado? Confira as devoluções.",
          esperado:
            "Item com saldo em aberto continua acumulando custo. Devolução registrada dias depois, com a data de hoje, cobra dias em que o equipamento já estava com a locadora.",
        },
        {
          onde: "/relatorios",
          acao: "Custo de equipamento ausente? Confira os recebimentos em rascunho.",
          esperado:
            "Recebimento não fechado não carimba a data de retirada, e sem retirada não há períodos decorridos — o custo daquele item simplesmente não existe ainda.",
        },
      ],
      atencao: [
        "O relatório não calcula errado: ele mostra o que existe. As três causas mais comuns de número estranho são lançamento sem contrato, devolução com data errada e recebimento em rascunho — e as três se resolvem na tela de origem, não aqui.",
      ],
    },
  ],
  perguntas: [
    {
      id: "rel-botao",
      enunciado:
        "Por que a tela de Relatórios tem um botão “Gerar”, se todas as outras listas filtram ao vivo?",
      alternativas: [
        "Porque o relatório é mais lento de calcular",
        "Porque são seis filtros que precisam valer juntos, e aplicar um por um refaria o relatório seis vezes",
        "Porque a exportação exige confirmação",
        "Porque só master pode gerar relatório",
      ],
      correta: 1,
      porque:
        "Nas listas comuns o filtro aplica na hora porque é um controle por vez. Aqui são seis — tipo, obra, fornecedor, status e as duas datas — e eles descrevem UMA pergunta. Aplicar cada um separadamente disparariam seis navegações, cada uma remontando o relatório inteiro.",
      aula: "rel-filtrar",
    },
    {
      id: "rel-periodo",
      enunciado:
        "Você escolheu “Itens em aberto” e preencheu o período. Por que o período não muda o resultado?",
      alternativas: [
        "Porque o relatório sempre usa o mês corrente",
        "Porque falta clicar em Gerar",
        "Porque “Itens em aberto” é um retrato de agora: são os itens ainda não devolvidos hoje",
        "Porque o período só vale para a exportação em Excel",
      ],
      correta: 2,
      porque:
        "Alguns relatórios são fotos do presente — itens em aberto e ociosidade dizem o que está pendurado AGORA. Outros são de período, como contas a pagar e avarias. Esperar que o período recorte um retrato do presente leva à conclusão errada de que o filtro está quebrado.",
      aula: "rel-escolher",
    },
    {
      id: "rel-custo-baixo",
      enunciado:
        "O relatório de custo por obra mostra um valor muito abaixo do que a obra realmente gastou. Qual é a primeira coisa a conferir?",
      alternativas: [
        "Se o período do relatório está certo e se há lançamentos sem contrato vinculado",
        "Se o orçamento da obra foi cadastrado",
        "Se o avanço físico foi lançado",
        "Se o relatório foi exportado em Excel",
      ],
      correta: 0,
      porque:
        "O relatório mostra o que existe: ou o período recorta menos do que você quer, ou há dinheiro lançado sem vínculo a contrato — e lançamento sem contrato não entra no realizado da obra. As outras duas causas frequentes são devolução com data errada e recebimento em rascunho, que não carimbou a retirada.",
      aula: "rel-numero-estranho",
    },
    {
      id: "rel-ociosidade",
      enunciado: "O que o relatório de Ociosidade mostra?",
      alternativas: [
        "Equipamentos que nunca foram alugados",
        "Horas paradas de cada máquina",
        "Itens ainda em aberto, atrasados ou sem previsão de devolução",
        "Obras sem lançamento de avanço",
      ],
      correta: 2,
      porque:
        "É a lista do equipamento locado que ninguém devolveu e que continua gerando custo — atrasado em relação à previsão, ou sem previsão nenhuma. É o relatório que mais se paga e o que menos se pede: cada linha dele é dinheiro saindo por equipamento que talvez ninguém esteja usando.",
      aula: "rel-escolher",
    },
  ],
};
