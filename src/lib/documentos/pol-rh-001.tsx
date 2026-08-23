// POL-RH-001 — Política de Alojamento.
//
// Normativo de 16 seções. O texto vem de `documento_template`, tipo
// `politica_alojamento`, e é editável em Configurações — é o documento que o
// Jurídico mais revisa.
//
// As DUAS TABELAS são ANEXOS — o corpo as cita ("conforme o Anexo II") e elas
// começam em página nova. Isso não é só arrumação: revisar uma penalidade deixa
// de exigir mexer no item 11.3 que a invoca.
//
// Elas ficam aqui, em código, e não no template. Não é preferência:
// a matriz de responsabilidades (item 10) e a tabela de infrações (item 11.3)
// não sobrevivem à conversão de texto — o extrator embaralha as linhas 8 a 15 da
// tabela de penalidades, e uma penalidade trocada num normativo disciplinar é
// erro que se paga em audiência. Foram transcritas do PDF original conferindo
// página a página.
//
// A tabela de infrações é ORIENTATIVA: a própria política diz que a penalidade
// efetiva considera o caso concreto. Não é tabela de cálculo.

import {
  Documento,
  Anexo,
  Secao,
  Tabela,
  type Coluna,
  type LinhaTabela,
} from "@/lib/pdf-form";
import { Narrativa, Paragrafo } from "./blocos";

/**
 * ANEXO I — matriz RACI do item 10, transcrita do original conferindo célula a
 * célula.
 *
 * Antes eu havia entregado aqui uma lista de papel → atribuições em prosa, que
 * é o "Detalhamento" do original — NÃO a matriz. São tabelas diferentes: a matriz
 * cruza ATIVIDADE com PAPEL e diz quem é Responsável, Aprovador, Consultado e
 * Informado. Numa política disciplinar, essa distinção é quem responde pelo quê.
 */
const COLUNAS_RACI: Coluna[] = [
  { titulo: "Atividade", largura: 44 },
  { titulo: "RH", largura: 14, alinhar: "center" },
  { titulo: "Encarregado", largura: 16, alinhar: "center" },
  { titulo: "SESMT / SST", largura: 14, alinhar: "center" },
  { titulo: "Empregado", largura: 12, alinhar: "center" },
];

const RACI: LinhaTabela[] = (
  [
    ["Elaborar e revisar esta política", "R", "C", "I", "—"],
    ["Comunicar regras ao empregado na admissão", "R", "C", "—", "—"],
    ["Colher assinatura do Termo de Compromisso", "R", "C", "—", "—"],
    ["Entrega e devolução de chaves do alojamento e do armário", "R", "R", "—", "C"],
    ["Operar o sistema de câmeras (CFTV)", "R", "C", "C", "I"],
    ["Fiscalizar o cumprimento das regras no dia a dia", "C", "R", "I", "—"],
    ["Registrar ocorrências e advertências", "A", "R", "—", "—"],
    ["Aplicar penalidades disciplinares", "R", "C", "I", "—"],
    ["Manter limpeza coletiva e organização", "—", "C", "—", "R"],
    ["Comunicar problemas estruturais (manutenção)", "I", "R", "C", "C"],
    ["Cumprir as regras do alojamento", "—", "—", "—", "R"],
    ["Apurar denúncias", "R", "C", "C", "I"],
  ] as const
).map((celulas) => ({ celulas: [...celulas] }));

/**
 * O "Detalhamento" do item 10: o que cada parte faz, em prosa. Vem depois da
 * matriz no mesmo anexo, como no original — a matriz diz QUEM responde, o
 * detalhamento diz O QUÊ.
 */
const COLUNAS_DETALHAMENTO: Coluna[] = [
  { titulo: "Responsável", largura: 24 },
  { titulo: "Atribuições", largura: 76 },
];

const DETALHAMENTO: LinhaTabela[] = [
  {
    celulas: [
      "Recursos Humanos",
      "Elaborar, revisar e atualizar esta política; comunicar as regras ao empregado na admissão e colher a assinatura do Termo de Compromisso; aplicar advertências, suspensões e demais penalidades; apurar denúncias e mediar conflitos não solucionados pelo Encarregado; manter o arquivo das ocorrências e penalidades; coordenar a gestão do CFTV (acesso, retenção e atendimento a pedidos de titulares).",
    ],
  },
  {
    celulas: [
      "Encarregado de Obra / Administrativo do Contrato",
      "Fiscalizar diariamente o cumprimento das regras; registrar ocorrências em livro próprio ou no sistema indicado; realizar entrega e devolução de chaves do alojamento e do armário individual; receber e dar primeira tratativa às demandas dos alojados; acionar o RH em caso de infração grave ou reincidência; coordenar a manutenção corretiva e preventiva do alojamento.",
    ],
  },
  {
    celulas: [
      "Empregado alojado",
      "Conhecer e cumprir esta política, assinando o Termo de Compromisso na admissão; zelar pela limpeza, segurança e conservação do alojamento e do armário individual; comunicar imediatamente problemas, danos ou violações; cooperar com a fiscalização.",
    ],
  },
  {
    celulas: [
      "SESMT / Segurança do Trabalho",
      "Verificar as condições sanitárias e de conforto exigidas pela NR-24; orientar sobre EPI e risco de incêndio.",
    ],
  },
  {
    celulas: [
      "Jurídico",
      "Orientar sobre enquadramento disciplinar e justa causa; acompanhar casos com repercussão trabalhista ou criminal.",
    ],
  },
  {
    celulas: [
      "Diretoria",
      "Aprovar a política e suas revisões; decidir sobre casos excepcionais.",
    ],
  },
];

const COLUNAS_INFRACAO: Coluna[] = [
  { titulo: "#", largura: 5, alinhar: "center" },
  { titulo: "Infração", largura: 45 },
  { titulo: "1ª ocorrência", largura: 25 },
  { titulo: "Reincidência", largura: 25 },
];

/** Item 11.3 da POL-RH-001, transcrito do original conferindo página a página. */
const INFRACOES: LinhaTabela[] = (
  [
    ["1", "Não manter a organização do quarto / pertences fora do lugar", "Advertência verbal", "Advertência escrita na reincidência (em até 30 dias)"],
    ["2", "Deixar louça suja ou restos de comida na cozinha/refeitório", "Advertência verbal", "Advertência escrita na reincidência"],
    ["3", "Descumprir horário de silêncio (22h às 06h)", "Advertência verbal na 1ª ocorrência", "Advertência escrita na 2ª; suspensão de 1 dia na 3ª"],
    ["4", "Uso de caixa de som no alojamento", "Advertência escrita direta", "Suspensão de 1 dia na reincidência"],
    ["5", "Permitir entrada de pessoa não autorizada no alojamento", "Advertência escrita direta", "Suspensão de 1 a 3 dias na reincidência"],
    ["6", "Receber visita íntima no alojamento", "Suspensão imediata de 3 dias", "Justa causa na reincidência"],
    ["7", "Consumir, portar ou armazenar bebida alcoólica no alojamento", "Suspensão imediata de 1 a 3 dias", "Justa causa na reincidência"],
    ["8", "Fumar fora da área designada", "Advertência verbal", "Advertência escrita na reincidência; suspensão de 1 dia na 3ª"],
    ["9", "Cozinhar no alojamento ou usar eletrodoméstico não autorizado (fogão, air fryer, forno elétrico, etc.)", "Advertência escrita direta", "Suspensão de 1 a 3 dias na reincidência (risco de incêndio)"],
    ["10", "Danificar bem do alojamento (móvel, eletrodoméstico, instalação)", "Advertência escrita + reposição do dano", "Suspensão e ressarcimento; justa causa se intencional"],
    ["11", "Embriaguez no alojamento ou no trabalho", "Suspensão imediata", "Justa causa na reincidência (CLT, art. 482, “f”)"],
    ["12", "Porte, uso ou tráfico de drogas ilícitas", "Justa causa imediata", "Comunicação às autoridades competentes"],
    ["13", "Agressão física ou verbal a colega, encarregado ou visitante", "Suspensão imediata", "Justa causa por indisciplina ou insubordinação"],
    ["14", "Furto, apropriação indébita ou improbidade", "Justa causa imediata", "Comunicação às autoridades competentes"],
    ["15", "Adulterar ou inutilizar câmeras, lacres ou dispositivos de segurança", "Suspensão imediata de 3 dias", "Justa causa na reincidência"],
  ] as const
).map((celulas) => ({ celulas: [...celulas] }));

export function PoliticaAlojamento({
  orgNome,
  titulo,
  paragrafos,
  versao,
  publicadoEm,
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
  versao?: string;
  publicadoEm?: string;
}) {
  return (
    <Documento
      codigo="POL-RH-001"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo={titulo}
      subtitulo={`${orgNome} — Recursos Humanos`}
    >
      <Narrativa paragrafos={paragrafos} tituloPadrao="Apresentação" />

      {/* Anexos, e não seções do corpo: o item 10 e o 11.3 os CITAM, então
          revisar a tabela não obriga a mexer na cláusula que a invoca. Cada um
          começa em página nova. */}
      <Anexo numero="I" titulo="Matriz de responsabilidades">
        <Paragrafo texto="R: Responsável · A: Aprovador · C: Consultado · I: Informado" />
        <Tabela colunas={COLUNAS_RACI} linhas={RACI} negritoNaPrimeira />
        <Secao titulo="Detalhamento">
          <Tabela
            colunas={COLUNAS_DETALHAMENTO}
            linhas={DETALHAMENTO}
            negritoNaPrimeira
          />
        </Secao>
      </Anexo>

      <Anexo numero="II" titulo="Tabela de infrações e penalidades">
        <Tabela colunas={COLUNAS_INFRACAO} linhas={INFRACOES} negritoNaPrimeira />
      </Anexo>
    </Documento>
  );
}
