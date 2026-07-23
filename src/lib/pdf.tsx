import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatarValor, type Relatorio } from "@/lib/relatorios";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
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

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.titulo}>{relatorio.titulo}</Text>
        <Text style={styles.sub}>
          Loca — controle de locações{periodo ? ` · ${periodo}` : ""}
        </Text>

        <View style={styles.header}>
          {relatorio.colunas.map((c, i) => (
            <Text key={c.key} style={[styles.hcell, { flex: larguras[i] }]}>
              {c.label}
            </Text>
          ))}
        </View>

        {relatorio.linhas.map((linha, idx) => (
          <View key={idx} style={styles.row} wrap={false}>
            {relatorio.colunas.map((c, i) => (
              <Text key={c.key} style={[styles.cell, { flex: larguras[i] }]}>
                {formatarValor(c.tipo, linha[c.key])}
              </Text>
            ))}
          </View>
        ))}

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

const ACENTO = "#5980a6";

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
  fotos: string[];
  empresaNome?: string;
  empresaImg?: string;
  retiranteNome?: string;
  retiranteImg?: string;
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
            {v.fotos.map((src, i) => (
              <View key={i} style={vStyles.fotoBox} wrap={false}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image style={vStyles.foto} src={src} />
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
