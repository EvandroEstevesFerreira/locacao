// Templates de documentos (contratos, termos) com variáveis {{chave}}.
// SEM dependências de servidor — usado pelo editor (client) e pelas rotas de PDF.

export type TipoDocumento =
  | "contrato_imovel"
  | "contrato_equipamento"
  | "termo_responsabilidade";

export type VariavelInfo = { chave: string; descricao: string };

export type DocumentoInfo = {
  tipo: TipoDocumento;
  label: string;
  descricao: string;
  eyebrow: string; // subtítulo fixo no topo do documento
  variaveis: VariavelInfo[];
};

/** Catálogo de documentos com template editável e suas variáveis. */
export const DOCUMENTOS: DocumentoInfo[] = [
  {
    tipo: "contrato_imovel",
    label: "Contrato de locação de imóvel",
    descricao: "Gerado no imóvel (botão “Gerar contrato”).",
    eyebrow: "Contrato de locação",
    variaveis: [
      { chave: "locataria", descricao: "Empresa locatária (razão social ou nome)" },
      { chave: "empresa_cnpj", descricao: "CNPJ da empresa" },
      { chave: "empresa_endereco", descricao: "Endereço da empresa" },
      { chave: "locador", descricao: "Proprietário (locador)" },
      { chave: "imovel", descricao: "Imóvel — apelido (tipo)" },
      { chave: "imovel_endereco", descricao: "Endereço do imóvel" },
      { chave: "vigencia", descricao: "Período do contrato" },
      { chave: "aluguel", descricao: "Valor do aluguel" },
      { chave: "condominio", descricao: "Valor do condomínio" },
      { chave: "iptu", descricao: "Valor do IPTU" },
      { chave: "seguro_fianca", descricao: "Valor do seguro fiança" },
      { chave: "total_mensal", descricao: "Total mensal" },
      { chave: "vencimento", descricao: "Dia de vencimento" },
      { chave: "indice_reajuste", descricao: "Índice de reajuste" },
      { chave: "caucao", descricao: "Valor da caução" },
      { chave: "dados_bancarios", descricao: "Dados bancários para pagamento" },
      { chave: "cidade", descricao: "Cidade do imóvel" },
    ],
  },
  {
    tipo: "contrato_equipamento",
    label: "Contrato de locação de equipamento",
    descricao: "Gerado no contrato de locação (botão “Gerar contrato (PDF)”).",
    eyebrow: "Contrato de locação de equipamento",
    variaveis: [
      { chave: "locataria", descricao: "Empresa locatária (razão social ou nome)" },
      { chave: "empresa_cnpj", descricao: "CNPJ da empresa" },
      { chave: "empresa_endereco", descricao: "Endereço da empresa" },
      { chave: "locador", descricao: "Fornecedor (locador)" },
      { chave: "fornecedor_cnpj", descricao: "CNPJ do fornecedor" },
      { chave: "contrato_numero", descricao: "Número do contrato" },
      { chave: "obra", descricao: "Obra vinculada" },
      { chave: "vigencia", descricao: "Período do contrato" },
      { chave: "cadencia", descricao: "Cadência de cobrança" },
      { chave: "itens", descricao: "Itens locados (descrição, quantidade e valor)" },
      { chave: "cidade", descricao: "Cidade da obra" },
    ],
  },
  {
    tipo: "termo_responsabilidade",
    label: "Termo de responsabilidade (ocupante)",
    descricao: "Gerado no ocupante do imóvel (botão “Gerar termo”).",
    eyebrow: "Termo de responsabilidade",
    variaveis: [
      { chave: "ocupante", descricao: "Nome do ocupante" },
      { chave: "ocupante_cpf", descricao: "CPF do ocupante" },
      { chave: "imovel", descricao: "Imóvel — apelido (tipo)" },
      { chave: "imovel_endereco", descricao: "Endereço do imóvel" },
      { chave: "empresa_nome", descricao: "Nome da empresa (cedente)" },
      { chave: "cidade", descricao: "Cidade do imóvel" },
    ],
  },
];

export function documentoInfo(tipo: TipoDocumento): DocumentoInfo | undefined {
  return DOCUMENTOS.find((d) => d.tipo === tipo);
}

/** Título + corpo padrão de cada documento (usados quando não há template salvo). */
export const DEFAULT_TEMPLATES: Record<
  TipoDocumento,
  { titulo: string; corpo: string }
> = {
  contrato_imovel: {
    titulo: "CONTRATO DE LOCAÇÃO DE IMÓVEL",
    corpo: [
      "Pelo presente instrumento particular, {{locataria}} (doravante LOCATÁRIA) e {{locador}} (doravante LOCADOR) ajustam a locação do imóvel {{imovel}}, situado em {{imovel_endereco}}, pelo período de {{vigencia}}, nas condições a seguir.",
      "O valor do aluguel mensal é de {{aluguel}}, acrescido de condomínio de {{condominio}}, IPTU de {{iptu}} e seguro fiança de {{seguro_fianca}}, totalizando {{total_mensal}} por mês, com vencimento no {{vencimento}}. O reajuste observará o índice {{indice_reajuste}}, na periodicidade legal.",
      "A LOCATÁRIA compromete-se a conservar o imóvel, comunicar avarias e devolvê-lo, ao término da locação, no estado em que o recebeu, salvo o desgaste natural pelo uso regular.",
      "Eventuais danos causados ao imóvel, além do desgaste natural, serão de responsabilidade da LOCATÁRIA, apurados em vistoria de devolução.",
      "Os pagamentos serão realizados por meio dos seguintes dados bancários: {{dados_bancarios}}.",
      "As partes elegem o foro da comarca do imóvel para dirimir questões oriundas deste contrato.",
    ].join("\n\n"),
  },
  contrato_equipamento: {
    titulo: "CONTRATO DE LOCAÇÃO DE EQUIPAMENTOS",
    corpo: [
      "Pelo presente instrumento particular, {{locataria}} (doravante LOCATÁRIA) e {{locador}} (doravante LOCADOR) ajustam a locação dos equipamentos/materiais discriminados abaixo, vinculados à obra {{obra}}, conforme o contrato nº {{contrato_numero}}.",
      "Vigência: {{vigencia}}. Cadência de cobrança: {{cadencia}}.",
      "Itens locados:\n{{itens}}",
      "A LOCATÁRIA compromete-se a utilizar os itens conforme sua destinação, conservá-los e devolvê-los ao término da locação no estado em que os recebeu, salvo o desgaste natural pelo uso regular.",
      "Eventuais avarias além do desgaste natural, apuradas em vistoria de devolução, serão de responsabilidade da LOCATÁRIA.",
      "As partes elegem o foro da comarca da obra para dirimir questões oriundas deste contrato.",
    ].join("\n\n"),
  },
  termo_responsabilidade: {
    titulo: "TERMO DE RESPONSABILIDADE",
    corpo: [
      "Eu, {{ocupante}}, inscrito(a) no CPF nº {{ocupante_cpf}}, declaro que ocuparei o imóvel {{imovel}}, situado em {{imovel_endereco}}, disponibilizado por {{empresa_nome}}, assumindo integral responsabilidade sobre sua guarda, conservação e uso adequado.",
      "Comprometo-me a: (a) zelar pela limpeza e conservação do imóvel e de seus equipamentos; (b) comunicar imediatamente à empresa quaisquer avarias, defeitos ou ocorrências; (c) não realizar alterações estruturais sem autorização; (d) utilizar o imóvel de forma pacífica e conforme as normas de convivência; (e) observar a Política de Alojamento da empresa (POL-RH-001) e as normas internas aplicáveis.",
      "Declaro ciência de que serei responsável por danos causados ao imóvel além do desgaste natural de uso, apurados em vistoria, bem como pela devolução do imóvel em bom estado ao término da ocupação, incluindo a entrega das chaves recebidas.",
      "Por ser expressão da verdade, firmo o presente Termo de Responsabilidade.",
    ].join("\n\n"),
  },
};

/** Substitui {{chave}} pelos valores. Variáveis desconhecidas viram "". */
export function renderTemplate(
  texto: string,
  variaveis: Record<string, string | null | undefined>,
): string {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, chave: string) => {
    const v = variaveis[chave];
    return v === null || v === undefined ? "" : String(v);
  });
}

/** Quebra o corpo em parágrafos (separados por linha em branco). */
export function corpoParaParagrafos(corpo: string): string[] {
  return corpo
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}
