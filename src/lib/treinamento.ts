// Treinamento: quem tem de fazer o quê, o que mudou, e se passou.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// "Todos fizeram o treinamento" só é fato se houver como verificar. O banco
// guarda uma linha por (pessoa, trilha, versão concluída) e NADA MAIS —
// "pendente" é calculado aqui, a cada leitura.
//
// Coluna de status seria a primeira coisa a ficar velha: bastaria eu bumpar a
// versão de uma trilha e o banco continuaria dizendo "concluído" para todo
// mundo. O cálculo não tem esse problema porque a pergunta é sempre feita
// contra o conteúdo vigente.
//
// Aqui mora só cálculo. A escrita é a action; a leitura é `data/treinamento.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { moduloLiberado } from "@/lib/modulos";
import type { Papel } from "@/lib/permissoes";
import { TRILHAS } from "@/lib/treinamento/index";
import type { Aula, Pergunta, Trilha } from "@/lib/treinamento/tipos";

export type SituacaoTrilha = "nao_iniciada" | "concluida" | "desatualizada";

export const SITUACAO_TRILHA_INFO: Record<
  SituacaoTrilha,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  nao_iniciada: { label: "Não iniciada", variant: "outline" },
  concluida: { label: "Concluída", variant: "secondary" },
  desatualizada: { label: "Atualização pendente", variant: "default" },
};

/** Uma linha de `treinamento_conclusao`, como a camada de leitura a entrega. */
export type Conclusao = {
  trilha: string;
  versao: number;
  concluidoEm: string;
  acertos: number;
  totalPerguntas: number;
  numeroRegistro: string | null;
};

/**
 * As trilhas a que a pessoa tem direito.
 *
 * A regra de módulo é a de `moduloLiberado`, e não é redecidida aqui: duas
 * cópias da regra de permissão divergem, e a divergência aparece como pessoa
 * cobrada por treinamento de tela que ela não pode abrir.
 */
export function trilhasDoUsuario(
  papel: Papel | undefined,
  modulos: string[] | null | undefined,
  isMaster: boolean,
  trilhas: Trilha[] = TRILHAS,
): Trilha[] {
  // Sessão sem papel não é "acesso total": é sessão inválida.
  if (!papel) return [];

  return trilhas.filter((t) => {
    if (t.papeis.length > 0 && !t.papeis.includes(papel)) return false;
    if (t.modulo === null) return true;
    return moduloLiberado(modulos, isMaster, t.modulo);
  });
}

/** A maior versão desta trilha que a pessoa já concluiu, ou `null`. */
export function versaoConcluida(
  trilha: Trilha,
  conclusoes: Conclusao[],
): number | null {
  const minhas = conclusoes.filter((c) => c.trilha === trilha.chave);
  if (minhas.length === 0) return null;
  return Math.max(...minhas.map((c) => c.versao));
}

export function situacaoDaTrilha(
  trilha: Trilha,
  conclusoes: Conclusao[],
): SituacaoTrilha {
  const v = versaoConcluida(trilha, conclusoes);
  if (v === null) return "nao_iniciada";
  return v >= trilha.versao ? "concluida" : "desatualizada";
}

/**
 * As aulas que a pessoa ainda não viu na versão vigente.
 *
 * É o "não releia o que não mudou" da decisão de projeto: quando eu mudo uma
 * tela e a aula muda, quem treinou na versão anterior refaz só o que mudou —
 * e o questionário, que é curto.
 */
export function aulasQueMudaram(
  trilha: Trilha,
  versaoConcluida: number | null,
): Aula[] {
  if (versaoConcluida === null) return trilha.aulas;
  return trilha.aulas.filter((a) => a.desdeVersao > versaoConcluida);
}

export type Correcao = {
  acertos: number;
  total: number;
  erradas: { pergunta: Pergunta; escolhida: number | null }[];
};

/**
 * Corrige o questionário.
 *
 * Roda no SERVIDOR, e é por isso que `Pergunta.correta` não vai no payload da
 * página. Um questionário cujas respostas chegam ao navegador é decorativo.
 */
export function corrigir(
  trilha: Trilha,
  respostas: Record<string, number>,
): Correcao {
  const erradas: Correcao["erradas"] = [];
  let acertos = 0;

  for (const p of trilha.perguntas) {
    const escolhida = Object.prototype.hasOwnProperty.call(respostas, p.id)
      ? respostas[p.id]
      : null;
    if (escolhida === p.correta) acertos += 1;
    else erradas.push({ pergunta: p, escolhida });
  }

  return { acertos, total: trilha.perguntas.length, erradas };
}

/**
 * Aprovado é acertar tudo.
 *
 * Com três a cinco perguntas, qualquer nota de corte abaixo de 100% significa
 * "pode errar uma" — e a pergunta que a pessoa erra é exatamente a que ela
 * precisava. Reprovar não pune: a tela mostra o `porque`, aponta a aula e
 * oferece tentar de novo.
 *
 * `total === 0` reprova: 0 de 0 não é 100%, é trilha sem questionário, e
 * aprovar nela seria aprovação por vacuidade.
 */
export function aprovado(c: Correcao): boolean {
  return c.total > 0 && c.acertos === c.total;
}

export type LinhaPendencia = {
  perfilId: string;
  nome: string;
  papel: Papel;
  total: number;
  concluidas: number;
  /** Títulos das trilhas que faltam — o que o painel mostra. */
  pendentes: string[];
};

/**
 * Uma linha por pessoa, para o painel de quem falta.
 *
 * Ordenado por quantidade de pendência, decrescente: o painel existe para
 * cobrar, e quem está em dia no topo esconderia exatamente quem interessa.
 */
export function resumirPendencias(
  usuarios: {
    perfilId: string;
    nome: string;
    papel: Papel;
    modulos: string[] | null | undefined;
    isMaster: boolean;
  }[],
  conclusoes: (Conclusao & { perfilId: string })[],
): LinhaPendencia[] {
  return usuarios
    .map((u) => {
      const minhas = conclusoes.filter((c) => c.perfilId === u.perfilId);
      const trilhas = trilhasDoUsuario(u.papel, u.modulos, u.isMaster);
      const pendentes = trilhas
        .filter((t) => situacaoDaTrilha(t, minhas) !== "concluida")
        .map((t) => t.titulo);

      return {
        perfilId: u.perfilId,
        nome: u.nome,
        papel: u.papel,
        total: trilhas.length,
        concluidas: trilhas.length - pendentes.length,
        pendentes,
      };
    })
    .sort((a, b) => {
      if (a.pendentes.length !== b.pendentes.length) {
        return b.pendentes.length - a.pendentes.length;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/**
 * O índice do manual: rota → aulas que a cobrem.
 *
 * É a segunda leitura da mesma fonte. A trilha percorre na ordem em que se
 * aprende; o manual indexa por tela, para quem já sabe e travou. Nada é escrito
 * duas vezes, e nenhum dos dois desatualiza sem o outro.
 */
export function manualPorRota(): {
  rota: string;
  aulas: { trilha: string; aula: Aula }[];
}[] {
  const mapa = new Map<string, { trilha: string; aula: Aula }[]>();

  for (const t of TRILHAS) {
    for (const a of t.aulas) {
      for (const r of a.rotas) {
        const atual = mapa.get(r) ?? [];
        atual.push({ trilha: t.chave, aula: a });
        mapa.set(r, atual);
      }
    }
  }

  return [...mapa.entries()]
    .map(([rota, aulas]) => ({ rota, aulas }))
    .sort((a, b) => a.rota.localeCompare(b.rota));
}

/**
 * As respostas que a tela manda para a action.
 *
 * O valor é o ÍNDICE da alternativa escolhida, de 0 a 3. Índice e não texto:
 * comparar texto tornaria a correção sensível a espaço e acento.
 */
export const respostasSchema = z.object({
  trilha: z.string().trim().min(1, "Trilha inválida."),
  respostas: z.record(
    z.string(),
    z.number().int().min(0).max(3),
  ),
});

export type RespostasInput = z.input<typeof respostasSchema>;
export type RespostasDados = z.output<typeof respostasSchema>;
