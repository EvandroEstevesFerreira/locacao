// FRM-RH-004 — Recebimento e devolução do kit de alojamento.
//
// A entrega e a devolução são preenchidas com meses de distância. A quebra de
// página entre as duas seções é deliberada, não desperdício: a folha da entrega
// fica na pasta funcional assinada, e a da devolução é preenchida no desligamento.

import {
  Documento,
  Secao,
  CampoGrid,
  OpcoesCheck,
  AreaTexto,
  Tabela,
  Assinaturas,
  CAIXA,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Opcao,
} from "@/lib/pdf-form";
import { Narrativa } from "./blocos";

const IDENTIFICACAO: Campo[] = [
  { label: "Nome completo" },
  { label: "CPF" },
  { label: "RG / Órgão emissor" },
  { label: "Função / Cargo" },
  { label: "Centro de Resultado (CR)" },
  { label: "Contrato / Obra" },
  { label: "Endereço do alojamento" },
  { label: "Nº do alojamento / Quarto" },
  { label: "Encarregado responsável" },
];

const ITENS_KIT = [
  ["1", "Lençol (par — inferior e superior)", "1 jogo"],
  ["2", "Fronha", "1 unid."],
  ["3", "Travesseiro", "1 unid."],
  ["4", "Cobertor", "1 unid."],
];

const COLUNAS_ENTREGA: Coluna[] = [
  { titulo: "#", largura: 6, alinhar: "center" },
  { titulo: "Item", largura: 46 },
  { titulo: "Quantidade", largura: 16, alinhar: "center" },
  { titulo: "Recebido", largura: 12, alinhar: "center" },
  { titulo: "Identificação / Nº", largura: 20 },
];

const ENTREGA: LinhaTabela[] = ITENS_KIT.map(([n, item, qtd]) => ({
  celulas: [n, item, qtd, CAIXA, ""],
}));

const COLUNAS_DEVOLUCAO: Coluna[] = [
  { titulo: "#", largura: 5, alinhar: "center" },
  { titulo: "Item", largura: 35 },
  { titulo: "Devolvido", largura: 12, alinhar: "center" },
  { titulo: "Bom estado", largura: 13, alinhar: "center" },
  { titulo: "Avariado / Faltante", largura: 15, alinhar: "center" },
  { titulo: "Observação", largura: 20 },
];

const DEVOLUCAO: LinhaTabela[] = ITENS_KIT.map(([n, item]) => ({
  celulas: [n, item, CAIXA, CAIXA, CAIXA, ""],
}));

const MOTIVO: Opcao[] = [
  { texto: "Desligamento da empresa" },
  { texto: "Transferência para outro contrato ou alojamento" },
  { texto: "Término do contrato ou da obra" },
  { texto: "Outro motivo (especificar):", linha: true },
];

const TRATATIVA: Opcao[] = [
  { texto: "Sem avarias ou faltas. Devolução aceita integralmente, sem ressalva." },
  { texto: "Avarias ou faltas decorrentes de desgaste natural — não geram cobrança." },
  { texto: "Avarias ou faltas atribuíveis ao empregado — encaminhar ao RH para apuração e eventual desconto ou cobrança, nos termos da legislação." },
];

export function KitAlojamento({
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
      codigo="FRM-RH-004"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Identificação do alojado" quebrar={false}>
        <CampoGrid colunas={2} campos={IDENTIFICACAO} />
      </Secao>

      <Secao n={2} titulo="Recebimento do kit (entrega)">
        <Tabela colunas={COLUNAS_ENTREGA} linhas={ENTREGA} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Assinaturas
        localData="Local e data da entrega: ______________________, ______ de ______________________ de __________."
        assinantes={[
          { papel: "Empregado(a) — recebedor" },
          { papel: "Encarregado — entregador" },
        ]}
      />

      <Secao n={3} titulo="Devolução do kit (preencher ao fim do uso)" quebrar={false}>
        <OpcoesCheck opcoes={MOTIVO} />
        <Tabela colunas={COLUNAS_DEVOLUCAO} linhas={DEVOLUCAO} />
      </Secao>

      <Secao titulo="Avarias e faltas — descrição detalhada">
        <AreaTexto linhas={4} />
      </Secao>

      <Secao titulo="Tratativa" quebrar={false}>
        <OpcoesCheck opcoes={TRATATIVA} />
      </Secao>

      <Assinaturas
        localData="Local e data da devolução: ______________________, ______ de ______________________ de __________."
        assinantes={[
          { papel: "Empregado(a) — devolve" },
          { papel: "Encarregado — recebe" },
          { papel: `Testemunha / Recursos Humanos — ${orgNome}` },
        ]}
      />
    </Documento>
  );
}
