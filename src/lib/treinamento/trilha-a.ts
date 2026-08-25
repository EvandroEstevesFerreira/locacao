// Trilha A — Ferramentas, materiais e locações.
//
// O fio condutor atravessa os seis: a betoneira BT-4412 da Locadora
// Bandeirantes chega à Torre B, é conferida, vistoriada, usada, devolvida com a
// coroa dentada, e a cobrança é contestada. Exemplo solto por módulo ensina
// telas; uma história só ensina o encadeamento, que é onde as pessoas de fato
// erram — a vistoria que ninguém fez na entrada só cobra o preço na devolução,
// três meses depois.
//
// Fontes de cada módulo: docs/superpowers/plans/2026-08-25-treinamento-interativo.md

import type { Modulo, Trilha } from "./tipos";

const modulos: Modulo[] = [
  {
    id: "itens",
    numero: 1,
    titulo: "Catálogo de itens — a escolha que decide todo o resto",
    perfis: ["master", "administrador"],
    problema:
      "O tipo e o controle que você escolhe ao cadastrar um item determinam o que o Loca consegue responder depois. Cadastrado por quantidade, o sistema sabe que chegaram duas betoneiras. Cadastrado por peça, ele sabe QUAIS duas — e é isso que decide uma discussão de avaria três meses depois.",
    caminho: [
      "Abra Itens e clique em novo item.",
      "Escolha o tipo: equipamento, material retornável ou consumível.",
      "Escolha o controle. Por peça significa rastreado por patrimônio; por quantidade significa por lote.",
      "Para item controlado por peça, cadastre as unidades físicas com o número de série ou patrimônio.",
      "Use por peça no que é caro e identificável — betoneira, vibrador, compressor. Use por quantidade no que é repetido e intercambiável — andaime, escora, prancha.",
    ],
    exemplo:
      "Betoneira 400L entra como equipamento controlado POR PEÇA, com as unidades BT-4412 e BT-4413 cadastradas. O andaime fachadeiro entra como material retornável POR QUANTIDADE: ninguém vai discutir qual das 48 peças de andaime voltou torta.",
    exercicios: [
      "Cadastre um item controlado por peça e crie duas unidades para ele.",
      "Cadastre um item por quantidade e observe que ele não pede patrimônio.",
      "Tente registrar um recebimento do item por peça sem informar a peça: o Loca recusa.",
    ],
    perguntas: [
      {
        enunciado: "Quando usar controle por peça em vez de por quantidade?",
        alternativas: [
          "Quando o item é caro e identificável, e vai importar saber qual unidade era",
          "Sempre — é mais completo",
          "Quando o fornecedor exigir",
        ],
        correta: 0,
        comentario:
          "Por peça dá rastreabilidade e cobra o preço de exigir o patrimônio em cada movimento. Faz sentido na betoneira; em 48 peças de andaime intercambiáveis é burocracia sem retorno.",
      },
    ],
  },

  {
    id: "contrato-fornecedor",
    numero: 2,
    titulo: "O contrato com o fornecedor",
    perfis: ["master", "administrador", "operador"],
    problema:
      "A cadência de cobrança é o que transforma dias em dinheiro: é ela que diz se aquele valor unitário é por dia, por semana, por quinzena ou por mês. Errar a cadência multiplica ou divide o custo da obra sem que nenhum campo pareça errado.",
    caminho: [
      "Abra Contratos e clique em novo contrato.",
      "Vincule a obra e o fornecedor. O número do Loca vem sugerido no formato CTR-2026-0007 e é único; ao lado dele, guarde o número que o fornecedor usa.",
      "Escolha a cadência: diária, semanal, quinzenal ou mensal.",
      "Informe início e fim previsto, e marque cobrança pró-rata se o fornecedor cobrar proporcional.",
      "Em itens do contrato, adicione item do catálogo, quantidade e valor unitário por período.",
      "O custo de cada item é a quantidade em aberto vezes o valor vezes os períodos do mês, pela cadência.",
      "Anexe o contrato original e, ao longo do tempo, os aditivos. Em gerar contrato sai um PDF no template da Sistenge.",
    ],
    exemplo:
      "Contrato CTR-2026-0187 com a Locadora Bandeirantes para a Torre B, cadência mensal: duas betoneiras a R$ 620,00 por mês cada e 48 peças de andaime. O custo mensal do contrato passa a aparecer no fluxo de caixa da obra.",
    exercicios: [
      "Crie um contrato de teste com cadência mensal e um item.",
      "Mude a cadência para diária e observe o custo mudar.",
      "Gere o PDF do contrato e confira se os itens saíram certos.",
    ],
    perguntas: [
      {
        enunciado:
          "Um item vale R$ 620,00 e o contrato tem cadência mensal. O que esse valor representa?",
        alternativas: [
          "R$ 620,00 por mês, por unidade",
          "R$ 620,00 pelo contrato inteiro",
          "R$ 620,00 por dia",
        ],
        correta: 0,
        comentario:
          "O valor unitário é sempre POR PERÍODO da cadência e POR UNIDADE. Com cadência diária, o mesmo R$ 620,00 passaria a custar cerca de trinta vezes mais no mês.",
      },
      {
        enunciado: "Para que serve guardar o número do fornecedor além do número do Loca?",
        alternativas: [
          "Para achar o contrato quando o fornecedor liga citando o número dele",
          "É obrigatório por lei",
          "Não serve para nada, é campo antigo",
        ],
        correta: 0,
        comentario:
          "São dois números para o mesmo acordo. A busca da lista acha pelos dois — e é o do fornecedor que vem na fatura que chega para pagamento.",
      },
    ],
  },

  {
    id: "recebimento",
    numero: 3,
    titulo: "Recebimento — conferir o que chegou",
    perfis: ["master", "administrador", "operador"],
    problema:
      "Assinar o romaneio do fornecedor sem conferir é assumir o que vier: quantidade a menos, modelo trocado, equipamento já danificado. E quem digita no escritório dias depois costuma deixar a data do lançamento no lugar da data da entrega — e aí o custo começa a correr no dia errado.",
    caminho: [
      "Abra o contrato e vá até a seção Recebimentos. Clique em novo recebimento.",
      "Informe a DATA DO RECEBIMENTO — é a data em que o equipamento chegou à obra, não a de hoje. O Loca não preenche sozinho de propósito.",
      "Informe quem conferiu e o número da nota do fornecedor.",
      "Lance item a item. Para item controlado por peça, informe QUAL peça chegou: o Loca recusa salvar sem o patrimônio.",
      "Marque a condição de cada item: Conforme, Com avaria ou Divergência.",
      "Divergência é o que permite registrar que chegou algo fora do contrato, ou em quantidade diferente, sem precisar forçar o lançamento para conseguir salvar.",
      "Enquanto está em Rascunho, tudo é editável e nada saiu do sistema. Ao FECHAR, o recebimento é congelado e ganha número — REC-2026-0014.",
      "O envio automático do romaneio ao fornecedor por e-mail ainda não existe; por ora, o PDF é enviado à mão.",
    ],
    diagrama: "cadeia-custodia",
    exemplo:
      "Na Torre B, dia 24, chegam as duas betoneiras e 48 peças de andaime. A BT-4412 vem com a proteção da coroa amassada: entra como Com avaria, com a descrição do que foi encontrado. Chegaram também 4 escoras que não estão no contrato: entram como Divergência. O recebimento fecha como REC-2026-0014.",
    exercicios: [
      "Registre um recebimento com um item Conforme e um Com avaria.",
      "Tente lançar um item controlado por peça sem informar o patrimônio e leia a mensagem.",
      "Registre um item que não está no contrato, usando Divergência.",
      "Feche o recebimento e confirme que ele não pode mais ser editado.",
    ],
    perguntas: [
      {
        enunciado: "A data do recebimento deve ser qual?",
        alternativas: [
          "A data em que o equipamento chegou à obra",
          "A data em que você está digitando",
          "A data da nota fiscal do fornecedor",
        ],
        correta: 0,
        comentario:
          "É a data da entrega. O Loca não preenche esse campo sozinho justamente para você não deixar passar a data do lançamento — o custo da locação corre a partir da entrega.",
      },
      {
        enunciado: "Chegou um item que não está no contrato. O que fazer?",
        alternativas: [
          "Lançar como Divergência",
          "Não lançar, porque o sistema não aceita",
          "Adicionar o item ao contrato primeiro, para depois lançar",
        ],
        correta: 0,
        comentario:
          "Divergência existe exatamente para isso. Sem ela, o conferente precisaria alterar o contrato ou mentir no documento só para conseguir salvar — e o registro perderia o valor de prova.",
      },
      {
        enunciado: "Qual a diferença entre Rascunho e Fechado?",
        alternativas: [
          "Rascunho é editável; Fechado é congelado e ganha número de registro",
          "Rascunho não é salvo no banco",
          "Fechado pode ser editado pelo Master a qualquer momento",
        ],
        correta: 0,
        comentario:
          "O fechamento é o que dá valor de documento ao recebimento: a partir dali ele tem número e não muda mais. Reabrir é operação de Master e ainda não está disponível.",
      },
    ],
  },

  {
    id: "vistoria-retirada",
    numero: 4,
    titulo: "Vistoria de retirada — a foto que ganha a discussão",
    perfis: ["master", "administrador", "operador"],
    problema:
      "Na devolução, o fornecedor aponta um dano e cobra. Sem foto da entrada, a palavra dele vale tanto quanto a da Sistenge, e quem paga é a obra. A vistoria de retirada custa dez minutos e é a única prova que existe de como o equipamento chegou.",
    caminho: [
      "No contrato, crie o relatório fotográfico de retirada ANTES de o equipamento entrar em uso.",
      "Anexe foto de TODOS os itens, não só dos que parecem problemáticos.",
      "O relatório nasce marcado como pendente de fotos e só perde essa marca quando tem ao menos uma.",
      "Fotografe o que já está danificado com mais cuidado do que o resto: é o dano existente que vai ser cobrado de você depois.",
      "A vistoria tem dois tipos: entrada, que é a retirada, e devolução.",
    ],
    exemplo:
      "A coroa amassada da BT-4412 foi fotografada na vistoria de entrada, no mesmo dia do recebimento. Três meses depois, quando a Bandeirantes cobrar por ela, essa foto é a resposta.",
    exercicios: [
      "Crie uma vistoria de entrada num contrato de teste e anexe uma foto.",
      "Observe a marca de pendente de fotos antes e depois de anexar.",
      "Abra a lista de Vistorias e filtre por obra.",
    ],
    perguntas: [
      {
        enunciado: "Por que fotografar também o que já está danificado na entrada?",
        alternativas: [
          "Porque é justamente o dano existente que o fornecedor vai cobrar na devolução",
          "Para o relatório ficar mais completo",
          "Não é necessário — só o que está intacto importa",
        ],
        correta: 0,
        comentario:
          "O dano que você não registrou na entrada é indistinguível do dano que a obra causou. A foto do problema que já veio é o que impede a cobrança.",
      },
    ],
  },

  {
    id: "devolucao",
    numero: 5,
    titulo: "Devolução — o custo que para de correr",
    perfis: ["master", "administrador", "operador"],
    problema:
      "Equipamento devolvido e não registrado continua sendo cobrado pelo Loca — e, o que é pior, muitas vezes pelo fornecedor também. É o custo mais silencioso da obra: nada dá erro, a fatura só continua chegando igual.",
    caminho: [
      "No contrato, no item, registre a devolução informando a quantidade que voltou.",
      "A devolução pode ser parcial e repetida: 10, depois 3, depois 4, depois 3, até zerar o saldo.",
      "Cada devolução cria um relatório fotográfico próprio e entra no histórico do item.",
      "O custo respeita o saldo: devolveu 7 de 10, o Loca passa a cobrar por 3.",
      "Informe a data real da devolução. É a partir dela que o custo para.",
    ],
    exemplo:
      "As 48 peças de andaime voltam em três viagens: 20, 20 e 8. Depois da primeira, o Loca já cobra por 28. A betoneira BT-4413 volta inteira; a BT-4412 volta com a coroa dentada.",
    exercicios: [
      "Devolva parte da quantidade de um item e confira o custo mudar.",
      "Devolva o restante e confirme que o item saiu de em aberto.",
      "Abra o histórico do item e veja as devoluções na ordem.",
    ],
    perguntas: [
      {
        enunciado: "Você devolveu 7 de 10 andaimes. O que o Loca cobra a partir daí?",
        alternativas: [
          "Por 3, que é o saldo em aberto",
          "Por 10, até a devolução total",
          "Nada, porque houve devolução",
        ],
        correta: 0,
        comentario:
          "O custo acompanha o saldo em aberto, período por período. É por isso que registrar devolução parcial no dia certo vale dinheiro.",
      },
      {
        enunciado: "O que acontece se o equipamento voltar e ninguém registrar?",
        alternativas: [
          "O Loca continua cobrando por ele, e nada acusa o erro",
          "O sistema detecta pela vistoria e corrige",
          "O custo para automaticamente no fim do contrato",
        ],
        correta: 0,
        comentario:
          "Nenhum sistema adivinha uma devolução que não foi registrada. É o custo mais silencioso da obra: não dá erro em lugar nenhum, só aparece na fatura.",
      },
    ],
  },

  {
    id: "avarias",
    numero: 6,
    titulo: "Avarias — cobrar e contestar",
    perfis: ["master", "administrador", "operador"],
    problema:
      "Avaria tem dois lados. Quando a obra danificou, o custo precisa entrar no financeiro para não virar surpresa. Quando o fornecedor cobra por dano que já existia, é preciso ter como recusar — e recusar com prova, não com discussão.",
    caminho: [
      "A avaria é registrada dentro da vistoria: descrição do que foi encontrado e custo estimado.",
      "Ela tem três estados: aberta, cobrada e resolvida.",
      "Em gerar cobrança, o Loca cria uma conta a pagar com o custo, marca a avaria como cobrada e amarra as duas — o que impede o mesmo dano de gerar duas cobranças. Exige permissão financeira.",
      "Para contestar cobrança do fornecedor, abra a vistoria de ENTRADA e use a foto de lá.",
      "O relatório de avarias lista tudo por obra e por período.",
    ],
    exemplo:
      "A Bandeirantes cobra R$ 1.850,00 pela coroa da BT-4412. A vistoria de entrada da Torre B mostra a proteção já amassada no dia 24. A cobrança é recusada com a foto anexa — e a avaria, que nunca foi da obra, não gera lançamento.",
    exercicios: [
      "Registre uma avaria numa vistoria de devolução com custo estimado.",
      "Gere a cobrança e confirme que apareceu um lançamento no Financeiro.",
      "Tente gerar a cobrança de novo e observe que o Loca não duplica.",
      "Gere o relatório de avarias da sua obra.",
    ],
    perguntas: [
      {
        enunciado: "Gerar cobrança de uma avaria faz o quê?",
        alternativas: [
          "Cria a conta a pagar, marca a avaria como cobrada e amarra as duas",
          "Só muda o status da avaria",
          "Envia a cobrança ao fornecedor por e-mail",
        ],
        correta: 0,
        comentario:
          "O vínculo entre a avaria e o lançamento é o que impede o mesmo dano de virar duas contas. O envio ao fornecedor por e-mail ainda não é automático.",
      },
      {
        enunciado: "O fornecedor cobra por um dano que já existia. O que resolve?",
        alternativas: [
          "A foto da vistoria de ENTRADA, que mostra o dano na chegada",
          "A vistoria de devolução",
          "O contrato assinado",
        ],
        correta: 0,
        comentario:
          "Só a vistoria de entrada prova o estado em que o item chegou. É por isso que os dez minutos gastos com ela na retirada valem mais que qualquer discussão depois.",
      },
    ],
  },
];

export const TRILHA_A: Trilha = {
  id: "ferramentas",
  numero: 1,
  titulo: "Ferramentas, materiais e locações",
  subtitulo:
    "Do catálogo à devolução: o que se aluga do fornecedor, como conferir o que chega, como provar o estado, e como o custo para de correr.",
  modulos,
};
