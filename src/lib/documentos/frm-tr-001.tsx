// FRM-TR-001 — Comprovante de Treinamento no Sistema.
//
// ESTRUTURA aqui; TEXTO da declaração em `documento_template`, tipo
// `comprovante_treinamento`, editável em Configurações. Mesma divisão dos
// outros documentos: revisar o texto de uma declaração é assunto de quem
// responde por ela, e não pode exigir deploy.
//
// A tabela lista as AULAS percorridas, não as perguntas. O comprovante atesta
// o que a pessoa leu; o acerto no questionário é a condição para ele existir, e
// aparece como resultado, não como gabarito impresso.

import { Narrativa } from "./blocos";
import {
  Documento,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Assinante,
} from "@/lib/pdf-form";

const COLUNAS_AULAS: Coluna[] = [
  { titulo: "#", largura: 8 },
  { titulo: "Aula", largura: 42 },
  { titulo: "O que ela cobre", largura: 50 },
];

export function ComprovanteTreinamento({
  orgNome,
  numero,
  campos,
  aulas,
  paragrafos,
  localData,
  assinantes,
  versao,
  publicadoEm,
}: {
  orgNome: string;
  numero?: string | null;
  campos: Campo[];
  aulas: { titulo: string; resumo: string }[];
  paragrafos: string[];
  localData: string;
  assinantes: Assinante[];
  versao?: string;
  publicadoEm?: string;
}) {
  const linhas: LinhaTabela[] = aulas.map((a, i) => ({
    celulas: [String(i + 1), a.titulo, a.resumo],
  }));

  return (
    <Documento
      codigo="FRM-TR-001"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo="Comprovante de Treinamento no Sistema"
      subtitulo={numero ? `${orgNome} — ${numero}` : orgNome}
    >
      <Secao n={1} titulo="Identificação">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      {/* quebrar={false}: sem isso o cabeçalho da tabela fica órfão no pé de
          uma página e as linhas caem na seguinte. */}
      <Secao n={2} titulo="Aulas percorridas" quebrar={false}>
        <Tabela colunas={COLUNAS_AULAS} linhas={linhas} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Declaração" />

      <Assinaturas modo="imagem" assinantes={assinantes} localData={localData} />
    </Documento>
  );
}
