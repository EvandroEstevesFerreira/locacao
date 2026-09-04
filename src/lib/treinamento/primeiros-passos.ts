// Trilha de primeiros passos — a única que todo usuário faz, em qualquer papel.
//
// A aula `entrar` fala de uma tela que quem está lendo já passou: ela existe
// para o MANUAL (alguém consultando por outra pessoa, ou lendo antes de repassar
// a senha a um novo funcionário), não porque quem está trancado fora vá lê-la.
//
// VERSÃO 2 — a aula `achar-obra` estava ERRADA quando foi publicada, na 0.53.0.
// Ela mandava clicar no código da obra (o código não é link; o link é um lápis
// na coluna de ações) e prometia "as seções de contratos, orçamento e avanço"
// numa tela que se chama "Editar obra" e não tem seção de contratos. Pior: a
// tela redireciona para a lista quem não é master ou administrador, então o
// passo era impossível para gestor e operador — que são a maioria de quem faz
// esta trilha.
//
// O bump é o mecanismo funcionando como projetado: quem concluiu a v1 vê
// "atualização pendente" e relê apenas a aula que mudou.

import type { Trilha } from "./tipos";

export const PRIMEIROS_PASSOS: Trilha = {
  chave: "primeiros-passos",
  titulo: "Primeiros passos no Loca",
  resumo:
    "Entrar, entender o menu, achar uma obra e saber o que fazer quando falta acesso.",
  modulo: null,
  papeis: [],
  versao: 2,
  aulas: [
    {
      id: "entrar",
      titulo: "Entrar no Loca",
      resumo: "Onde é o endereço, e o que fazer quando a senha não passa.",
      rotas: ["/login"],
      desdeVersao: 1,
      passos: [
        {
          onde: "Navegador",
          acao: "Abra o endereço do Loca e guarde nos favoritos.",
          esperado: "A tela de entrada aparece, com campo de e-mail e senha.",
        },
        {
          onde: "/login",
          acao: "Digite o seu e-mail da Sistenge e a senha que você recebeu.",
          esperado:
            "O sistema abre na tela inicial, com o seu nome no canto e o menu à esquerda.",
        },
        {
          onde: "/login",
          acao: "Erre a senha de propósito uma vez, para conhecer a mensagem.",
          esperado:
            "Aparece um aviso dizendo que o e-mail ou a senha não conferem — e não qual dos dois. É de propósito: dizer qual entregaria a metade da informação a quem está tentando adivinhar.",
        },
      ],
      atencao: [
        "Não existe cadastro por conta própria. Quem cria usuário é o master, e você recebe a senha dele.",
        "Esqueceu a senha? Peça a redefinição ao master. Não há e-mail automático de recuperação.",
      ],
    },
    {
      id: "trocar-senha",
      titulo: "A troca de senha do primeiro acesso",
      resumo: "Por que o sistema obriga, e por que não dá para pular.",
      rotas: ["/trocar-senha"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/trocar-senha",
          acao: "No primeiro acesso, escolha uma senha sua e confirme.",
          esperado:
            "O sistema libera o resto das telas. Antes disso, qualquer endereço que você digitar traz você de volta para cá.",
        },
      ],
      atencao: [
        "A senha que o master te deu é conhecida por ele. Enquanto você não trocar, a conta não é só sua — é por isso que a troca vem antes de tudo.",
        "Você pode trocar a senha depois, quando quiser, em Perfil.",
      ],
    },
    {
      id: "menu",
      titulo: "O menu, e por que o seu é diferente do menu do colega",
      resumo:
        "O menu mostra só o que foi liberado para você, agrupado por área de trabalho.",
      rotas: ["/"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/",
          acao: "Olhe o menu à esquerda e repare nos títulos de grupo.",
          esperado:
            "Os itens estão agrupados em Obra, Equipamento, Imóveis e Financeiro. Grupo sem nenhum item liberado para você não aparece.",
        },
        {
          onde: "/",
          acao: "Compare o seu menu com o de um colega de outro cargo.",
          esperado:
            "Os dois menus são diferentes. Cada usuário tem uma lista de módulos liberados, e o menu mostra só esses.",
        },
        {
          onde: "Celular",
          acao: "Abra o Loca no celular e toque no menu.",
          esperado:
            "O mesmo agrupamento aparece, adaptado à tela. O sistema é o mesmo — não existe versão reduzida.",
        },
      ],
      atencao: [
        "O menu não é preferência sua nem do sistema: é a permissão. Item que falta é módulo não liberado, e quem libera é o master ou o administrador.",
      ],
    },
    {
      id: "achar-obra",
      titulo: "Achar uma obra, e onde ver o que pendura nela",
      resumo: "A obra é o centro do Loca — quase tudo pendura nela.",
      rotas: ["/obras"],
      desdeVersao: 2,
      passos: [
        {
          onde: "/obras",
          acao: "Abra Obras e digite parte do código, do nome ou do responsável na busca.",
          esperado:
            "A lista filtra enquanto você digita, sem precisar apertar nada. As colunas são código, nome, responsável e status.",
        },
        {
          onde: "/obras",
          acao: "Clique no título de uma coluna para reordenar.",
          esperado:
            "A lista reordena por aquela coluna, e clicar de novo inverte. Ordenar por status agrupa as obras ativas.",
        },
        {
          onde: "Menu",
          acao: "Para ver o que está numa obra, use as telas que penduram nela.",
          esperado:
            "Frota filtrada por obra mostra o equipamento que está lá; Estoque filtrado por local mostra o material; Avanço mostra o percentual da semana. A obra é o filtro, e ele existe em quase toda lista.",
        },
      ],
      atencao: [
        "Abrir a ficha da obra — período, orçamento, fechamento mensal — é de master e administrador. Nos outros perfis a lista não oferece o botão, porque a tela devolveria você para cá.",
      ],
    },
    {
      id: "filtros",
      titulo: "Filtrar e buscar em qualquer lista",
      resumo:
        "Todas as listas do sistema funcionam igual — aprender uma é aprender todas.",
      rotas: ["/obras", "/contratos", "/frota", "/estoque", "/termos", "/itens"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota",
          acao: "Digite na busca e escolha algo num dos seletores de filtro.",
          esperado:
            "A lista se ajusta na hora, sem botão de aplicar, e volta para a primeira página.",
        },
        {
          onde: "/frota",
          acao: "Filtre por algo que não existe, de propósito.",
          esperado:
            "O cabeçalho da tabela continua na tela e uma linha diz que não há registro no filtro atual. Isso é diferente de a tela dizer que não há nenhum registro cadastrado — a primeira é filtro, a segunda é cadastro vazio.",
        },
        {
          onde: "/relatorios",
          acao: "Abra Relatórios e repare que aqui há um botão de aplicar.",
          esperado:
            "É a única tela com botão, de propósito: são seis filtros que precisam valer juntos, e aplicar um por um refaria o relatório seis vezes.",
        },
      ],
      atencao: [
        "O endereço da página guarda os filtros. Dá para mandar um link já filtrado para um colega — se ele tiver acesso ao módulo, ele vê o mesmo que você.",
      ],
    },
    {
      id: "novidades-e-acesso",
      titulo: "Ver o que mudou, e pedir o acesso que falta",
      resumo:
        "Onde o sistema conta o que mudou, e o caminho certo quando uma tela não aparece.",
      rotas: ["/novidades", "/perfil"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/novidades",
          acao: "Abra Novidades.",
          esperado:
            "A lista mostra o que mudou em cada versão, da mais recente para a mais antiga, com o número da versão atual no topo.",
        },
        {
          onde: "/perfil",
          acao: "Abra Perfil e confira o seu nome, e-mail e cargo.",
          esperado:
            "Os dados aparecem. O seu papel no sistema também — e ele não é editável por você.",
        },
        {
          onde: "Menu",
          acao:
            "Precisa de uma tela que não está no seu menu? Peça ao master ou ao administrador para liberar o módulo.",
          esperado:
            "Digitar o endereço à mão não funciona: o sistema devolve você para a tela inicial. O acesso é por módulo, não por conhecer o caminho.",
        },
      ],
      atencao: [
        "Quando a versão em Novidades não bate com o que alguém te disse que mudou, provavelmente a atualização ainda não subiu. Avise quem cuida do sistema.",
      ],
    },
  ],
  perguntas: [
    {
      id: "pq-menu",
      enunciado:
        "O menu de um colega tem itens que o seu não tem. Qual é a explicação?",
      alternativas: [
        "Ele tem um plano diferente do seu",
        "Cada usuário tem módulos liberados, e o menu mostra só os dele",
        "O menu muda conforme o horário de trabalho de cada um",
        "Ele está usando uma versão mais nova do sistema",
      ],
      correta: 1,
      porque:
        "O acesso no Loca é por módulo, liberado usuário por usuário pelo master ou pelo administrador. O menu é a permissão desenhada na tela — não preferência, nem versão.",
      aula: "menu",
    },
    {
      id: "pq-lista-vazia",
      enunciado:
        "Você filtrou uma lista e ela não trouxe nada, mas o cabeçalho da tabela continua na tela. O que isso quer dizer?",
      alternativas: [
        "O sistema travou e precisa recarregar",
        "Não existe nenhum registro cadastrado nesse módulo",
        "Existem registros, mas nenhum atende ao filtro que está ativo",
        "Você perdeu o acesso ao módulo",
      ],
      correta: 2,
      porque:
        "O cabeçalho preservado com uma linha de aviso significa filtro sem resultado. Cadastro realmente vazio mostra outra coisa: um bloco no meio da tela explicando o que é aquele módulo e oferecendo criar o primeiro registro. Confundir os dois faz a pessoa cadastrar o que já existe.",
      aula: "filtros",
    },
    {
      id: "pq-sem-acesso",
      enunciado:
        "Você precisa usar uma tela que não aparece no seu menu. Qual é o caminho?",
      alternativas: [
        "Digitar o endereço da tela direto no navegador",
        "Pedir ao master ou ao administrador para liberar o módulo",
        "Entrar com o usuário de um colega que tem acesso",
        "Criar um segundo usuário para você",
      ],
      correta: 1,
      porque:
        "Digitar o endereço não funciona: o sistema devolve você para a tela inicial, porque a verificação é no servidor e não no menu. E entrar com usuário de outra pessoa apaga o rastro de quem fez o quê — em telas que geram documento assinado, isso é o pior resultado possível.",
      aula: "novidades-e-acesso",
    },
    {
      id: "pq-trocar-senha",
      enunciado:
        "Por que o sistema obriga a trocar a senha no primeiro acesso, antes de liberar qualquer tela?",
      alternativas: [
        "Para o sistema medir a força da senha",
        "Porque a senha inicial é conhecida por quem criou o seu usuário",
        "Porque a senha expira a cada 30 dias",
        "Para liberar o acesso pelo celular",
      ],
      correta: 1,
      porque:
        "Quem cria o usuário define a primeira senha e a repassa a você. Enquanto ela não é trocada, a conta não é só sua — e tudo o que for feito nela fica no seu nome. É por isso que a troca vem antes de todo o resto.",
      aula: "trocar-senha",
    },
  ],
};
