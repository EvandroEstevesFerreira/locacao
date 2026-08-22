// Templates de documentos (contratos, termos) com variáveis {{chave}}.
// SEM dependências de servidor — usado pelo editor (client) e pelas rotas de PDF.

import type { ModuloKey } from "@/lib/modulos";
import type { CategoriaBiblioteca } from "@/lib/biblioteca";

export type TipoDocumento =
  | "contrato_imovel"
  | "contrato_equipamento"
  | "termo_responsabilidade"
  | "medida_disciplinar"
  | "termo_chaves"
  | "kit_alojamento"
  | "checklist_limpeza";

export type VariavelInfo = { chave: string; descricao: string };

export type DocumentoInfo = {
  tipo: TipoDocumento;
  label: string;
  descricao: string;
  eyebrow: string; // subtítulo fixo no topo do documento
  /** Módulo a que o documento pertence — governa onde ele aparece. */
  modulo: ModuloKey;
  /** Categoria na tela de documentos do alojamento. */
  categoria: CategoriaBiblioteca;
  /** Sai preenchido com dados do sistema, ou em branco para preencher à mão. */
  preenchimento: "com_dados" | "em_branco";
  variaveis: VariavelInfo[];
};

/** Catálogo de documentos com template editável e suas variáveis. */
export const DOCUMENTOS: DocumentoInfo[] = [
  {
    tipo: "contrato_imovel",
    label: "Contrato de locação de imóvel",
    descricao: "Gerado no imóvel (botão “Gerar contrato”).",
    eyebrow: "Contrato de locação",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "com_dados",
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
    modulo: "contratos",
    categoria: "formulario",
    preenchimento: "com_dados",
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
    label: "Termo de Compromisso de Alojamento (FRM-RH-001)",
    descricao: "Gerado no ocupante do imóvel (botão “Gerar termo”).",
    eyebrow: "FRM-RH-001 · Termo de Compromisso",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "com_dados",
    variaveis: [
      { chave: "ocupante", descricao: "Nome do alojado" },
      { chave: "ocupante_cpf", descricao: "CPF do alojado" },
      { chave: "ocupante_cargo", descricao: "Função / cargo" },
      { chave: "imovel", descricao: "Alojamento — apelido (tipo)" },
      { chave: "imovel_endereco", descricao: "Endereço do alojamento" },
      { chave: "quarto", descricao: "Nº do alojamento / quarto" },
      { chave: "armario", descricao: "Nº do armário individual" },
      { chave: "obra", descricao: "Contrato / obra" },
      { chave: "centro_resultado", descricao: "Centro de Resultado (CR)" },
      { chave: "empresa_nome", descricao: "Nome da empresa (cedente)" },
      { chave: "cidade", descricao: "Cidade do alojamento" },
    ],
  },
  {
    tipo: "medida_disciplinar",
    label: "Medida disciplinar — advertência e suspensão (FRM-RH-002)",
    descricao: "Formulário em branco, para imprimir e preencher à mão.",
    eyebrow: "FRM-RH-002 · Medida disciplinar",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "em_branco",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
    ],
  },
  {
    tipo: "termo_chaves",
    label: "Entrega e devolução de chaves (FRM-RH-003)",
    descricao: "Formulário em branco, com checklist de conservação.",
    eyebrow: "FRM-RH-003 · Entrega e devolução de chaves",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "em_branco",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
    ],
  },
  {
    tipo: "kit_alojamento",
    label: "Recebimento e devolução do kit (FRM-RH-004)",
    descricao: "Formulário em branco, entrega e devolução do enxoval.",
    eyebrow: "FRM-RH-004 · Kit de alojamento",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "em_branco",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
    ],
  },
  {
    tipo: "checklist_limpeza",
    label: "Checklist semanal de limpeza (FRM-RH-005)",
    descricao: "Folha semanal em paisagem, para o auxiliar de limpeza.",
    eyebrow: "FRM-RH-005 · Checklist semanal de limpeza",
    modulo: "imoveis",
    categoria: "formulario",
    preenchimento: "em_branco",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
    ],
  },
];

export function documentoInfo(tipo: TipoDocumento): DocumentoInfo | undefined {
  return DOCUMENTOS.find((d) => d.tipo === tipo);
}

/**
 * Documentos de um módulo, na ordem do catálogo.
 *
 * É o que liga documento a módulo: a tela de Templates agrupa por aqui, a de
 * Documentos do alojamento filtra por aqui, e a filtragem de `moduloLiberado`
 * passa a valer para documentos sem nenhum código novo de permissão.
 */
export function documentosDoModulo(modulo: ModuloKey): DocumentoInfo[] {
  return DOCUMENTOS.filter((d) => d.modulo === modulo);
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
    titulo: "TERMO DE COMPROMISSO DE ALOJAMENTO",
    corpo: [
      "Pelo presente Termo de Compromisso, o(a) empregado(a) abaixo identificado(a), nesta data admitido(a) por {{empresa_nome}}, declara conhecer e aceitar as regras de uso, convivência, higiene e segurança do alojamento que lhe foi disponibilizado pela empresa para residência temporária durante a execução do contrato de trabalho.",
      "Este Termo é parte integrante do contrato de trabalho e referencia a Política de Alojamento POL-RH-001, à qual o(a) empregado(a) teve acesso integral antes da assinatura.",
      "REGRAS QUE DECLARO CONHECER E ME COMPROMETO A CUMPRIR",
      "Declaro estar ciente e me comprometo a cumprir integralmente as regras abaixo, sem prejuízo das demais constantes da Política de Alojamento POL-RH-001:",
      "— Tratar colegas, encarregados e visitantes autorizados com respeito e cordialidade, sem qualquer forma de discriminação, agressão ou assédio.",
      "— Respeitar o horário de silêncio das 22h às 06h: caixas de som proibidas, fones de ouvido obrigatórios e conversas em tom baixo.",
      "— Manter o quarto, a cama e os pertences pessoais organizados; lavar e guardar a louça após o uso (\"Usou, lavou, guardou\").",
      "— Não dormir em ambientes coletivos (sala, refeitório); o descanso noturno deve ocorrer na cama designada.",
      "— Trancar portas e janelas quando o ambiente estiver vazio; comunicar imediatamente ao Encarregado qualquer dano, vazamento ou problema.",
      "— Não permitir o acesso de pessoa não autorizada ao alojamento. Visitas só com autorização prévia do Encarregado.",
      "— Não receber visita íntima nas dependências do alojamento.",
      "— Não consumir, portar ou armazenar bebidas alcoólicas no alojamento.",
      "— Não portar, usar ou comercializar drogas ilícitas — ciente de que tal conduta enseja justa causa e comunicação às autoridades competentes.",
      "— Não portar armas de fogo, armas brancas ou objetos análogos.",
      "— Não cozinhar no alojamento. É proibido o uso de fogão, air fryer, forno elétrico, fritadeira, grill, sanduicheira, churrasqueira ou qualquer equipamento de cocção. O micro-ondas pode ser usado APENAS para aquecer refeições prontas. Chaleira elétrica e cafeteira são permitidas apenas se disponibilizadas pela empresa, nas áreas designadas.",
      "— Não manter no quarto ou no armário individual gás, álcool inflamável, materiais inflamáveis ou equipamentos de cocção.",
      "— Fumar apenas na área externa designada, afastado de portas e janelas, descartando bitucas no recipiente específico.",
      "— Usar o banheiro de forma adequada: descartar papel higiênico no cesto, dar descarga após o uso, lavar as mãos e manter o ambiente limpo.",
      "— Passar roupa apenas no local designado, com o ferro autorizado pela empresa; nunca passar roupa sobre a cama.",
      "— Não sublocar, ceder ou compartilhar a vaga do alojamento com terceiros.",
      "— Não alterar instalações elétricas, hidráulicas ou estruturais; utilizar apenas equipamentos elétricos autorizados.",
      "— Zelar pela conservação do armário individual e dos pertences nele guardados. A chave/segredo é pessoal e intransferível.",
      "— Não adulterar, danificar ou inutilizar câmeras do CFTV, lacres ou dispositivos de segurança.",
      "— Cooperar com a fiscalização do Encarregado e do Recursos Humanos.",
      "— Comunicar imediatamente ao Encarregado ou ao RH qualquer violação desta política, dano ao patrimônio, conflito ou situação de risco.",
      "— Respeitar a capacidade máxima do alojamento, conforme NR-24, afixada na entrada.",
      "— Utilizar o canal de denúncias da Sistenge (https://sistenge-ouvidoria.vercel.app/, também acessível pelo QR Code afixado no alojamento) para relatar, com sigilo, qualquer situação de assédio, violência, fraude, risco ou descumprimento desta política.",
      "CÂMERAS DE SEGURANÇA (CFTV) — CONSENTIMENTO INFORMADO",
      "Declaro ESTAR CIENTE de que o alojamento dispõe de sistema de câmeras de circuito fechado (CFTV) nas áreas comuns, com as seguintes condições:",
      "— As câmeras estão instaladas APENAS em áreas comuns: sala, refeitório, cozinha, lavanderia, corredores e áreas externas (entradas, pátio, estacionamento).",
      "— As câmeras NÃO são instaladas em quartos, banheiros ou vestiários — locais onde minha intimidade é integralmente preservada.",
      "— A finalidade exclusiva do CFTV é a segurança patrimonial, a integridade física dos alojados e a prevenção/apuração de incidentes.",
      "— As bases legais do tratamento das imagens são o legítimo interesse do controlador (LGPD, art. 7º, IX), o cumprimento de obrigação legal (art. 7º, II) e o exercício regular de direito (art. 7º, VI).",
      "— As imagens são armazenadas por até 30 (trinta) dias, salvo prorrogação justificada por incidente em apuração ou determinação judicial.",
      "— O acesso às imagens é restrito ao RH, ao Encarregado e, quando necessário, ao Jurídico/Diretoria, sob registro.",
      "— Tenho o direito de acesso, retificação, oposição e demais direitos previstos no art. 18 da LGPD, mediante solicitação ao Encarregado de Dados da Sistenge.",
      "ARMÁRIO INDIVIDUAL — GUARDA E RESPONSABILIDADE",
      "Declaro também ESTAR CIENTE de que:",
      "— A empresa me disponibiliza armário individual com fechadura ou cadeado para guarda dos meus pertences.",
      "— A chave/segredo do armário é de meu uso pessoal e intransferível, e eu respondo por sua guarda.",
      "— Não posso armazenar no armário, no quarto ou em qualquer local do alojamento substâncias ou objetos proibidos por esta política (drogas, armas, bebidas alcoólicas, inflamáveis, equipamentos de cocção).",
      "— A empresa NÃO se responsabiliza por bens deixados fora do armário, por subtração praticada por terceiros, ou por danos a bens cujo armazenamento não tenha sido autorizado pela empresa.",
      "— Recomenda-se fortemente que objetos de valor (joias, eletrônicos caros, documentos originais, somas em dinheiro) NÃO sejam mantidos no alojamento; estou ciente desta recomendação.",
      "— Em caso de suspeita fundada de violação grave, a empresa poderá realizar revista no armário, com aviso prévio e na minha presença sempre que possível, com registro em ata.",
      "— Ao desligamento ou ao fim do uso do alojamento, devo esvaziar o armário, devolver a chave/cadeado e firmar o Termo de Devolução (FRM-RH-003).",
      "DECLARAÇÕES FINAIS",
      "Declaro, sob as penas da lei:",
      "— Ter recebido cópia da Política de Alojamento POL-RH-001 e o conteúdo deste Termo de Compromisso, com tempo adequado para leitura.",
      "— Ter tido a oportunidade de esclarecer dúvidas com o Recursos Humanos antes da assinatura.",
      "— Estar ciente de que o alojamento é cedido por mera liberalidade e necessidade operacional, não constituindo salário in natura para fins trabalhistas (art. 458, §2º, IV, da CLT, com redação da Lei 13.467/2017).",
      "— Estar ciente de que a empresa poderá realizar revista no alojamento e no armário individual, mediante aviso prévio, em caso de suspeita fundada de violação grave (drogas, armas, furto), respeitada minha dignidade.",
      "— Autorizar a empresa, conforme a LGPD, ao tratamento dos meus dados pessoais e imagens captadas pelo CFTV para fins de gestão do alojamento e segurança, com acesso restrito ao RH e ao Encarregado.",
      "— Estar ciente de que, ao desligamento ou término do uso do alojamento, devo devolver as chaves e o ambiente em condições adequadas, sob pena de descontos legais e de responsabilização pelos danos eventualmente causados.",
      "— Estar ciente de que a Sistenge mantém canal próprio de denúncias (https://sistenge-ouvidoria.vercel.app/), com garantia de sigilo, apuração imparcial e vedação de retaliação, conforme a Lei 14.457/2022 e a LGPD.",
    ].join("\n\n"),
  },
  medida_disciplinar: {
    titulo: "MEDIDA DISCIPLINAR — ADVERTÊNCIA E SUSPENSÃO",
    corpo: [
      "Aplicada nos termos da Política de Alojamento POL-RH-001 e da CLT (arts. 474 e 482).",
      "ORIENTAÇÕES AO EMPREGADO",
      "Fica o(a) empregado(a) ciente de que:",
      "— Deve adequar imediatamente sua conduta às regras da Política de Alojamento POL-RH-001 e ao Termo de Compromisso FRM-RH-001 que assinou.",
      "— A reincidência poderá ensejar penalidade mais grave, inclusive a rescisão por justa causa, nos termos do art. 482 da CLT.",
      "— Tem o direito de apresentar manifestação por escrito ao RH no prazo de 5 (cinco) dias úteis a contar do recebimento deste documento.",
      "— Em caso de suspensão, o período não será remunerado (CLT, art. 474) e poderá impactar a contagem para férias proporcionais e demais direitos.",
    ].join("\n\n"),
  },
  termo_chaves: {
    titulo: "TERMO DE ENTREGA / DEVOLUÇÃO DE CHAVES DO ALOJAMENTO",
    corpo: [
      "Vinculado à Política de Alojamento POL-RH-001.",
      "DECLARAÇÕES — EM CASO DE ENTREGA",
      "Declaro receber, nesta data, os itens e o ambiente acima descritos, em condições adequadas de uso, ressalvadas as avarias preexistentes registradas no campo de observações. Comprometo-me a zelar pela conservação do alojamento e do armário, comunicar imediatamente qualquer dano ou problema, devolver tudo em condições equivalentes às recebidas no encerramento do uso, não trocar fechaduras ou cadeados sem autorização e cumprir integralmente a Política POL-RH-001 e o Termo de Compromisso FRM-RH-001.",
      "DECLARAÇÕES — EM CASO DE DEVOLUÇÃO",
      "Declaro devolver, nesta data, os itens e o ambiente acima descritos. Estou ciente de que:",
      "— Avarias identificadas e atribuídas à minha responsabilidade (uso indevido, dolo ou culpa) poderão ser objeto de desconto em rescisão ou cobrança, nos termos da legislação e do contrato de trabalho.",
      "— Pertences pessoais foram retirados; objetos eventualmente esquecidos serão guardados pela empresa por até 30 (trinta) dias, após o que serão considerados abandonados.",
      "— A não devolução de chaves implica autorização para descontos do custo de reposição ou substituição de fechaduras.",
    ].join("\n\n"),
  },
  kit_alojamento: {
    titulo: "DECLARAÇÃO DE RECEBIMENTO E DEVOLUÇÃO DO KIT DE ALOJAMENTO",
    corpo: [
      "Vinculado à Política de Alojamento POL-RH-001 e ao Termo de Compromisso FRM-RH-001.",
      "CONDIÇÕES DE USO E HIGIENIZAÇÃO",
      "— Os itens do kit são de uso pessoal e exclusivo do alojado, sendo vedado o compartilhamento com terceiros.",
      "— A higienização é semanal, fornecida pela empresa mediante troca dos itens utilizados por itens limpos, em dia e horário a ser comunicado pelo Encarregado.",
      "— O alojado é corresponsável pela conservação do kit, evitando danos por uso inadequado (rasgos intencionais, queimaduras, manchas decorrentes de produtos não autorizados).",
      "— Em caso de extravio ou dano causado por uso inadequado, comprovada a responsabilidade do alojado, a reposição poderá ser objeto de desconto em folha ou rescisão, nos termos da legislação e do contrato de trabalho.",
      "— Solicitações de troca extraordinária (acidente, mancha grave, dano não intencional) devem ser dirigidas ao Encarregado do alojamento, que avaliará e providenciará a substituição.",
      "— Ao fim do uso do alojamento — desligamento, transferência ou término de contrato — os itens devem ser devolvidos conforme a seção de devolução deste formulário.",
    ].join("\n\n"),
  },
  checklist_limpeza: {
    titulo: "CHECKLIST SEMANAL DE LIMPEZA DO ALOJAMENTO",
    corpo: [
      "Vinculado à Política de Alojamento POL-RH-001 — uso pelo auxiliar de limpeza.",
      "CUIDADOS E BOAS PRÁTICAS",
      "— Nunca misturar água sanitária com amoníaco ou detergente — a mistura libera gases tóxicos.",
      "— Diluir desinfetantes conforme o rótulo. Soluções muito concentradas não limpam melhor, apenas desperdiçam produto.",
      "— Lavar áreas limpas antes das sujas (por exemplo, dormitórios antes de banheiros).",
      "— Usar panos separados por ambiente, com cor diferente para banheiro, cozinha e áreas comuns.",
      "— Recolher o lixo de cada ambiente em saco próprio e trocar diariamente.",
      "— Respeitar a privacidade dos alojados: não mexer em pertences pessoais dentro dos armários ou nas camas, e não entrar em quartos ocupados sem autorização.",
      "— Em caso de acidente, contato com produto químico ou indisposição, avisar o Encarregado imediatamente e procurar atendimento.",
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
