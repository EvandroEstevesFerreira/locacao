// Trilha do catálogo de itens — o cadastro de onde todo o resto nasce.
//
// Vem antes de Frota e de Estoque na ordem das trilhas de propósito: as duas
// telas mostram consequências de uma escolha feita AQUI (o controle por peça ou
// por quantidade), e quem não entendeu a escolha vai procurar na tela errada.

import type { Trilha } from "./tipos";

export const CATALOGO: Trilha = {
  chave: "catalogo",
  titulo: "O catálogo de itens",
  resumo:
    "Cadastrar o que a empresa usa e aluga — e a escolha que decide em que tela cada item vai aparecer.",
  modulo: "itens",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "catalogo-e-frota",
      titulo: "Catálogo é o tipo; frota é a peça",
      resumo:
        "A distinção que evita metade das dúvidas: uma linha do catálogo pode ter vinte peças de verdade.",
      rotas: ["/itens", "/frota"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/itens",
          acao: "Abra Itens e olhe uma linha de equipamento.",
          esperado:
            "Ao lado da descrição aparece a contagem de unidades — por exemplo “3 un.”. A linha é o TIPO (“Betoneira 400L”); as unidades são as betoneiras de verdade, cada uma com seu patrimônio.",
        },
        {
          onde: "/itens",
          acao: "Clique no ícone de lápis da linha.",
          esperado:
            "Abre a tela de edição do item, com o bloco Unidades embaixo. É ali que as peças daquele tipo são cadastradas.",
        },
        {
          onde: "/frota",
          acao: "Agora abra Frota e compare.",
          esperado:
            "A lista da Frota é de peças, não de tipos: uma linha por patrimônio. O mesmo item do catálogo aparece em várias linhas, uma para cada peça.",
        },
      ],
      atencao: [
        "Cadastrar o item não cadastra nenhuma peça. Um item de equipamento novo nasce com zero unidades e só aparece na Frota depois que a primeira peça é cadastrada.",
        "Quem cria e edita item é o master ou o administrador. Gestor e operador veem o catálogo, mas não têm o botão Novo item.",
      ],
    },
    {
      id: "tipo-e-controle",
      titulo: "Tipo e controle: a escolha que define a tela",
      resumo:
        "Dois campos no cadastro decidem se o item vive na Frota ou no Estoque. Errar aqui é procurar o resto do ano.",
      rotas: ["/itens/novo", "/itens/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/itens/novo",
          acao: "Abra Novo item e olhe o campo Tipo.",
          esperado:
            "Três opções: Equipamento (retornável, controlado por unidade, com nº de série ou patrimônio), Material retornável (retornável, controlado por saldo) e Consumível (não retorna).",
        },
        {
          onde: "/itens/novo",
          acao: "Olhe o campo “Controle no recebimento” e troque a opção.",
          esperado:
            "A ajuda embaixo do campo muda junto. Por peça significa que cada unidade é conferida pelo patrimônio; por quantidade significa que se confere o total.",
        },
        {
          onde: "/itens/novo",
          acao: "Preencha a descrição e a unidade de medida (un, m, kg) e salve.",
          esperado:
            "O item aparece no catálogo. A unidade de medida é a que vai aparecer no estoque, nos contratos e nos documentos impressos.",
        },
      ],
      atencao: [
        "Controle por quantidade manda o item para o Estoque; controle por peça manda para a Frota. O item não aparece nas duas telas — o sistema teria duas verdades sobre onde ele está.",
        "A descrição é o que todo mundo vai digitar para achar depois. “Betoneira 400L” é achável; quinze itens chamados só “Betoneira” não são.",
      ],
    },
    {
      id: "cadastrar-pecas",
      titulo: "Cadastrar as peças de um equipamento",
      resumo:
        "O patrimônio, a propriedade e o “onde está” de cada unidade — dentro do item a que ela pertence.",
      rotas: ["/itens/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/itens/[id]",
          acao: "Num item de equipamento, vá ao bloco Unidades e preencha o Patrimônio.",
          esperado:
            "É o campo obrigatório da peça. Se a empresa usa etiqueta, digite exatamente o que está na etiqueta — é por ele que todo mundo vai buscar.",
        },
        {
          onde: "/itens/[id]",
          acao: "Escolha a Propriedade e deixe a Situação como Disponível.",
          esperado:
            "Propriedade é “Própria da Sistenge” ou “Locada de terceiro” — o que separa o patrimônio da empresa do equipamento que ela paga para usar.",
        },
        {
          onde: "/itens/[id]",
          acao: "Em “Onde está”, escolha a obra — ou deixe em branco.",
          esperado:
            "Em branco não é campo esquecido: é o almoxarifado central. É a mesma convenção no lançamento de estoque e na movimentação da peça.",
        },
        {
          onde: "/itens/[id]",
          acao: "Preencha ano, estado e observações, e salve.",
          esperado:
            "A peça entra na lista de unidades e passa a aparecer em Frota. As observações são o lugar dos acessórios que vão junto e das avarias já conhecidas.",
        },
      ],
      atencao: [
        "Depois de cadastrada, a obra da peça não se muda mais por aqui. Muda em Frota, no bloco Movimentar — que é o que registra o histórico de quem ficou com ela e por quanto tempo.",
        "Número de série é opcional, mas é o que a seguradora e a nota fiscal pedem. Quando existe, vale preencher na hora do cadastro.",
      ],
    },
    {
      id: "achar-e-arquivar",
      titulo: "Achar no catálogo, e o que fazer com o que saiu de linha",
      resumo:
        "Busca, ordenação e a diferença entre inativar e excluir — que é a diferença entre guardar e perder o passado.",
      rotas: ["/itens"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/itens",
          acao: "Digite parte da descrição ou da unidade na busca.",
          esperado: "A lista filtra enquanto você digita, sem botão de aplicar.",
        },
        {
          onde: "/itens",
          acao: "Clique no título de uma coluna, como Descrição ou Tipo.",
          esperado:
            "A lista reordena por aquela coluna; clicar de novo inverte a ordem. A lista mostra 20 itens por página — se não achou, confira a paginação embaixo.",
        },
        {
          onde: "/itens/[id]",
          acao: "Abra um item, desmarque “Item ativo” e salve.",
          esperado:
            "Na lista ele passa a aparecer com o status Inativo. Continua explicando tudo o que já usou no passado, mas sai das escolhas de novos lançamentos.",
        },
      ],
      atencao: [
        "Inativar e excluir são coisas diferentes. Inativar preserva o passado; excluir tenta apagar a linha, e o sistema recusa quando já existe peça, contrato ou movimento apontando para ela — a recusa aparece dentro da própria janela de confirmação.",
        "Nunca reaproveite a linha de um item para outro equipamento, trocando a descrição. Isso reescreve o passado: um contrato do ano passado passa a dizer que saiu uma coisa que nunca saiu.",
      ],
    },
  ],
  perguntas: [
    {
      id: "cat-controle",
      enunciado:
        "Você cadastrou um item novo e ele não aparece no Estoque. Qual é a causa mais provável?",
      alternativas: [
        "O item foi cadastrado com controle por peça, e item por peça aparece em Frota",
        "O estoque só mostra itens com saldo maior que zero",
        "O item precisa ser vinculado a uma obra antes de aparecer",
        "O estoque atualiza uma vez por dia, de madrugada",
      ],
      correta: 0,
      porque:
        "O campo “Controle no recebimento” é o que decide a tela: por peça manda para a Frota, onde cada unidade tem patrimônio; por quantidade manda para o Estoque, onde o que existe é saldo. É uma escolha só, e o item nunca aparece nas duas telas — o sistema teria duas verdades sobre onde ele está.",
      aula: "tipo-e-controle",
    },
    {
      id: "cat-peca-onde",
      enunciado:
        "A linha “Betoneira 400L” já existe no catálogo e a empresa comprou mais uma betoneira. Onde se cadastra a peça nova?",
      alternativas: [
        "Em Frota, por um botão de nova peça",
        "No detalhe do item do catálogo, no bloco Unidades",
        "Em Estoque, lançando uma entrada de quantidade 1",
        "Em Recebimentos, ao conferir a nota",
      ],
      correta: 1,
      porque:
        "A Frota mostra e movimenta peças, mas não cria: não existe botão de nova peça lá. A peça nasce no detalhe do item, porque é ali que já está decidido de que tipo ela é — e é isso que impede uma peça de existir sem tipo nenhum.",
      aula: "cadastrar-pecas",
    },
    {
      id: "cat-onde-esta-vazio",
      enunciado:
        "No cadastro de uma peça, o campo “Onde está” ficou em branco. O que o sistema entende?",
      alternativas: [
        "Que o campo ainda precisa ser preenchido por alguém",
        "Que a peça está no almoxarifado central",
        "Que a peça está perdida",
        "Que a peça é locada de terceiro",
      ],
      correta: 1,
      porque:
        "Vazio é o almoxarifado central, e é a mesma convenção no lançamento de estoque e na movimentação da peça. Ler o vazio como “falta preencher” faz alguém sair procurando um dado que já está registrado.",
      aula: "cadastrar-pecas",
    },
    {
      id: "cat-inativar",
      enunciado:
        "A empresa parou de usar um tipo de equipamento que já saiu em vários contratos. Qual é o caminho certo no catálogo?",
      alternativas: [
        "Excluir o item, para limpar a lista",
        "Trocar a descrição e reaproveitar a linha para outro equipamento",
        "Desmarcar “Item ativo” na edição do item",
        "Não fazer nada e avisar a equipe por e-mail",
      ],
      correta: 2,
      porque:
        "Inativar tira o item das próximas escolhas e mantém tudo o que ele explica no passado. Excluir é recusado enquanto houver peça, contrato ou movimento apontando para ele. E reaproveitar a linha é o pior dos três: reescreve documentos antigos, que passam a dizer que saiu um equipamento que nunca saiu.",
      aula: "achar-e-arquivar",
    },
  ],
};
