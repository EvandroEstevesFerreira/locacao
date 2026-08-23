// FRM-RH-004 — Recebimento e devolução do kit de alojamento.
//
// A entrega e a devolução são preenchidas com meses de distância. A quebra de
// página entre as duas seções é deliberada, não desperdício: a folha da entrega
// fica na pasta funcional assinada, e a da devolução é preenchida no desligamento.

import { ITENS_ENTREGA } from "@/lib/alojamento";
import type { DadosEntrega } from "./frm-rh-003";
import {
  Documento,
  Secao,
  CampoGrid,
  OpcoesCheck,
  AreaTexto,
  Tabela,
  Assinaturas,
  CAIXA,
  CAIXA_MARCADA,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Opcao,
} from "@/lib/pdf-form";
import { Narrativa, Paragrafo } from "./blocos";

function identificacao(d?: DadosEntrega): Campo[] {
  return [
    { label: "Nome completo", valor: d?.ocupante },
    { label: "CPF", valor: d?.cpf },
    { label: "RG / Órgão emissor" },
    { label: "Função / Cargo", valor: d?.cargo },
    { label: "Centro de Resultado (CR)", valor: d?.centroResultado },
    { label: "Contrato / Obra", valor: d?.obra },
    { label: "Endereço do alojamento", valor: d?.endereco },
    { label: "Nº do alojamento / Quarto", valor: d?.quarto },
    { label: "Encarregado responsável" },
  ];
}

// Fonte única com o formulário: os rótulos gravados em `entrega_ocupante.itens`
// são exatamente estes. Ver o comentário de ITENS_ENTREGA em alojamento.ts.
const ITENS_KIT = ITENS_ENTREGA.kit.map((i, idx) => [
  String(idx + 1),
  i.item,
  i.quantidade,
]);

const COLUNAS_ENTREGA: Coluna[] = [
  { titulo: "#", largura: 6, alinhar: "center" },
  { titulo: "Item", largura: 46 },
  { titulo: "Quantidade", largura: 16, alinhar: "center" },
  { titulo: "Recebido", largura: 12, alinhar: "center" },
  { titulo: "Identificação / Nº", largura: 20 },
];

/**
 * Itens do kit. Sem dados, todas as caixas vazias, para marcar à mão. Com
 * dados, marca as que o registro diz que saíram e deixa as outras vazias — a
 * folha mostra o kit inteiro, e não só o que foi entregue, porque a lista dos
 * quatro itens é o padrão e a ausência de um deles é informação.
 */
function entrega(d?: DadosEntrega): LinhaTabela[] {
  const marcados = new Set(d?.itens ?? []);
  return ITENS_KIT.map(([n, item, qtd]) => ({
    celulas: [n, item, qtd, marcados.has(item) ? CAIXA_MARCADA : CAIXA, ""],
  }));
}

const COLUNAS_DEVOLUCAO: Coluna[] = [
  { titulo: "#", largura: 5, alinhar: "center" },
  { titulo: "Item", largura: 35 },
  { titulo: "Devolvido", largura: 12, alinhar: "center" },
  { titulo: "Bom estado", largura: 13, alinhar: "center" },
  { titulo: "Avariado / Faltante", largura: 15, alinhar: "center" },
  { titulo: "Observação", largura: 20 },
];

/**
 * Conferência de devolução: sai SEMPRE em branco, mesmo no documento
 * preenchido. É vistoria conjunta feita com os dois olhando o item — pré-marcar
 * "bom estado" a partir do sistema seria inventar uma conferência.
 */
const DEVOLUCAO: LinhaTabela[] = ITENS_KIT.map(([n, item]) => ({
  celulas: [n, item, CAIXA, CAIXA, CAIXA, ""],
}));

function motivo(d?: DadosEntrega): Opcao[] {
  const m = d?.devolucaoMotivo;
  return [
    { texto: "Desligamento da empresa", marcada: m === "desligamento" },
    {
      texto: "Transferência para outro contrato ou alojamento",
      marcada: m === "transferencia",
    },
    { texto: "Término do contrato ou da obra", marcada: m === "termino_contrato" },
    { texto: "Outro motivo (especificar):", linha: true, marcada: m === "outro" },
  ];
}

function tratativa(d?: DadosEntrega): Opcao[] {
  const t = d?.tratativa;
  return [
    {
      texto: "Sem avarias ou faltas. Devolução aceita integralmente, sem ressalva.",
      marcada: t === "sem_ressalva",
    },
    {
      texto: "Avarias ou faltas decorrentes de desgaste natural — não geram cobrança.",
      marcada: t === "desgaste_natural",
    },
    {
      texto:
        "Avarias ou faltas atribuíveis ao empregado — encaminhar ao RH para apuração e eventual desconto ou cobrança, nos termos da legislação.",
      marcada: t === "atribuivel",
    },
  ];
}

export function KitAlojamento({
  orgNome,
  titulo,
  paragrafos,
  versao,
  publicadoEm,
  dados,
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
  versao?: string;
  publicadoEm?: string;
  /** Ausente, o documento sai em branco para preencher à mão. */
  dados?: DadosEntrega;
}) {
  return (
    <Documento
      codigo="FRM-RH-004"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Identificação do alojado" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={2} titulo="Recebimento do kit (entrega)">
        <Tabela colunas={COLUNAS_ENTREGA} linhas={entrega(dados)} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Assinaturas
        localData={
          dados?.entregueEm
            ? `Local e data da entrega: ______________________, ${dados.entregueEm}.`
            : "Local e data da entrega: ______________________, ______ de ______________________ de __________."
        }
        assinantes={[
          { papel: "Empregado(a) — recebedor", nome: dados?.ocupante },
          { papel: "Encarregado — entregador" },
        ]}
      />

      <Secao n={3} titulo="Devolução do kit (preencher ao fim do uso)" quebrar={false}>
        <OpcoesCheck opcoes={motivo(dados)} />
        <Tabela colunas={COLUNAS_DEVOLUCAO} linhas={DEVOLUCAO} />
      </Secao>

      <Secao titulo="Avarias e faltas — descrição detalhada">
        {dados?.avarias ? <Paragrafo texto={dados.avarias} /> : <AreaTexto linhas={4} />}
      </Secao>

      <Secao titulo="Tratativa" quebrar={false}>
        <OpcoesCheck opcoes={tratativa(dados)} />
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
