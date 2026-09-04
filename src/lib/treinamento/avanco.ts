// Trilha do avanço semanal.
//
// A trilha mais curta do sistema, e a que evita o erro mais caro: o campo pede
// o percentual ACUMULADO da obra, não o da semana. Quem digita 5 achando que
// informou "avançamos 5 pontos nesta semana" joga a obra de 60% para 5%, e o
// avanço alimenta a projeção de orçamento e a previsão de término — o erro
// aparece na reunião de diretoria, não na tela.

import type { Trilha } from "./tipos";

export const AVANCO: Trilha = {
  chave: "avanco",
  titulo: "Avanço semanal das obras",
  resumo:
    "Lançar o percentual de cada obra na semana, ler o desvio de prazo e saber o que o avanço alimenta.",
  modulo: "avanco",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "avanco-semana",
      titulo: "A tela da semana",
      resumo:
        "Uma linha por obra ativa, e a semana que começa na segunda-feira.",
      rotas: ["/avanco"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/avanco",
          acao: "Abra Avanço das obras e leia a linha embaixo do título.",
          esperado:
            "A data da segunda-feira da semana e, ao lado, quantas obras ainda estão sem lançamento — ou “todas as obras lançadas”.",
        },
        {
          onde: "/avanco",
          acao: "Olhe as obras marcadas em vermelho com “Sem lançamento nesta semana”.",
          esperado:
            "São as que faltam. É a lista de cobrança da semana, e ela se esvazia conforme os lançamentos entram.",
        },
        {
          onde: "/avanco",
          acao: "Abra a tela num domingo, se puder.",
          esperado:
            "A semana mostrada continua sendo a que começou na segunda anterior. Domingo FECHA a semana, não abre uma nova — sem esse ajuste, todo lançamento de domingo cairia na semana seguinte.",
        },
      ],
      atencao: [
        "Só obra ativa aparece. Obra pausada ou encerrada sai da tela — e é por isso que o status da obra precisa estar em dia.",
        "Lançar o avanço é de master e administrador. Nos outros perfis a tela mostra o que já foi lançado, sem os campos.",
      ],
    },
    {
      id: "avanco-lancar",
      titulo: "O percentual é o ACUMULADO da obra",
      resumo:
        "O erro mais caro desta tela, e as duas coisas que a tela faz para ajudar a não cometê-lo.",
      rotas: ["/avanco"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/avanco",
          acao: "Olhe o texto “Anterior: 60%” ao lado do campo, antes de digitar.",
          esperado:
            "É o último percentual lançado. O número que você vai digitar precisa ser maior que ele — porque é o total da obra, não o quanto ela andou na semana.",
        },
        {
          onde: "/avanco",
          acao: "Digite o novo acumulado — 65, e não 5 — e escreva a observação da semana.",
          esperado:
            "Aceita valores com casa decimal, de 0 a 100. A observação é opcional e é onde entra o motivo de uma semana fraca: chuva, falta de material, aditivo.",
        },
        {
          onde: "/avanco",
          acao: "Deixe em branco a linha de uma obra que você não vai lançar, e salve.",
          esperado:
            "Aparece quantos avanços foram lançados. A linha em branco é DESCARTADA — ela não vira lançamento de 0%.",
        },
        {
          onde: "/avanco",
          acao: "Lance várias obras de uma vez.",
          esperado:
            "Um único botão salva todas as linhas preenchidas. A tela foi feita para a rotina de segunda-feira: uma passada, todas as obras.",
        },
      ],
      atencao: [
        "Linha em branco não é zero, e isso é proposital: abrir a tela e salvar sem preencher gravaria “0% de avanço” em toda obra não lançada — e, como o avanço é acumulado, isso APAGARIA o progresso real de cada uma.",
        "Se você lançou o número errado, lance o certo: o valor da semana é o que vale, e o histórico guarda a sequência.",
      ],
    },
    {
      id: "avanco-desvio",
      titulo: "O desvio, calculado enquanto você digita",
      resumo:
        "Pontos de atraso é a comparação entre o que a obra entregou e o quanto do prazo já passou.",
      rotas: ["/avanco"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/avanco",
          acao: "Digite um percentual e olhe o texto embaixo do nome da obra.",
          esperado:
            "Ele muda na hora: “12 pontos de atraso”, “3 pontos adiantada” ou “No prazo”. Você vê a consequência do número antes de salvar.",
        },
        {
          onde: "/avanco",
          acao: "Entenda a conta: é o prazo decorrido menos o avanço físico.",
          esperado:
            "Obra com 70% do prazo passado e 58% entregue está 12 pontos atrasada. Não é opinião nem julgamento de quem lança — são duas datas e um percentual.",
        },
        {
          onde: "/avanco",
          acao: "Procure alguma obra com “Período não informado”.",
          esperado:
            "Falta data de início ou de fim previsto no cadastro da obra. Sem período não há prazo decorrido, e sem prazo decorrido não há desvio a calcular.",
        },
      ],
      atencao: [
        "Obra atrasada no desvio não é obra com problema, necessariamente — pode ser previsão inicial errada. O desvio abre a conversa; ele não a encerra.",
      ],
    },
    {
      id: "avanco-para-que",
      titulo: "O que o avanço alimenta fora desta tela",
      resumo:
        "Dois indicadores da ficha da obra dependem exclusivamente deste lançamento.",
      rotas: ["/avanco", "/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras/[id]",
          acao: "Depois de lançar, abra a ficha da obra e veja o bloco Avanço da obra.",
          esperado:
            "Avanço físico, prazo decorrido, desvio, orçamento consumido e previsão de término — com o histórico das últimas semanas embaixo.",
        },
        {
          onde: "/obras/[id]",
          acao: "Olhe a Projeção final, no bloco de orçamento.",
          esperado:
            "Ela usa o avanço físico como divisor: se 31% de obra custou 62% do orçamento, a projeção é 200%. Sem avanço lançado, ela fica vazia.",
        },
        {
          onde: "/obras/[id]",
          acao: "Olhe a Previsão de término.",
          esperado:
            "Sai do RITMO das últimas semanas de avanço. Com menos de dois lançamentos ela mostra “ritmo insuficiente para projetar” em vez de uma data inventada.",
        },
      ],
      atencao: [
        "Semana sem lançamento não é só um dado a menos: é o ritmo que fica desatualizado, e com ele a previsão de término e a projeção de custo. Cinco minutos na segunda-feira sustentam os dois painéis.",
        "Abrir a ficha da obra é de master e administrador. Nos outros perfis, o avanço da semana se vê nesta própria tela.",
      ],
    },
  ],
  perguntas: [
    {
      id: "ava-acumulado",
      enunciado:
        "A obra estava com 60% e avançou 5 pontos nesta semana. O que se digita no campo?",
      alternativas: [
        "5, que foi o avanço da semana",
        "65, porque o campo pede o percentual acumulado da obra",
        "5%, com o sinal de percentual",
        "Tanto faz: o sistema soma ao anterior",
      ],
      correta: 1,
      porque:
        "O campo é o total da obra, e a tela mostra “Anterior: 60%” justamente para você comparar antes de digitar. Lançar 5 jogaria a obra de 60% para 5%, e como o avanço alimenta a projeção de custo e a previsão de término, o erro aparece na reunião de diretoria — não na tela.",
      aula: "avanco-lancar",
    },
    {
      id: "ava-branco",
      enunciado:
        "Você abriu a tela para lançar duas obras e deixou as outras cinco em branco. O que acontece com as cinco ao salvar?",
      alternativas: [
        "Ficam registradas com 0% naquela semana",
        "O sistema recusa o envio até que todas estejam preenchidas",
        "Repetem automaticamente o percentual da semana anterior",
        "São descartadas: nenhum lançamento é criado para elas",
      ],
      correta: 3,
      porque:
        "Linha em branco é descartada de propósito. Se virasse lançamento de 0%, abrir a tela e salvar apagaria o progresso acumulado de toda obra não preenchida — o avanço é acumulado, então 0% não significa “não andou”, significa “voltou ao início”.",
      aula: "avanco-lancar",
    },
    {
      id: "ava-desvio",
      enunciado:
        "A tela diz que uma obra está com “12 pontos de atraso”. De onde sai esse número?",
      alternativas: [
        "Da diferença entre o percentual desta semana e o da semana anterior",
        "Da diferença entre o prazo decorrido da obra e o avanço físico lançado",
        "Da diferença entre o orçamento consumido e o avanço",
        "Da quantidade de semanas sem lançamento",
      ],
      correta: 1,
      porque:
        "É quanto do período da obra já passou, menos quanto da obra já foi entregue: 70% de prazo com 58% entregue dá 12 pontos. Por isso obra sem data de início ou de fim previsto mostra “Período não informado” — sem período não existe prazo decorrido, e sem ele não há desvio.",
      aula: "avanco-desvio",
    },
    {
      id: "ava-domingo",
      enunciado:
        "Você vai lançar o avanço num domingo. A qual semana o lançamento pertence?",
      alternativas: [
        "À semana que começa na segunda seguinte",
        "À semana que começou na segunda anterior",
        "O sistema recusa lançamento no fim de semana",
        "A uma semana parcial, só com o domingo",
      ],
      correta: 1,
      porque:
        "Domingo fecha a semana que começou na segunda anterior; ele não abre uma nova. Sem esse ajuste, o lançamento feito no domingo à noite entraria na semana seguinte e a semana que acabou ficaria marcada como “sem lançamento” — cobrando de quem já tinha lançado.",
      aula: "avanco-semana",
    },
  ],
};
