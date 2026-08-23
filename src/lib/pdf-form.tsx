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
import {
  BRANCO,
  SLATE_50,
  SLATE_100,
  SLATE_200,
  SLATE_400,
  SLATE_500,
  SLATE_900,
} from "@/lib/brand-colors";
import { LogoSistenge } from "./pdf-logo";
import { formatarData } from "./locacao";

/**
 * Marcador de célula que deve virar uma caixa de marcação.
 *
 * NÃO é o caractere impresso. O Helvetica — fonte padrão do PDF, sem embutir
 * arquivo — não tem o glifo U+2610 (☐), e usá-lo direto fazia TODOS os
 * checkboxes dos formulários saírem invisíveis: as opções viravam texto solto e
 * as colunas OK/Avaria saíam em branco. Descoberto ao inspecionar o FRM-RH-003
 * gerado, em 2026-08-22.
 *
 * A caixa é DESENHADA (`<Caixa/>`), o que independe de fonte e ainda dá uma
 * borda mais firme para marcar à mão. Este valor é só o sinal que `Tabela` e
 * `OpcoesCheck` reconhecem para trocar o texto pelo desenho.
 */
export const CAIXA = "☐";

/** Como CAIXA, mas já marcada — para documento preenchido pelo sistema. */
export const CAIXA_MARCADA = "☒";

/** Acima do piso de 85pt exigido pelo Manual de Identidade Visual. */
const LOGO_LARGURA = 110;

/**
 * Geometria da caixa de marcação, exportada para o teste de regressão.
 *
 * O X precisa caber DENTRO da caixa: altura menos as duas bordas. Com o X maior
 * que isso o glifo é recortado e a caixa sai VAZIA mesmo marcada — foi o que
 * aconteceu na primeira versão do documento preenchido, e nenhum teste de
 * conteúdo pegaria, porque o X está lá, só invisível.
 */
export const CAIXA_GEOMETRIA = {
  lado: 9,
  borda: 0.7,
  marcaFonte: 6,
  marcaEntrelinha: 1,
} as const;

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
  versao: { fontSize: 6.5, color: SLATE_400, textAlign: "right", marginTop: 1 },
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
  opcao: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  caixa: {
    width: CAIXA_GEOMETRIA.lado,
    height: CAIXA_GEOMETRIA.lado,
    borderWidth: CAIXA_GEOMETRIA.borda,
    borderColor: SLATE_900,
    borderStyle: "solid",
    marginRight: 5,
    marginTop: 1.5,
  },
  // O X precisa caber DENTRO da caixa: 9pt menos 1,4 de borda deixam 7,6pt de
  // altura útil, e sem lineHeight: 1 a linha padrão passa disso e o glifo é
  // cortado — a caixa saía vazia mesmo com `marcada`.
  caixaMarca: {
    fontSize: CAIXA_GEOMETRIA.marcaFonte,
    lineHeight: CAIXA_GEOMETRIA.marcaEntrelinha,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  // Caixa DENTRO de célula de tabela: centrada por alignSelf, sem View
  // envolvente. A versão anterior usava um wrapper para centralizar, e num grid
  // de 45x7 isso dobrava a contagem de nós — 630 Views só de checkbox, o que
  // pesou segundos no render.
  caixaCelula: {
    alignSelf: "center",
    marginVertical: 2.5,
    width: 8,
    height: 8,
    borderWidth: 0.7,
    borderColor: SLATE_900,
    borderStyle: "solid",
  },
  celulaCentro: { alignItems: "center", justifyContent: "center", paddingVertical: 2 },
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
  // Cabeçalho com fundo cheio e texto claro, como nos documentos originais do
  // RH. Antes era texto sobre branco, e a tabela se dissolvia na página.
  tabelaCabecalho: {
    flexDirection: "row",
    backgroundColor: SLATE_900,
  },
  tabelaCabecalhoCelula: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: BRANCO,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  // Zebra: o original alterna cinza claro e branco, e numa tabela de 15 linhas
  // com quatro colunas isso é o que impede o olho de pular de linha.
  tabelaLinhaPar: { backgroundColor: SLATE_50 },
  tabelaCelulaPrimeira: { fontFamily: "Helvetica-Bold" },
  tabelaLinha: {
    flexDirection: "row",
    minHeight: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: SLATE_200,
    borderBottomStyle: "solid",
  },
  tabelaCelula: {
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
    lineHeight: 1.3,
    borderRightWidth: 0.5,
    borderRightColor: SLATE_200,
    borderRightStyle: "solid",
  },
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
  anexoRotulo: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: SLATE_500,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  anexoTitulo: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: SLATE_900,
    borderBottomStyle: "solid",
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
  versao,
  publicadoEm,
  orientacao = "portrait",
  children,
}: {
  codigo: string;
  titulo: string;
  subtitulo?: string;
  /**
   * Versão e data de publicação do TEXTO, no cabeçalho de toda folha.
   *
   * Não é enfeite: num documento que sustenta justa causa, "ele assinou o termo"
   * vale menos que "ele assinou a versão 1.2, publicada em 23/08/2026". E o
   * cabeçalho é `fixed`, então a identificação viaja em todas as páginas — folha
   * solta continua rastreável.
   */
  versao?: string;
  publicadoEm?: string;
  orientacao?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  // A data chega em ISO (yyyy-mm-dd), do `updated_at` ou do padrão, e é
  // formatada aqui — num só lugar. Documento brasileiro com data ISO no
  // cabeçalho é erro que salta aos olhos de quem assina.
  const selo = [
    versao ? `Versão ${versao}` : null,
    publicadoEm ? formatarData(publicadoEm) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Document>
      <Page size="A4" orientation={orientacao} style={f.page}>
        <View style={f.cabecalho} fixed>
          <LogoSistenge width={LOGO_LARGURA} />
          <View>
            <Text style={f.codigo}>{codigo}</Text>
            {selo ? <Text style={f.versao}>{selo}</Text> : null}
          </View>
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

/**
 * Anexo de documento normativo.
 *
 * Existe porque tabela grande no meio do corpo é ruim de duas formas: ela quebra
 * a leitura corrida e, principalmente, revisar a tabela obriga a mexer na
 * cláusula que a cita. Como anexo, o corpo diz "conforme o Anexo II" e a tabela
 * pode ser revista sem tocar no texto que a invoca.
 *
 * Começa em página nova por padrão — é o que se espera de um anexo, e evita
 * anexo pendurado no rodapé de uma seção do corpo.
 */
export function Anexo({
  numero,
  titulo,
  novaPagina = true,
  children,
}: {
  /** Numeral romano: "I", "II", "III". */
  numero: string;
  titulo: string;
  novaPagina?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View break={novaPagina}>
      <Text style={f.anexoRotulo}>ANEXO {numero}</Text>
      <Text style={f.anexoTitulo}>{titulo}</Text>
      {children}
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
  negritoNaPrimeira = false,
}: {
  colunas: Coluna[];
  linhas: LinhaTabela[];
  /** Primeira coluna em negrito — usado nas tabelas dos normativos. */
  negritoNaPrimeira?: boolean;
  /**
   * Aperta linha e corpo. Existe para o grid do FRM-RH-005: 44 tarefas × 7 dias
   * numa folha paisagem, onde a altura útil é de apenas 527pt. Fora desse caso a
   * escala normal é mais legível — use com parcimônia.
   */
  densa?: boolean;
}) {
  const zebra = calcularZebra(linhas);

  // Estilos pré-computados FORA do map. Passar array novo a cada linha e a cada
  // célula derrota o cache de estilo do @react-pdf: o mesmo grid de 45 linhas ia
  // de ~0,5s para ~10s, e a rota de PDF responderia em dez segundos.
  const estiloLinha = densa ? [f.tabelaLinha, f.tabelaLinhaDensa] : [f.tabelaLinha];
  const estiloLinhaPar = [...estiloLinha, f.tabelaLinhaPar];
  const estiloCelula = densa ? f.tabelaCelulaDensa : f.tabelaCelula;
  const larguras = colunas.map((c) => ({
    width: `${c.largura}%` as const,
    textAlign: c.alinhar ?? ("left" as const),
  }));
  const celulaPorColuna = colunas.map((_, j) =>
    j === 0 && negritoNaPrimeira
      ? [estiloCelula, f.tabelaCelulaPrimeira, larguras[j]]
      : [estiloCelula, larguras[j]],
  );
  const larguraPorColuna = colunas.map((c) => ({
    width: `${c.largura}%` as const,
  }));

  return (
    <View style={f.tabela}>
      <View style={f.tabelaCabecalho} fixed>
        {colunas.map((c, i) => (
          <Text key={i} style={[f.tabelaCabecalhoCelula, larguras[i]]}>
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
            style={zebra[i] ? estiloLinhaPar : estiloLinha}
            wrap={false}
          >
            {colunas.map((_, j) =>
              linha.celulas[j] === CAIXA || linha.celulas[j] === CAIXA_MARCADA ? (
                <View key={j} style={larguraPorColuna[j]}>
                  <Caixa celula marcada={linha.celulas[j] === CAIXA_MARCADA} />
                </View>
              ) : (
                <Text key={j} style={celulaPorColuna[j]}>
                  {linha.celulas[j] ?? ""}
                </Text>
              ),
            )}
          </View>
        ),
      )}
    </View>
  );
}

/**
 * Quais linhas recebem fundo alternado.
 *
 * Conta pela posição entre as linhas de DADOS, não pelo índice bruto: com linhas
 * de grupo no meio (o grid do FRM-RH-005 tem seis), o índice bruto quebraria a
 * alternância justamente onde ela mais ajuda a não pular de linha.
 *
 * Numa passada só. A primeira versão recalculava do zero para cada linha, o que
 * é O(n²) e estourou o timeout dos testes na tabela de 45 linhas.
 */
function calcularZebra(linhas: LinhaTabela[]): boolean[] {
  let n = 0;
  return linhas.map((l) => ("grupo" in l ? false : n++ % 2 === 1));
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

/**
 * Caixa de marcação desenhada — independe de glifo de fonte.
 *
 * `marcada` põe um X dentro, para os documentos que saem PREENCHIDOS com dados
 * do sistema. O X é Helvetica, que existe em qualquer leitor; um glifo de "check"
 * repetiria o bug que apagou todos os checkboxes na 0.25.0.
 */
export function Caixa({
  celula = false,
  marcada = false,
}: {
  celula?: boolean;
  marcada?: boolean;
}) {
  return (
    <View style={celula ? f.caixaCelula : f.caixa}>
      {marcada ? <Text style={f.caixaMarca}>X</Text> : null}
    </View>
  );
}

export type Opcao = { texto: string; linha?: boolean; marcada?: boolean };

/** `☐ texto`, com linha à direita quando a opção continua em branco. */
export function OpcoesCheck({ opcoes }: { opcoes: Opcao[] }) {
  return (
    <View>
      {opcoes.map((o, i) => (
        <View key={i} style={f.opcao} wrap={false}>
          <Caixa marcada={o.marcada} />
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
