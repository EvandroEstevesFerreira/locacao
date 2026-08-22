// FRM-RH-002 — Medida disciplinar: advertência e suspensão.
//
// O MESMO componente serve aos dois usos: sem `dados`, sai em branco para o RH
// imprimir e preencher à mão; com `dados`, sai preenchido a partir do registro
// em `medida_disciplinar`. Duplicar o documento em duas versões garantiria que
// uma delas ficasse para trás na primeira revisão de cláusula.
//
// A estrutura mora aqui; as orientações ao empregado vêm de
// `documento_template`, tipo `medida_disciplinar`.
//
// As AreaTexto (descrição do fato, fundamentação) são o maior gasto de página na
// versão em branco e são justamente o que NÃO pode encolher: é onde o RH escreve
// o que aconteceu, e campo apertado produz descrição vaga — que é o que derruba
// a medida quando ela é questionada.

import {
  Documento,
  Secao,
  CampoGrid,
  OpcoesCheck,
  AreaTexto,
  Assinaturas,
  type Campo,
  type Opcao,
} from "@/lib/pdf-form";
import { Narrativa, Paragrafo } from "./blocos";

/** Dados de uma medida já registrada. Ausente, o documento sai em branco. */
export type DadosMedida = {
  ocupante: string;
  cpf?: string | null;
  cargo?: string | null;
  obra?: string | null;
  tipo: "verbal" | "escrita" | "suspensao" | "outra";
  suspensaoDias?: number | null;
  suspensaoPeriodo?: string | null;
  fatoEm?: string | null;
  fatoLocal?: string | null;
  fatoDescricao: string;
  testemunhas?: string | null;
  regrasVioladas?: string[];
  cltArtigo?: string | null;
  reincidencia?: boolean;
  fundamentacao?: string | null;
  ciencia?: "recebeu" | "com_ressalva" | "recusou" | null;
};

function identificacao(d?: DadosMedida): Campo[] {
  return [
    { label: "Nome completo", valor: d?.ocupante },
    { label: "CPF / Matrícula", valor: d?.cpf },
    { label: "Cargo / Função", valor: d?.cargo },
    { label: "Contrato / Obra", valor: d?.obra },
    { label: "Encarregado" },
    { label: "Data de admissão" },
  ];
}

function fato(d?: DadosMedida): Campo[] {
  return [
    { label: "Data e hora do fato", valor: d?.fatoEm },
    { label: "Local", valor: d?.fatoLocal },
    { label: "Testemunhas (nome e cargo)", valor: d?.testemunhas },
  ];
}

function tipoMedida(d?: DadosMedida): Opcao[] {
  const suspensao =
    d?.tipo === "suspensao"
      ? `SUSPENSÃO disciplinar — ${d.suspensaoDias ?? "___"} dia(s)${
          d.suspensaoPeriodo ? `: ${d.suspensaoPeriodo}` : ""
        }`
      : "SUSPENSÃO disciplinar — período e datas:";
  return [
    { texto: "Advertência VERBAL — registro interno", marcada: d?.tipo === "verbal" },
    {
      texto:
        "Advertência ESCRITA — ciência do empregado e arquivamento na pasta funcional",
      marcada: d?.tipo === "escrita",
    },
    { texto: suspensao, linha: d?.tipo !== "suspensao", marcada: d?.tipo === "suspensao" },
    { texto: "Outras medidas (especificar):", linha: true, marcada: d?.tipo === "outra" },
  ];
}

/** Itens da POL-RH-001 que a medida pode invocar. */
const REGRAS_BASE: { chave: string; texto: string }[] = [
  { chave: "6.1", texto: "Convivência (item 6.1)" },
  { chave: "6.2", texto: "Higiene e organização (item 6.2)" },
  { chave: "6.3", texto: "Segurança (item 6.3)" },
  { chave: "6.4", texto: "Refeitório e cozinha (item 6.4)" },
  { chave: "6.5", texto: "Áreas externas e fumantes (item 6.5)" },
  { chave: "7.1", texto: "Proibições — substâncias e comportamentos (item 7.1)" },
  { chave: "7.2", texto: "Proibição de cozinhar (item 7.2)" },
  { chave: "8", texto: "Armário individual (item 8)" },
  { chave: "9", texto: "Sistema de câmeras / CFTV (item 9)" },
];

function regras(d?: DadosMedida): Opcao[] {
  const violadas = new Set(d?.regrasVioladas ?? []);
  const base: Opcao[] = REGRAS_BASE.map((r) => ({
    texto: r.texto,
    marcada: violadas.has(r.chave),
  }));
  return [
    ...base,
    d?.cltArtigo
      ? {
          texto: `CLT, art. 482 — justa causa, alínea ${d.cltArtigo}`,
          marcada: true,
        }
      : {
          texto: "CLT, art. 482 — justa causa (especificar alínea):",
          linha: true,
        },
    { texto: "Outro (especificar):", linha: true },
  ];
}

function historico(d?: DadosMedida): Opcao[] {
  return [
    {
      texto: "Primeira ocorrência registrada nos últimos 12 meses.",
      marcada: d ? !d.reincidencia : false,
    },
    {
      texto: "Reincidência. Penalidade(s) anterior(es) e data(s):",
      linha: true,
      marcada: d?.reincidencia ?? false,
    },
  ];
}

function ciencia(d?: DadosMedida): Opcao[] {
  return [
    {
      texto:
        "Recebi o presente documento, li seu conteúdo e estou ciente das orientações e consequências.",
      marcada: d?.ciencia === "recebeu",
    },
    {
      texto:
        "Recebi o presente documento, mas reservo o direito de apresentar manifestação por escrito ao RH em 5 dias úteis.",
      marcada: d?.ciencia === "com_ressalva",
    },
    {
      texto:
        "Recuso-me a assinar (a recusa será registrada na presença de duas testemunhas).",
      marcada: d?.ciencia === "recusou",
    },
  ];
}

export function MedidaDisciplinar({
  orgNome,
  titulo,
  paragrafos,
  dados,
  localData,
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
  /** Ausente, o documento sai em branco para preencher à mão. */
  dados?: DadosMedida;
  localData?: string;
}) {
  return (
    <Documento
      codigo="FRM-RH-002"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Tipo de medida disciplinar" quebrar={false}>
        <OpcoesCheck opcoes={tipoMedida(dados)} />
      </Secao>

      <Secao n={2} titulo="Identificação do empregado" quebrar={false}>
        <CampoGrid colunas={2} campos={identificacao(dados)} />
      </Secao>

      <Secao n={3} titulo="Descrição do fato">
        <CampoGrid colunas={2} campos={fato(dados)} />
        {dados ? <Paragrafo texto={dados.fatoDescricao} /> : <AreaTexto linhas={6} />}
      </Secao>

      <Secao n={4} titulo="Regra descumprida">
        <OpcoesCheck opcoes={regras(dados)} />
      </Secao>

      <Secao n={5} titulo="Histórico disciplinar" quebrar={false}>
        <OpcoesCheck opcoes={historico(dados)} />
      </Secao>

      <Secao n={6} titulo="Fundamentação e justificativa da medida">
        {dados?.fundamentacao ? (
          <Paragrafo texto={dados.fundamentacao} />
        ) : (
          <AreaTexto linhas={4} />
        )}
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Secao titulo="Ciência do(a) empregado(a)" quebrar={false}>
        <OpcoesCheck opcoes={ciencia(dados)} />
      </Secao>

      <Assinaturas
        localData={
          localData ??
          "Local e data: ____________________, ______ de ______________________ de __________."
        }
        assinantes={[
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Encarregado" },
          { papel: "Empregado(a) — nome e CPF", nome: dados?.ocupante },
          { papel: "Testemunha 1 — nome e CPF" },
          { papel: "Testemunha 2 — nome e CPF" },
        ]}
      />
    </Documento>
  );
}
