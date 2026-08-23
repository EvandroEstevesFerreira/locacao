// FRM-RH-001 — Termo de Compromisso de Alojamento.
//
// ESTRUTURA aqui; TEXTO em `documento_template`, tipo `termo_responsabilidade`,
// editável em Configurações → Templates de documentos. Se procurar as 22 regras
// neste arquivo, não vai achar: elas moram no template, porque o RH e o Jurídico
// as revisam — e revisar cláusula não pode exigir deploy.
//
// Os parágrafos vindos do template são classificados por forma:
//   - CAIXA ALTA sem ponto final  → título de subseção, abre um bloco
//   - começa com "— "             → item de lista numerada
//   - qualquer outro              → parágrafo corrido
//
// A convenção é frágil de propósito ser simples: o alternativo era inventar uma
// linguagem de marcação dentro de um textarea que o RH usa uma vez por ano.

import { Narrativa, Paragrafo } from "./blocos";
import {
  Documento,
  Anexo,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
  type LinhaTabela,
} from "@/lib/pdf-form";


const COLUNAS_PENALIDADE: Coluna[] = [
  { titulo: "Penalidade", largura: 30 },
  { titulo: "Como se aplica", largura: 70 },
];

/**
 * Tabela do item 11 da POL-RH-001. Fica em código, e não no template, porque é
 * estrutura — e porque o teto de 30 dias da suspensão é o do art. 474 da CLT,
 * não uma preferência editorial.
 */
const PENALIDADES: LinhaTabela[] = [
  {
    celulas: [
      "Advertência verbal",
      "Aplicada pelo Encarregado, registrada em livro de ocorrências.",
    ],
  },
  {
    celulas: [
      "Advertência escrita",
      "Aplicada pelo RH (FRM-RH-002), com ciência do empregado e juntada à pasta funcional.",
    ],
  },
  {
    celulas: [
      "Suspensão disciplinar (1 a 30 dias)",
      "Sem remuneração, conforme art. 474 da CLT. Aplicável diretamente, sem advertência escrita prévia, em casos como visita íntima no alojamento, consumo ou porte de bebida alcoólica e adulteração de câmeras.",
    ],
  },
  {
    celulas: [
      "Rescisão por justa causa",
      "Nas hipóteses do art. 482 da CLT — embriaguez habitual, improbidade, indisciplina, agressão, porte ou uso de drogas e demais infrações graves desta política.",
    ],
  },
];

export function TermoCompromisso({
  orgNome,
  titulo,
  campos,
  paragrafos,
  versao,
  publicadoEm,
  localData,
  aceite,
}: {
  orgNome: string;
  titulo: string;
  campos: Campo[];
  paragrafos: string[];
  versao?: string;
  publicadoEm?: string;
  localData: string;
  /**
   * Registro do aceite eletrônico. Presente, o bloco de assinatura do empregado
   * imprime data/hora e IP no lugar da linha para assinar à mão — o `modo` do
   * primitivo <Assinaturas> foi desenhado para esta troca desde a fase 1.
   */
  aceite?: { em: string; ip?: string | null };
}) {
  const nomeAlojado = campos[0]?.valor ?? undefined;

  return (
    <Documento
      codigo="FRM-RH-001"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Identificação do Alojado">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Apresentação" />

      {/* quebrar={false}: sem isso o título e o cabeçalho da tabela ficam
          órfãos no pé de uma página e as linhas caem na seguinte. */}
      {/* O empregado assina declarando ciência de um anexo IDENTIFICÁVEL, o que
          em audiência vale mais que "a tabela da página 2". A remissão fica no
          corpo, logo antes das assinaturas. */}
      <Secao titulo="Penalidades" quebrar={false}>
        <Paragrafo texto="Declaro ciência do regime disciplinar aplicável ao descumprimento deste Termo e da Política POL-RH-001, conforme o Anexo I, que integra este documento." />
      </Secao>

      <Assinaturas
        localData={localData}
        modo={aceite ? "aceite" : "manual"}
        assinantes={[
          {
            papel: "Empregado(a)",
            nome: nomeAlojado,
            detalhe: aceite
              ? `Aceite eletrônico em ${aceite.em}${aceite.ip ? ` — IP ${aceite.ip}` : ""}`
              : undefined,
          },
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Testemunha 1" },
          { papel: "Testemunha 2" },
        ]}
      />
      <Anexo numero="I" titulo="Regime disciplinar aplicável">
        <Tabela colunas={COLUNAS_PENALIDADE} linhas={PENALIDADES} />
      </Anexo>
    </Documento>
  );
}
