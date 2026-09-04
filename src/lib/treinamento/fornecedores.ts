// Trilha do cadastro de fornecedores.
//
// A trilha mais curta da cadeia da locação, e a que carrega um detalhe que
// ninguém adivinha: o e-mail do contato não é informação de agenda, é o
// endereço para onde o sistema manda o romaneio quando um recebimento fecha.
// Fornecedor sem e-mail faz o recebimento fechar em silêncio.

import type { Trilha } from "./tipos";

export const FORNECEDORES: Trilha = {
  chave: "fornecedores",
  titulo: "Fornecedores e locadoras",
  resumo:
    "Cadastrar de quem a empresa aluga, o CNPJ no formato novo e por que o e-mail do contato importa.",
  modulo: "fornecedores",
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "fornecedor-cadastro",
      titulo: "Cadastrar uma locadora",
      resumo: "Nome, CNPJ, contato e as obras em que ela atende.",
      rotas: ["/fornecedores/novo", "/fornecedores/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/fornecedores/novo",
          acao: "Preencha o nome da locadora.",
          esperado:
            "É o único campo obrigatório. É esse nome que vai aparecer no contrato, no romaneio e no histórico de custódia da peça que estiver em manutenção com ela.",
        },
        {
          onde: "/fornecedores/novo",
          acao: "Digite o CNPJ.",
          esperado:
            "O campo aceita o formato ALFANUMÉRICO, com letras — como 12.ABC.345/01DE-35. Não é erro de digitação nem placeholder de exemplo: é o CNPJ novo, e o sistema valida os dígitos verificadores dele.",
        },
        {
          onde: "/fornecedores/novo",
          acao: "Preencha contato, telefone e e-mail.",
          esperado:
            "Salva. O e-mail é o mais importante dos três — veja a aula sobre ele.",
        },
        {
          onde: "/fornecedores/novo",
          acao: "Marque as obras em que essa locadora atende, e salve.",
          esperado:
            "O fornecedor passa a aparecer filtrado por aquelas obras na lista. Um fornecedor pode atender várias obras.",
        },
      ],
      atencao: [
        "Cadastrar e editar fornecedor é de master e administrador.",
        "Fornecedor que a empresa deixou de usar fica INATIVO, não excluído: contratos antigos apontam para ele, e o nome dele precisa continuar explicando o passado.",
      ],
    },
    {
      id: "fornecedor-cnpj-duplicado",
      titulo: "O aviso de CNPJ já cadastrado",
      resumo:
        "O sistema avisa e deixa você decidir — porque às vezes a duplicidade é intencional.",
      rotas: ["/fornecedores/novo"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/fornecedores/novo",
          acao: "Cadastre um fornecedor com um CNPJ que já existe em outro, e tente salvar.",
          esperado:
            "O sistema NÃO salva na primeira tentativa: aparece uma caixa dizendo que o CNPJ já está cadastrado em outro fornecedor.",
        },
        {
          onde: "/fornecedores/novo",
          acao: "Marque “Salvar mesmo assim” e salve de novo.",
          esperado:
            "Agora salva. O aviso existe para pegar o erro de digitação e o cadastro em dobro; a decisão é sua, porque filial e matriz com o mesmo CNPJ são caso real.",
        },
      ],
      atencao: [
        "Antes de marcar “Salvar mesmo assim”, procure o fornecedor existente na lista. Duas fichas para a mesma locadora dividem o histórico dela em dois, e nenhum relatório volta a juntar.",
      ],
    },
    {
      id: "fornecedor-email",
      titulo: "O e-mail do contato não é agenda: é destinatário",
      resumo:
        "É para lá que o sistema manda o romaneio quando um recebimento é fechado.",
      rotas: ["/fornecedores/[id]", "/recebimentos/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/fornecedores/[id]",
          acao: "Confira se o e-mail do contato está preenchido e correto.",
          esperado:
            "Salva. Esse endereço é usado pelo sistema, não só por você.",
        },
        {
          onde: "/recebimentos/[id]",
          acao: "Abra a confirmação de “Fechar recebimento” de um contrato dessa locadora.",
          esperado:
            "A confirmação diz para qual e-mail o romaneio vai sair. Quando o fornecedor não tem e-mail cadastrado, ela avisa que ele NÃO será comunicado — e o recebimento fecha do mesmo jeito.",
        },
      ],
      atencao: [
        "Fechar recebimento é irreversível. Se o e-mail estava errado ou faltando, o fornecedor não recebe o romaneio daquele fechamento, e não há como reenviar refazendo o fechamento — corrija o cadastro ANTES.",
      ],
    },
    {
      id: "fornecedor-lista",
      titulo: "Achar um fornecedor",
      resumo: "Busca por nome ou CNPJ, e filtro pela obra que ele atende.",
      rotas: ["/fornecedores"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/fornecedores",
          acao: "Busque por nome ou por CNPJ.",
          esperado: "A lista filtra ao vivo pelos dois campos.",
        },
        {
          onde: "/fornecedores",
          acao: "Filtre por obra.",
          esperado:
            "Mostra só quem atende aquela obra. É a lista para responder “de quem a gente aluga nessa obra?” antes de pedir cotação.",
        },
        {
          onde: "/fornecedores",
          acao: "Leia as colunas.",
          esperado:
            "Nome, CNPJ, contato, obras e status. Status Inativo significa que a locadora não aparece mais nas escolhas de contrato novo.",
        },
      ],
    },
  ],
  perguntas: [
    {
      id: "for-cnpj",
      enunciado:
        "O campo de CNPJ mostra o exemplo “12.ABC.345/01DE-35”, com letras. Por quê?",
      alternativas: [
        "É um texto de exemplo genérico; o CNPJ real só tem números",
        "Porque o campo aceita também inscrição estadual",
        "Porque o CNPJ passou a ser alfanumérico, e o sistema valida esse formato",
        "Porque fornecedor estrangeiro usa letras",
      ],
      correta: 2,
      porque:
        "O campo aceita o CNPJ alfanumérico e valida os dígitos verificadores dele. Quem acha que é erro tenta digitar só números de um CNPJ que tem letras, e conclui que o sistema está recusando um documento válido.",
      aula: "fornecedor-cadastro",
    },
    {
      id: "for-duplicado",
      enunciado:
        "Você salvou um fornecedor com CNPJ já usado por outro. O que acontece?",
      alternativas: [
        "O sistema salva e junta os dois cadastros automaticamente",
        "O sistema recusa em definitivo: CNPJ é único",
        "O sistema avisa e só salva depois que você marcar “Salvar mesmo assim”",
        "O sistema salva sem avisar",
      ],
      correta: 2,
      porque:
        "É aviso, não validação: matriz e filial com o mesmo CNPJ são caso real, então a decisão é de quem cadastra. Mas vale procurar o fornecedor existente antes de confirmar — duas fichas para a mesma locadora dividem o histórico dela em dois, e nenhum relatório volta a juntar.",
      aula: "fornecedor-cnpj-duplicado",
    },
    {
      id: "for-email",
      enunciado:
        "Um contrato vai ter recebimentos e o fornecedor está sem e-mail cadastrado. Qual é a consequência?",
      alternativas: [
        "O recebimento não pode ser fechado",
        "O recebimento fecha, mas o fornecedor não recebe o romaneio — e não há como reenviar",
        "O sistema pede o e-mail no momento do fechamento",
        "O romaneio vai para o e-mail da obra",
      ],
      correta: 1,
      porque:
        "A confirmação do fechamento avisa que o fornecedor não será comunicado, e fecha de todo modo. Como o fechamento é irreversível, o romaneio daquele recebimento simplesmente não é enviado: corrigir o cadastro depois não reenvia nada.",
      aula: "fornecedor-email",
    },
    {
      id: "for-inativar",
      enunciado:
        "A empresa parou de alugar de uma locadora que tem contratos antigos no sistema. O que fazer com o cadastro dela?",
      alternativas: [
        "Excluir, porque não será mais usada",
        "Deixar ativa para não perder o histórico",
        "Marcá-la como inativa",
        "Trocar os dados dela pelos da nova locadora",
      ],
      correta: 2,
      porque:
        "Inativar tira a locadora das escolhas de contrato novo e mantém o nome dela explicando todo o passado — contratos, romaneios e o histórico de peças que estiveram em manutenção com ela. Reaproveitar a ficha para outra empresa é o pior caminho: reescreve documentos antigos.",
      aula: "fornecedor-cadastro",
    },
  ],
};
