// Dados de exemplo da galeria de escolha — SÓ para renderizar os templates fora
// do sistema. Nada aqui é importado por código de produção.
//
// Os valores são realistas de propósito: obra com nome longo, fornecedor com
// "&" no nome, valor de seis dígitos, descrição que estoura a coluna. Exemplo
// bonitinho esconde exatamente os problemas que a escolha precisa enxergar.

import type { Contexto } from "./base";
import type {
  DadosAcessoCriado,
  DadosAvancoSemanal,
  DadosAvaria,
  DadosDocumento,
  DadosFluxo,
  DadosIndicadores,
  DadosRecebimento,
  DadosRelatorio,
  DadosSenhaRedefinida,
  DadosVencimentosCentral,
  DadosVencimentosObra,
} from "./templates";

export const CONTEXTO: Contexto = {
  remetente: {
    nome: "Sistenge Engenharia",
    razaoSocial: "SISTENGE ENGENHARIA E CONSTRUÇÕES LTDA",
    cnpj: "12.345.678/0001-90",
  },
  appUrl: "https://loca-sistenge.vercel.app",
  // A galeria abre por `file://` a partir de .artefatos/emails/, então o
  // logotipo tem de sair do `public/` do disco. Com a URL de produção a imagem
  // chega quebrada — e o cabeçalho é justamente o que está em julgamento.
  assetsUrl: "../../public",
};

export const VENCIMENTOS_OBRA: DadosVencimentosObra = {
  obra: "Residencial Alto da Serra — Torre B",
  linhas: [
    {
      categoria: "Devolução prevista",
      descricao: "Betoneira 400L — Loc. 2026/0187",
      obra: "Residencial Alto da Serra — Torre B",
      custo: "R$ 1.240,00",
      data: "27/08/2026",
    },
    {
      categoria: "Fim de contrato",
      descricao: "Andaime fachadeiro — 220 m² — Móveis & Equipamentos Rocha",
      obra: "Residencial Alto da Serra — Torre B",
      custo: "R$ 8.750,00",
      data: "31/08/2026",
    },
    {
      categoria: "Pagamento",
      descricao: "Aluguel de container escritório — competência 08/2026",
      obra: "Residencial Alto da Serra — Torre B",
      custo: "R$ 2.100,00",
      data: "05/09/2026",
    },
  ],
};

export const VENCIMENTOS_CENTRAL: DadosVencimentosCentral = {
  grupos: [
    {
      obra: "Residencial Alto da Serra — Torre B",
      linhas: VENCIMENTOS_OBRA.linhas,
    },
    {
      obra: "Galpão Logístico Contorno Norte",
      semDestinatarios: true,
      linhas: [
        {
          categoria: "Imóvel — fim de contrato",
          descricao: "Alojamento Rua das Palmeiras, 412",
          obra: "Galpão Logístico Contorno Norte",
          custo: "R$ 4.500,00",
          data: "30/08/2026",
        },
        {
          categoria: "Imóvel — reajuste de aluguel",
          descricao: "Alojamento Rua das Palmeiras, 412 — IGP-M",
          obra: "Galpão Logístico Contorno Norte",
          custo: "R$ 4.500,00",
          data: "01/09/2026",
        },
      ],
    },
    {
      obra: "Sem obra",
      linhas: [
        {
          categoria: "Imóvel sem contrato",
          descricao: "Sala comercial Av. Getúlio Vargas, 1180 — sala 704",
          custo: "—",
          data: "24/08/2026",
        },
      ],
    },
  ],
};

export const ACESSO_CRIADO: DadosAcessoCriado = {
  nome: "Evandro Ferreira",
  email: "evandro.ferreira@sistenge.com",
  senha: "Tq7-Mx42-Rv",
  perfil: "Master",
};

export const SENHA_REDEFINIDA: DadosSenhaRedefinida = {
  nome: "Juliana Prado",
  email: "juliana.prado@sistenge.com",
  senha: "Kd9-Ptz1-Wb",
};

export const RELATORIO: DadosRelatorio = {
  titulo: "Contas a pagar",
  periodo: "agosto de 2026",
  colunas: [
    { label: "Fornecedor" },
    { label: "Total", tipo: "moeda" },
    { label: "Pendente", tipo: "moeda" },
    { label: "Pago", tipo: "moeda" },
  ],
  linhas: [
    { celulas: ["Móveis & Equipamentos Rocha", "R$ 26.250,00", "R$ 8.750,00", "R$ 17.500,00"] },
    { celulas: ["Locadora Bandeirantes", "R$ 14.880,00", "R$ 1.240,00", "R$ 13.640,00"] },
    { celulas: ["Containers do Sul", "R$ 6.300,00", "R$ 2.100,00", "R$ 4.200,00"] },
    { celulas: ["Andaimes Meridional", "R$ 41.900,00", "R$ 19.400,00", "R$ 22.500,00"] },
    {
      celulas: ["Total", "R$ 89.330,00", "R$ 31.490,00", "R$ 57.840,00"],
      enfase: "total",
    },
  ],
  total: { rotulo: "total do período", valor: "R$ 89.330,00" },
  anexo: "contas-a-pagar-2026-08.pdf",
};

export const RELATORIO_VAZIO: DadosRelatorio = {
  ...RELATORIO,
  linhas: [],
  total: undefined,
  anexo: undefined,
};

export const RECEBIMENTO: DadosRecebimento = {
  numero: "REC-2026-0014",
  fornecedor: "Móveis & Equipamentos Rocha",
  obra: "Residencial Alto da Serra — Torre B",
  contrato: "LOC-2026-0187",
  data: "24/08/2026",
  itens: [
    { descricao: "Betoneira 400L", quantidade: "2", patrimonio: "BT-4412 / BT-4413" },
    { descricao: "Andaime fachadeiro — módulo 2,00 x 1,20 m", quantidade: "48" },
    { descricao: "Vibrador de imersão 1,5 cv", quantidade: "1", patrimonio: "VI-0087" },
  ],
  observacoes:
    "Uma betoneira chegou com a proteção da coroa amassada. Registrado em vistoria de entrada.",
  anexo: "romaneio-REC-2026-0014.pdf",
};

export const DOCUMENTO_TERCEIRO: DadosDocumento = {
  tipo: "Contrato de locação de imóvel",
  numero: "CTI-2026-0031",
  destinatario: "Sr. Antônio Sales Bittencourt",
  referencia: "Alojamento Rua das Palmeiras, 412",
  data: "24/08/2026",
  anexo: "contrato-CTI-2026-0031.pdf",
  acao:
    "Pedimos a devolução de uma via assinada até 05/09/2026, digitalizada em resposta a este e-mail.",
};

export const AVARIA: DadosAvaria = {
  numero: "VIS-2026-0072",
  fornecedor: "Locadora Bandeirantes",
  obra: "Galpão Logístico Contorno Norte",
  tipoVistoria: "devolução",
  data: "22/08/2026",
  avarias: [
    { item: "Betoneira 400L — BT-4412", descricao: "Coroa dentada com dois dentes quebrados", valor: "R$ 1.850,00" },
    { item: "Vibrador de imersão VI-0087", descricao: "Mangote rompido a 40 cm da ponteira", valor: "R$ 620,00" },
  ],
  total: "R$ 2.470,00",
  prazoResposta: "31/08/2026",
};

export const FLUXO: DadosFluxo = {
  periodo: "set/2026 a fev/2027",
  meses: [
    { mes: "setembro/2026", previsto: "R$ 89.330,00", realizado: "R$ 31.440,00", saldo: "R$ 57.890,00" },
    { mes: "outubro/2026", previsto: "R$ 76.120,00", realizado: "—", saldo: "R$ 76.120,00" },
    { mes: "novembro/2026", previsto: "R$ 68.400,00", realizado: "—", saldo: "R$ 68.400,00" },
    { mes: "dezembro/2026", previsto: "R$ 41.250,00", realizado: "—", saldo: "R$ 41.250,00" },
    { mes: "janeiro/2027", previsto: "R$ 38.900,00", realizado: "—", saldo: "R$ 38.900,00" },
    { mes: "fevereiro/2027", previsto: "R$ 22.150,00", realizado: "—", saldo: "R$ 22.150,00" },
  ],
  totalPrevisto: "R$ 336.150,00",
  totalRealizado: "R$ 31.440,00",
  anexo: "fluxo-caixa-2026-09.xlsx",
};

export const AVANCO_SEMANAL: DadosAvancoSemanal = {
  semana: "31/08/2026",
  linhas: [
    {
      obra: "OB-042 — Residencial Alto da Serra",
      fisico: "31%",
      prazo: "55%",
      desvio: "24 pts de atraso",
      previsao: "23/11/2027",
      itens: "14",
    },
    {
      obra: "OB-051 — Galpão Logístico Contorno Norte",
      fisico: "68%",
      prazo: "61%",
      desvio: "7 pts adiantada",
      previsao: "12/02/2027",
      itens: "6",
    },
    {
      obra: "OB-055 — Subestação Vila Prado",
      fisico: "12%",
      prazo: "—",
      desvio: "—",
      previsao: "ritmo insuficiente para projetar",
      itens: "3",
    },
  ],
  semLancamento: [
    { obra: "OB-048 — Ampliação Ala Leste", desde: "3 semanas sem informação" },
    { obra: "OB-060 — Reforma Bloco C", desde: "nunca informada" },
  ],
};

export const INDICADORES: DadosIndicadores = {
  periodo: "1ª quinzena de setembro de 2026",
  linhas: [
    {
      obra: "OB-042 — Residencial Alto da Serra",
      prazo: "55%",
      avanco: "31%",
      consumido: "62%",
      projecao: "200% · +R$ 400.000,00",
      itens: "14",
      previsao: "R$ 180.000,00",
      situacao: "Consumindo mais rápido que entrega.",
    },
    {
      obra: "OB-051 — Galpão Logístico Contorno Norte",
      prazo: "61%",
      avanco: "68%",
      consumido: "54%",
      projecao: "79%",
      itens: "6",
      previsao: "R$ 42.000,00",
      situacao: "Entregando mais que consome.",
    },
    {
      obra: "OB-055 — Subestação Vila Prado",
      prazo: "—",
      avanco: "12%",
      consumido: "—",
      projecao: "sem orçamento",
      itens: "3",
      previsao: "R$ 15.000,00",
      situacao: "Sem orçamento cadastrado.",
    },
  ],
  comEstouro: 1,
  estouroTotal: "R$ 400.000,00",
  semDados: 1,
  previsaoTotal: "R$ 237.000,00",
};
