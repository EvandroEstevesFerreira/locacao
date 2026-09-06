import { z } from "zod";
import { CONTROLES } from "@/lib/recebimento";
import { idOpcional, textoOpcional, uuidOpcional } from "@/lib/campos";

/**
 * A NATUREZA do item: como ele se comporta.
 *
 * Chamava-se `TipoItem`, e a tela chamava de "Tipo". O nome mudou porque TIPO
 * passou a significar a FAMÍLIA — NOTEBOOK, ANDAIME, BETONEIRA — no catálogo de
 * quatro níveis. Dois campos "Tipo" na mesma tela seria um desastre.
 */
export type NaturezaItem = "equipamento" | "material_retornavel" | "consumivel";

export const NATUREZA_ITEM: Record<
  NaturezaItem,
  { label: string; descricao: string; variant: "default" | "secondary" | "outline" }
> = {
  equipamento: {
    label: "Equipamento",
    descricao: "Retornável, controlado por unidade (nº de série/patrimônio).",
    variant: "default",
  },
  material_retornavel: {
    label: "Material retornável",
    descricao: "Retornável, controlado por quantidade/saldo.",
    variant: "secondary",
  },
  consumivel: {
    label: "Consumível",
    descricao: "Não retorna.",
    variant: "outline",
  },
};

/**
 * Unidades de medida de reserva.
 *
 * A lista de verdade vive em `unidade_medida` (migration 0069) e é cadastrável
 * em Configurações — campo livre de unidade sempre vira "un", "UN", "unid" e
 * "unidade" convivendo na mesma tabela, e aí nenhum relatório soma direito.
 *
 * Esta constante fica como reserva para a organização cuja tabela ainda não foi
 * semeada: um seletor vazio impediria de cadastrar item, e cadastrar item é
 * mais importante do que a unidade estar na lista canônica.
 */
export const UNIDADES = ["un", "m", "m²", "m³", "kg", "L", "par", "cj"];

// ── Schema ───────────────────────────────────────────────────────────────────
// Fica aqui, e não em `itens/actions.ts`, para poder ser importado pelo
// formulário — um arquivo "use server" não atravessa para o cliente.


export const NATUREZAS_ITEM = [
  "equipamento",
  "material_retornavel",
  "consumivel",
] as const;

export const itemSchema = z.object({
  id: idOpcional,
  natureza: z.enum(NATUREZAS_ITEM),
  /**
   * A família — NOTEBOOK, ANDAIME. Cadastrada em Configurações › Catálogo.
   *
   * OPCIONAL, e permanentemente: um modelo pode existir antes de alguém decidir
   * seu tipo, e exigir travaria o cadastro rápido que a obra faz com o caminhão
   * parado no portão.
   */
  tipo_id: uuidOpcional,
  descricao: z.string().trim().min(1, "Informe a descrição do item.").max(200),
  unidade: textoOpcional(10),
  ativo: z.boolean(),
});

/**
 * `controle` NÃO está mais no schema — ele é derivado da natureza por trigger
 * (migration 0069).
 *
 * O DEFEITO QUE ISSO CONSERTOU: o estado PADRÃO de um item novo era
 * `Tipo = Equipamento` — cuja ajuda na tela diz "controlado por unidade" — com
 * `Controle = Por quantidade`. O formulário nascia se contradizendo, porque os
 * dois campos diziam a mesma coisa por caminhos diferentes e nada os mantinha
 * de acordo.
 */
export function controleDaNatureza(n: NaturezaItem): (typeof CONTROLES)[number] {
  return n === "equipamento" ? "peca" : "quantidade";
}

export type ItemInput = z.input<typeof itemSchema>;
export type ItemDados = z.output<typeof itemSchema>;

// ---------------------------------------------------------------------------
// O catálogo agrupado por tipo
// ---------------------------------------------------------------------------

/** Uma linha do catálogo com o parque dela já contado. */
export type LinhaCatalogo = {
  id: string;
  descricao: string;
  natureza: NaturezaItem;
  ativo: boolean;
  unidade: string | null;
  categoriaNome: string | null;
  tipoNome: string | null;
  pecas: number;
  emUso: number;
  disponivel: number;
  locadas: number;
};

export type GrupoCatalogo = {
  /** Chave estável para `key` de React e para o `<details>` lembrar o estado. */
  chave: string;
  rotulo: string;
  /** Por que este grupo existe. Só os grupos que são LACUNA têm nota. */
  nota: string | null;
  itens: LinhaCatalogo[];
  modelos: number;
  pecas: number;
  emUso: number;
  disponivel: number;
  locadas: number;
};

/** O rótulo do grupo de um item, e a nota quando o grupo é uma lacuna. */
function grupoDe(l: LinhaCatalogo): { rotulo: string; nota: string | null } {
  if (l.tipoNome) return { rotulo: l.tipoNome, nota: null };

  // Item que NÃO é equipamento legitimamente não tem tipo: um saco de cimento
  // não é NOTEBOOK nem ANDAIME. Agrupá-lo pela natureza é o rótulo honesto.
  if (l.natureza !== "equipamento") {
    return { rotulo: NATUREZA_ITEM[l.natureza].label, nota: null };
  }

  // EQUIPAMENTO sem tipo é lacuna de cadastro, e uma com consequência: ele não
  // aparece em nenhum filtro por tipo, então some das buscas de quem procura
  // "todos os notebooks". Dizer isso é o que faz alguém consertar.
  return {
    rotulo: "Equipamento sem tipo",
    nota: "Estes não aparecem quando alguém filtra por tipo. Defina o tipo no cadastro do item.",
  };
}

/**
 * Agrupa o catálogo por TIPO, com os totais de cada grupo.
 *
 * Ordem: grupos com mais peças primeiro — a pergunta que a tela responde é
 * "onde está o meu parque", e a resposta começa pelo maior. Dentro do grupo,
 * a ordem que veio do banco é preservada (o `order by` da consulta manda).
 *
 * O total de um grupo conta os itens QUE ESTÃO NA LISTA. Com filtro ativo isso
 * é o certo: mostrar "96 peças" num grupo filtrado que exibe duas seria somar
 * o que não está à vista.
 */
export function agruparPorTipo(linhas: LinhaCatalogo[]): GrupoCatalogo[] {
  const grupos = new Map<string, GrupoCatalogo>();

  for (const l of linhas) {
    const { rotulo, nota } = grupoDe(l);
    let g = grupos.get(rotulo);
    if (!g) {
      g = {
        chave: rotulo.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        rotulo,
        nota,
        itens: [],
        modelos: 0,
        pecas: 0,
        emUso: 0,
        disponivel: 0,
        locadas: 0,
      };
      grupos.set(rotulo, g);
    }
    g.itens.push(l);
    g.modelos += 1;
    g.pecas += l.pecas;
    g.emUso += l.emUso;
    g.disponivel += l.disponivel;
    g.locadas += l.locadas;
  }

  return [...grupos.values()].sort(
    (a, b) => b.pecas - a.pecas || a.rotulo.localeCompare(b.rotulo, "pt-BR"),
  );
}
