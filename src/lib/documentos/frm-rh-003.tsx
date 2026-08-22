// FRM-RH-003 — Termo de entrega e devolução de chaves do alojamento.
//
// Formulário em branco. O checklist de conservação é vistoria conjunta entre
// Encarregado e alojado: cada linha tem OK, Avaria e observação, porque avaria
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
import { Narrativa } from "./blocos";

const OPERACAO: Opcao[] = [
  { texto: "ENTREGA — primeira ocupação do alojamento (admissão ou transferência)" },
  { texto: "DEVOLUÇÃO — fim do uso (desligamento, transferência ou término de contrato)" },
  { texto: "Substituição de chave ou cadeado extraviado ou danificado" },
  { texto: "Outra operação (especificar):", linha: true },
];

const IDENTIFICACAO: Campo[] = [
  { label: "Empregado(a) — nome completo" },
  { label: "CPF / Matrícula" },
  { label: "Cargo / Função" },
  { label: "Centro de Resultado (CR)" },
  { label: "Encarregado responsável" },
  { label: "Endereço do alojamento" },
  { label: "Nº do alojamento / Quarto" },
  { label: "Nº do armário individual" },
];

const COLUNAS_ITENS: Coluna[] = [
  { titulo: "Item", largura: 50 },
  { titulo: "Quantidade", largura: 20, alinhar: "center" },
  { titulo: "Identificação / Nº de série", largura: 30 },
];

const ITENS: LinhaTabela[] = [
  "Chave da porta de entrada do alojamento",
  "Chave da porta do quarto",
  "Cadeado do armário individual",
  "Chave / segredo do cadeado",
  "Controle de portão / acesso",
  "Outro item (especificar)",
].map((item) => ({ celulas: [item, "", ""] }));

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
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
}) {
  return (
    <Documento
      codigo="FRM-RH-003"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Tipo de operação" quebrar={false}>
        <OpcoesCheck opcoes={OPERACAO} />
      </Secao>

      <Secao n={2} titulo="Identificação" quebrar={false}>
        <CampoGrid colunas={2} campos={IDENTIFICACAO} />
      </Secao>

      <Secao n={3} titulo="Itens entregues / devolvidos">
        <Tabela colunas={COLUNAS_ITENS} linhas={ITENS} />
      </Secao>

      <Secao n={4} titulo="Checklist de conservação">
        <Tabela colunas={COLUNAS_CONSERVACAO} linhas={CONSERVACAO} />
      </Secao>

      <Secao n={5} titulo="Descrição detalhada de avarias, se houver">
        <AreaTexto linhas={6} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />

      <Assinaturas
        localData="Local e data: ___________________, ______ de ______________________ de __________."
        assinantes={[
          { papel: "Empregado(a) — nome e CPF" },
          { papel: "Encarregado" },
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Testemunha — nome e CPF" },
        ]}
      />
    </Documento>
  );
}
