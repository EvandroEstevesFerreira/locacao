// Trilha B — Imóveis e alojamento.
//
// É o controle mais documental do Loca: sete dos oito documentos gerados em PDF
// pertencem a este módulo. O fio condutor é o Alojamento Rua das Palmeiras, 412,
// que recebe um ocupante e passa por todos os formulários do RH.
//
// Fontes de cada módulo: docs/superpowers/plans/2026-08-25-treinamento-interativo.md

import type { Modulo, Trilha } from "./tipos";

const modulos: Modulo[] = [
  {
    id: "imovel-cadastro",
    numero: 1,
    titulo: "Cadastro do imóvel",
    perfis: ["master", "administrador"],
    problema:
      "O imóvel guarda os dados bancários de quem recebe o aluguel, e é por eles que o pagamento sai todo mês. Cadastro incompleto vira aluguel atrasado, e aluguel atrasado de alojamento vira gente sem lugar para dormir.",
    caminho: [
      "Abra Imóveis e clique em novo imóvel.",
      "Escolha o tipo: kitnet, apartamento, casa, galpão, escritório ou outro.",
      "Informe apelido, endereço, cidade, UF, capacidade e a obra vinculada.",
      "Cadastre o proprietário ou a imobiliária.",
      "Preencha os dados bancários: banco, agência, conta, titular e chave PIX. Eles aparecem mascarados na tela, com botão de revelar.",
      "A capacidade importa: é ela que diz quantas pessoas aquele alojamento comporta.",
    ],
    exemplo:
      "Cadastre o alojamento da Rua das Palmeiras, 412, kitnet, capacidade 6, vinculado à Torre B, com o proprietário e a chave PIX dele.",
    exercicios: [
      "Cadastre um imóvel de teste com dados bancários e confirme que a conta aparece mascarada.",
      "Clique em revelar e observe o comportamento.",
      "Vincule o imóvel a uma obra e confira que ele aparece no filtro daquela obra.",
    ],
    perguntas: [
      {
        enunciado: "Por que CPF, conta bancária e chave PIX aparecem mascarados?",
        alternativas: [
          "Porque são dados sensíveis, e quem precisa vê sob demanda clicando em revelar",
          "Porque o sistema não consegue exibi-los",
          "Para economizar espaço na tela",
        ],
        correta: 0,
        comentario:
          "O dado está lá e é acessível a quem tem permissão; o que o mascaramento evita é ele ficar exposto na tela para qualquer um que passe por perto.",
      },
    ],
  },

  {
    id: "imovel-contrato",
    numero: 2,
    titulo: "Contrato do imóvel: caução, reajuste e ciclo de vida",
    perfis: ["master", "administrador"],
    problema:
      "O aluguel não é um número só: soma condomínio, IPTU e, dependendo da flag, seguro fiança. E a caução segue um caminho próprio — encerrar o contrato não devolve a caução, e é aí que o dinheiro fica esquecido com o proprietário.",
    caminho: [
      "No imóvel, crie o contrato. Informe aluguel, condomínio, IPTU e seguro fiança, marcando se o seguro soma à parcela mensal.",
      "Informe o dia de vencimento, o índice de reajuste e a data do próximo reajuste.",
      "Registre o valor da caução. Ela nasce em aberto.",
      "Só existe UM contrato vigente por imóvel; os anteriores ficam no histórico.",
      "Na aba de ações: em reajuste, informe o percentual — o aluguel é atualizado e a próxima data avança cerca de doze meses.",
      "Em aditivo, altere valor ou prazo informando o motivo; o histórico é preservado.",
      "Em encerramento, informe data e motivo. O contrato sai da projeção do fluxo de caixa.",
      "A caução precisa ser resolvida por decisão própria: devolvida, quando não há avaria, ou retida, quando há.",
    ],
    diagrama: "ciclo-contrato-imovel",
    exemplo:
      "O contrato do alojamento da Rua das Palmeiras: R$ 1.800,00 de aluguel mais R$ 320,00 de condomínio, vencimento dia 10, reajuste pelo IGP-M em agosto do ano seguinte, caução de R$ 3.600,00. Quando a obra terminar, alguém tem de decidir o destino desses R$ 3.600,00 — o encerramento do contrato não decide por ninguém.",
    exercicios: [
      "Crie um contrato de imóvel de teste com caução.",
      "Aplique um reajuste de 4% e confira o aluguel novo e a nova data de reajuste.",
      "Encerre o contrato e confirme que ele saiu da projeção do fluxo de caixa.",
      "Confira em que estado a caução ficou depois do encerramento.",
    ],
    perguntas: [
      {
        enunciado: "Encerrar o contrato do imóvel resolve a caução?",
        alternativas: [
          "Não — a caução tem caminho próprio e precisa ser devolvida ou retida",
          "Sim, é devolvida automaticamente",
          "Sim, é retida automaticamente",
        ],
        correta: 0,
        comentario:
          "São duas trilhas paralelas. O contrato encerra; a caução continua em aberto até alguém decidir. É assim que caução fica esquecida com o proprietário por anos.",
      },
      {
        enunciado: "Quantos contratos vigentes um imóvel pode ter?",
        alternativas: ["Um", "Um por obra vinculada", "Quantos forem necessários"],
        correta: 0,
        comentario:
          "Um vigente por vez. Os anteriores ficam no histórico, e é o histórico que mostra a evolução do aluguel ao longo dos reajustes.",
      },
    ],
  },

  {
    id: "ocupantes",
    numero: 3,
    titulo: "Ocupantes — quem mora onde",
    perfis: ["master", "administrador"],
    problema:
      "Sem saber quem está em cada quarto, não há como cobrar responsabilidade por dano, nem aplicar medida disciplinar que se sustente. E o aceite da política registrado é o que transforma uma regra afixada na parede em obrigação de quem assinou.",
    caminho: [
      "No imóvel, cadastre os ocupantes. O CPF aparece mascarado.",
      "Informe cargo, quarto e armário de cada um: é o que permite responsabilizar por dano localizado.",
      "Registre o aceite da Política de Alojamento. O Loca guarda a data, a hora e o endereço de rede de onde o aceite partiu.",
      "É esse aceite que sustenta uma medida disciplinar depois — sem ele, a defesa é sempre que a pessoa não conhecia a regra.",
      "Respeite a capacidade do imóvel cadastrada.",
    ],
    exemplo:
      "O alojamento da Rua das Palmeiras recebe seis ocupantes da Torre B. Cada um com quarto e armário, e o aceite da política registrado no dia da chegada.",
    exercicios: [
      "Cadastre um ocupante de teste com quarto e armário.",
      "Registre o aceite da política e confira a data e hora gravadas.",
      "Confira o CPF mascarado e o botão de revelar.",
    ],
    perguntas: [
      {
        enunciado: "Para que serve registrar o aceite da Política de Alojamento?",
        alternativas: [
          "Para sustentar uma medida disciplinar — prova que a pessoa conhecia a regra",
          "É exigência do sistema para salvar o ocupante",
          "Serve apenas como estatística",
        ],
        correta: 0,
        comentario:
          "Medida disciplinar sem prova de que a regra era conhecida cai. O aceite com data, hora e endereço de rede é o que fecha essa porta.",
      },
    ],
  },

  {
    id: "documentos-alojamento",
    numero: 4,
    titulo: "Os sete documentos do alojamento",
    perfis: ["master", "administrador"],
    problema:
      "O alojamento é a parte mais documental do Loca: sete dos oito documentos que o sistema gera pertencem a ele. Cada um existe para fechar uma porta — e o que não é emitido na hora certa não se emite depois, porque ninguém assina retroativo.",
    caminho: [
      "Contrato de locação de imóvel: sai do contrato do imóvel, assinado pelo proprietário e pela Sistenge. Fica no imóvel.",
      "Termo de Compromisso de Alojamento (FRM-RH-001): sai na chegada do ocupante, assinado por ele. Cita a política e a entrega de chaves.",
      "Política de Alojamento (POL-RH-001): é o normativo. Não se assina — se aceita, e o aceite fica no cadastro do ocupante.",
      "Entrega e devolução de chaves (FRM-RH-003): sai na entrada e volta a sair na saída, com conferência do que foi devolvido.",
      "Recebimento e devolução do kit (FRM-RH-004): mesma lógica das chaves, para colchão, roupa de cama, utensílios. Registra avaria e a tratativa.",
      "Checklist semanal de limpeza (FRM-RH-005): sai toda semana, com as tarefas conferidas.",
      "Medida disciplinar — advertência e suspensão (FRM-RH-002): sai quando há infração. Registra o fato, o local, as testemunhas, as regras violadas da política e a alínea do artigo 482 da CLT quando cabe.",
      "Todos ficam na biblioteca de documentos do imóvel, organizados por categoria: normativo, formulário, placa e comunicação.",
    ],
    exemplo:
      "Na chegada dos seis ocupantes à Rua das Palmeiras: FRM-RH-001 assinado por cada um, aceite da POL-RH-001 registrado, FRM-RH-003 com as chaves de cada quarto e FRM-RH-004 com o kit. A partir da primeira semana, FRM-RH-005 toda sexta-feira.",
    exercicios: [
      "Gere o Termo de Compromisso (FRM-RH-001) de um ocupante de teste e confira o bloco de identificação.",
      "Registre uma entrega de chaves (FRM-RH-003) e depois a devolução.",
      "Registre uma entrega de kit (FRM-RH-004) com avaria e escolha a tratativa.",
      "Gere um checklist de limpeza (FRM-RH-005) e marque as tarefas.",
      "Abra a biblioteca do imóvel e localize a POL-RH-001 na categoria de normativos.",
    ],
    perguntas: [
      {
        enunciado: "A Política de Alojamento (POL-RH-001) é assinada pelo ocupante?",
        alternativas: [
          "Não — ela é aceita, e o aceite fica registrado no cadastro do ocupante",
          "Sim, como qualquer formulário",
          "Só quando há medida disciplinar",
        ],
        correta: 0,
        comentario:
          "Ela é o normativo, não o formulário. O que se registra é o aceite, com data, hora e endereço de rede — e é ele que sustenta a medida disciplinar depois.",
      },
      {
        enunciado:
          "Uma medida disciplinar (FRM-RH-002) precisa citar o quê para se sustentar?",
        alternativas: [
          "O fato, o local, as testemunhas e as regras da política que foram violadas",
          "Apenas a descrição do fato",
          "Apenas a alínea da CLT",
        ],
        correta: 0,
        comentario:
          "É o conjunto que sustenta: o fato descrito, onde aconteceu, quem viu, qual regra da POL-RH-001 foi violada e, quando cabe, a alínea do artigo 482. Faltando a regra violada, a medida vira opinião.",
      },
    ],
  },

  {
    id: "consumo",
    numero: 5,
    titulo: "Contas de consumo",
    perfis: ["master", "administrador"],
    problema:
      "Água, luz e gás do alojamento chegam separados do aluguel e é fácil pagá-los sem nunca saber quanto aquele imóvel custa de verdade. Sem o consumo lançado, o custo do alojamento no relatório é só o aluguel — e a decisão de trocar de imóvel é tomada com o número errado.",
    caminho: [
      "No imóvel, abra contas de consumo e registre mês a mês.",
      "Os tipos são água, luz, gás, internet, IPTU e outros.",
      "Marque a opção de lançar no financeiro para que a conta entre nas contas a pagar.",
      "Confira contra o contrato o que é do proprietário e o que é da Sistenge — nem todo condomínio inclui água.",
      "O relatório de consumo de imóveis consolida tudo por obra e por período.",
    ],
    exemplo:
      "A Rua das Palmeiras custa R$ 2.120,00 de aluguel mais condomínio. Com água, luz e gás de seis pessoas, passa de R$ 2.800,00 — e é esse número que serve para comparar com a alternativa.",
    exercicios: [
      "Registre uma conta de luz de teste e lance no financeiro.",
      "Confirme que ela apareceu nas contas a pagar.",
      "Gere o relatório de consumo de imóveis do período.",
    ],
    perguntas: [
      {
        enunciado: "Qual o risco de não lançar as contas de consumo?",
        alternativas: [
          "O custo do imóvel no relatório fica só com o aluguel, e a comparação entre imóveis sai errada",
          "Nenhum — consumo não é custo de locação",
          "O sistema bloqueia o pagamento do aluguel",
        ],
        correta: 0,
        comentario:
          "O relatório só sabe o que foi lançado. Decidir trocar de alojamento comparando aluguel contra aluguel, sem consumo, é comparar metade do custo.",
      },
    ],
  },

  {
    id: "imovel-vistorias",
    numero: 6,
    titulo: "Vistorias, reparos e ocorrências do imóvel",
    perfis: ["master", "administrador"],
    problema:
      "Na saída, o proprietário aponta dano e quer descontar da caução. Sem vistoria de entrada com foto, a discussão é de palavra — e a caução, que é dinheiro da obra, fica retida. Vale exatamente o mesmo raciocínio do equipamento.",
    caminho: [
      "No imóvel, registre a vistoria com fotos. Ela recebe número próprio, no formato VIM.",
      "Reparos são registrados com anexo: o que foi feito, quando e quanto custou.",
      "Ocorrências registram o que aconteceu no imóvel e recebem número OCO.",
      "Faça a vistoria de entrada ANTES de o primeiro ocupante chegar. Depois disso, todo dano é discutível.",
      "Na saída, a vistoria de devolução é o que decide se a caução volta ou é retida.",
    ],
    exemplo:
      "A vistoria de entrada da Rua das Palmeiras registrou a infiltração no banheiro do quarto 2 antes de qualquer ocupante entrar. Na saída, o proprietário tenta descontar da caução de R$ 3.600,00 — e a foto de entrada decide.",
    exercicios: [
      "Registre uma vistoria de imóvel com foto e localize o número VIM gerado.",
      "Registre um reparo com custo e anexo.",
      "Registre uma ocorrência e confira o número OCO.",
    ],
    perguntas: [
      {
        enunciado: "Quando fazer a vistoria de entrada do imóvel?",
        alternativas: [
          "Antes de o primeiro ocupante entrar",
          "No primeiro mês de ocupação",
          "Só na saída, comparando com o contrato",
        ],
        correta: 0,
        comentario:
          "Depois que alguém mora ali, todo dano passa a ser discutível. É o mesmo raciocínio da vistoria de retirada do equipamento: a prova é o estado inicial, e ele só existe antes do uso.",
      },
    ],
  },
];

export const TRILHA_B: Trilha = {
  id: "imoveis",
  numero: 2,
  titulo: "Imóveis e alojamento",
  subtitulo:
    "Kitnet, apartamento, casa, galpão e escritório locados: contrato, caução, ocupantes, os sete documentos do RH, consumo e vistoria.",
  modulos,
};
