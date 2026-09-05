// Domínio Catálogo — categorias, tipos e unidades de medida. Client-safe.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import { uuidOpcional } from "@/lib/campos";
import { NATUREZAS_ITEM } from "@/lib/itens";

export const categoriaSchema = z.object({
  id: uuidOpcional,
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da categoria.")
    .max(60, "Use no máximo 60 caracteres."),
});

export type CategoriaInput = z.input<typeof categoriaSchema>;
export type CategoriaDados = z.output<typeof categoriaSchema>;

/**
 * O TIPO é a família — NOTEBOOK, ANDAIME, BETONEIRA.
 *
 * `nome` é normalizado em CAIXA ALTA de propósito. A família é um rótulo curto
 * de classificação, não uma frase, e "Notebook" convivendo com "NOTEBOOK" é
 * exatamente a duplicata que este cadastro existe para impedir — a unicidade do
 * banco é sensível a caixa, então sem a normalização os dois entrariam.
 */
export const tipoEquipamentoSchema = z.object({
  id: uuidOpcional,
  categoria_id: z.string().uuid("Selecione a categoria."),
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome do tipo.")
    .max(60, "Use no máximo 60 caracteres.")
    .transform((v) => v.toUpperCase()),
  natureza_padrao: z.enum(NATUREZAS_ITEM),
  ativo: z.boolean(),
});

export type TipoEquipamentoInput = z.input<typeof tipoEquipamentoSchema>;
export type TipoEquipamentoDados = z.output<typeof tipoEquipamentoSchema>;

/**
 * Unidade de medida.
 *
 * `simbolo` NÃO é normalizado: "m" e "M" querem dizer metro e mega, e "L" é
 * litro enquanto "l" é ambíguo. Caixa alta automática aqui destruiria a
 * distinção que a unidade carrega.
 */
export const unidadeMedidaSchema = z.object({
  id: uuidOpcional,
  simbolo: z
    .string()
    .trim()
    .min(1, "Informe o símbolo.")
    .max(10, "Use no máximo 10 caracteres."),
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome por extenso.")
    .max(40, "Use no máximo 40 caracteres."),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  ativo: z.boolean(),
});

export type UnidadeMedidaInput = z.input<typeof unidadeMedidaSchema>;
export type UnidadeMedidaDados = z.output<typeof unidadeMedidaSchema>;
