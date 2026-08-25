// Trilha 0 — Fundação. Todos fazem antes das outras duas.
//
// São os quatro módulos compartilhados (obras, fornecedores, financeiro,
// relatórios) mais o que vale para o sistema inteiro: o que o Loca é, como se
// entra nele, e quem pode o quê. Repetidos dentro das outras duas trilhas,
// seriam duas versões da mesma verdade e divergiriam na primeira correção.
//
// Nenhum fato aqui foi escrito de memória. As fontes, módulo por módulo, estão
// em docs/superpowers/plans/2026-08-25-treinamento-interativo.md.

import type { Modulo, Trilha } from "./tipos";

const modulos: Modulo[] = [
  {
    id: "visao-geral",
    numero: 1,
    titulo: "O que o Loca resolve — e o que ele não é",
    perfis: ["master", "administrador", "gestor", "operador"],
    problema:
      "O Loca controla o que a Sistenge ALUGA de terceiros: equipamentos, materiais e imóveis. A perspectiva é de locatária — o sistema cuida do custo que a empresa paga, nunca do que ela cobra de cliente. Ele existe para matar duas dores: pagar por equipamento parado, e aceitar cobrança de avaria sem ter prova do estado em que o item chegou.",
    caminho: [
      "Toda informação pertence a uma OBRA, que é o centro de custo. É por isso que quase toda tela tem um filtro de obra no topo.",
      "De quem se aluga é o FORNECEDOR — locadora de equipamento ou proprietário de imóvel.",
      "O que se aluga entra pelo CATÁLOGO DE ITENS, para equipamento e material, ou pelo cadastro de IMÓVEIS.",
      "O acordo com o fornecedor é o CONTRATO, que tem obra, cadência de cobrança e itens.",
      "O estado do que entra e do que sai é registrado em VISTORIA, com foto.",
      "O que se paga vira LANÇAMENTO no financeiro, com competência, vencimento e baixa.",
      "Todo registro do sistema tem número próprio: CTR-2026-0007 para contrato, REC para recebimento, VIS para vistoria, AVA para avaria.",
    ],
    exemplo:
      "A obra Residencial Alto da Serra — Torre B vai alugar uma betoneira da Locadora Bandeirantes e um alojamento na Rua das Palmeiras, 412. Esses três nomes voltam em todos os dezoito módulos deste treinamento: é a mesma história, do início ao fim.",
    exercicios: [
      "Entre no Loca e abra a tela Início. Localize o filtro de obra no topo.",
      "Percorra o menu da esquerda e associe cada item a um dos conceitos acima.",
    ],
    perguntas: [
      {
        enunciado: "O Loca serve para controlar o quê?",
        alternativas: [
          "O que a Sistenge aluga de terceiros e paga por isso",
          "O que a Sistenge aluga para clientes e cobra por isso",
          "O estoque de material comprado pela Sistenge",
        ],
        correta: 0,
        comentario:
          "A Sistenge é a locatária. O Loca controla o custo pago a fornecedores e proprietários. Material comprado, que é da empresa, não entra aqui.",
      },
    ],
  },

  {
    id: "primeiro-acesso",
    numero: 2,
    titulo: "Primeiro acesso e instalação no celular",
    perfis: ["master", "administrador", "gestor", "operador"],
    problema:
      "A senha que chega por e-mail é temporária e serve uma vez só. E quem opera está na obra, com o celular na mão e sinal ruim — abrir o navegador e digitar endereço a cada consulta é atrito suficiente para a pessoa desistir e voltar ao papel.",
    caminho: [
      "Você recebe um e-mail com o endereço do sistema, seu login e uma senha temporária.",
      "Entre com esses dados. O Loca vai OBRIGAR a criar uma senha pessoal antes de deixar continuar — a temporária não serve de novo.",
      "Esqueceu a senha depois? Use o recuperar senha na tela de entrada, ou peça ao Master para redefinir.",
      "No celular, use Adicionar à tela inicial (ou Instalar aplicativo). O Loca passa a abrir em tela cheia, com ícone próprio.",
      "Sem sinal, o app mostra uma tela explicando em vez de dar erro. Quando a conexão volta, recarregue para continuar.",
    ],
    exemplo:
      "O mestre da Torre B instala o Loca no celular no primeiro dia. Da obra, ele registra a devolução de um andaime sem precisar passar no escritório.",
    exercicios: [
      "Troque sua senha e confirme que a temporária deixou de funcionar.",
      "Instale o Loca na tela inicial do seu celular.",
      "Ative o modo avião e abra o app: confirme que aparece a tela de sem conexão, não um erro.",
    ],
    perguntas: [
      {
        enunciado: "Para que serve a senha que chega por e-mail?",
        alternativas: [
          "Para o primeiro acesso apenas — o sistema exige criar uma nova",
          "É a sua senha definitiva",
          "Serve até você querer trocar",
        ],
        correta: 0,
        comentario:
          "É temporária de verdade: o Loca não deixa navegar antes de você criar uma senha pessoal. O mesmo vale quando o Master redefine sua senha.",
      },
    ],
  },

  {
    id: "perfis",
    numero: 3,
    titulo: "Perfis: quem pode o quê",
    perfis: ["master", "administrador"],
    problema:
      "Dar acesso total a todos parece simpático e cobra o preço depois: alguém apaga um contrato por engano, ou o encarregado de uma obra vê o custo de outra. E quando uma pessoa sai de uma obra, o acesso dela precisa sair também — senão continua vendo o que já não é dela.",
    caminho: [
      "São quatro perfis. Master faz tudo, incluindo criar usuários e excluir registros. Administrador faz tudo menos usuários e configuração de sistema.",
      "Gestor lê tudo e gera relatórios, e não edita nada. Operador opera contratos, devoluções e vistorias.",
      "Além do perfil, existe o ACESSO POR OBRA: vincule a pessoa às obras dela e o Loca esconde o resto — imóveis, contratos, financeiro e relatórios de outras obras simplesmente não aparecem.",
      "O Master ainda pode liberar ou bloquear MENUS por pessoa, em Usuários.",
      "Dado sensível sai mascarado: CPF, conta bancária e chave PIX aparecem como pontinhos, com botão de revelar.",
      "Exclusão é reversível. Obra, contrato, lançamento e imóvel excluídos podem ser recuperados, e o histórico fica.",
    ],
    diagrama: "matriz-perfis",
    exemplo:
      "Na Torre B, o mestre entra como Operador e vinculado só àquela obra: ele registra devolução e vistoria, e não vê o custo do Galpão Contorno Norte. O engenheiro entra como Gestor, vê tudo e não altera nada.",
    exercicios: [
      "Em Usuários, abra o seu próprio perfil e confira quais obras estão vinculadas a você.",
      "Peça ao Master para criar um usuário Gestor de teste e confirme que ele não consegue editar um contrato.",
    ],
    perguntas: [
      {
        enunciado:
          "Um Operador vinculado apenas à Torre B abre a tela de Relatórios. O que ele vê?",
        alternativas: [
          "Só os dados da Torre B",
          "Os dados de todas as obras, porque relatório é leitura",
          "Nada — Operador não acessa relatórios",
        ],
        correta: 0,
        comentario:
          "O acesso por obra vale em toda parte, inclusive em relatórios e no financeiro. Não é filtro de tela: o dado das outras obras não chega até ele.",
      },
      {
        enunciado: "Qual a diferença entre Gestor e Administrador?",
        alternativas: [
          "O Gestor lê e relata sem editar; o Administrador cadastra e opera",
          "O Gestor é acima do Administrador",
          "Nenhuma, são nomes diferentes para o mesmo acesso",
        ],
        correta: 0,
        comentario:
          "O Gestor é o perfil de quem analisa: enxerga tudo e não muda nada. É o certo para quem cobra resultado sem operar o sistema.",
      },
    ],
  },

  {
    id: "obras",
    numero: 4,
    titulo: "Obras — o centro de custo de tudo",
    perfis: ["master", "administrador"],
    problema:
      "Sem obra, nenhum custo tem dono. É a obra que responde à pergunta que a diretoria faz todo mês: quanto esta obra gastou de locação? Se um contrato entra sem obra, o valor dele fica órfão em todo relatório.",
    caminho: [
      "Abra Obras no menu e clique em nova obra.",
      "Informe código, nome, responsável, endereço e o status: ativa, pausada ou encerrada.",
      "Na lista, use a busca por código, nome ou responsável; clique no título da coluna para ordenar.",
      "Só Master e Administrador editam. A exclusão é do Master e é reversível.",
    ],
    diagrama: "tela-lista",
    exemplo:
      "Cadastre a obra Residencial Alto da Serra — Torre B com o mestre como responsável. Ela é a obra que vai receber a betoneira, o andaime e o alojamento nos próximos módulos.",
    exercicios: [
      "Cadastre uma obra de teste e depois mude o status dela para pausada.",
      "Na lista de obras, ordene por responsável clicando no título da coluna.",
    ],
    perguntas: [
      {
        enunciado: "Por que quase toda tela do Loca tem filtro por obra?",
        alternativas: [
          "Porque a obra é o centro de custo — todo gasto precisa de um dono",
          "Para deixar a tela mais organizada",
          "Porque o sistema não consegue mostrar tudo junto",
        ],
        correta: 0,
        comentario:
          "A obra é a unidade de custo do Loca. Todo contrato, imóvel, vistoria e lançamento se pendura numa obra, e é isso que permite responder quanto cada uma custou.",
      },
    ],
  },

  {
    id: "fornecedores",
    numero: 5,
    titulo: "Fornecedores — de quem se aluga",
    perfis: ["master", "administrador"],
    problema:
      "O fornecedor cadastrado torto aparece torto no contrato em PDF e no e-mail que o Loca manda para ele. Pior: o mesmo fornecedor cadastrado duas vezes com nomes ligeiramente diferentes parte o custo em dois no relatório, e ninguém percebe que aquela locadora é a maior despesa da obra.",
    caminho: [
      "Abra Fornecedores e clique em novo fornecedor.",
      "Informe nome, CNPJ e os contatos. O CNPJ é validado, inclusive no formato alfanumérico novo.",
      "Preencha o e-mail de contato: é para ele que o Loca envia o romaneio de recebimento e a cobrança de avaria.",
      "Vincule as obras em que aquele fornecedor atua — útil quando há locadora local em vários estados.",
      "Se o CNPJ já existir em outro cadastro, o Loca avisa. É possível salvar mesmo assim, marcando a confirmação — mas pare e confira antes.",
    ],
    exemplo:
      "Cadastre a Locadora Bandeirantes, com o e-mail do contato dela e vínculo com a Torre B. É desse cadastro que sai o destinatário do romaneio quando a betoneira chegar.",
    exercicios: [
      "Cadastre um fornecedor de teste com CNPJ válido.",
      "Tente cadastrar um segundo com o MESMO CNPJ e observe o aviso.",
      "Vincule o fornecedor a uma obra e confirme que ele aparece no filtro por obra.",
    ],
    perguntas: [
      {
        enunciado: "O Loca deixa cadastrar dois fornecedores com o mesmo CNPJ?",
        alternativas: [
          "Deixa, mas avisa e pede confirmação",
          "Bloqueia completamente",
          "Deixa sem dizer nada",
        ],
        correta: 0,
        comentario:
          "Ele avisa e permite prosseguir marcando a confirmação, porque há casos legítimos — filial, troca de razão social. Mas duplicata por descuido parte o custo do fornecedor em dois no relatório.",
      },
    ],
  },

  {
    id: "financeiro-relatorios",
    numero: 6,
    titulo: "Financeiro e Relatórios — para onde tudo converge",
    perfis: ["master", "administrador", "gestor"],
    problema:
      "Competência e vencimento são confundidos todo mês, e o erro é caro: a despesa entra no mês errado e o custo da obra fica torto para sempre. Competência é o mês a que a despesa PERTENCE; vencimento é o dia em que ela é PAGA. O aluguel de agosto pago em 5 de setembro tem competência 08 e vencimento 05/09.",
    caminho: [
      "Abra Financeiro. No topo, os números de a pagar, vencido e pago.",
      "Cada lançamento tem competência, valor, vencimento e status pendente ou pago.",
      "Em fluxo de caixa, o Loca projeta mês a mês somando os lançamentos reais e a estimativa dos contratos ativos e imóveis vigentes.",
      "Em gerar recorrentes, ele cria uma conta por mês para cada contrato vigente, até o mês escolhido. Pode rodar duas vezes sem medo: não duplica mês já gerado.",
      "Para dar baixa, use o ícone no lançamento pendente: informe o valor realmente pago, a data, o número da nota e anexe o comprovante.",
      "Se pagou com atraso, o Loca sugere multa de 2% mais juros de 1% ao mês pró-rata, e você aplica num clique.",
      "Em Relatórios são doze: seis do lado de equipamento (itens em aberto, contas a pagar, custo por obra, custo por fornecedor, ociosidade, avarias) e seis do lado de imóveis (custo mensal, contratos a vencer, sem contrato, consumo, reparos, caução).",
    ],
    exemplo:
      "O aluguel do alojamento da Rua das Palmeiras vence todo dia 10. Em gerar recorrentes, você materializa os doze meses de uma vez; o fluxo de caixa passa a mostrar o desembolso da Torre B até o fim da obra.",
    exercicios: [
      "Abra o fluxo de caixa e identifique quais meses ainda são projeção, e não lançamento real.",
      "Dê baixa num lançamento de teste com valor diferente do previsto.",
      "Gere o relatório de custo por obra e confira se o total bate com o que você esperava.",
    ],
    perguntas: [
      {
        enunciado:
          "O aluguel de agosto foi pago em 5 de setembro. Qual é a competência?",
        alternativas: ["Agosto", "Setembro", "Depende da data da nota fiscal"],
        correta: 0,
        comentario:
          "Competência é o mês a que a despesa pertence — agosto. Setembro é só o vencimento. Lançar como setembro joga o custo para o mês errado e distorce o custo da obra nos dois meses.",
      },
      {
        enunciado: "Rodar gerar recorrentes duas vezes duplica as contas?",
        alternativas: [
          "Não — o Loca não recria mês que já existe",
          "Sim, cria tudo de novo",
          "Sim, e é preciso apagar as duplicadas à mão",
        ],
        correta: 0,
        comentario:
          "A geração é idempotente: rodar de novo só cria o que falta. Isso existe justamente para você poder rodar sem conferir antes o que já foi gerado.",
      },
    ],
  },
];

export const TRILHA_0: Trilha = {
  id: "fundacao",
  numero: 0,
  titulo: "Fundação",
  subtitulo:
    "Todos começam aqui. O que o Loca controla, como se entra nele, quem pode o quê, e as quatro telas que os dois controles compartilham.",
  modulos,
};
