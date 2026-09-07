// O agrupamento da tela de Frota — puro, e por isso testável.
//
// Irmão de `itens.ts`, e de propósito: as duas telas passam a ter a mesma
// gramática — categoria navega, tipo agrupa. Quem aprende uma sabe a outra.
//
// A DIFERENÇA entre as duas: Itens lista MODELOS (o catálogo), Frota lista
// PEÇAS (o patrimônio). Por isso as contagens aqui são de peça, e o que se soma
// é situação — em uso, livre, locada — e não quantas peças cada modelo tem.

/** O mínimo que o agrupamento precisa saber de uma peça. */
export type PecaAgrupavel = {
  id: string;
  situacao: string;
  propriedade: string;
  tipoNome: string | null;
};

export type GrupoFrota<T extends PecaAgrupavel> = {
  /** Chave estável para o React. `"sem"` é a lacuna. */
  chave: string;
  rotulo: string;
  /** Só existe no grupo que é LACUNA, e diz a consequência. */
  nota?: string;
  pecas: T[];
  emUso: number;
  disponivel: number;
  locadas: number;
};

const CHAVE_SEM_TIPO = "sem";

/**
 * Agrupa as peças por TIPO.
 *
 * A ordem é por tamanho e depois alfabética: quem abre a Frota quer ver
 * primeiro onde está a massa do parque. Empate desempata por nome para a ordem
 * não dançar entre dois carregamentos.
 *
 * O grupo "sem tipo" vai SEMPRE por último, mesmo que seja o maior: ele é uma
 * lacuna de cadastro, não uma família — e listá-lo no topo por ser numeroso
 * daria a ele a importância de um tipo de verdade.
 */
export function agruparPorTipo<T extends PecaAgrupavel>(
  pecas: T[],
): GrupoFrota<T>[] {
  const grupos = new Map<string, GrupoFrota<T>>();

  for (const p of pecas) {
    const chave = p.tipoNome ?? CHAVE_SEM_TIPO;
    const g = grupos.get(chave) ?? {
      chave,
      rotulo: p.tipoNome ?? "Equipamento sem tipo",
      nota:
        p.tipoNome === null
          ? "Estas peças não aparecem para quem filtra por tipo. Defina o tipo no modelo, em Itens."
          : undefined,
      pecas: [] as T[],
      emUso: 0,
      disponivel: 0,
      locadas: 0,
    };
    g.pecas.push(p);
    if (p.situacao === "em_uso") g.emUso += 1;
    if (p.situacao === "disponivel") g.disponivel += 1;
    if (p.propriedade === "locada") g.locadas += 1;
    grupos.set(chave, g);
  }

  return [...grupos.values()].sort((a, b) => {
    if (a.chave === CHAVE_SEM_TIPO) return 1;
    if (b.chave === CHAVE_SEM_TIPO) return -1;
    return (
      b.pecas.length - a.pecas.length ||
      a.rotulo.localeCompare(b.rotulo, "pt-BR")
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// A faixa de pendência
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Uma pendência da categoria que está sendo olhada.
 *
 * `href` leva ao filtro que isola aquelas peças — a faixa não é um aviso, é um
 * atalho para o trabalho.
 */
export type PendenciaFrota = {
  chave: string;
  texto: string;
  href: string;
};

/**
 * O que precisa de ação nas peças visíveis.
 *
 * Devolve `[]` quando não há nada, e a tela faz a faixa SUMIR — não mostra
 * "tudo em ordem". Uma faixa permanente vira moldura, e aí deixa de ser lida
 * justamente no dia em que tem conteúdo.
 *
 * A urgência muda de assunto conforme a frota: hoje são 95 máquinas de TI
 * entregues sem termo; em outubro serão inspeções de PTA vencidas; depois, CRLV.
 * Por isso a faixa é montada a partir do que se está olhando, e não de uma
 * lista fixa de checagens.
 */
export function pendenciasDaLista(
  pecas: { id: string; situacao: string }[],
  comResponsavel: Set<string> | null,
  certificado: Map<string, "ausente" | "vencido" | "proximo" | "em_dia">,
  base: string,
): PendenciaFrota[] {
  const saida: PendenciaFrota[] = [];

  // `null` = a consulta de custódia falhou. Omite a pendência em vez de
  // marcar a frota inteira — a faixa só é lida enquanto não dá alarme falso.
  const semTermo =
    comResponsavel === null
      ? 0
      : pecas.filter(
          (p) => p.situacao === "em_uso" && !comResponsavel.has(p.id),
        ).length;
  if (semTermo > 0) {
    saida.push({
      chave: "sem_responsavel",
      texto:
        semTermo === 1
          ? "1 peça está em uso sem termo assinado"
          : `${semTermo} peças estão em uso sem termo assinado`,
      href: `${base}pendencia=sem_responsavel`,
    });
  }

  const semCertificado = pecas.filter((p) => {
    const e = certificado.get(p.id);
    return e === "ausente" || e === "vencido";
  }).length;
  if (semCertificado > 0) {
    saida.push({
      chave: "certificado",
      texto:
        semCertificado === 1
          ? "1 peça está sem certificado válido"
          : `${semCertificado} peças estão sem certificado válido`,
      href: `${base}certificado=ausente`,
    });
  }

  return saida;
}
