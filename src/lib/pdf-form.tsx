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

/**
 * Estilo da página dos formulários.
 *
 * ARMADILHA — NUNCA declare `lineHeight` aqui. Com `lineHeight` no estilo da
 * `Page`, o @react-pdf/renderer 4.5 deixa de desenhar QUALQUER filho
 * `position: absolute` + `fixed`: o rodapé some, sem erro nenhum, em todas as
 * páginas. Vale para 1.35 e até para 1. O entrelinhamento vive nos estilos de
 * texto (listaTexto, campoValor, tabelaCelula, opcaoTexto).
 *
 * Diagnosticado em 2026-08-22: a paginação do FRM-RH-001 sumia em silêncio, e o
 * teste de contagem de páginas não pegava. `pdf-form.test.tsx` guarda a regra.
 */
export const ESTILO_PAGINA = {
  paddingTop: 28,
  paddingHorizontal: 30,
  paddingBottom: 40,
  fontSize: 9,
  fontFamily: "Helvetica",
  color: SLATE_900,
} as const;

const f = StyleSheet.create({
  page: ESTILO_PAGINA,
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
  rodapeEmpresa: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: SLATE_400,
  },
  rodapePagina: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: SLATE_400,
    textAlign: "right",
  },
  secao: { marginBottom: 7 },
  secaoTitulo: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    paddingBottom: 1.5,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  campoGrid: { flexDirection: "row", flexWrap: "wrap" },
  campo: { paddingRight: 10, marginBottom: 6 },
  campoLabel: { fontSize: 7.5, color: SLATE_500, marginBottom: 1 },
  campoValor: { fontSize: 9, lineHeight: 1.35 },
  campoLinha: {
    marginTop: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_400,
    borderBottomStyle: "solid",
  },
  listaItem: { flexDirection: "row", marginBottom: 2.5 },
  listaMarca: { width: 15, fontSize: 8.5 },
  listaTexto: { flex: 1, fontSize: 8.5, textAlign: "justify", lineHeight: 1.35 },
  opcao: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  opcaoCaixa: { width: 12, fontSize: 10 },
  opcaoTexto: { fontSize: 8.5, lineHeight: 1.35 },
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
    minHeight: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCelula: { fontSize: 8, paddingVertical: 1.5, paddingHorizontal: 3, lineHeight: 1.35 },
  tabelaLinhaDensa: { minHeight: 10 },
  tabelaCelulaDensa: { fontSize: 7, paddingVertical: 0.5, paddingHorizontal: 2.5, lineHeight: 1.2 },
  tabelaGrupo: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: SLATE_500,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
    backgroundColor: SLATE_100,
  },
  colunas: { flexDirection: "row" },
  colunaEsq: { width: "50%", paddingRight: 10 },
  colunaDir: { width: "50%", paddingLeft: 10 },
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
        <Text style={f.rodapeEmpresa} fixed>
          Sistenge Construções e Comércio Ltda — Recursos Humanos
        </Text>
        <Text
          style={f.rodapePagina}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Página ${pageNumber} de ${totalPages}`
          }
        />
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

/**
 * Dois blocos lado a lado.
 *
 * Existe por causa da paisagem: uma folha A4 deitada tem só 527pt de altura útil
 * contra 782pt de largura, então empilhar blocos estreitos (lista de EPI, tabela
 * de estoque) gasta a dimensão escassa e desperdiça a abundante. Foi o que fez o
 * FRM-RH-005 sair em 4 páginas na primeira medição.
 */
export function Colunas({
  esquerda,
  direita,
}: {
  esquerda: React.ReactNode;
  direita: React.ReactNode;
}) {
  return (
    <View style={f.colunas}>
      <View style={f.colunaEsq}>{esquerda}</View>
      <View style={f.colunaDir}>{direita}</View>
    </View>
  );
}

export type Assinante = { papel: string; nome?: string | null; detalhe?: string };

/**
 * Grid de assinaturas, 2 por linha.
 *
 * `modo="aceite"` está preparado para a fase de aceite digital: em vez da linha
 * para assinar à mão, imprime o registro de data/hora e IP. As colunas
 * `ocupante_imovel.aceite_em` / `aceite_ip` já existem, nulas, desde a fase 1 —
 * a troca será de props, não de layout nem de migration.
 *
 * `wrap={false}`: bloco de assinatura partido entre duas páginas produz folha
 * com linhas soltas e sem contexto, que é exatamente o que ninguém assina.
 */
export function Assinaturas({
  assinantes,
  modo = "manual",
  localData,
}: {
  assinantes: Assinante[];
  modo?: "manual" | "aceite";
  localData?: string;
}) {
  return (
    <View wrap={false}>
      {localData ? <Text style={f.localData}>{localData}</Text> : null}
      <View style={f.assGrid}>
        {assinantes.map((a, i) => (
          <View key={i} style={f.assCol}>
            <View style={f.assLinha}>
              <Text style={f.assNome}>{a.nome || " "}</Text>
              <Text style={f.assPapel}>{a.papel}</Text>
              {modo === "aceite" && a.detalhe ? (
                <Text style={f.assDetalhe}>{a.detalhe}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export type Coluna = {
  titulo: string;
  /** Largura em % da tabela. A soma das colunas deve dar 100. */
  largura: number;
  alinhar?: "left" | "center";
};

export type LinhaTabela = { grupo: string } | { celulas: string[] };

/**
 * Soma das larguras declaradas. Existe para ser testada: uma tabela cujas
 * colunas não somam 100% desalinha em silêncio, e o erro só aparece impresso.
 */
export function somaLarguras(colunas: Coluna[]): number {
  return colunas.reduce((total, c) => total + c.largura, 0);
}

/**
 * Tabela de larguras declaradas. É o primitivo que mais varia entre os
 * documentos — de 2 colunas de texto (penalidades do FRM-RH-001) a 10 colunas
 * de checkbox em paisagem (checklist do FRM-RH-005) — e por isso foi construída
 * validada contra o caso difícil.
 *
 * O cabeçalho é `fixed`: numa tabela que atravessa páginas, repetir o cabeçalho
 * é o que mantém as colunas legíveis na segunda folha.
 */
export function Tabela({
  colunas,
  linhas,
  densa = false,
}: {
  colunas: Coluna[];
  linhas: LinhaTabela[];
  /**
   * Aperta linha e corpo. Existe para o grid do FRM-RH-005: 44 tarefas × 7 dias
   * numa folha paisagem, onde a altura útil é de apenas 527pt. Fora desse caso a
   * escala normal é mais legível — use com parcimônia.
   */
  densa?: boolean;
}) {
  return (
    <View style={f.tabela}>
      <View style={f.tabelaCabecalho} fixed>
        {colunas.map((c, i) => (
          <Text
            key={i}
            style={[
              f.tabelaCabecalhoCelula,
              { width: `${c.largura}%`, textAlign: c.alinhar ?? "left" },
            ]}
          >
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((linha, i) =>
        "grupo" in linha ? (
          <Text key={i} style={f.tabelaGrupo} wrap={false}>
            {linha.grupo}
          </Text>
        ) : (
          <View
            key={i}
            style={densa ? [f.tabelaLinha, f.tabelaLinhaDensa] : f.tabelaLinha}
            wrap={false}
          >
            {colunas.map((c, j) => (
              <Text
                key={j}
                style={[
                  densa ? f.tabelaCelulaDensa : f.tabelaCelula,
                  { width: `${c.largura}%`, textAlign: c.alinhar ?? "left" },
                ]}
              >
                {linha.celulas[j] ?? ""}
              </Text>
            ))}
          </View>
        ),
      )}
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
