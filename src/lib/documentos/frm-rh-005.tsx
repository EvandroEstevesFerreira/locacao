// FRM-RH-005 — Checklist semanal de limpeza do alojamento.
//
// Único documento em PAISAGEM: são 10 colunas (tarefa, frequência, 7 dias e
// rubrica) e em retrato o checkbox fica impreenchível.
//
// A economia de página aqui NÃO é tipográfica. As 44 tarefas em uma folha só não
// cabem em tamanho utilizável; o que resolve é imprimir por frequência — a folha
// SEMANAL leva as diárias e semanais (38), e as mensais (6) saem numa folha
// própria, uma vez por mês. Ver a seção de densidade da spec de 2026-08-22.
//
// DENSIDADE: 3 páginas paisagem na folha semanal, não as 2 que a spec previa.
// Medido: o grid de 44 linhas (38 tarefas + 6 linhas de grupo) ocupa 2 folhas
// sozinho — a altura útil em paisagem é de apenas 527pt — e o apêndice
// (identificação, observações, EPI, estoque, avaliação, assinaturas) ocupa a
// terceira. Tentado e descartado: coluna de tarefa mais larga, tabela densa e
// tirar as boas práticas da folha. Comprimir além disto inviabiliza marcar o ☐ à
// mão, que é o único uso deste papel. A folha MENSAL fecha em 1 página.
//
// O catálogo de tarefas está em código nesta fase. Na fase 4 ele migra para a
// tabela `tarefa_limpeza`, editável em Configurações, e este array vira a semente
// da migration — o formato de `TAREFAS` foi escolhido para essa passagem ser
// direta.

import {
  Documento,
  Secao,
  CampoGrid,
  OpcoesCheck,
  AreaTexto,
  Tabela,
  Assinaturas,
  Colunas,
  CAIXA,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Opcao,
} from "@/lib/pdf-form";
import { Narrativa } from "./blocos";

export type Frequencia = "D" | "S" | "M";
export type Tarefa = { grupo: string; descricao: string; frequencia: Frequencia };

/** Catálogo de tarefas, na ordem em que o auxiliar percorre o alojamento. */
export const TAREFAS: Tarefa[] = [
  ...(
    [
      ["Limpar vasos sanitários (interno e externo) com desinfetante", "D"],
      ["Limpar pias, torneiras e espelhos", "D"],
      ["Limpar box, chuveiros e ralos", "D"],
      ["Repor papel higiênico, sabonete líquido e papel toalha", "D"],
      ["Recolher e trocar saco de lixo", "D"],
      ["Lavar piso com desinfetante", "D"],
      ["Lavar paredes e azulejos (limpeza profunda)", "S"],
      ["Higienizar suportes de papel/sabonete e maçanetas", "S"],
      ["Desinfecção profunda (vasos, ralos, registros) — produto específico", "M"],
    ] as const
  ).map(([descricao, frequencia]) => ({ grupo: "BANHEIROS", descricao, frequencia })),
  ...(
    [
      ["Limpar mesas, bancadas e cadeiras após cada turno (3x ao dia)", "D"],
      ["Lavar e secar a pia da cozinha", "D"],
      ["Recolher lixo orgânico (manhã e fim do dia)", "D"],
      ["Limpar fogão, micro-ondas (externo e interno) e bancada de apoio", "D"],
      ["Varrer e passar pano no piso após cada refeição", "D"],
      ["Higienizar maçanetas, interruptores e portas", "D"],
      ["Limpar geladeira por dentro (descartar alimentos vencidos ou sem identificação)", "S"],
      ["Limpar armários (por dentro e por fora)", "S"],
      ["Limpar interior do micro-ondas com produto específico", "S"],
      ["Desinfecção do exaustor / coifa", "M"],
      ["Desentupir e desinfetar ralos", "M"],
    ] as const
  ).map(([descricao, frequencia]) => ({
    grupo: "COZINHA / REFEITÓRIO",
    descricao,
    frequencia,
  })),
  ...(
    [
      ["Varrer e passar pano no piso", "D"],
      ["Recolher lixo do quarto", "D"],
      ["Limpar maçanetas e interruptores", "D"],
      ["Limpar janelas, vidros e cortinas ou persianas", "S"],
      ["Limpar pás de ventilador / grade de ar-condicionado", "S"],
      ["Desinfecção de paredes (manchas, marcas)", "M"],
    ] as const
  ).map(([descricao, frequencia]) => ({
    grupo: "QUARTOS / DORMITÓRIOS (áreas comuns — não pertences do alojado)",
    descricao,
    frequencia,
  })),
  ...(
    [
      ["Varrer e passar pano", "D"],
      ["Limpar mesas, sofás (pano úmido) e estantes", "D"],
      ["Recolher lixo da sala", "D"],
      ["Limpar TV, controle remoto e equipamentos", "D"],
      ["Higienizar maçanetas, interruptores e janelas", "S"],
      ["Limpeza profunda de estofados (aspirar)", "M"],
    ] as const
  ).map(([descricao, frequencia]) => ({
    grupo: "SALA / ÁREA DE VIVÊNCIA",
    descricao,
    frequencia,
  })),
  ...(
    [
      ["Limpar tanque e máquinas de lavar (externo)", "D"],
      ["Limpar bancada do ferro de passar", "D"],
      ["Varrer e passar pano no piso", "D"],
      ["Limpar filtros da máquina de lavar", "S"],
      ["Limpar ralo e desinfetar", "S"],
    ] as const
  ).map(([descricao, frequencia]) => ({ grupo: "LAVANDERIA", descricao, frequencia })),
  ...(
    [
      ["Varrer corredores internos", "D"],
      ["Varrer entrada, pátio e estacionamento", "D"],
      ["Recolher bitucas da área de fumantes", "D"],
      ["Recolher lixo dos corredores e áreas externas", "D"],
      ["Lavar corredores com água e desinfetante", "S"],
      ["Limpar lixeiras externas com produto desinfetante", "S"],
      ["Capinar ou aparar grama (quando aplicável)", "M"],
    ] as const
  ).map(([descricao, frequencia]) => ({
    grupo: "CORREDORES E ÁREAS EXTERNAS",
    descricao,
    frequencia,
  })),
];

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// A coluna da tarefa é larga de propósito: com 34% as descrições longas
// quebravam em duas linhas e o grid de 44 linhas estourava para 2 páginas. Em
// paisagem a largura é o recurso abundante — 47pt por dia sobra para um ☐.
const COLUNAS: Coluna[] = [
  { titulo: "Tarefa", largura: 46 },
  { titulo: "Freq.", largura: 5, alinhar: "center" },
  ...DIAS.map((d) => ({ titulo: d, largura: 6, alinhar: "center" as const })),
  { titulo: "Rubrica", largura: 7 },
];

const CABECALHO: Campo[] = [
  { label: "Alojamento / Contrato" },
  { label: "Semana de ____/____/______ a ____/____/______" },
  { label: "Auxiliar de limpeza" },
  { label: "Matrícula / CPF" },
  { label: "Encarregado responsável" },
  { label: "Telefone" },
];

const EPIS: Opcao[] = [
  { texto: "Luvas de borracha (limpeza geral) — em boas condições" },
  { texto: "Luvas nitrílicas (manuseio de produtos químicos)" },
  { texto: "Calçado de segurança fechado, antiderrapante" },
  { texto: "Máscara descartável (PFF1 ou cirúrgica) — para áreas com produtos químicos" },
  { texto: "Avental ou vestimenta impermeável" },
  { texto: "Óculos de proteção (manuseio de cloro, ácido)" },
  { texto: "Touca ou proteção de cabelo (quando aplicável)" },
];

const COLUNAS_ESTOQUE: Coluna[] = [
  { titulo: "Produto", largura: 46 },
  { titulo: "Unidade", largura: 18 },
  { titulo: "Estoque", largura: 18, alinhar: "center" },
  { titulo: "Solicitar reposição", largura: 18, alinhar: "center" },
];

const ESTOQUE: LinhaTabela[] = (
  [
    ["Detergente neutro", "Litros"],
    ["Desinfetante (pinho ou lavanda)", "Litros"],
    ["Água sanitária / hipoclorito", "Litros"],
    ["Limpa-vidros", "Frascos"],
    ["Sabão em pó ou em barra", "kg"],
    ["Saco de lixo (30 / 50 / 100 L)", "Pacote"],
    ["Papel higiênico (rolão)", "Rolos"],
    ["Sabonete líquido (refil)", "Litros"],
    ["Papel toalha", "Pacotes"],
    ["Esponjas e panos de chão", "Unid."],
  ] as const
).map(([produto, unidade]) => ({ celulas: [produto, unidade, "", CAIXA] }));

const AVALIACAO: Opcao[] = [
  { texto: "Conforme — todas as tarefas foram executadas no padrão esperado." },
  { texto: "Parcialmente conforme — pontos a corrigir (descrever nas observações)." },
  { texto: "Não conforme — encaminhar ao RH para orientação ou medida disciplinar (FRM-RH-002)." },
];

/**
 * Monta as linhas do grid, com linha de grupo antes de cada bloco.
 *
 * `catalogo` permite passar as tarefas da ORGANIZAÇÃO (tabela `tarefa_limpeza`)
 * no lugar do embutido. Enquanto a organização não semeia o catálogo, a folha
 * impressa continua saindo com o padrão — não faz sentido entregar folha vazia
 * à obra só porque ninguém abriu Configurações ainda.
 */
export function linhasDoGrid(
  frequencias: Frequencia[],
  catalogo: Tarefa[] = TAREFAS,
): LinhaTabela[] {
  const linhas: LinhaTabela[] = [];
  let grupoAtual = "";
  for (const t of catalogo) {
    if (!frequencias.includes(t.frequencia)) continue;
    if (t.grupo !== grupoAtual) {
      linhas.push({ grupo: t.grupo });
      grupoAtual = t.grupo;
    }
    linhas.push({
      celulas: [t.descricao, t.frequencia, ...DIAS.map(() => CAIXA), ""],
    });
  }
  return linhas;
}

export function ChecklistLimpeza({
  orgNome,
  titulo,
  paragrafos,
  frequencias = ["D", "S"],
  catalogo,
  semana,
}: {
  orgNome: string;
  titulo: string;
  paragrafos: string[];
  /** `["D","S"]` gera a folha semanal; `["M"]` gera a folha mensal. */
  frequencias?: Frequencia[];
  /** Tarefas da organização; ausente, usa o catálogo padrão embutido. */
  catalogo?: Tarefa[];
  /** Rótulo "dd/mm a dd/mm" impresso no cabeçalho, quando a folha é de uma semana. */
  semana?: string;
}) {
  const mensal = frequencias.length === 1 && frequencias[0] === "M";
  return (
    <Documento
      codigo="FRM-RH-005"
      titulo={mensal ? `${titulo} — folha mensal` : titulo}
      subtitulo={`${orgNome} — Política de Alojamento POL-RH-001`}
      orientacao="landscape"
    >
      <Secao titulo="Identificação" quebrar={false}>
        <CampoGrid
          colunas={2}
          campos={CABECALHO.map((c) =>
            semana && c.label.startsWith("Semana")
              ? { label: "Semana", valor: semana }
              : c,
          )}
        />
      </Secao>

      <Secao
        titulo={
          mensal
            ? "Tarefas mensais — marcar o dia em que foi executada"
            : "Tarefas — marque o dia em que a tarefa foi concluída (D = diária, S = semanal)"
        }
      >
        <Tabela colunas={COLUNAS} linhas={linhasDoGrid(frequencias, catalogo)} densa />
      </Secao>

      <Secao titulo="Observações do período">
        <AreaTexto linhas={3} />
      </Secao>

      {/* A folha MENSAL para aqui: EPI, estoque e boas práticas são conferência
          da rotina semanal, e repeti-los na folha de 6 tarefas seria papel a
          mais sem nenhum uso. */}
      {mensal ? null : (
        <>
          <Colunas
            esquerda={
              <Secao titulo="Conferência de EPIs" quebrar={false}>
                <OpcoesCheck opcoes={EPIS} />
              </Secao>
            }
            direita={
              <Secao titulo="Controle de produtos (final da semana)">
                <Tabela colunas={COLUNAS_ESTOQUE} linhas={ESTOQUE} />
              </Secao>
            }
          />

          <Colunas
            esquerda={<Narrativa paragrafos={paragrafos} tituloPadrao="Base normativa" />}
            direita={
              <Secao titulo="Avaliação geral do Encarregado" quebrar={false}>
                <OpcoesCheck opcoes={AVALIACAO} />
              </Secao>
            }
          />
        </>
      )}

      <Assinaturas
        localData="Local e data: ____________________________, ______ de ______________________ de __________."
        assinantes={[
          { papel: "Auxiliar de limpeza — nome e matrícula" },
          { papel: `Encarregado — fiscalização (${orgNome})` },
        ]}
      />
    </Documento>
  );
}
