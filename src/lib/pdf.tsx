import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Polygon,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  expandirLinhas,
  dadosGrafico,
  formatarValor,
  type Relatorio,
} from "@/lib/relatorios";

// Logotipo da Sistenge portado para as primitivas SVG do @react-pdf/renderer.
// Ícone no vermelho da marca; wordmark em cinza-escuro (fundo branco do PDF).
const LOGO_VIEWBOX = "0 0 1920 392.19";
const LOGO_RATIO = 392.19 / 1920;
const ICONE_VERMELHO = "#cf2927";
const WORDMARK_COR = "#1f2933";

function LogoSistenge({ width = 150 }: { width?: number }) {
  return (
    <Svg viewBox={LOGO_VIEWBOX} width={width} height={width * LOGO_RATIO}>
      <Path fill={ICONE_VERMELHO} d="M95.63,305.28h276.21c23.7,0,47.95-19.22,54.16-42.9,6.21-23.69-7.97-42.9-31.68-42.9H118.11l-22.48,85.81Z" />
      <Path fill={ICONE_VERMELHO} d="M555.81,76.75h-276.21c-23.7,0-47.95,19.22-54.16,42.9-6.21,23.7,7.97,42.91,31.68,42.91h276.21l22.48-85.82Z" />
      <Path fill={WORDMARK_COR} d="M643.58,205.45c-33.51,0-39.7-14.53-31.66-44.61,7.73-28.87,20.96-43.61,55.29-43.61h94.26l-8.87,33.11h-86.19c-9.09,0-13.31,3.64-15.84,13.12-2.49,9.3-.23,12.93,8.86,12.93h47.64c33.52,0,39.67,13.92,31.67,43.8-7.95,29.67-21.64,44.61-55.35,44.61h-97.92l8.81-32.9h90.04c8.89,0,13.34-3.84,15.94-13.53,2.71-10.08-.38-12.91-8.84-12.91h-47.85.01Z" />
      <Polygon fill={WORDMARK_COR} points="829.48 117.24 789.96 264.79 750.4 264.79 789.92 117.24 829.48 117.24" />
      <Path fill={WORDMARK_COR} d="M873.32,205.45c-33.51,0-39.7-14.53-31.66-44.61,7.73-28.87,20.96-43.61,55.29-43.61h94.26l-8.87,33.11h-86.19c-9.1,0-13.31,3.64-15.84,13.12-2.49,9.3-.23,12.93,8.86,12.93h47.65c33.52,0,39.67,13.92,31.67,43.8-7.95,29.67-21.64,44.61-55.35,44.61h-97.92l8.81-32.9h90.05c8.88,0,13.33-3.84,15.93-13.53,2.71-10.08-.38-12.91-8.84-12.91h-47.85Z" />
      <Polygon fill={WORDMARK_COR} points="1054.6 149.14 1002.31 149.14 1010.85 117.24 1154.99 117.24 1146.46 149.14 1094.17 149.14 1063.19 264.79 1023.61 264.79 1054.6 149.14" />
      <Polygon fill={WORDMARK_COR} points="1287.32 205.25 1191.01 205.25 1183.61 232.9 1280.72 232.9 1272.17 264.8 1135.5 264.8 1175.04 117.24 1311.3 117.24 1302.75 149.14 1206.05 149.14 1198.65 176.79 1294.95 176.79 1287.32 205.25" />
      <Polygon fill={WORDMARK_COR} points="1430.47 221.81 1458.48 117.24 1495.01 117.24 1455.49 264.79 1407.45 264.79 1362.6 163.88 1335.57 264.79 1298.82 264.79 1338.36 117.24 1385.2 117.24 1430.47 221.81" />
      <Path fill={WORDMARK_COR} d="M1620.49,264.8h-75.7c-43.61,0-62.05-12.51-45.67-73.66,16.39-61.17,41.61-73.89,85.21-73.89h75.3l-8.7,32.51h-75.1c-19.79,0-28.81,8.07-37.73,41.38-8.92,33.3-4.17,41.18,15.62,41.18h40.78l11.84-44.21h34.72l-20.54,76.7h-.02Z" />
      <Polygon fill={WORDMARK_COR} points="1800.39 205.25 1704.09 205.25 1696.68 232.9 1793.79 232.9 1785.24 264.8 1648.57 264.8 1688.11 117.24 1824.37 117.24 1815.83 149.14 1719.13 149.14 1711.72 176.79 1808.02 176.79 1800.39 205.25" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titulo: { fontSize: 15, marginBottom: 2 },
  sub: { fontSize: 9, color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", borderBottom: "1 solid #eee", paddingVertical: 4 },
  header: {
    flexDirection: "row",
    borderBottom: "1 solid #333",
    paddingVertical: 4,
    backgroundColor: "#f2f2f2",
  },
  cell: { paddingHorizontal: 4 },
  hcell: { paddingHorizontal: 4, fontFamily: "Helvetica-Bold" },
  rowSubtotal: { backgroundColor: "#f2f2f3" },
  rowTotal: { borderTop: "1 solid #BE3A31", backgroundColor: "#f7e9e8" },
  cellForte: { fontFamily: "Helvetica-Bold" },
  grafico: { marginBottom: 14 },
  gRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  gLabel: { width: "32%", fontSize: 8, paddingRight: 4 },
  gTrack: { flex: 1, height: 8, backgroundColor: "#eee" },
  gBar: { height: 8, backgroundColor: "#BE3A31" },
  gValor: { width: "18%", fontSize: 8, textAlign: "right", paddingLeft: 4 },
});

export function DocumentoRelatorio({
  relatorio,
  periodo,
}: {
  relatorio: Relatorio;
  periodo?: string;
}) {
  const larguras = relatorio.colunas.map((c) =>
    c.tipo === "texto" ? 2 : 1,
  );
  const grafico = dadosGrafico(relatorio);
  const maxGrafico = grafico.reduce((m, g) => Math.max(m, g.valor), 0);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.topo}>
          <View>
            <Text style={styles.titulo}>{relatorio.titulo}</Text>
            <Text style={styles.sub}>
              Loca — controle de locações{periodo ? ` · ${periodo}` : ""}
            </Text>
          </View>
          <LogoSistenge width={150} />
        </View>

        {grafico.length > 0 ? (
          <View style={styles.grafico}>
            {grafico.map((g, i) => (
              <View key={i} style={styles.gRow} wrap={false}>
                <Text style={styles.gLabel}>{g.label}</Text>
                <View style={styles.gTrack}>
                  <View
                    style={[
                      styles.gBar,
                      { width: `${maxGrafico > 0 ? (g.valor / maxGrafico) * 100 : 0}%` },
                    ]}
                  />
                </View>
                <Text style={styles.gValor}>{formatarValor("moeda", g.valor)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.header}>
          {relatorio.colunas.map((c, i) => (
            <Text key={c.key} style={[styles.hcell, { flex: larguras[i] }]}>
              {c.label}
            </Text>
          ))}
        </View>

        {expandirLinhas(relatorio).map((lr, idx) => {
          if (lr.tipo === "dado") {
            return (
              <View key={idx} style={styles.row} wrap={false}>
                {relatorio.colunas.map((c, i) => (
                  <Text key={c.key} style={[styles.cell, { flex: larguras[i] }]}>
                    {formatarValor(c.tipo, lr.valores[c.key])}
                  </Text>
                ))}
              </View>
            );
          }
          const primeira = relatorio.colunas[0].key;
          return (
            <View
              key={idx}
              style={[styles.row, lr.tipo === "total" ? styles.rowTotal : styles.rowSubtotal]}
              wrap={false}
            >
              {relatorio.colunas.map((c, i) => {
                let conteudo = "";
                if (c.key in lr.valores)
                  conteudo = formatarValor("moeda", lr.valores[c.key]);
                else if (c.key === primeira)
                  conteudo = lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
                return (
                  <Text
                    key={c.key}
                    style={[styles.cell, styles.cellForte, { flex: larguras[i] }]}
                  >
                    {conteudo}
                  </Text>
                );
              })}
            </View>
          );
        })}

        {relatorio.linhas.length === 0 ? (
          <Text style={{ marginTop: 12, color: "#666" }}>
            Nenhum registro para os filtros selecionados.
          </Text>
        ) : null}
      </Page>
    </Document>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Relatório de Vistoria (retirada/devolução) — dados + fotos
// ═══════════════════════════════════════════════════════════════════════════

const ACENTO = "#BE3A31";

const vStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#1d1f20" },
  eyebrow: { fontSize: 8, color: ACENTO, letterSpacing: 1, marginBottom: 3 },
  titulo: { fontSize: 20, marginBottom: 2 },
  sub: { fontSize: 10, color: "#5d5d60", marginBottom: 16 },
  frame: { border: "1 solid #cfcfd2", padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "25%", marginBottom: 8 },
  infoLabel: { fontSize: 7, color: "#8a8a8d", textTransform: "uppercase", marginBottom: 2 },
  infoValor: { fontSize: 11 },
  h3: { fontSize: 13, marginBottom: 6 },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1 solid #ededf0",
    paddingVertical: 4,
  },
  fotoGrid: { flexDirection: "row", flexWrap: "wrap" },
  fotoBox: { width: "48%", marginRight: "2%", marginBottom: 10 },
  foto: { width: "100%", height: 200, objectFit: "cover", border: "1 solid #cfcfd2" },
  fotoLegenda: { fontSize: 8, color: "#5d5d60", marginTop: 2 },
  aviso: {
    border: "1 solid #b45309",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: 8,
    marginBottom: 12,
    fontSize: 10,
  },
  assRow: { flexDirection: "row", marginTop: 8 },
  assCol: { width: "48%", marginRight: "4%" },
  assArea: { height: 54, marginBottom: 2 },
  assImg: { height: 54, objectFit: "contain" },
  assLinha: { borderTop: "1 solid #1d1f20", paddingTop: 3 },
  assNome: { fontSize: 11 },
  assRole: { fontSize: 8, color: "#8a8a8d", textTransform: "uppercase" },
  rodape: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: "#8a8a8d", textAlign: "center" },
});

export type VistoriaPdf = {
  contratoLinha?: string;
  tipoLabel: string;
  data: string;
  responsavel: string;
  avariasCusto: string;
  contexto?: string;
  observacoes?: string;
  avarias: { descricao: string; custo: string; status: string }[];
  fotos: { src: string; legenda?: string }[];
  empresaNome?: string;
  empresaImg?: string;
  empresaEm?: string;
  retiranteNome?: string;
  retiranteImg?: string;
  retiranteEm?: string;
  empresaAssinado: boolean;
  geradoEm: string;
};

export function DocumentoVistoria({ v }: { v: VistoriaPdf }) {
  return (
    <Document>
      <Page size="A4" style={vStyles.page}>
        <Text style={vStyles.eyebrow}>SISTENGE · LOCAÇÕES DE OBRA</Text>
        <Text style={vStyles.titulo}>Relatório de vistoria</Text>
        <Text style={vStyles.sub}>
          {v.contratoLinha ?? "—"}
          {v.contexto ? ` · ${v.contexto}` : ""}
        </Text>

        {!v.empresaAssinado ? (
          <Text style={vStyles.aviso}>
            ⚠ PENDENTE DE ASSINATURA DO REPRESENTANTE SISTENGE — este relatório
            não foi assinado pelo representante da empresa.
          </Text>
        ) : null}

        <View style={vStyles.frame}>
          <View style={vStyles.infoRow}>
            <View style={vStyles.infoCell}>
              <Text style={vStyles.infoLabel}>Tipo</Text>
              <Text style={vStyles.infoValor}>{v.tipoLabel}</Text>
            </View>
            <View style={vStyles.infoCell}>
              <Text style={vStyles.infoLabel}>Data</Text>
              <Text style={vStyles.infoValor}>{v.data}</Text>
            </View>
            <View style={vStyles.infoCell}>
              <Text style={vStyles.infoLabel}>Responsável</Text>
              <Text style={vStyles.infoValor}>{v.responsavel}</Text>
            </View>
            <View style={vStyles.infoCell}>
              <Text style={vStyles.infoLabel}>Avarias (custo est.)</Text>
              <Text style={vStyles.infoValor}>{v.avariasCusto}</Text>
            </View>
          </View>
          {v.observacoes ? (
            <Text style={{ fontSize: 10, color: "#5d5d60", marginTop: 4 }}>
              {v.observacoes}
            </Text>
          ) : null}
        </View>

        {v.avarias.length > 0 ? (
          <View style={vStyles.frame}>
            <Text style={vStyles.h3}>Avarias</Text>
            {v.avarias.map((a, i) => (
              <View key={i} style={vStyles.linha}>
                <Text>
                  {a.descricao} · {a.custo}
                </Text>
                <Text style={{ color: "#5d5d60" }}>{a.status}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={vStyles.h3}>Fotos ({v.fotos.length})</Text>
        {v.fotos.length > 0 ? (
          <View style={vStyles.fotoGrid}>
            {v.fotos.map((f, i) => (
              <View key={i} style={vStyles.fotoBox} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image style={vStyles.foto} src={f.src} />
                {f.legenda ? (
                  <Text style={vStyles.fotoLegenda}>{f.legenda}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: "#8a8a8d" }}>
            Nenhuma foto anexada a esta vistoria.
          </Text>
        )}

        <View wrap={false} style={{ marginTop: 18 }}>
          <Text style={vStyles.h3}>Assinaturas</Text>
          <View style={vStyles.assRow}>
            <View style={vStyles.assCol}>
              <View style={vStyles.assArea}>
                {v.empresaImg ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image style={vStyles.assImg} src={v.empresaImg} />
                ) : null}
              </View>
              <View style={vStyles.assLinha}>
                <Text style={vStyles.assNome}>{v.empresaNome || "—"}</Text>
                <Text style={vStyles.assRole}>Representante Sistenge</Text>
                {v.empresaEm ? (
                  <Text style={vStyles.assRole}>Assinado em {v.empresaEm}</Text>
                ) : null}
              </View>
            </View>
            <View style={vStyles.assCol}>
              <View style={vStyles.assArea}>
                {v.retiranteImg ? (
                  /* eslint-disable-next-line jsx-a11y/alt-text */
                  <Image style={vStyles.assImg} src={v.retiranteImg} />
                ) : null}
              </View>
              <View style={vStyles.assLinha}>
                <Text style={vStyles.assNome}>{v.retiranteNome || "—"}</Text>
                <Text style={vStyles.assRole}>Quem retira / recebe</Text>
                {v.retiranteEm ? (
                  <Text style={vStyles.assRole}>Assinado em {v.retiranteEm}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <Text style={vStyles.rodape} fixed>
          Gerado pelo Loca em {v.geradoEm} · Sistenge — controle de locações
        </Text>
      </Page>
    </Document>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Documento de texto genérico (Imóveis): contrato e termo de responsabilidade
// ═══════════════════════════════════════════════════════════════════════════

const docStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1d1f20", lineHeight: 1.5 },
  marca: { fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  eyebrow: { fontSize: 8, color: ACENTO, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 16 },
  infoBox: { border: "1 solid #cfcfd2", padding: 10, marginBottom: 16 },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: "35%", fontSize: 9, color: "#5d5d60" },
  infoValor: { width: "65%", fontSize: 10 },
  paragrafo: { marginBottom: 10, textAlign: "justify" },
  assRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  assCol: { width: "45%" },
  assLinha: { borderTop: "1 solid #1d1f20", paddingTop: 3, textAlign: "center" },
  assNome: { fontSize: 10 },
  assRole: { fontSize: 8, color: "#8a8a8d" },
  local: { marginTop: 32, fontSize: 10 },
});

export type InfoLinha = { label: string; valor: string };
export type Assinatura = { nome: string; papel: string };

export function DocumentoTexto({
  orgNome,
  eyebrow,
  titulo,
  infos,
  paragrafos,
  assinaturas,
  localData,
}: {
  orgNome: string;
  eyebrow: string;
  titulo: string;
  infos: InfoLinha[];
  paragrafos: string[];
  assinaturas: Assinatura[];
  localData: string;
}) {
  return (
    <Document>
      <Page size="A4" style={docStyles.page}>
        <Text style={docStyles.marca}>SISTENGE</Text>
        <Text style={docStyles.eyebrow}>{eyebrow} · {orgNome}</Text>
        <Text style={docStyles.titulo}>{titulo}</Text>

        {infos.length > 0 ? (
          <View style={docStyles.infoBox}>
            {infos.map((i, idx) => (
              <View key={idx} style={docStyles.infoRow}>
                <Text style={docStyles.infoLabel}>{i.label}</Text>
                <Text style={docStyles.infoValor}>{i.valor}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {paragrafos.map((p, idx) => (
          <Text key={idx} style={docStyles.paragrafo}>{p}</Text>
        ))}

        <Text style={docStyles.local}>{localData}</Text>

        <View style={docStyles.assRow}>
          {assinaturas.map((a, idx) => (
            <View key={idx} style={docStyles.assCol}>
              <View style={docStyles.assLinha}>
                <Text style={docStyles.assNome}>{a.nome || "—"}</Text>
                <Text style={docStyles.assRole}>{a.papel}</Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
