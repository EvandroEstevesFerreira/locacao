// Trilha do termo de responsabilidade.
//
// É a trilha mais importante do grupo, e a única cujo erro tem consequência
// jurídica: o termo é o documento que autoriza descontar do salário o
// equipamento danificado por dolo ou culpa (art. 462 § 1º da CLT). Termo mal
// emitido não é papel errado — é desconto que não se sustenta.
//
// Por isso as aulas insistem no estado na entrega e no encerramento assinado:
// são os dois pontos onde o documento ganha ou perde valor.

import type { Trilha } from "./tipos";

export const TERMOS: Trilha = {
  chave: "termos",
  titulo: "Termo de responsabilidade",
  resumo:
    "Entregar equipamento a um funcionário com assinatura, registrar a devolução e encerrar o documento.",
  modulo: "termos",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "funcionarios",
      titulo: "Quem pode assinar um termo",
      resumo:
        "O funcionário vem de um cadastro próprio. Sem ele, o termo não tem quem assine.",
      rotas: ["/termos/funcionarios"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/termos/funcionarios",
          acao: "Abra Funcionários e cadastre quem recebe equipamento na obra.",
          esperado:
            "A pessoa entra na lista com nome, CPF, cargo, matrícula, obra e situação. É essa lista que aparece no primeiro passo do termo.",
        },
        {
          onde: "/termos/funcionarios",
          acao: "Confira o CPF antes de salvar.",
          esperado:
            "O CPF vai impresso no documento e é o que identifica a pessoa numa discussão futura. Termo com CPF errado identifica outra pessoa.",
        },
      ],
      atencao: [
        "Funcionário aqui não é usuário do sistema. Quem recebe equipamento não precisa ter login — ele assina na tela de quem está emitindo.",
        "Sem nenhum funcionário cadastrado, a tela de novo termo não abre o passo a passo: ela diz o que falta e oferece o caminho para cá.",
      ],
    },
    {
      id: "termo-novo",
      titulo: "Emitir um termo, passo a passo",
      resumo:
        "Três etapas: quem recebe, o que sai e a assinatura. Cada uma responde uma pergunta diferente.",
      rotas: ["/termos/novo"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/termos/novo",
          acao: "No passo 1 — “Quem e quando” — escolha o funcionário e a data da entrega.",
          esperado:
            "Obra, previsão de devolução e observações são opcionais. Vale preencher a previsão: é o que permite cobrar depois sem parecer arbitrário.",
        },
        {
          onde: "/termos/novo",
          acao: "No passo 2 — “O que sai” — clique em Acrescentar item e escolha o item.",
          esperado:
            "Para item controlado por peça, aparece o seletor de Patrimônio e a quantidade fica travada em 1 — é uma peça específica que está saindo. Para item por quantidade, você digita quanto.",
        },
        {
          onde: "/termos/novo",
          acao: "Ajuste o Estado na entrega de cada linha, item por item.",
          esperado:
            "Novo, Bom, Regular ou Com avaria. Esse campo protege os dois lados quando o equipamento voltar: sem ele, toda avaria na devolução parece nova.",
        },
        {
          onde: "/termos/novo",
          acao: "Avance para o passo 3.",
          esperado:
            "Aparece “Rascunho salvo. Agora é só assinar.” O trabalho de montar a lista já está guardado — se a assinatura der errado, você não recomeça do zero.",
        },
      ],
      atencao: [
        "Acrescente uma linha por peça. Duas betoneiras são duas linhas, com dois patrimônios: é o que permite devolver uma e continuar com a outra.",
        "O estado na entrega é o campo mais esquecido e o mais caro. Ele é a única prova de como o equipamento saiu.",
      ],
    },
    {
      id: "termo-assinar",
      titulo: "Assinar, e o que a assinatura muda",
      resumo:
        "Rascunho não é documento. A assinatura é o que numera o termo e move as peças.",
      rotas: ["/termos/novo", "/termos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/termos/novo",
          acao: "No passo 3, peça ao funcionário para assinar com o dedo na tela.",
          esperado:
            "A assinatura do funcionário é obrigatória; a da empresa é opcional. Sem a do funcionário, o sistema recusa a emissão.",
        },
        {
          onde: "/termos/novo",
          acao: "Clique em Emitir termo.",
          esperado:
            "Aparece “Termo emitido e numerado”. O termo ganha número de registro, e as peças passam para a situação Em uso na frota.",
        },
        {
          onde: "/termos/[id]",
          acao: "Abra um termo emitido e olhe o bloco Assinaturas.",
          esperado:
            "Nome, quem assinou (funcionário ou empresa), o momento (entrega ou devolução), a data com hora e o IP. É isso que sustenta a assinatura eletrônica se alguém disser que não assinou.",
        },
        {
          onde: "/termos/[id]",
          acao: "Clique em “Gerar termo (PDF)”.",
          esperado:
            "Abre o documento FRM-EQ-001 em outra aba, com as cláusulas, a lista de itens e as assinaturas. É o que se imprime e se arquiva.",
        },
      ],
      atencao: [
        "Um rascunho não gastou número e não mexeu na frota: o equipamento continua Disponível. É por isso que rascunho pode ser excluído e termo emitido não.",
        "Se a emissão foi interrompida — internet caiu, aba fechada —, o rascunho fica salvo com os itens. Abra o termo pela lista e use o bloco “Emitir o termo”: ele existe exatamente para isso.",
      ],
    },
    {
      id: "termo-devolucao",
      titulo: "Registrar a devolução, inteira ou em partes",
      resumo:
        "Marcar só o que voltou, com o estado e a data de cada item. Devolução parcial é o caso normal, não a exceção.",
      rotas: ["/termos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/termos/[id]",
          acao: "No bloco Devolução, marque a caixa dos itens que voltaram.",
          esperado:
            "Os campos de estado e data daquela linha ficam habilitados; os das linhas não marcadas continuam desligados. O botão mostra quantos você marcou.",
        },
        {
          onde: "/termos/[id]",
          acao: "Compare o estado na devolução com o estado na entrega, que aparece na própria linha.",
          esperado:
            "A linha diz “saiu como Bom”. Marcar “Com avaria” contra um “saiu como Novo” é o registro de que a avaria aconteceu no período — a conversa que o termo existe para permitir.",
        },
        {
          onde: "/termos/[id]",
          acao: "Ajuste a data, se a devolução não foi hoje, e clique em Registrar devolução.",
          esperado:
            "Aparece “Devolução registrada. As peças voltaram para disponível”. As peças devolvidas saem de Em uso e ficam disponíveis para sair de novo.",
        },
        {
          onde: "/termos/[id]",
          acao: "Repare no bloco “Já devolvidos”.",
          esperado:
            "O que voltou fica à vista, com data e estado, e o topo da tela mostra “itens pendentes: 2 de 5”. Quem confere precisa ver o que já voltou para saber o que falta.",
        },
      ],
      atencao: [
        "Cada item devolvido libera a peça dele na frota, um por um. O termo só fecha no encerramento.",
      ],
    },
    {
      id: "termo-encerrar",
      titulo: "Encerrar, cancelar e a pendência de quem foi desligado",
      resumo:
        "O encerramento é assinado, e item que não voltou fica registrado como pendência — não desaparece.",
      rotas: ["/termos/[id]", "/termos"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/termos/[id]",
          acao: "Com os itens devolvidos, colha as assinaturas no bloco “Encerrar o termo” e clique em Encerrar termo.",
          esperado:
            "Aparece “Termo encerrado”. O documento fecha e o bloco de devolução dá lugar a um aviso de que o termo está encerrado.",
        },
        {
          onde: "/termos/[id]",
          acao: "Encerre um termo com item ainda pendente, quando for o caso — um desligamento, por exemplo.",
          esperado:
            "O termo fecha e os itens sem devolução ficam registrados como pendência no documento. É esse registro que sustenta a cobrança de quem saiu devendo equipamento.",
        },
        {
          onde: "/termos/[id]",
          acao: "Em um termo emitido por engano, use Cancelar termo e escreva o motivo.",
          esperado:
            "O documento não é apagado: fica anulado, com o motivo no histórico, e as peças voltam para disponível. Cancelar é de master ou administrador.",
        },
        {
          onde: "/termos",
          acao: "Na lista, filtre por Situação para ver o que está aberto.",
          esperado:
            "A lista mostra número, funcionário, obra, data de entrega, devolução prevista, itens e situação. É o mapa de quem está com o quê.",
        },
      ],
      atencao: [
        "Cancelar não é excluir. Excluir existe só para rascunho, que nunca foi documento. Termo emitido é cancelado, com motivo, e permanece no histórico — inclusive no histórico de custódia da peça, marcado como termo cancelado.",
        "Encerrar exige assinatura do funcionário. Se a pessoa não está mais disponível para assinar, o encerramento com pendência registrada é o caminho — e o motivo vale ser escrito nas observações.",
      ],
    },
  ],
  perguntas: [
    {
      id: "ter-rascunho",
      enunciado:
        "Você montou o termo, avançou até a assinatura e fechou a aba sem assinar. O que aconteceu com o equipamento?",
      alternativas: [
        "Nada: o rascunho ficou salvo e as peças continuam Disponíveis",
        "As peças ficaram Em uso e é preciso devolver uma por uma",
        "O termo foi emitido automaticamente sem assinatura",
        "O trabalho foi perdido e é preciso montar tudo de novo",
      ],
      correta: 0,
      porque:
        "O rascunho é salvo ao entrar no passo da assinatura, justamente para o caso de a assinatura na tela dar errado. Rascunho não gasta número e não mexe na frota: é a emissão assinada que registra a entrega e move as peças para Em uso.",
      aula: "termo-assinar",
    },
    {
      id: "ter-estado-entrega",
      enunciado:
        "Por que o estado na entrega precisa ser preenchido item por item, e não uma vez para o termo todo?",
      alternativas: [
        "Porque o sistema exige que todos os campos sejam preenchidos",
        "Porque o PDF fica melhor formatado",
        "Porque cada peça sai numa condição, e é a comparação com a devolução que mostra o que aconteceu no período",
        "Porque a quantidade depende do estado escolhido",
      ],
      correta: 2,
      porque:
        "Na devolução, a linha mostra “saiu como Bom” ao lado do estado que você está registrando. Sem o estado na entrega, toda avaria encontrada parece nova — e o funcionário não tem como se defender, nem a empresa como cobrar.",
      aula: "termo-novo",
    },
    {
      id: "ter-encerrar-pendente",
      enunciado:
        "Um funcionário foi desligado e não devolveu duas ferramentas. Como se fecha o termo dele?",
      alternativas: [
        "Cancelando o termo, porque ele não se cumpriu",
        "Deixando o termo aberto para sempre, como lembrete",
        "Registrando a devolução das duas ferramentas com estado Com avaria",
        "Encerrando o termo: os itens não devolvidos ficam registrados como pendência",
      ],
      correta: 3,
      porque:
        "O encerramento fecha o documento e mantém a falta registrada — é exatamente o caso para o qual a pendência existe. Cancelar diria que o termo não valeu, o oposto do que interessa. E registrar como devolvido o que não voltou é falsificar o documento que sustentaria a cobrança.",
      aula: "termo-encerrar",
    },
    {
      id: "ter-cancelar-excluir",
      enunciado:
        "Um termo foi emitido para o funcionário errado. Qual é o caminho, e quem pode fazer?",
      alternativas: [
        "Excluir o termo; qualquer operador pode",
        "Cancelar o termo com o motivo; é de master ou administrador",
        "Editar o termo e trocar o funcionário",
        "Registrar a devolução de tudo e encerrar",
      ],
      correta: 1,
      porque:
        "Termo emitido não se apaga nem se edita: ele foi assinado, e um documento assinado que muda depois não prova nada. Cancelar anula com o motivo registrado e devolve as peças para disponível. Excluir existe só para rascunho — que nunca chegou a ser documento.",
      aula: "termo-encerrar",
    },
    {
      id: "ter-devolucao-parcial",
      enunciado:
        "De cinco itens de um termo, dois voltaram hoje. O que você faz na tela?",
      alternativas: [
        "Espero todos voltarem para registrar de uma vez",
        "Encerro o termo e emito outro com os três que faltam",
        "Marco só os dois que voltaram, com estado e data, e registro a devolução",
        "Registro os cinco e depois corrijo os três",
      ],
      correta: 2,
      porque:
        "Devolução parcial é o caso normal. Cada item marcado libera a peça dele na frota na hora, e o termo continua aberto com a pendência à vista, mostrando “2 de 5 devolvidos”. Esperar tudo voltar mantém peças presas em Em uso sem estarem com ninguém.",
      aula: "termo-devolucao",
    },
  ],
};
