// Trilha dos imóveis e alojamentos.
//
// É o módulo mais largo do Loca: um imóvel carrega contratos, contas de
// consumo, reparos, vistorias, ocupantes, entregas de chave e kit, medidas
// disciplinares e checklist de limpeza. A trilha não tenta cobrir cada campo —
// ela ensina a ESTRUTURA (o que pendura em quê) e insiste nos três pontos que
// custam dinheiro quando passam batido: o total mensal, o reajuste e a caução.

import type { Trilha } from "./tipos";

export const IMOVEIS: Trilha = {
  chave: "imoveis",
  titulo: "Imóveis e alojamentos",
  resumo:
    "Cadastrar imóvel e contrato, acompanhar consumo e reparos, controlar ocupantes e o que foi entregue a cada alojado.",
  modulo: "imoveis",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "imovel-lista",
      titulo: "A lista de imóveis",
      resumo:
        "Kitnets, apartamentos, casas, galpões e escritórios — com o custo mensal à vista.",
      rotas: ["/imoveis"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/imoveis",
          acao: "Abra Imóveis e leia os dois indicadores do topo.",
          esperado:
            "Quantos imóveis estão no filtro e quanto custa por mês o conjunto deles. O segundo número muda com o filtro — é assim que se responde “quanto a gente gasta de moradia nessa obra?”.",
        },
        {
          onde: "/imoveis",
          acao: "Use os filtros de tipo, status e obra.",
          esperado:
            "O filtro de status vem por padrão em “Ativos e em desocupação”, ou seja, encerrado não aparece a menos que você peça.",
        },
        {
          onde: "/imoveis",
          acao: "Leia a coluna “Aluguel + cond.”.",
          esperado:
            "É o custo mensal do contrato vigente daquele imóvel. Imóvel sem contrato vigente aparece sem valor — e isso é uma pendência, não um imóvel de graça.",
        },
      ],
      atencao: [
        "Status “Em desocupação” é o imóvel que a empresa está devolvendo, e ele continua custando até a entrega das chaves. Por isso ele aparece junto com os ativos.",
        "Cadastrar e editar imóvel é de operador, administrador e master.",
      ],
    },
    {
      id: "imovel-contrato",
      titulo: "O contrato do imóvel: o total mensal é uma soma",
      resumo:
        "Aluguel, condomínio, IPTU e seguro fiança. Três somam sempre; o quarto depende de uma marcação.",
      rotas: ["/imoveis/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/imoveis/[id]",
          acao: "No bloco Contratos, cadastre o contrato do imóvel com os valores.",
          esperado:
            "Aluguel, condomínio, IPTU, seguro fiança, dia de vencimento, índice e data de reajuste, caução.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Leia o campo “Total/mês”.",
          esperado:
            "É a soma de aluguel + condomínio + IPTU, mais o seguro fiança SOMENTE quando ele for mensal. Quando não é, o campo do seguro aparece marcado com “(não somado)”.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Confira o índice e a data de reajuste.",
          esperado:
            "Ficam à vista no contrato. É o que permite saber quando o aluguel vai subir — antes de o boleto chegar diferente.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Anexe o contrato assinado e o comprovante da caução.",
          esperado:
            "Os dois arquivos ficam guardados no contrato. O comprovante da caução é o documento que a empresa vai precisar no dia de pedir o dinheiro de volta.",
        },
      ],
      atencao: [
        "A caução tem situação própria: em aberto, devolvida ou retida. Caução em aberto de imóvel já entregue é dinheiro da empresa parado na mão do proprietário — e ninguém devolve por iniciativa própria.",
        "Renovação é um contrato NOVO no mesmo imóvel, não a edição do antigo. Assim o histórico mostra qual valor valia em cada período.",
      ],
    },
    {
      id: "imovel-consumo-reparos",
      titulo: "Consumo e reparos: o custo que não está no aluguel",
      resumo:
        "Água, luz, gás e internet mês a mês; e o que foi consertado, por quem e por quanto.",
      rotas: ["/imoveis/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/imoveis/[id]",
          acao: "No bloco de consumo, lance as contas do mês.",
          esperado:
            "Água, luz, gás, internet, IPTU — mês a mês, por imóvel. É o que mostra o alojamento que gasta o dobro do vizinho.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "No bloco Reparos, registre o que foi consertado com custo e executor.",
          esperado:
            "O bloco mostra o total gasto em reparos naquele imóvel. Reparo recorrente no mesmo item é argumento de negociação com o proprietário.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Use o bloco de vistorias do imóvel na entrada e na saída.",
          esperado:
            "Mesma lógica da vistoria de equipamento: é a prova do estado. Na devolução do imóvel, é o que separa desgaste de uso de dano a pagar.",
        },
      ],
      atencao: [
        "O consumo pode ser lançado direto no financeiro a partir daqui. Lançar nos dois lugares gera conta em dobro — escolha um caminho e mantenha.",
        "Vistoria de entrada do imóvel é como a do equipamento: é a que ninguém faz e a que decide a discussão na saída, quando o proprietário aponta um dano na parede.",
      ],
    },
    {
      id: "imovel-ocupantes",
      titulo: "Quem mora ali, e o que foi entregue a essa pessoa",
      resumo:
        "Ocupantes, chaves e kit de alojamento — a base dos formulários de RH.",
      rotas: ["/imoveis/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/imoveis/[id]",
          acao: "No bloco Ocupantes, cadastre quem está morando no imóvel.",
          esperado:
            "Vale para kitnet, casa e apartamento. É a base do termo de responsabilidade do alojado.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "No bloco “Entregas ao alojado”, registre a entrega de chaves e do kit.",
          esperado:
            "São os formulários FRM-RH-003 (chaves) e FRM-RH-004 (kit de alojamento). Fica registrado o que foi entregue e a quem.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Use o bloco de medidas disciplinares quando houver ocorrência.",
          esperado:
            "Avarias, desentendimentos e reparos causados pelo ocupante ficam registrados ali, ligados à pessoa e ao imóvel.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Veja o checklist de limpeza do alojamento.",
          esperado:
            "É o FRM-RH-005, semanal. A folha é impressa e marcada à mão; aqui fica o registro de que ela foi feita.",
        },
      ],
      atencao: [
        "Sem registro de entrega, a discussão sobre uma chave perdida ou um kit incompleto é palavra contra palavra — exatamente como no equipamento sem termo.",
      ],
    },
    {
      id: "imovel-excluir",
      titulo: "Encerrar, não excluir",
      resumo:
        "Excluir imóvel apaga os contratos dele. É quase nunca o que se quer.",
      rotas: ["/imoveis/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/imoveis/[id]",
          acao: "Quando a empresa devolve o imóvel, mude o status para Em desocupação e depois Encerrado.",
          esperado:
            "O imóvel sai da lista padrão e continua no histórico, com todos os contratos, consumos e reparos que explicam o que foi gasto ali.",
        },
        {
          onde: "/imoveis/[id]",
          acao: "Leia o aviso do botão de excluir, sem clicar.",
          esperado:
            "Ele diz: “Excluir este imóvel e todos os seus contratos? Esta ação não pode ser desfeita.” Não é remoção da lista — é o histórico financeiro do imóvel indo embora.",
        },
      ],
      atencao: [
        "Antes de encerrar, resolva a caução. Imóvel encerrado com caução em aberto sai da lista de trabalho levando consigo o lembrete de cobrar o dinheiro.",
      ],
    },
  ],
  perguntas: [
    {
      id: "imo-total-mes",
      enunciado:
        "O contrato tem aluguel de R$ 1.200, condomínio de R$ 300, IPTU de R$ 100 e seguro fiança de R$ 500 marcado como NÃO mensal. Qual é o total por mês?",
      alternativas: [
        "R$ 2.100",
        "R$ 1.200",
        "R$ 1.600",
        "R$ 1.500",
      ],
      correta: 2,
      porque:
        "Aluguel + condomínio + IPTU = R$ 1.600. O seguro fiança só entra na soma quando é mensal; quando não é, a tela mostra o valor marcado com “(não somado)”. Somar um seguro anual como se fosse mensal infla o custo do alojamento em todos os relatórios de imóveis.",
      aula: "imovel-contrato",
    },
    {
      id: "imo-caucao",
      enunciado:
        "A empresa devolveu um imóvel e a caução aparece com situação “em aberto”. O que isso significa?",
      alternativas: [
        "Que a caução ainda não foi paga ao proprietário",
        "Que o dinheiro da caução ainda está com o proprietário e não foi devolvido à empresa",
        "Que o valor da caução ainda não foi definido",
        "Que a caução foi retida por causa de avarias",
      ],
      correta: 1,
      porque:
        "As três situações são em aberto, devolvida e retida. Em aberto num imóvel já entregue é dinheiro da empresa parado na mão do proprietário — e ninguém devolve caução por iniciativa própria. É por isso que a caução deve ser resolvida ANTES de encerrar o imóvel: encerrado, ele sai da lista de trabalho levando o lembrete com ele.",
      aula: "imovel-contrato",
    },
    {
      id: "imo-renovacao",
      enunciado:
        "O contrato de aluguel foi renovado com valor novo. O que fazer no sistema?",
      alternativas: [
        "Editar o contrato existente e trocar o valor",
        "Excluir o antigo e cadastrar o novo",
        "Registrar a diferença como reparo",
        "Cadastrar um contrato novo para o mesmo imóvel",
      ],
      correta: 3,
      porque:
        "Renovação é contrato novo no mesmo imóvel. Editar o antigo reescreve o passado: os meses já pagos passam a constar com o valor de hoje, e nenhum relatório de custo por período volta a fazer sentido. Com dois contratos, o histórico mostra qual valor valia em cada época.",
      aula: "imovel-contrato",
    },
    {
      id: "imo-excluir",
      enunciado:
        "A empresa não usa mais um alojamento. Qual é o caminho certo, e por quê?",
      alternativas: [
        "Mudar o status para Encerrado, preservando contratos, consumos e reparos",
        "Excluir o imóvel, porque não será mais usado",
        "Apagar os contratos e manter o imóvel",
        "Deixar como Ativo para não perder nada",
      ],
      correta: 0,
      porque:
        "O botão de excluir avisa que apaga o imóvel E todos os contratos dele, sem volta — isso não é tirar da lista, é apagar o histórico financeiro do que foi gasto ali. Encerrado tira do trabalho do dia a dia e mantém tudo o que explica o passado.",
      aula: "imovel-excluir",
    },
  ],
};
