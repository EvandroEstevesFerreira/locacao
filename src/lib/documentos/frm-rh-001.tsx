// FRM-RH-001 — Termo de Compromisso de Alojamento.
//
// ESTRUTURA aqui; TEXTO em `documento_template`, tipo `termo_responsabilidade`,
// editável em Configurações → Templates de documentos. Se procurar as 22 regras
// neste arquivo, não vai achar: elas moram no template, porque o RH e o Jurídico
// as revisam — e revisar cláusula não pode exigir deploy.
//
// Os parágrafos vindos do template são classificados por forma:
//   - CAIXA ALTA sem ponto final  → título de subseção, abre um bloco
//   - começa com "— "             → item de lista numerada
//   - qualquer outro              → parágrafo corrido
//
// A convenção é frágil de propósito ser simples: o alternativo era inventar uma
// linguagem de marcação dentro de um textarea que o RH usa uma vez por ano.

import { Text, StyleSheet } from "@react-pdf/renderer";
import {
  Documento,
  Secao,
  CampoGrid,
  Lista,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
  type LinhaTabela,
} from "@/lib/pdf-form";

const s = StyleSheet.create({
  paragrafo: { fontSize: 8.5, textAlign: "justify", marginBottom: 4 },
});

const COLUNAS_PENALIDADE: Coluna[] = [
  { titulo: "Penalidade", largura: 30 },
  { titulo: "Como se aplica", largura: 70 },
];

/**
 * Tabela do item 11 da POL-RH-001. Fica em código, e não no template, porque é
 * estrutura — e porque o teto de 30 dias da suspensão é o do art. 474 da CLT,
 * não uma preferência editorial.
 */
const PENALIDADES: LinhaTabela[] = [
  {
    celulas: [
      "Advertência verbal",
      "Aplicada pelo Encarregado, registrada em livro de ocorrências.",
    ],
  },
  {
    celulas: [
      "Advertência escrita",
      "Aplicada pelo RH (FRM-RH-002), com ciência do empregado e juntada à pasta funcional.",
    ],
  },
  {
    celulas: [
      "Suspensão disciplinar (1 a 30 dias)",
      "Sem remuneração, conforme art. 474 da CLT. Aplicável diretamente, sem advertência escrita prévia, em casos como visita íntima no alojamento, consumo ou porte de bebida alcoólica e adulteração de câmeras.",
    ],
  },
  {
    celulas: [
      "Rescisão por justa causa",
      "Nas hipóteses do art. 482 da CLT — embriaguez habitual, improbidade, indisciplina, agressão, porte ou uso de drogas e demais infrações graves desta política.",
    ],
  },
];

/** Um parágrafo do template é título de subseção quando está em caixa alta. */
function ehSubtitulo(p: string): boolean {
  return p === p.toUpperCase() && !p.endsWith(".");
}

type Bloco = { titulo?: string; texto: string[]; itens: string[] };

/** Agrupa os parágrafos do template em blocos de subseção. */
export function agruparBlocos(paragrafos: string[]): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco = { titulo: undefined, texto: [], itens: [] };
  for (const p of paragrafos) {
    if (ehSubtitulo(p)) {
      blocos.push(atual);
      atual = { titulo: p, texto: [], itens: [] };
    } else if (p.startsWith("— ")) {
      atual.itens.push(p.slice(2));
    } else {
      atual.texto.push(p);
    }
  }
  blocos.push(atual);
  return blocos.filter(
    (b) => b.titulo || b.texto.length > 0 || b.itens.length > 0,
  );
}

export function TermoCompromisso({
  orgNome,
  titulo,
  campos,
  paragrafos,
  localData,
}: {
  orgNome: string;
  titulo: string;
  campos: Campo[];
  paragrafos: string[];
  localData: string;
}) {
  const blocos = agruparBlocos(paragrafos);
  const nomeAlojado = campos[0]?.valor ?? undefined;

  return (
    <Documento
      codigo="FRM-RH-001"
      titulo={titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
    >
      <Secao n={1} titulo="Identificação do Alojado">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      {blocos.map((b, i) => (
        <Secao key={i} titulo={b.titulo ?? "Apresentação"}>
          {b.texto.map((t, j) => (
            <Text key={j} style={s.paragrafo}>
              {t}
            </Text>
          ))}
          {b.itens.length > 0 ? (
            <Lista tipo="numerada" itens={b.itens} />
          ) : null}
        </Secao>
      ))}

      <Secao titulo="Penalidades — estou ciente de que">
        <Tabela colunas={COLUNAS_PENALIDADE} linhas={PENALIDADES} />
      </Secao>

      <Assinaturas
        localData={localData}
        assinantes={[
          { papel: "Empregado(a)", nome: nomeAlojado },
          { papel: `Recursos Humanos — ${orgNome}` },
          { papel: "Testemunha 1" },
          { papel: "Testemunha 2" },
        ]}
      />
    </Documento>
  );
}
