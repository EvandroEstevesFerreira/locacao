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
