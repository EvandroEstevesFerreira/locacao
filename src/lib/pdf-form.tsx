// Primitivos de formulário em PDF.
//
// Os documentos do alojamento (POL-RH-001, FRM-RH-001 a 005) se descrevem por
// composição destes blocos. A ESTRUTURA mora aqui, em código; o TEXTO narrativo
// mora em `documento_template.corpo` e é editável em Configurações. A divisão
// acompanha quem edita o quê: o RH revisa cláusula, não grid de checkbox.
//
// Escala própria de formulário (9pt/1.35), mais densa que a de contrato
// (11pt/1.5, em pdf.tsx) — um formulário é para preencher, não para ler
// corrido. Ver a seção "Densidade" da spec de 2026-08-22.

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { SLATE_100, SLATE_200, SLATE_400, SLATE_500, SLATE_900 } from "@/lib/brand-colors";
import { LogoSistenge } from "./pdf-logo";

/** Caixa de marcação vazia, para preenchimento à mão. */
export const CAIXA = "☐";

/** Acima do piso de 85pt exigido pelo Manual de Identidade Visual. */
const LOGO_LARGURA = 110;

const f = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: SLATE_900,
    lineHeight: 1.35,
  },
  cabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  codigo: { fontSize: 7.5, color: SLATE_500, textAlign: "right" },
  titulo: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitulo: {
    fontSize: 8,
    color: SLATE_500,
    textAlign: "center",
    marginBottom: 14,
  },
  rodape: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: SLATE_200,
    borderTopStyle: "solid",
    paddingTop: 4,
    fontSize: 7,
    color: SLATE_400,
  },
  secao: { marginBottom: 10 },
  secaoTitulo: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  campoGrid: { flexDirection: "row", flexWrap: "wrap" },
  campo: { paddingRight: 10, marginBottom: 6 },
  campoLabel: { fontSize: 7.5, color: SLATE_500, marginBottom: 1 },
  campoValor: { fontSize: 9 },
  campoLinha: {
    marginTop: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_400,
    borderBottomStyle: "solid",
  },
  listaItem: { flexDirection: "row", marginBottom: 3 },
  listaMarca: { width: 16, fontSize: 8.5 },
  listaTexto: { flex: 1, fontSize: 8.5, textAlign: "justify" },
  opcao: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  opcaoCaixa: { width: 12, fontSize: 10 },
  opcaoTexto: { fontSize: 8.5 },
  opcaoLinha: {
    flex: 1,
    marginLeft: 4,
    marginBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_400,
    borderBottomStyle: "solid",
  },
  areaLinha: {
    height: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabela: {
    borderWidth: 0.5,
    borderColor: SLATE_200,
    borderStyle: "solid",
    marginBottom: 8,
  },
  tabelaCabecalho: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCabecalhoCelula: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  tabelaLinha: {
    flexDirection: "row",
    minHeight: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCelula: { fontSize: 8, paddingVertical: 2.5, paddingHorizontal: 3 },
  tabelaGrupo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: SLATE_500,
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    backgroundColor: SLATE_100,
  },
  localData: { marginTop: 18, marginBottom: 20, fontSize: 9 },
  assGrid: { flexDirection: "row", flexWrap: "wrap" },
  assCol: { width: "50%", paddingRight: 16, marginBottom: 24 },
  assLinha: {
    borderTopWidth: 0.5,
    borderTopColor: SLATE_900,
    borderTopStyle: "solid",
    paddingTop: 3,
  },
  assNome: { fontSize: 8.5 },
  assPapel: { fontSize: 7.5, color: SLATE_500 },
  assDetalhe: { fontSize: 7, color: SLATE_400 },
});

export type Campo = { label: string; valor?: string | null };

/**
 * Conta páginas de um PDF já renderizado.
 *
 * Serve aos testes de densidade: "nenhum formulário passa de 2 páginas" só é
 * meta de verdade se o CI reprovar quando ela for rompida. Lê o `/Count` do nó
 * de páginas — suficiente e sem dependência nova.
 */
export function contarPaginas(buffer: Buffer | Uint8Array): number {
  const texto = Buffer.from(buffer).toString("latin1");
  const contagens = [
    ...texto.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g),
  ]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n));
  if (contagens.length > 0) return Math.max(...contagens);
  // Fallback: conta os objetos de página.
  return [...texto.matchAll(/\/Type\s*\/Page[^s]/g)].length;
}

export function Documento({
  codigo,
  titulo,
  subtitulo,
  orientacao = "portrait",
  children,
}: {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  orientacao?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  return (
    <Document>
      <Page size="A4" orientation={orientacao} style={f.page}>
        <View style={f.cabecalho} fixed>
          <LogoSistenge width={LOGO_LARGURA} />
          <Text style={f.codigo}>{codigo}</Text>
        </View>
        <Text style={f.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={f.subtitulo}>{subtitulo}</Text> : null}
        {children}
        <View style={f.rodape} fixed>
          <Text>Sistenge Construções e Comércio Ltda — Recursos Humanos</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export function Secao({
  n,
  titulo,
  quebrar = true,
  children,
}: {
  n?: number;
  titulo: string;
  /** `false` mantém a seção inteira na mesma página. */
  quebrar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={f.secao} wrap={quebrar}>
      <Text style={f.secaoTitulo}>{n ? `${n}. ${titulo}` : titulo}</Text>
      {children}
    </View>
  );
}

export function Lista({
  itens,
  tipo = "marcador",
}: {
  itens: string[];
  tipo?: "numerada" | "marcador";
}) {
  return (
    <View>
      {itens.map((item, i) => (
        <View key={i} style={f.listaItem} wrap={false}>
          <Text style={f.listaMarca}>
            {tipo === "numerada" ? `${i + 1}.` : "•"}
          </Text>
          <Text style={f.listaTexto}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export type Opcao = { texto: string; linha?: boolean };

/** `☐ texto`, com linha à direita quando a opção continua em branco. */
export function OpcoesCheck({ opcoes }: { opcoes: Opcao[] }) {
  return (
    <View>
      {opcoes.map((o, i) => (
        <View key={i} style={f.opcao} wrap={false}>
          <Text style={f.opcaoCaixa}>{CAIXA}</Text>
          <Text style={f.opcaoTexto}>{o.texto}</Text>
          {o.linha ? <View style={f.opcaoLinha} /> : null}
        </View>
      ))}
    </View>
  );
}

/** N linhas em branco para escrita à mão. */
export function AreaTexto({ linhas }: { linhas: number }) {
  return (
    <View>
      {Array.from({ length: linhas }, (_, i) => (
        <View key={i} style={f.areaLinha} />
      ))}
    </View>
  );
}

/**
 * Campos label/valor. `valor` ausente ou nulo desenha uma LINHA para preencher
 * à mão — é o que permite o Loca guardar só parte dos dados do alojado sem
 * bifurcar o layout: promover um campo a "guardado" é passar o valor, nada mais.
 */
export function CampoGrid({
  campos,
  colunas = 2,
}: {
  campos: Campo[];
  colunas?: 1 | 2;
}) {
  const largura = colunas === 2 ? "50%" : "100%";
  return (
    <View style={f.campoGrid}>
      {campos.map((c, i) => (
        <View key={i} style={[f.campo, { width: largura }]}>
          <Text style={f.campoLabel}>{c.label}</Text>
          {c.valor ? (
            <Text style={f.campoValor}>{c.valor}</Text>
          ) : (
            <View style={f.campoLinha} />
          )}
        </View>
      ))}
    </View>
  );
}
