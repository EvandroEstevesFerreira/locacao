// Trilha da frota e da custódia da peça.
//
// A pergunta que esta trilha ensina a responder é a que mais se ouve no
// almoxarifado: "onde está a betoneira, e com quem ela ficou?". Duas telas
// respondem — a lista responde "onde", o detalhe responde "com quem e desde
// quando" — e a diferença entre as duas é o que a maioria das pessoas não
// percebe sozinha.

import type { Trilha } from "./tipos";

export const FROTA: Trilha = {
  chave: "frota",
  titulo: "Frota: onde está e com quem está",
  resumo:
    "Achar uma peça, ler o histórico de custódia, movimentar entre obras e entender as situações.",
  modulo: "frota",
  papeis: [],
  // 2: a aula de ordens de reparo. Bumpar é o que faz `aulasNovasDesde` mostrar
  // a aula a quem já concluiu a versão 1 — sem isso, quem fez a trilha antes de
  // Reparos existir continuaria marcado como "concluída" sem nunca vê-la.
  versao: 2,
  aulas: [
    {
      id: "frota-achar",
      titulo: "Achar a peça na lista",
      resumo:
        "Quatro filtros e uma busca. Saber qual deles usar é a diferença entre trinta segundos e meia hora.",
      rotas: ["/frota"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota",
          acao: "Digite um patrimônio, um número de série ou parte da descrição na busca.",
          esperado:
            "A lista filtra ao vivo pelos três campos ao mesmo tempo — você não precisa saber de antemão qual deles tem o que você digitou.",
        },
        {
          onde: "/frota",
          acao: "Use o filtro Obra para ver tudo o que está numa obra.",
          esperado:
            "A lista mostra só as peças daquela obra. É a resposta para “o que a gente tem lá?” antes de mandar mais equipamento.",
        },
        {
          onde: "/frota",
          acao: "Combine o filtro Situação com o filtro Propriedade.",
          esperado:
            "Por exemplo: Disponível + Locada de terceiro mostra o que a empresa está pagando e não está usando. É a lista que faz alguém devolver equipamento ou parar de pagar.",
        },
        {
          onde: "/frota",
          acao: "Leia as colunas da tabela.",
          esperado:
            "Patrimônio, Item, Categoria, Situação, Onde está, Propriedade e Estado. “Onde está” é o lugar; quem respondeu pela peça está no detalhe.",
        },
      ],
      atencao: [
        "A peça é cadastrada no catálogo, não aqui. A Frota mostra e movimenta; não existe botão de nova peça nesta tela.",
      ],
    },
    {
      id: "peca-com-quem",
      titulo: "O topo do detalhe: com quem está, e há quanto tempo",
      resumo:
        "Os dois campos em destaque respondem a pergunta que a lista não responde.",
      rotas: ["/frota/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota",
          acao: "Clique no patrimônio de uma peça.",
          esperado:
            "Abre o detalhe. Os dois primeiros campos são “Com quem está” — em destaque — e “Há”.",
        },
        {
          onde: "/frota/[id]",
          acao: "Leia “Com quem está”.",
          esperado:
            "Pode ser o almoxarifado central, uma obra, um funcionário ou um fornecedor em manutenção. Quando não há registro nenhum, a tela diz “Sem registro de posse” — e isso é diferente de estar no almoxarifado.",
        },
        {
          onde: "/frota/[id]",
          acao: "Leia o campo “Há”.",
          esperado:
            "O tempo da posse atual, em dias, meses ou anos. É o número que sustenta a conversa de cobrança: “está com essa obra há 8 meses” pesa mais que “está com essa obra”.",
        },
      ],
      atencao: [
        "Peça cadastrada antes do livro de custódia começa sem histórico, e o sistema diz isso em vez de inventar uma posse. O histórico dela começa na primeira movimentação.",
      ],
    },
    {
      id: "peca-mover",
      titulo: "Movimentar a peça",
      resumo:
        "Três destinos, e um quarto que de propósito não está aqui: entregar a uma pessoa é termo, com assinatura.",
      rotas: ["/frota/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota/[id]",
          acao: "No bloco Movimentar, abra “Para onde vai”.",
          esperado:
            "Três destinos: Obra, Almoxarifado central e Manutenção em fornecedor. Escolhendo Obra ou Fornecedor, aparece o segundo campo para dizer qual.",
        },
        {
          onde: "/frota/[id]",
          acao: "Confira a data da movimentação antes de confirmar.",
          esperado:
            "Ela vem preenchida com hoje, mas aceita a data real da saída. É essa data que fecha a posse anterior e abre a nova — lançar com a data errada erra o tempo dos dois períodos.",
        },
        {
          onde: "/frota/[id]",
          acao: "Escreva nas observações quem levou e em que veículo, e confirme.",
          esperado:
            "Aparece “Movimentação registrada no histórico da peça”, o topo passa a mostrar o novo detentor, e a linha do tempo ganha um período novo.",
        },
        {
          onde: "/frota/[id]",
          acao: "Repare no botão “Entregar a funcionário”, no topo da tela.",
          esperado:
            "Ele leva para o termo de responsabilidade, não para o bloco Movimentar. Entregar equipamento a uma pessoa exige assinatura, e é isso que o termo faz.",
        },
      ],
      atencao: [
        "Movimentar exige perfil de operador, administrador ou master. Gestor não vê o bloco.",
        "Mandar para manutenção em fornecedor muda a situação da peça para Em manutenção. Quando ela volta, a movimentação para o almoxarifado é o que a deixa disponível de novo — e é ali que alguém confere se ela voltou inteira.",
      ],
    },
    {
      id: "peca-historico",
      titulo: "Ler o histórico de custódia",
      resumo:
        "Um período por posse, com data de início, fim e duração. É o livro que responde “com quem ficou”.",
      rotas: ["/frota/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota/[id]",
          acao: "Vá ao bloco Histórico de custódia.",
          esperado:
            "Uma lista de períodos. O primeiro é a posse atual, marcada com “Agora”, e os outros vêm do mais recente para o mais antigo.",
        },
        {
          onde: "/frota/[id]",
          acao: "Leia uma linha inteira.",
          esperado:
            "Quem ficou com a peça, a data de início, a de fim (ou “em aberto”), a duração e, quando a posse veio de um termo, o número do termo.",
        },
        {
          onde: "/frota/[id]",
          acao: "Procure alguma linha marcada como “Termo cancelado”.",
          esperado:
            "O período continua no histórico, marcado. Um documento anulado não desaparece: “esteve com o Fulano” e “houve um termo que não valeu” são fatos diferentes, e o segundo também precisa aparecer.",
        },
      ],
      atencao: [
        "O histórico não é editável, nem pelo master. Cada posse é um período fechado; corrigir é registrar a movimentação seguinte, não reescrever a anterior. É o que faz o livro valer como prova.",
        "Mover a peça da Obra A para a Obra B não apaga que ela esteve na A. Antes do livro de custódia era exatamente o que acontecia — a obra nova sobrescrevia a anterior.",
      ],
    },
    {
      id: "peca-situacao",
      titulo: "As situações da peça, e por que algumas não se escolhem",
      resumo:
        "Disponível, Em uso, Em manutenção, Baixada, Perdida — e as transições que o sistema recusa de propósito.",
      rotas: ["/frota/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota/[id]",
          acao: "No bloco Situação da peça, abra a lista de novas situações.",
          esperado:
            "Aparecem só as situações alcançáveis a partir da atual. A lista muda conforme onde a peça está — não é a mesma lista sempre.",
        },
        {
          onde: "/frota/[id]",
          acao: "Numa peça em uso, tente escolher Baixada.",
          esperado:
            "O sistema recusa e explica: a peça está em uso, e é preciso encerrar o termo de responsabilidade antes de baixá-la. Alguém assinou por ela.",
        },
        {
          onde: "/frota/[id]",
          acao: "Repare que “Em uso” nunca aparece como opção.",
          esperado:
            "“Em uso” é consequência de um termo assinado, não uma escolha de tela. Do outro lado, é a devolução registrada no termo que devolve a peça para Disponível.",
        },
        {
          onde: "/frota/[id]",
          acao: "Numa peça em manutenção, veja para onde ela pode ir.",
          esperado:
            "Disponível ou Baixada — nunca direto para Em uso. Ela passa por Disponível, que é onde alguém confere que ela voltou em condição de sair de novo.",
        },
      ],
      atencao: [
        "Mudar situação e editar cadastro exigem perfil de administrador ou master. Operador movimenta a peça, mas não a baixa.",
        "Baixada e Perdida podem voltar para Disponível. É a saída para erro de digitação — e para a peça que reapareceu.",
      ],
    },
    {
      id: "peca-ti",
      titulo: "Celular, notebook e desktop: os campos de TI",
      resumo:
        "Quando a peça é de TI, o cadastro mostra IMEI, linha, service tag e configuração — e isso vem da categoria.",
      rotas: ["/frota/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota/[id]",
          acao: "Abra uma peça de categoria TI.",
          esperado:
            "Além dos campos de sempre, aparecem IMEI, IMEI 2, Linha, Operadora, Service tag, Memória e Configuração.",
        },
        {
          onde: "/frota/[id]",
          acao: "Abra uma betoneira e compare.",
          esperado:
            "Os campos de TI não aparecem. Quem decide isso é o perfil da categoria da peça, não o nome do item — categoria de TI mostra os campos, as outras não.",
        },
        {
          onde: "/frota/[id]",
          acao: "No bloco Cadastro da peça, preencha o IMEI de um celular e salve.",
          esperado:
            "Salva. Se outro aparelho da empresa já tiver esse IMEI, o sistema recusa: IMEI é único no mundo, e IMEI repetido no cadastro é sinal de digitação errada.",
        },
      ],
      atencao: [
        "Os campos de TI ficam na PEÇA, não no item do catálogo: o mesmo modelo de notebook tem unidades com 8 e com 16 GB, e a verdade fica onde as duas divergem.",
        "IMEI 2 existe porque celular corporativo com dois chips é comum — e o segundo IMEI é o que a operadora pede no bloqueio por roubo. Preencher na hora do cadastro economiza a corrida no dia do sinistro.",
        "Memória é campo próprio para poder filtrar (“quais notebooks têm 8 GB para trocar este ano”). Processador, disco e sistema vão em Configuração, escrito como o TI já escreve.",
      ],
    },
    {
      id: "peca-reparo",
      titulo: "Ordem de reparo: onde a máquina está enquanto conserta",
      resumo:
        "O documento que autoriza a peça a sair da obra — e o que impede que ela suma do sistema enquanto está fora.",
      rotas: ["/frota/reparos", "/frota/reparos/nova", "/frota/[id]"],
      desdeVersao: 2,
      passos: [
        {
          onde: "/frota/reparos",
          acao: "Abra Reparos no menu.",
          esperado:
            "As ordens da organização, com quantas peças estão fora da obra e quantas passaram do prazo prometido.",
        },
        {
          onde: "/frota/[id]",
          acao: "Na peça, vá ao bloco Manutenção e clique em Abrir ordem de reparo.",
          esperado:
            "A peça já vem escolhida. O bloco também mostra quanto essa máquina já consumiu em conserto — é o número que decide entre consertar de novo e substituir.",
        },
        {
          onde: "/frota/reparos/nova",
          acao: "Descreva o serviço, informe a oficina e salve.",
          esperado:
            "A ordem nasce NUMERADA. Não existe rascunho aqui, porque é ela que autoriza a peça a sair da obra — e um rascunho de autorização não autoriza nada.",
        },
        {
          onde: "/frota/reparos/[id]",
          acao: "Quando a máquina sair de fato, mude a situação para Em execução e informe a data de saída.",
          esperado:
            "A peça passa a constar como em manutenção em TODAS as telas — frota, estoque, seleção de peça num termo. Ela deixa de ser oferecida a quem procura equipamento disponível.",
        },
        {
          onde: "/frota/reparos/[id]",
          acao: "Clique em Ordem em PDF.",
          esperado:
            "O documento que vai JUNTO com a máquina, com três assinaturas: quem autorizou, quem transportou e quem recebeu na oficina.",
        },
        {
          onde: "/frota/reparos/[id]",
          acao: "Na volta, use Concluir ordem com a data e o valor final.",
          esperado:
            "A peça volta a ficar disponível automaticamente, e a ordem deixa de ser editável.",
        },
      ],
      atencao: [
        "A ordem só marca a peça como em manutenção quando passa a Em execução — não ao ser aberta. É de propósito: a ordem pode ser emitida hoje e a máquina sair na quinta, e marcá-la antes esconderia da obra um equipamento que ainda está lá.",
        "A assinatura de quem recebe na oficina é a única prova de onde a peça foi parar. É a linha que resolve a conversa quando ela não volta.",
        "Reparo não precisa vir de avaria: revisão de rotina é manutenção preventiva, e a ordem sai igual. O campo “Avaria de origem” fica em branco, e isso diz que o custo era previsto.",
        "Ordem concluída não se exclui nem se edita — ela registra um custo pago e um serviço feito. Para desfazer, cancele: a peça volta e o rastro fica.",
      ],
    },
  ],
  perguntas: [
    {
      id: "fro-entregar",
      enunciado:
        "Um encarregado vai levar um notebook da empresa. Por que o bloco Movimentar não tem a opção “funcionário”?",
      alternativas: [
        "Porque a movimentação para pessoa é feita pelo módulo Estoque",
        "Porque entregar a uma pessoa exige assinatura, e isso é o termo de responsabilidade",
        "Porque só o master pode entregar equipamento a funcionário",
        "Porque o funcionário precisa ter usuário no sistema para receber",
      ],
      correta: 1,
      porque:
        "Obra, almoxarifado e fornecedor são lugares; funcionário é uma pessoa que responde pelo equipamento. A posse de funcionário só nasce de um termo assinado, e essa regra está no banco, não só na tela — é o que faz o termo valer como a única fonte sobre quem respondeu pela peça.",
      aula: "peca-mover",
    },
    {
      id: "fro-baixar-em-uso",
      enunciado:
        "Uma peça está Em uso e quebrou de vez. Você tenta mudar a situação para Baixada e o sistema recusa. O que fazer?",
      alternativas: [
        "Encerrar o termo de responsabilidade e depois baixar a peça",
        "Pedir ao master, que não tem essa restrição",
        "Movimentar a peça para o almoxarifado e baixar de lá",
        "Cadastrar uma peça nova e deixar a antiga como está",
      ],
      correta: 0,
      porque:
        "Enquanto o termo está aberto, existe alguém que assinou por aquela peça. Baixá-la por baixo do termo apagaria a pendência do documento — justamente o que sustenta a cobrança de quem ficou com equipamento quebrado. A restrição vale para todos os perfis, master incluído.",
      aula: "peca-situacao",
    },
    {
      id: "fro-historico",
      enunciado:
        "A betoneira saiu da Obra A para a Obra B em março. Hoje, o que o sistema mostra sobre a passagem dela pela Obra A?",
      alternativas: [
        "Nada: a obra atual substitui a anterior no cadastro",
        "Só a data da última movimentação",
        "Um período fechado na Obra A, com início, fim e duração",
        "Um aviso de que o histórico foi arquivado",
      ],
      correta: 2,
      porque:
        "O livro de custódia guarda uma linha por PERÍODO de posse, e a movimentação fecha a anterior e abre a seguinte. Antes dele, a obra nova sobrescrevia a antiga e a passagem pela Obra A desaparecia — que é como uma peça “nunca esteve” num lugar de onde ela saiu.",
      aula: "peca-historico",
    },
    {
      id: "fro-imei",
      enunciado:
        "Você abriu uma peça e não encontrou os campos de IMEI e linha telefônica. Por quê?",
      alternativas: [
        "Os campos aparecem só depois que a peça é entregue a alguém",
        "A categoria da peça não é de TI, e é a categoria que define esses campos",
        "Só o TI tem permissão para ver esses campos",
        "O item precisa ter “celular” na descrição",
      ],
      correta: 1,
      porque:
        "Quem governa os campos é o perfil da categoria, e não o nome do item nem o seu perfil de acesso. Amarrar isso ao nome quebraria no dia em que alguém renomeasse a categoria — e uma betoneira com campo de IMEI é um formulário pedindo dado que não existe.",
      aula: "peca-ti",
    },
    {
      id: "fro-sem-posse",
      enunciado:
        "O detalhe de uma peça mostra “Sem registro de posse”. O que isso significa?",
      alternativas: [
        "A peça foi perdida",
        "A peça está no almoxarifado central",
        "Houve erro ao carregar o histórico",
        "A peça foi cadastrada antes do livro e ainda não teve movimentação",
      ],
      correta: 3,
      porque:
        "O livro começou a registrar de uma data em diante, e o sistema não inventa posse retroativa — registrar um fato que ninguém observou é pior que admitir a falta. A primeira movimentação abre o histórico. E “sem registro” não é o mesmo que “no almoxarifado”: essa é uma posse de verdade, registrada.",
      aula: "peca-com-quem",
    },
  ],
};
