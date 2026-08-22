import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import {
  expandirLinhas,
  dadosGrafico,
  formatarValor,
  type Relatorio,
} from "@/lib/relatorios";
import {
  SLATE_50,
  SLATE_100,
  SLATE_200,
  SLATE_400,
  SLATE_500,
  SLATE_900,
  WARNING_BORDA,
  WARNING_FUNDO,
  WARNING_TEXTO,
} from "@/lib/brand-colors";
import { LogoSistenge } from "./pdf-logo";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  topo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titulo: { fontSize: 15, marginBottom: 2 },
  sub: { fontSize: 9, color: SLATE_500, marginBottom: 12 },
  row: { flexDirection: "row", borderBottom: `1 solid ${SLATE_200}`, paddingVertical: 4 },
  header: {
    flexDirection: "row",
    borderBottom: `1 solid ${SLATE_900}`,
    paddingVertical: 4,
    backgroundColor: SLATE_100,
  },
  cell: { paddingHorizontal: 4 },
  hcell: { paddingHorizontal: 4, fontFamily: "Helvetica-Bold" },
  rowSubtotal: { backgroundColor: SLATE_50 },
  rowTotal: { borderTop: `1 solid ${SLATE_900}`, backgroundColor: SLATE_100 },
  cellForte: { fontFamily: "Helvetica-Bold" },
  grafico: { marginBottom: 14 },
  gRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  gLabel: { width: "32%", fontSize: 8, paddingRight: 4 },
  gTrack: { flex: 1, height: 8, backgroundColor: SLATE_200 },
  gBar: { height: 8, backgroundColor: SLATE_900 },
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
          <Text style={{ marginTop: 12, color: SLATE_500 }}>
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

// Cor de destaque dos documentos. Passa a ser o slate-900: na identidade
// Sistenge 2026 o vermelho e da marca, nao da interface.
const ACENTO = SLATE_900;

const vStyles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: SLATE_900 },
  eyebrow: { fontSize: 8, color: ACENTO, letterSpacing: 1, marginBottom: 3 },
  titulo: { fontSize: 20, marginBottom: 2 },
  sub: { fontSize: 10, color: SLATE_500, marginBottom: 16 },
  frame: { border: `1 solid ${SLATE_200}`, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", flexWrap: "wrap" },
  infoCell: { width: "25%", marginBottom: 8 },
  infoLabel: { fontSize: 7, color: SLATE_400, textTransform: "uppercase", marginBottom: 2 },
  infoValor: { fontSize: 11 },
  h3: { fontSize: 13, marginBottom: 6 },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: `1 solid ${SLATE_100}`,
    paddingVertical: 4,
  },
  fotoGrid: { flexDirection: "row", flexWrap: "wrap" },
  fotoBox: { width: "48%", marginRight: "2%", marginBottom: 10 },
  foto: { width: "100%", height: 200, objectFit: "cover", border: `1 solid ${SLATE_200}` },
  fotoLegenda: { fontSize: 8, color: SLATE_500, marginTop: 2 },
  aviso: {
    border: `1 solid ${WARNING_BORDA}`,
    backgroundColor: WARNING_FUNDO,
    color: WARNING_TEXTO,
    padding: 8,
    marginBottom: 12,
    fontSize: 10,
  },
  assRow: { flexDirection: "row", marginTop: 8 },
  assCol: { width: "48%", marginRight: "4%" },
  assArea: { height: 54, marginBottom: 2 },
  assImg: { height: 54, objectFit: "contain" },
  assLinha: { borderTop: `1 solid ${SLATE_900}`, paddingTop: 3 },
  assNome: { fontSize: 11 },
  assRole: { fontSize: 8, color: SLATE_400, textTransform: "uppercase" },
  rodape: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: SLATE_400, textAlign: "center" },
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
            <Text style={{ fontSize: 10, color: SLATE_500, marginTop: 4 }}>
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
                <Text style={{ color: SLATE_500 }}>{a.status}</Text>
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
          <Text style={{ color: SLATE_400 }}>
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
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: SLATE_900, lineHeight: 1.5 },
  eyebrow: { fontSize: 8, color: ACENTO, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 },
  titulo: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 16 },
  infoBox: { border: `1 solid ${SLATE_200}`, padding: 10, marginBottom: 16 },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel: { width: "35%", fontSize: 9, color: SLATE_500 },
  infoValor: { width: "65%", fontSize: 10 },
  paragrafo: { marginBottom: 10, textAlign: "justify" },
  assRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 48 },
  assCol: { width: "45%" },
  assLinha: { borderTop: `1 solid ${SLATE_900}`, paddingTop: 3, textAlign: "center" },
  assNome: { fontSize: 10 },
  assRole: { fontSize: 8, color: SLATE_400 },
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
        <LogoSistenge width={110} />
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
