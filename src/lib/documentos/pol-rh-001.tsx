// POL-RH-001 — Política de Alojamento.
//
// Normativo de 16 seções. O texto vem de `documento_template`, tipo
// `politica_alojamento`, e é editável em Configurações — é o documento que o
// Jurídico mais revisa.
//
// As DUAS TABELAS ficam aqui, em código, e não no template. Não é preferência:
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
  Secao,
  Tabela,
  type Coluna,
  type LinhaTabela,
} from "@/lib/pdf-form";
import { Narrativa } from "./blocos";

const COLUNAS_RESPONSABILIDADE: Coluna[] = [
  { titulo: "Responsável", largura: 24 },
  { titulo: "Atribuições", largura: 76 },
];

const RESPONSABILIDADES: LinhaTabela[] = [
  {
    celulas: [
      "Empregado alojado",
      "Cumprir esta política e o Termo de Compromisso FRM-RH-001; zelar pela conservação do alojamento, do armário e do kit; comunicar avarias, riscos e violações ao Encarregado.",
    ],
  },
  {
    celulas: [
      "Encarregado",
      "Fiscalizar o cumprimento da política; registrar ocorrências; conduzir a vistoria de entrega e devolução; aplicar advertência verbal e acionar o RH nos demais casos.",
    ],
  },
  {
    celulas: [
      "Recursos Humanos",
      "Aplicar advertência escrita e suspensão (FRM-RH-002); manter a pasta funcional; apurar denúncias; guardar as imagens de CFTV sob acesso restrito.",
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
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
}) {
  return (
    <Documento
      codigo="POL-RH-001"
      titulo={titulo}
      subtitulo={`${orgNome} — Recursos Humanos`}
    >
      <Narrativa paragrafos={paragrafos} tituloPadrao="Apresentação" />

      <Secao titulo="Matriz de responsabilidades">
        <Tabela colunas={COLUNAS_RESPONSABILIDADE} linhas={RESPONSABILIDADES} />
      </Secao>

      <Secao titulo="Tabela de infrações e penalidades">
        <Tabela colunas={COLUNAS_INFRACAO} linhas={INFRACOES} densa />
      </Secao>
    </Documento>
  );
}
