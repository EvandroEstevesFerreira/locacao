import {
  Document,
  Page,
  View,
  Text,
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
