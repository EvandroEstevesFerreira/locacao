// Templates de documentos (contratos, termos) com variáveis {{chave}}.
// SEM dependências de servidor — usado pelo editor (client) e pelas rotas de PDF.

import type { ModuloKey } from "@/lib/modulos";
import type { CategoriaBiblioteca } from "@/lib/biblioteca";

export type TipoDocumento =
  | "contrato_imovel"
  | "contrato_equipamento"
  | "termo_responsabilidade"
  | "termo_equipamento"
  | "medida_disciplinar"
  | "termo_chaves"
  | "kit_alojamento"
  | "checklist_limpeza"
  | "politica_alojamento";

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
    tipo: "termo_equipamento",
    label: "Termo de responsabilidade por uso de equipamento (FRM-EQ-001)",
    descricao: "Gerado no termo (botão “Gerar termo (PDF)”).",
    eyebrow: "FRM-EQ-001 · Termo de responsabilidade",
    modulo: "termos",
    categoria: "formulario",
    preenchimento: "com_dados",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
      { chave: "funcionario", descricao: "Nome do funcionário" },
      { chave: "funcionario_cpf", descricao: "CPF do funcionário" },
      { chave: "funcionario_cargo", descricao: "Função / cargo" },
      { chave: "obra", descricao: "Obra vinculada" },
      { chave: "data_entrega", descricao: "Data da entrega" },
      { chave: "previsao_devolucao", descricao: "Previsão de devolução" },
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
    tipo: "politica_alojamento",
    label: "Política de Alojamento (POL-RH-001)",
    descricao: "Normativo completo, para consulta e impressão.",
    eyebrow: "POL-RH-001 · Política de Alojamento",
    modulo: "imoveis",
    categoria: "normativo",
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

/**
 * Título, corpo, versão e data de publicação padrão de cada documento.
 *
 * `versao` e `publicadoEm` existem porque o cabeçalho tem de dizer QUAL texto o
 * empregado assinou — "ele assinou o termo" vale menos, em audiência, que "ele
 * assinou a versão 1.2, publicada em 23/08/2026". Nas versões herdadas dos
 * `.docx` originais (POL-RH-001 e FRM-RH-001) mantivemos a numeração que eles
 * já traziam, para não fingir que a primeira publicação foi nossa.
 *
 * Quando existe template salvo, a versão vem da linha e a data do `updated_at`.
 */
export const DEFAULT_TEMPLATES: Record<
  TipoDocumento,
  { titulo: string; corpo: string; versao: string; publicadoEm: string }
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
    versao: "1.0",
    publicadoEm: "2026-07-24",
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
    versao: "1.0",
    publicadoEm: "2026-07-24",
  },
  termo_equipamento: {
    titulo: "TERMO DE RESPONSABILIDADE POR USO DE EQUIPAMENTO",
    corpo: [
      "Declaro receber de {{empresa_nome}}, nesta data, os equipamentos, ferramentas e materiais discriminados neste termo, nas quantidades e nos estados de conservação acima registrados, para uso exclusivo no desempenho das minhas atividades profissionais.",
      "Comprometo-me a:",
      "— Utilizar os itens recebidos somente para fins de trabalho, conforme a destinação de cada um e as instruções do fabricante.",
      "— Zelar pela conservação e pela guarda dos itens, mantendo-os em local seguro quando fora de uso.",
      "— Utilizar os equipamentos de proteção individual exigidos para cada equipamento e não operar equipamento para o qual não tenha treinamento ou habilitação.",
      "— Não emprestar, ceder, alugar ou vender os itens a terceiros, nem retirá-los da obra sem autorização do responsável.",
      "— Não alterar, adulterar ou remover identificação, número de patrimônio, lacre ou dispositivo de segurança dos itens.",
      "— Comunicar imediatamente ao responsável qualquer defeito, avaria, furto, roubo ou extravio, e nesses dois últimos casos apresentar o boletim de ocorrência.",
      "— Devolver os itens ao término do uso, do contrato de trabalho ou quando solicitado pela empresa, no mesmo estado em que os recebi, ressalvado o desgaste natural decorrente do uso regular.",
      "Estou ciente de que:",
      "— O desgaste natural pelo uso regular é de responsabilidade da empresa e não me será cobrado.",
      "— Danos, perdas ou extravios decorrentes de dolo ou de culpa comprovada (uso indevido, negligência, imprudência ou imperícia) poderão ser descontados dos meus haveres, mediante apuração prévia e nos termos do art. 462, § 1º, da CLT, para o qual dou expressa autorização.",
      "— A recusa injustificada em devolver os itens caracteriza retenção indevida de patrimônio da empresa, sujeita às medidas administrativas, cíveis e criminais cabíveis.",
      "— Este termo é parte integrante do meu contrato de trabalho e vale como comprovante de entrega e de devolução dos itens nele descritos.",
    ].join("\n\n"),
    versao: "1.0",
    publicadoEm: "2026-09-02",
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
    versao: "1.2",
    publicadoEm: "2026-08-22",
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
    versao: "1.0",
    publicadoEm: "2026-08-22",
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
    versao: "1.0",
    publicadoEm: "2026-08-22",
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
    versao: "1.0",
    publicadoEm: "2026-08-22",
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
    versao: "1.0",
    publicadoEm: "2026-08-22",
  },
  politica_alojamento: {
    titulo: "POLÍTICA DE ALOJAMENTO",
    corpo: [
      "1. OBJETIVO",
      "Esta política estabelece as regras de uso, convivência, higiene, segurança e disciplina aplicáveis aos empregados que residem, em caráter temporário, em alojamentos fornecidos pela Sistenge Construções e Comércio Ltda durante a execução dos contratos da empresa. Tem como finalidade preservar o bem-estar coletivo, garantir a integridade física e patrimonial dos alojados, assegurar o cumprimento das normas legais aplicáveis (em especial a NR-24 e a LGPD) e formalizar os deveres mútuos entre empregado e empregador no ambiente de moradia funcional.",
      "2. BASE LEGAL E PRINCÍPIOS",
      "Esta política observa, sem prejuízo de outras normas aplicáveis:",
      "— Norma Regulamentadora nº 24 (NR-24) — condições sanitárias e de conforto nos locais de trabalho, incluindo alojamentos.",
      "— Consolidação das Leis do Trabalho (CLT), em especial os arts. 158, 474 e 482, sobre deveres do empregado, suspensão disciplinar e justa causa.",
      "— Lei 12.546/2011, art. 49 — proibição do fumo em recintos coletivos fechados.",
      "— Lei 13.709/2018 (LGPD) — tratamento de dados pessoais dos alojados e imagens captadas por sistema de CFTV.",
      "— Guia ANPD sobre videomonitoramento e bases legais aplicáveis.",
      "— Convenção Coletiva de Trabalho aplicável à categoria, quando contiver cláusula específica sobre alojamento. Princípios orientadores",
      "— Respeito mútuo: o alojamento é coletivo e a convivência respeitosa é condição inegociável.",
      "— Higiene e segurança: o alojado é corresponsável pela limpeza, organização e segurança do ambiente.",
      "— Transparência: as regras, o uso de câmeras e o tratamento de dados são públicos e comunicados ao empregado na admissão.",
      "— Proporcionalidade: penalidades são progressivas e proporcionais à gravidade da infração.",
      "3. ABRANGÊNCIA",
      "Esta política se aplica a todos os empregados, próprios ou terceirizados, que utilizem alojamento fornecido pela Sistenge, em qualquer contrato, obra ou unidade. Aplica-se também a estagiários, aprendizes e visitantes autorizados, no que couber.",
      "4. DEFINIÇÕES",
      "— Alojamento: imóvel ou conjunto de cômodos disponibilizado pela empresa para uso residencial temporário do empregado em razão da execução do contrato de trabalho.",
      "— Alojado: empregado autorizado pela empresa a utilizar o alojamento.",
      "— Encarregado: profissional indicado pela empresa para fiscalização cotidiana do alojamento e mediação de conflitos.",
      "— Armário individual: mobiliário com fechadura ou cadeado disponibilizado pela empresa para guarda dos pertences pessoais do alojado, de uso exclusivo do empregado titular.",
      "— Áreas comuns: refeitório, cozinha, banheiros, corredores, lavanderia, áreas externas e demais ambientes de uso compartilhado.",
      "— Áreas íntimas: quartos, banheiros e vestiários — onde NÃO há captação de imagem por câmeras.",
      "— CFTV (Circuito Fechado de Televisão): sistema de câmeras instalado nas áreas comuns para fins exclusivos de segurança patrimonial e prevenção de incidentes.",
      "— Pessoa autorizada: visitante previamente cadastrado e autorizado pelo Encarregado para acesso pontual ao alojamento.",
      "— Visita íntima: presença, no alojamento, de pessoa com vínculo afetivo-sexual com o alojado.",
      "5. DIREITOS DO ALOJADO",
      "É garantido ao empregado alojado:",
      "— Condições mínimas de higiene, ventilação, iluminação e segurança, conforme a NR-24.",
      "— Cama individual com colchão, travesseiro e roupa de cama em condições adequadas de uso.",
      "— Armário individual com chave/cadeado para guarda de pertences pessoais.",
      "— Acesso a banheiros, refeitório, cozinha e áreas comuns devidamente equipados.",
      "— Respeito à sua intimidade, integridade física e moral. Quartos, banheiros e vestiários não são monitorados por câmeras em hipótese alguma.",
      "— Acesso ao canal de comunicação da empresa para reportar problemas estruturais, conflitos ou violações desta política.",
      "— Direito de acesso, retificação e oposição relacionado aos seus dados pessoais e imagens captadas pelo CFTV, nos termos da LGPD.",
      "6. DEVERES E REGRAS DE CONDUTA",
      "6.1. CONVIVÊNCIA",
      "— Tratar colegas, encarregados e visitantes autorizados com respeito e cordialidade.",
      "— Não promover discussões, agressões verbais, físicas ou qualquer forma de discriminação.",
      "— Respeitar o horário de silêncio das 22h às 06h: caixas de som proibidas, fones de ouvido obrigatórios e conversas em tom baixo.",
      "— Não dormir em ambientes de uso coletivo (sala, refeitório). O descanso noturno deve ocorrer na cama designada.",
      "— Não permitir o acesso de pessoa não autorizada ao alojamento. Visitas só com autorização prévia do Encarregado.",
      "— Não receber visita íntima nas dependências do alojamento.",
      "6.2. HIGIENE E ORGANIZAÇÃO",
      "— Manter o quarto e a cama organizados; pertences pessoais devem ficar no armário individual ou nas áreas designadas.",
      "— Após o uso, lavar e guardar a louça utilizada (\\\"Usou, lavou, guardou\\\").",
      "— Não deixar restos de alimento na geladeira; itens perecíveis devem ser identificados com nome e data.",
      "— Limpar a mesa após cada refeição; descartar resíduos na lixeira correta.",
      "— Banheiro: usar corretamente o vaso sanitário, descartar papel higiênico no cesto, dar descarga após cada uso e lavar as mãos.",
      "— Lavanderia: passar roupa apenas em local designado; nunca sobre a cama; desligar o ferro após o uso.",
      "6.3. SEGURANÇA",
      "— Trancar portas e janelas quando o ambiente estiver vazio.",
      "— Manter o armário individual sempre fechado quando ausente.",
      "— Comunicar imediatamente ao Encarregado qualquer dano, vazamento, infiltração ou problema elétrico.",
      "— Não alterar instalações elétricas, hidráulicas ou estruturais.",
      "— Não utilizar equipamentos elétricos não autorizados pela empresa (ver item 7.2).",
      "— Conhecer a rota de fuga e a localização dos extintores.",
      "6.4. REFEITÓRIO E COZINHA",
      "— Cumprir o horário das refeições estabelecido pelo contrato.",
      "— Promover rodízio na ocupação das mesas em horário de pico, liberando o assento para o próximo após a refeição.",
      "— Não deixar pertences pessoais sobre as mesas após a refeição.",
      "— Lavar a louça e guardar nas prateleiras; copos descartáveis vão diretamente ao lixo.",
      "6.5. ÁREAS EXTERNAS E FUMANTES",
      "— É permitido fumar exclusivamente na área externa designada, afastada de portas, janelas e áreas de alimentação.",
      "— Descartar bitucas no recipiente específico — nunca no chão, vaso ou pia.",
      "— Manter as áreas externas limpas e organizadas.",
      "7. PROIBIÇÕES EXPRESSAS",
      "7.1. SUBSTÂNCIAS E COMPORTAMENTOS",
      "— Consumir, portar ou armazenar bebidas alcoólicas.",
      "— Portar, usar ou comercializar drogas ilícitas — qualquer ocorrência será comunicada às autoridades competentes.",
      "— Praticar jogos de azar com aposta de dinheiro.",
      "— Portar ou guardar armas de fogo, armas brancas ou objetos análogos.",
      "— Receber visita íntima.",
      "— Acessar conteúdo pornográfico em equipamentos compartilhados (TV, computadores comuns).",
      "— Promover qualquer forma de discriminação por raça, gênero, orientação sexual, religião, origem ou condição social.",
      "— Praticar agressão física, verbal, moral ou sexual contra qualquer pessoa.",
      "— Sublocar, ceder ou compartilhar a vaga do alojamento com terceiros.",
      "— Permanecer no alojamento sob efeito de álcool ou substâncias entorpecentes.",
      "— Adulterar, danificar, obstruir ou inutilizar câmeras do CFTV, lacres ou qualquer dispositivo de segurança.",
      "7.2. COZINHAR NO ALOJAMENTO",
      "É expressamente proibido cozinhar no alojamento, em razão do risco de incêndio, sobrecarga elétrica e comprometimento da estrutura. Especificamente:",
      "— Proibido o uso de fogão (gás ou elétrico), air fryer, forno elétrico, forninho, fritadeira, grill, sanduicheira, churrasqueira, chapa ou qualquer outro equipamento de cocção.",
      "— Forno de micro-ondas pode ser utilizado APENAS para aquecer refeições prontas ou compradas; não pode ser usado para preparar/cozinhar alimentos.",
      "— Equipamentos autorizados (quando disponibilizados pela empresa): chaleira elétrica e cafeteira, exclusivamente nas áreas designadas pelo Encarregado.",
      "— É proibido manter no quarto ou no armário individual qualquer equipamento de cocção, gás (botijão ou cartucho), álcool em gel inflamável fora de uso pessoal, ou inflamável de qualquer natureza.",
      "8. ARMÁRIO INDIVIDUAL E GUARDA DE PERTENCES",
      "A empresa disponibiliza ao alojado um armário individual com fechadura ou cadeado para guarda de pertences pessoais. As seguintes regras se aplicam:",
      "— A chave/segredo do armário é de uso pessoal e intransferível. O empregado responde pelo seu uso e pela sua guarda.",
      "— É vedada a troca de cadeado ou fechadura sem autorização do Encarregado/RH.",
      "— Não é permitido armazenar no armário substâncias ou objetos proibidos por esta política (drogas, armas, bebidas alcoólicas, inflamáveis, equipamentos de cocção).",
      "— Em caso de suspeita fundada de violação grave (drogas, armas, furto, ameaça à segurança coletiva), a empresa poderá realizar revista no armário, com aviso prévio ao alojado e, sempre que possível, na presença dele e de testemunha. A revista será registrada em ata.",
      "— A empresa não se responsabiliza por bens deixados fora do armário, por subtração praticada por terceiros, ou por danos a bens cujo armazenamento não tenha sido autorizado pela empresa.",
      "— A empresa recomenda fortemente que objetos de alto valor (joias, eletrônicos caros, documentos originais, somas significativas em dinheiro) NÃO sejam mantidos no alojamento.",
      "— Em caso de desligamento, transferência ou fim do uso do alojamento, o empregado deve esvaziar o armário, devolver a chave/cadeado e firmar o Termo de Devolução (FRMRH-003). Pertences abandonados serão tratados conforme procedimento interno (notificação por 30 dias e descarte).",
      "9. SISTEMA DE CÂMERAS (CFTV) E PROTEÇÃO DE DADOS",
      "9.1. FINALIDADE E LOCAIS MONITORADOS",
      "A Sistenge mantém sistema de câmeras de circuito fechado (CFTV) nas áreas comuns do alojamento com a finalidade exclusiva de:",
      "— Garantir a segurança patrimonial e a integridade física dos alojados e visitantes.",
      "— Prevenir e apurar eventuais incidentes (acidentes, furtos, agressões, incêndios).",
      "— Cumprir obrigações legais e regulatórias aplicáveis. As câmeras são instaladas apenas em: sala/área de convivência, refeitório, cozinha, lavanderia, corredores e áreas externas (entradas, estacionamento, pátio).",
      "É EXPRESSAMENTE PROIBIDA a instalação de câmeras em quartos, banheiros, vestiários ou qualquer área que comprometa a intimidade do alojado.",
      "9.2. BASE LEGAL (LGPD)",
      "O tratamento das imagens captadas pelo CFTV tem como bases legais, nos termos do art. 7º da Lei 13.709/2018:",
      "— Legítimo interesse do controlador (art. 7º, IX) — segurança patrimonial e prevenção de incidentes.",
      "— Cumprimento de obrigação legal (art. 7º, II), quando aplicável.",
      "— Exercício regular de direito em processo administrativo, judicial ou arbitral (art. 7º, VI).",
      "9.3. SINALIZAÇÃO, RETENÇÃO E ACESSO",
      "— Toda área monitorada possui placa indicativa visível, com identificação da empresa controladora e contato do Encarregado de Dados.",
      "— As imagens são armazenadas por até 30 (trinta) dias, salvo prorrogação justificada por incidente em apuração ou determinação judicial.",
      "— O acesso às imagens é restrito ao RH, ao Encarregado responsável e, quando necessário, ao Jurídico e à Diretoria. Demais acessos exigem autorização formal.",
      "— É vedado o compartilhamento das imagens com terceiros, exceto por requisição judicial, administrativa legítima ou consentimento expresso do titular.",
      "— Após o prazo de retenção, as imagens são apagadas automaticamente.",
      "9.4. DIREITOS DOS TITULARES",
      "Nos termos do art. 18 da LGPD, o alojado pode:",
      "— Confirmar a existência de tratamento dos seus dados/imagens.",
      "— Solicitar acesso às imagens nas quais figure, observada a privacidade de terceiros (com possível ocultação de imagens de outras pessoas).",
      "— Solicitar a correção de dados incompletos ou inexatos.",
      "— Apresentar oposição ao tratamento, quando aplicável.",
      "Os pedidos devem ser dirigidos ao Encarregado de Dados da Sistenge, no canal indicado na placa de aviso e neste documento.",
      "10. RESPONSABILIDADES",
      "A gestão do alojamento é compartilhada entre o Recursos Humanos (responsável normativo e disciplinar) e o Encarregado da Obra/Contrato (responsável fiscalizatório cotidiano). R: Responsável, A: Aprovador, C: Consultado, I: Informado.",
      "As atribuições de cada parte — responsável, aprovador, consultado e informado — constam do Anexo I desta política.",
      "11. REGIME DISCIPLINAR E PENALIDADES",
      "As penalidades por descumprimento desta política seguem o princípio da progressividade e da proporcionalidade. A regra geral é: advertência verbal → advertência escrita → suspensão → desligamento por justa causa, com possibilidade de pular etapas em casos graves ou reincidência.",
      "11.1. PRINCÍPIOS",
      "— Progressividade: penalidades crescem em proporção à gravidade ou repetição.",
      "— Devido processo: o alojado tem direito de manifestação prévia antes da aplicação da penalidade.",
      "— Pessoalidade: a penalidade recai apenas sobre o infrator identificado.",
      "— Tempestividade: a penalidade é aplicada em até 30 dias da ciência do fato pela empresa.",
      "— Imparcialidade: aplicação uniforme, sem discriminação.",
      "11.2. TIPOS DE PENALIDADE",
      "— Advertência verbal: comunicada pelo Encarregado, registrada em livro de ocorrências.",
      "— Advertência escrita: emitida pelo RH, com ciência do empregado e juntada à pasta funcional (FRM-RH-002).",
      "— Suspensão disciplinar: 1 a 30 dias, sem remuneração, conforme art. 474 da CLT.",
      "— Rescisão por justa causa: nas hipóteses do art. 482 da CLT — embriaguez habitual, ato de improbidade, indisciplina ou insubordinação, agressão física, violação de segredo, condenação criminal e demais.",
      "11.3. TABELA DE INFRAÇÕES E PENALIDADES",
      "As infrações e as penalidades correspondentes constam do Anexo II desta política. A tabela é orientativa e não exaustiva: a penalidade efetiva considera o caso concreto, atenuantes e agravantes, e é aplicada após análise pelo Recursos Humanos.",
      "11.4. REINCIDÊNCIA",
      "Para efeito desta política, considera-se reincidência a prática da mesma infração no prazo de 12 meses contado da última penalidade aplicada. A reincidência habilita a aplicação da penalidade prevista na coluna correspondente da tabela, sem prejuízo da análise individual do caso.",
      "12. FISCALIZAÇÃO E CONTROLE",
      "— O Encarregado realizará inspeção diária das áreas comuns do alojamento.",
      "— O RH realizará auditoria mensal documentada (checklist de NR-24, conservação, limpeza, ocorrências).",
      "— As ocorrências serão registradas em livro próprio ou sistema digital indicado pela empresa.",
      "— Denúncias podem ser feitas por qualquer alojado ao Encarregado, ao RH ou pelo canal de denúncias da empresa, com garantia de sigilo.",
      "— A empresa poderá realizar revista no alojamento ou no armário individual, com aviso prévio ao alojado e na sua presença sempre que possível, em caso de suspeita fundada de violação grave (drogas, armas, furto). A revista será registrada em ata.",
      "— As imagens do CFTV poderão ser consultadas para apurar ocorrências, no prazo de retenção previsto no item 9.3.",
      "13. CAPACIDADE, CONFORTO E SEGURANÇA (NR-24)",
      "A capacidade máxima de cada alojamento é definida pelo SESMT e pela engenharia da Sistenge, observados os parâmetros da NR-24:",
      "— Área mínima por cama: 3,00 m², considerando circulação.",
      "— Pé-direito mínimo: 2,60 m.",
      "— Camas individuais; beliches admitidos até o limite de dois andares.",
      "— Distância mínima entre camas: 1,00 m.",
      "— Banheiros: 1 conjunto sanitário para cada grupo de 10 trabalhadores.",
      "— Ventilação cruzada, iluminação natural e artificial adequadas. A capacidade do alojamento será afixada na entrada e não poderá ser excedida em nenhuma hipótese.",
      "14. CANAIS DE COMUNICAÇÃO",
      "— Encarregado do alojamento — primeiro contato para todas as demandas.",
      "— Recursos Humanos — para denúncias formais, questões disciplinares e violações desta política.",
      "— Encarregado de Dados (LGPD) — para pedidos relacionados a dados pessoais e imagens do CFTV.",
      "— Emergências — SAMU 192, Bombeiros 193, Polícia 190.",
      "14.1. CANAL DE DENÚNCIAS (OUVIDORIA)",
      "A Sistenge mantém canal próprio e seguro para recebimento de denúncias, sugestões e reclamações relacionadas a esta política, à conduta no trabalho e à segurança no alojamento. O canal pode ser acessado de duas formas:",
      "https://sistenge-ouvidoria.vercel.app/",
      "— Pelo QR Code acima — apontando a câmera do celular sobre o código.",
      "— Pelo endereço https://sistenge-ouvidoria.vercel.app/, em qualquer navegador. O canal é destinado especialmente a relatos de:",
      "— Assédio moral, sexual ou discriminação.",
      "— Agressão física, verbal ou ameaça.",
      "— Furto, desvio, fraude ou improbidade.",
      "— Riscos à integridade dos alojados ou ao patrimônio.",
      "— Descumprimento desta política ou de outras normas internas.",
      "— Qualquer fato relevante que mereça apuração sigilosa. Princípios do canal: sigilo da identidade do denunciante, apuração imparcial conduzida pelo RH e/ou Jurídico, e proteção contra retaliação. O canal observa a Lei 14.457/2022 (programa Emprega + Mulher) e a LGPD.",
      "15. VIGÊNCIA E REVISÃO",
      "Esta política entra em vigor na data de sua publicação e tem validade indeterminada, devendo ser revisada anualmente ou sempre que houver alteração legal aplicável, mudança na realidade operacional dos alojamentos ou determinação da Diretoria. Em caso de conflito entre esta política e norma legal de hierarquia superior, prevalece a norma legal.",
      "16. DOCUMENTOS RELACIONADOS E ANEXOS",
      "— FRM-RH-001 — Termo de Compromisso de Alojamento (assinado na admissão).",
      "— FRM-RH-002 — Advertência / Suspensão Disciplinar (aplicado conforme regime disciplinar).",
      "— FRM-RH-003 — Termo de Entrega e Devolução de Chaves do Alojamento e do Armário Individual.",
      "— Conjunto padrão de Placas de Sinalização do Alojamento, com 13 placas (PPTX A3) — inclui a Placa 13 com QR Code do canal de denúncias.",
      "— Modelo de Livro de Ocorrências do Alojamento (a desenvolver).",
      "— Checklist de Auditoria Mensal NR-24 (a desenvolver).",
    ].join("\n\n"),
    versao: "1.2",
    publicadoEm: "2026-08-22",
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

/** Linha de `documento_template`, como as rotas a leem. */
export type TemplateSalvo = {
  titulo: string;
  corpo: string;
  versao: string | null;
  updated_at: string | null;
};

export type TemplateResolvido = {
  titulo: string;
  corpo: string;
  versao: string;
  publicadoEm: string;
};

/**
 * Junta o template salvo da organização com o padrão do sistema.
 *
 * Existe para não repetir esta decisão em seis rotas — e porque a regra da DATA
 * é sutil: quando há texto salvo, a data de publicação é o `updated_at` da
 * linha, não a do padrão. Ou seja, revisar a cláusula reata a data
 * automaticamente, sem depender de alguém lembrar de mudar um campo.
 *
 * A versão, ao contrário, é deliberada: quem revisa decide se aquilo é 1.3 ou
 * 2.0. O sistema não adivinha isso.
 */
export function resolverTemplate(
  tipo: TipoDocumento,
  salvo?: Partial<TemplateSalvo> | null,
): TemplateResolvido {
  const padrao = DEFAULT_TEMPLATES[tipo];
  return {
    titulo: salvo?.titulo ?? padrao.titulo,
    corpo: salvo?.corpo ?? padrao.corpo,
    versao: salvo?.versao ?? padrao.versao,
    publicadoEm: salvo?.updated_at
      ? salvo.updated_at.slice(0, 10)
      : padrao.publicadoEm,
  };
}
