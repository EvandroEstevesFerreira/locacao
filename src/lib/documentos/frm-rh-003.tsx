// FRM-RH-003 — Termo de entrega e devolução de chaves do alojamento.
//
// O MESMO componente serve aos dois usos: sem `dados`, sai em branco para
// preencher à mão; com `dados`, sai preenchido a partir de `entrega_ocupante`.
//
// O CHECKLIST DE CONSERVAÇÃO sai sempre em branco, mesmo no documento
// preenchido — e isso é deliberado. Ele é vistoria CONJUNTA entre Encarregado e
// alojado, feita com os dois olhando o quarto. Pré-marcar item de vistoria a
// partir do sistema seria inventar uma conferência que não aconteceu, e avaria
// não registrada na entrada vira cobrança indevida na saída.

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
import { ITENS_ENTREGA } from "@/lib/alojamento";
import { Narrativa, Paragrafo } from "./blocos";

/** Dados de uma entrega registrada. Ausente, o documento sai em branco. */
export type DadosEntrega = {
  ocupante: string;
  cpf?: string | null;
  cargo?: string | null;
  centroResultado?: string | null;
  obra?: string | null;
  endereco?: string | null;
  quarto?: string | null;
  armario?: string | null;
  entregueEm?: string | null;
  devolvidoEm?: string | null;
  /** Itens marcados no registro. */
  itens?: string[];
  avarias?: string | null;
  devolucaoMotivo?: string | null;
  tratativa?: string | null;
};

function operacao(d?: DadosEntrega): Opcao[] {
  const entrega = Boolean(d?.entregueEm) && !d?.devolvidoEm;
  const devolucao = Boolean(d?.devolvidoEm);
  return [
    {
      texto: d?.entregueEm
        ? `ENTREGA — primeira ocupação do alojamento, em ${d.entregueEm}`
        : "ENTREGA — primeira ocupação do alojamento (admissão ou transferência)",
      marcada: entrega,
    },
    {
      texto: d?.devolvidoEm
        ? `DEVOLUÇÃO — fim do uso, em ${d.devolvidoEm}`
        : "DEVOLUÇÃO — fim do uso (desligamento, transferência ou término de contrato)",
      marcada: devolucao,
    },
    { texto: "Substituição de chave ou cadeado extraviado ou danificado" },
    { texto: "Outra operação (especificar):", linha: true },
  ];
}

function identificacao(d?: DadosEntrega): Campo[] {
  return [
    { label: "Empregado(a) — nome completo", valor: d?.ocupante },
    { label: "CPF / Matrícula", valor: d?.cpf },
    { label: "Cargo / Função", valor: d?.cargo },
    { label: "Centro de Resultado (CR)", valor: d?.centroResultado },
    { label: "Encarregado responsável" },
    { label: "Endereço do alojamento", valor: d?.endereco },
    { label: "Nº do alojamento / Quarto", valor: d?.quarto },
    { label: "Nº do armário individual", valor: d?.armario },
  ];
}

const COLUNAS_ITENS: Coluna[] = [
  { titulo: "Item", largura: 50 },
  { titulo: "Quantidade", largura: 20, alinhar: "center" },
  { titulo: "Identificação / Nº de série", largura: 30 },
];

// Fonte única com o formulário, mais a linha livre que só existe no papel.
const ITENS_BASE = [
  ...ITENS_ENTREGA.chaves.map((i) => i.item),
  "Outro item (especificar)",
];

/**
 * Itens da tabela. No documento preenchido, a coluna de quantidade traz "1"
 * apenas nos itens que o registro marcou — a folha diz o que de fato saiu do
 * armário, e não a lista inteira de possibilidades.
 */
function itens(d?: DadosEntrega): LinhaTabela[] {
  const marcados = new Set(d?.itens ?? []);
  return ITENS_BASE.map((item) => ({
    celulas: [item, d && marcados.has(item) ? "1" : "", ""],
  }));
}

const COLUNAS_CONSERVACAO: Coluna[] = [
  { titulo: "Item", largura: 46 },
  { titulo: "OK", largura: 8, alinhar: "center" },
  { titulo: "Avaria", largura: 10, alinhar: "center" },
  { titulo: "Observação", largura: 36 },
];

const CONSERVACAO: LinhaTabela[] = [
  "Cama e estrutura (sem danos, parafusos firmes)",
  "Colchão (sem rasgos, manchas ou cheiro forte)",
  "Travesseiro e roupa de cama",
  "Armário individual (porta, dobradiça, fechadura)",
  "Cadeado e chave do armário",
  "Chave da porta do alojamento / quarto",
  "Tomadas e interruptores (sem danos)",
  "Lâmpadas funcionando",
  "Janelas, vidros e venezianas",
  "Ventilador / ar-condicionado",
  "Paredes e piso (sem furos, manchas, riscos)",
  "Cortina ou persiana",
  "Banheiro (vaso, pia, chuveiro, registro)",
  "Geladeira (limpa, sem restos de alimento)",
  "Micro-ondas (limpo, sem dano)",
  "Outros itens (especificar)",
].map((item) => ({ celulas: [item, CAIXA, CAIXA, ""] }));

export function TermoChaves({
  orgNome,
  titulo,
  paragrafos,
  versao,
  publicadoEm,
  dados,
  localData,
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
  versao?: string;
  publicadoEm?: string;
  /** Ausente, o documento sai em branco para preencher à mão. */
  dados?: DadosEntrega;
  localData?: string;
}) {
  return (
    <Documento
      codigo="FRM-RH-003"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Tipo de operação" quebrar={false}>
        <OpcoesCheck opcoes={operacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={3} titulo="Itens entregues / devolvidos">
        <Tabela colunas={COLUNAS_ITENS} linhas={itens(dados)} />
      </Secao>

      <Secao n={4} titulo="Checklist de conservação">
        <Tabela colunas={COLUNAS_CONSERVACAO} linhas={CONSERVACAO} />
      </Secao>

      <Secao n={5} titulo="Descrição detalhada de avarias, se houver">
        {dados?.avarias ? <Paragrafo texto={dados.avarias} /> : <AreaTexto linhas={6} />}
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Assinaturas
        localData={
          localData ??
          "Local e data: ___________________, ______ de ______________________ de __________."
        }
        assinantes={[
          { papel: "Empregado(a) — nome e CPF", nome: dados?.ocupante },
          { papel: "Encarregado" },
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Testemunha — nome e CPF" },
        ]}
      />
    </Documento>
  );
}
