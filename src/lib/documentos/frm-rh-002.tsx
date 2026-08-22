// FRM-RH-002 — Medida disciplinar: advertência e suspensão.
//
// Formulário em branco, para o RH imprimir e preencher à mão. A estrutura mora
// aqui; as orientações ao empregado vêm de `documento_template`, tipo
// `medida_disciplinar`.
//
// As AreaTexto (descrição do fato, fundamentação) são o maior gasto de página e
// são justamente o que NÃO pode encolher: é onde o RH escreve o que aconteceu, e
// um campo apertado produz descrição vaga — que é o que derruba a medida quando
// ela é questionada.

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
import { Narrativa } from "./blocos";

const IDENTIFICACAO: Campo[] = [
  { label: "Nome completo" },
  { label: "CPF / Matrícula" },
  { label: "Cargo / Função" },
  { label: "Contrato / Obra" },
  { label: "Encarregado" },
  { label: "Data de admissão" },
];

const FATO: Campo[] = [
  { label: "Data e hora do fato" },
  { label: "Local" },
  { label: "Testemunhas (nome e cargo)" },
];

const TIPO_MEDIDA: Opcao[] = [
  { texto: "Advertência VERBAL — registro interno" },
  { texto: "Advertência ESCRITA — ciência do empregado e arquivamento na pasta funcional" },
  { texto: "SUSPENSÃO disciplinar — período e datas:", linha: true },
  { texto: "Outras medidas (especificar):", linha: true },
];

/** Itens da POL-RH-001 que a medida pode invocar. */
const REGRAS: Opcao[] = [
  { texto: "Convivência (item 6.1)" },
  { texto: "Higiene e organização (item 6.2)" },
  { texto: "Segurança (item 6.3)" },
  { texto: "Refeitório e cozinha (item 6.4)" },
  { texto: "Áreas externas e fumantes (item 6.5)" },
  { texto: "Proibições — substâncias e comportamentos (item 7.1)" },
  { texto: "Proibição de cozinhar (item 7.2)" },
  { texto: "Armário individual (item 8)" },
  { texto: "Sistema de câmeras / CFTV (item 9)" },
  { texto: "CLT, art. 482 — justa causa (especificar alínea):", linha: true },
  { texto: "Outro (especificar):", linha: true },
];

const HISTORICO: Opcao[] = [
  { texto: "Primeira ocorrência registrada nos últimos 12 meses." },
  { texto: "Reincidência. Penalidade(s) anterior(es) e data(s):", linha: true },
];

const CIENCIA: Opcao[] = [
  { texto: "Recebi o presente documento, li seu conteúdo e estou ciente das orientações e consequências." },
  { texto: "Recebi o presente documento, mas reservo o direito de apresentar manifestação por escrito ao RH em 5 dias úteis." },
  { texto: "Recuso-me a assinar (a recusa será registrada na presença de duas testemunhas)." },
];

export function MedidaDisciplinar({
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
      codigo="FRM-RH-002"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Tipo de medida disciplinar" quebrar={false}>
        <OpcoesCheck opcoes={TIPO_MEDIDA} />
      </Secao>

      <Secao n={2} titulo="Identificação do empregado" quebrar={false}>
        <CampoGrid colunas={2} campos={IDENTIFICACAO} />
      </Secao>

      <Secao n={3} titulo="Descrição do fato">
        <CampoGrid colunas={2} campos={FATO} />
        <AreaTexto linhas={6} />
      </Secao>

      <Secao n={4} titulo="Regra descumprida">
        <OpcoesCheck opcoes={REGRAS} />
      </Secao>

      <Secao n={5} titulo="Histórico disciplinar" quebrar={false}>
        <OpcoesCheck opcoes={HISTORICO} />
      </Secao>

      <Secao n={6} titulo="Fundamentação e justificativa da medida">
        <AreaTexto linhas={4} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Secao titulo="Ciência do(a) empregado(a)" quebrar={false}>
        <OpcoesCheck opcoes={CIENCIA} />
      </Secao>

      <Assinaturas
        localData="Local e data: ____________________, ______ de ______________________ de __________."
        assinantes={[
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Encarregado" },
          { papel: "Empregado(a) — nome e CPF" },
          { papel: "Testemunha 1 — nome e CPF" },
          { papel: "Testemunha 2 — nome e CPF" },
        ]}
      />
    </Documento>
  );
}
