// Campos opcionais de formulário — FONTE ÚNICA.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// Toda server action deste sistema RE-VALIDA o que recebe, e o que ela recebe é
// o OUTPUT do mesmo schema: o zodResolver já transformou os dados no cliente.
// Logo o schema tem de aceitar o próprio output — `parse(parse(x))` precisa dar
// `parse(x)`.
//
// O jeito ingênuo de escrever campo opcional QUEBRA essa propriedade:
//
//     z.string().trim().max(200).optional().transform((v) => v || null)
//                                ↑ aceita string | undefined
//                                                              ↑ produz null
//
// Na primeira passagem, "" vira `null`. Na segunda, `null` não é `string` nem
// `undefined` e o zod recusa com "Invalid input: expected string, received
// null" — o erro cru, sem nome de campo, na cara do usuário.
//
// Esse defeito chegou à produção TRÊS vezes, cada uma numa cópia diferente do
// mesmo helper de três linhas:
//
//   1. `imoveis.ts` — reparo sem executor e ocupante sem CPF (0.23.0 → 0.31.x)
//   2. `obra.ts`    — obra sem endereço, responsável ou centro de custo (0.35.0)
//   3. `config.ts`  — empresa sem razão social, reportado com a tela mostrando
//                     "Invalid input: expected string, received null"
//
// E a varredura de `schemas-varredura.test.ts` mostrou que havia mais quatro
// vivos ao mesmo tempo: `lancamentoSchema`, `fornecedorSchema`, `contratoSchema`
// e `itemLocadoSchema`.
//
// Corrigir cópia por cópia foi o que fez o defeito voltar. Aqui há UMA
// implementação; `schemas-varredura.test.ts` encontra todo schema exportado por
// convenção de nome e exige a propriedade de todos, sem lista para manter.
//
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";

/**
 * A base de todo campo opcional: aceita `string`, `null` ou `undefined` e
 * devolve `string | null` já aparado.
 *
 * `z.union([z.string(), z.null()])` antes de `.optional()` é o que torna o
 * schema idempotente — sem o `z.null()` a segunda passagem recusa o próprio
 * output.
 *
 * Encadeie `.refine()` sobre ele para as regras específicas; o valor que chega
 * ao refine já é `string | null`, então trate o `null` como "não informado".
 */
export const opcional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : null;
  });

/** Texto opcional com limite de tamanho. O caso mais comum, de longe. */
export const textoOpcional = (max: number) =>
  opcional.refine((v) => v === null || v.length <= max, {
    message: `Use no máximo ${max} caracteres.`,
  });

/**
 * Data opcional — sem validação de formato, porque o `<input type="date">` já
 * garante `yyyy-mm-dd` e o banco recusa o resto.
 */
export const dataOpcional = opcional;

/**
 * Enum que também aceita `""` (o valor do `<option>` vazio de um `<select>`) e
 * `null` (o próprio output).
 */
export const enumOpcional = <T extends readonly [string, ...string[]]>(valores: T) =>
  z
    .union([z.literal(""), z.null(), z.enum(valores)])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v));

/**
 * Número opcional vindo de `<input type="number">`.
 *
 * `z.null()` vem ANTES do `z.coerce.number()` de propósito: o coerce converte
 * `null` em `0`, e `0` costuma ser rejeitado por um `check` do banco — foi o que
 * transformou "medida sem suspensão" em erro de banco em vez de campo vazio.
 */
export const numeroOpcional = z
  .union([z.literal(""), z.null(), z.coerce.number()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID opcional — para vínculos que o formulário deixa em branco. */
export const uuidOpcional = opcional.refine((v) => v === null || UUID_RE.test(v), {
  message: "Selecione uma opção válida.",
});

/**
 * O `id` de um formulário que cria E edita: em branco = criação, uuid = edição.
 *
 * NUNCA escreva `id: z.string().uuid().optional()` aqui. O `<input
 * type="hidden" {...register("id")} />` que carrega o id manda `""` quando não
 * há registro para editar, e o react-hook-form SEMEIA esse `""` nos valores do
 * form: em `updateValidAndValue`, quando o `defaultValue` é `undefined`, ele lê
 * o valor do DOM. O schema então recebe `id: ""`, o `uuid()` recusa, o
 * `handleSubmit` engole o submit — e o botão Salvar não faz NADA. Sem toast,
 * sem mensagem, sem requisição: nenhum form renderiza `errors.id`.
 *
 * Foi o defeito da 0.39.1, e não era só um cadastro. Os SETE formulários que
 * criam e editam no mesmo componente estavam impedidos de criar registro novo
 * — item, obra, imóvel, contrato de imóvel, contrato de locação, fornecedor e
 * lançamento — enquanto editar funcionava em todos, porque aí o id é um uuid
 * de verdade. A varredura de idempotência não pegou porque a amostra mínima de
 * cada schema OMITE o `id`, e é justamente o `""` que o browser manda.
 *
 * A mensagem existe por obrigação do refine; o usuário não deveria vê-la nunca,
 * porque o único jeito de chegar nela é um id corrompido no HTML.
 */
export const idOpcional = opcional.refine((v) => v === null || UUID_RE.test(v), {
  message: "Registro inválido. Recarregue a página e tente de novo.",
});

/** E-mail opcional. */
export const emailOpcional = (max = 200) =>
  textoOpcional(max).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
    message: "E-mail inválido.",
  });

/** UF opcional, normalizada para maiúsculas. */
export const ufOpcional = opcional
  .refine((v) => v === null || /^[A-Za-z]{2}$/.test(v), {
    message: "UF deve ter 2 letras.",
  })
  .transform((v) => (v === null ? null : v.toUpperCase()));

/** CEP opcional, no formato 00000-000 ou 00000000. */
export const cepOpcional = opcional.refine((v) => v === null || /^\d{5}-?\d{3}$/.test(v), {
  message: "CEP inválido (use 00000-000).",
});
