// Trilha da vistoria — a prova do estado do equipamento.
//
// A vistoria é o único lugar do sistema cujo valor é inteiramente probatório:
// ela não move saldo, não gera custo e não muda situação de peça. Ela produz
// FOTO com data e assinatura. Existe para o dia em que a locadora cobrar uma
// avaria que já estava lá — e nesse dia, ou existe a foto da retirada, ou a
// empresa paga.

import type { Trilha } from "./tipos";

export const VISTORIAS: Trilha = {
  chave: "vistorias",
  titulo: "Vistorias, fotos e avarias",
  resumo:
    "Registrar o estado do equipamento na retirada e na devolução, anexar fotos, apontar avarias e gerar a cobrança.",
  modulo: "vistorias",
  papeis: [],
  // 2: a aula do laudo de avaria. Bumpar é o que faz `aulasNovasDesde` mostrar
  // a aula a quem já concluiu a versão 1 — sem isso, quem fez a trilha antes do
  // laudo existir continuaria marcado como "concluída" sem nunca vê-la.
  versao: 2,
  aulas: [
    {
      id: "vistoria-quando",
      titulo: "Os dois momentos de vistoriar",
      resumo:
        "Entrada é a retirada; devolução é a volta. Faltando a primeira, a segunda não prova nada.",
      rotas: ["/vistorias", "/vistorias/nova"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/vistorias/nova",
          acao: "Crie uma vistoria e escolha o tipo.",
          esperado:
            "Dois tipos: Entrada (retirada) e Devolução. Preencha o contrato, a data e o responsável — depois é que se anexam fotos e avarias.",
        },
        {
          onde: "/vistorias",
          acao: "Na lista, leia as colunas.",
          esperado:
            "Data, contrato, tipo, quantidade de fotos e quantidade de avarias. Vistoria com zero fotos aparece com zero — e vistoria sem foto não prova nada.",
        },
        {
          onde: "/vistorias",
          acao: "Filtre por obra.",
          esperado:
            "Mostra as vistorias daquela obra, das duas pontas. É como se confere se a retirada foi vistoriada antes de discutir uma devolução.",
        },
      ],
      atencao: [
        "A vistoria de ENTRADA é a que ninguém faz e a que mais falta depois. Sem ela, qualquer avaria encontrada na devolução parece nova, e a empresa não tem com o que comparar.",
        "Registrar vistoria é de operador, administrador e master.",
      ],
    },
    {
      id: "vistoria-fotos",
      titulo: "As fotos",
      resumo: "É a parte da vistoria que realmente prova algo.",
      rotas: ["/vistorias/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/vistorias/[id]",
          acao: "No bloco Fotos, anexe as imagens do equipamento.",
          esperado:
            "As fotos ficam guardadas junto da vistoria, com a data dela. A legenda do bloco resume o propósito: prova do estado na retirada ou na devolução.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Fotografe o que costuma dar discussão: pneus, painel, horímetro, cabos, chassi, avarias já existentes.",
          esperado:
            "Quanto mais específica a foto, menos conversa depois. Foto geral do equipamento inteiro não mostra o risco no capô.",
        },
      ],
      atencao: [
        "Foto tirada no celular e guardada no celular não é prova da empresa: ela sai com a pessoa. A foto vale quando está na vistoria, com data e contrato.",
      ],
    },
    {
      id: "vistoria-avarias",
      titulo: "Registrar avaria e gerar a cobrança",
      resumo:
        "Descrição, custo estimado e status. A cobrança vira um lançamento financeiro.",
      rotas: ["/vistorias/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/vistorias/[id]",
          acao: "No bloco Avarias, registre o dano com descrição e custo estimado.",
          esperado:
            "A avaria entra na lista com status Aberta, e o topo da vistoria passa a somar o custo estimado de todas.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Numa avaria com custo maior que zero, clique em “Gerar cobrança”.",
          esperado:
            "O sistema cria um lançamento financeiro a partir da avaria e a marca como cobrada. A lista passa a mostrar o selo “Cobrança gerada”.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Tente gerar a cobrança duas vezes.",
          esperado:
            "Não duplica. Uma vez gerada, a avaria mostra o selo em vez do botão.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Atualize o status quando a situação mudar: Aberta, Cobrada ou Resolvida.",
          esperado:
            "Salva. Resolvida é a avaria que terminou — reparada, cobrada e paga, ou perdoada em acordo.",
        },
      ],
      atencao: [
        "O botão “Gerar cobrança” aparece só para master e administrador — criar lançamento financeiro é permissão financeira. Operador registra a avaria; a cobrança é de quem responde pelo dinheiro.",
        "Avaria com custo estimado zero não oferece cobrança. Se há dano a cobrar, o custo precisa estar estimado — é ele que vira o valor do lançamento.",
      ],
    },
    {
      id: "avaria-laudo",
      titulo: "O laudo: quem responde pelo dano",
      resumo:
        "Registrar a avaria é o começo. O laudo é onde se apura de quem é a conta.",
      rotas: ["/vistorias/avarias", "/vistorias/avarias/[id]"],
      desdeVersao: 2,
      passos: [
        {
          onde: "/vistorias/avarias",
          acao: "Abra Avarias no menu.",
          esperado:
            "Todas as avarias da organização, com o custo em aberto somado no cabeçalho e quantas ainda estão sem responsabilidade definida.",
        },
        {
          onde: "/vistorias/avarias",
          acao: "Filtre a responsabilidade por “A apurar”.",
          esperado:
            "Aparecem os danos que ninguém apurou. É a razão de existir desta lista — antes dela, uma avaria de dois mil reais só era encontrada por quem abrisse a vistoria certa.",
        },
        {
          onde: "/vistorias/avarias/[id]",
          acao: "Abra uma avaria e confira a data em “Constatada em”.",
          esperado:
            "É a data em que o dano foi VISTO, não a de hoje. Ela separa dano anterior à locação de dano ocorrido nela, que é a primeira coisa que o fornecedor contesta.",
        },
        {
          onde: "/vistorias/avarias/[id]",
          acao: "Escreva a apuração e escolha a responsabilidade.",
          esperado:
            "Salva. O texto sai no laudo em PDF; em branco, o PDF sai com espaço para preencher à mão em campo.",
        },
        {
          onde: "/vistorias/avarias/[id]",
          acao: "Clique em Laudo, no topo.",
          esperado:
            "Abre o PDF com o dano, a apuração, a responsabilidade e o custo — mesmo que a apuração ainda esteja em branco.",
        },
      ],
      atencao: [
        "Toda avaria nasce com responsabilidade “A apurar”, inclusive as abertas automaticamente ao fechar uma devolução com item ressalvado. É o estado honesto: acabou de ser constatada.",
        "Marcar “De funcionário” não autoriza desconto em salário. Desconto por dano depende de dolo, ou de culpa prevista em contrato (CLT art. 462, §1º) — não do que se marca no laudo. Descreva na apuração COMO se chegou à conclusão e quem participou.",
        "Depois que a avaria vira lançamento financeiro, o laudo não é mais editável. Ele é o texto que sustentou a cobrança, e é o que alguém vai ler se ela for contestada.",
      ],
    },
    {
      id: "vistoria-relatorio",
      titulo: "Observações, assinaturas e o relatório em PDF",
      resumo:
        "Duas assinaturas na tela, e o documento que sustenta a conversa com a locadora.",
      rotas: ["/vistorias/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/vistorias/[id]",
          acao: "No bloco “Observações e assinaturas”, escreva o que as fotos não mostram.",
          esperado:
            "Ruído no motor, vazamento, acessório que não veio. As observações entram no PDF do relatório.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Colha as duas assinaturas: o representante e quem retira.",
          esperado:
            "As duas entram no relatório. É a assinatura de quem retira que transforma a vistoria em documento aceito pelas duas partes.",
        },
        {
          onde: "/vistorias/[id]",
          acao: "Gere o relatório em PDF.",
          esperado:
            "Abre em outra aba, com os dados da vistoria, as observações e as assinaturas. É o que se anexa a uma cobrança ou se apresenta numa contestação.",
        },
      ],
      atencao: [
        "Assinatura colhida na hora vale muito mais que assinatura colhida depois. Quem retira o equipamento está ali, na frente da máquina, e é o momento em que ele concorda com o que está escrito.",
      ],
    },
  ],
  perguntas: [
    {
      id: "vis-entrada",
      enunciado:
        "Na devolução, a locadora aponta um amassado na lateral e cobra o reparo. Como a empresa se defende?",
      alternativas: [
        "Com a vistoria de entrada e as fotos da retirada, mostrando que o amassado já existia",
        "Com o contrato de locação, que não menciona amassado",
        "Com o romaneio do recebimento",
        "Não há defesa: a devolução é o que vale",
      ],
      correta: 0,
      porque:
        "A vistoria de entrada é o retrato de como o equipamento saiu, com data e assinatura. Sem ela, qualquer avaria encontrada na devolução parece nova — e a empresa não tem com o que comparar. É por isso que a vistoria que ninguém faz é a que mais falta depois.",
      aula: "vistoria-quando",
    },
    {
      id: "vis-foto",
      enunciado:
        "O encarregado fotografou o equipamento no celular dele e guardou as fotos lá. Isso resolve?",
      alternativas: [
        "Sim, desde que ele guarde a foto com data",
        "Não: a foto vale quando está anexada à vistoria, com data e contrato",
        "Sim, se ele enviar por mensagem ao gestor",
        "Não, porque foto de celular não tem validade",
      ],
      correta: 1,
      porque:
        "Não é uma questão de qualidade da foto — é de onde ela está. Foto no celular sai da empresa com a pessoa, e não está amarrada a contrato nem a data verificável. A mesma foto anexada à vistoria vira prova da empresa, e continua lá quando o funcionário não estiver.",
      aula: "vistoria-fotos",
    },
    {
      id: "vis-cobranca",
      enunciado:
        "Você é operador, registrou uma avaria de R$ 800 e não vê o botão “Gerar cobrança”. Por quê?",
      alternativas: [
        "Porque a avaria precisa estar com status Resolvida",
        "Porque falta anexar foto à avaria",
        "Porque gerar cobrança cria um lançamento financeiro, e isso é de master ou administrador",
        "Porque o valor é alto demais para cobrança automática",
      ],
      correta: 2,
      porque:
        "Gerar cobrança cria um lançamento financeiro, e criar lançamento é permissão financeira — a mesma regra que o banco aplica na inserção. A divisão é deliberada: operador registra o que viu na vistoria; quem responde pelo dinheiro decide cobrar.",
      aula: "vistoria-avarias",
    },
    {
      id: "vis-assinatura",
      enunciado:
        "Por que colher a assinatura de quem retira no momento da vistoria de entrada?",
      alternativas: [
        "Porque o sistema não deixa salvar a vistoria sem assinatura",
        "Porque é o momento em que a pessoa está na frente do equipamento e concorda com o que está escrito",
        "Porque a assinatura substitui as fotos",
        "Porque sem ela a avaria não pode ser cobrada",
      ],
      correta: 1,
      porque:
        "A vistoria só é documento aceito pelas duas partes quando as duas assinam, e a hora em que isso é possível é a hora da retirada — com a máquina à vista e o estado dela evidente. Assinatura pedida semanas depois é assinatura sobre a memória de alguém.",
      aula: "vistoria-relatorio",
    },
    {
      id: "vis-laudo-responsabilidade",
      enunciado:
        "Um notebook volta com a tela trincada. Ninguém viu acontecer. O que marcar em Responsabilidade?",
      alternativas: [
        "De funcionário, porque alguém usou a máquina",
        "Do fornecedor, porque o equipamento é dele",
        "A apurar, e escrever no laudo o que já se sabe",
        "Da obra, para não travar o fechamento",
      ],
      correta: 2,
      porque:
        "O laudo existe para APURAR, não para confirmar um palpite. Marcar um responsável no momento da constatação transforma suposição em registro oficial — e, no caso de funcionário, põe o nome de uma pessoa num documento sem apuração nenhuma por trás. “A apurar” é o estado honesto até que alguém verifique.",
      aula: "avaria-laudo",
    },
  ],
};
