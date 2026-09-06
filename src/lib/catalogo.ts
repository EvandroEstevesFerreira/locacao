// Domínio Catálogo — categorias, tipos e unidades de medida. Client-safe.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import { numeroOpcional, textoOpcional, uuidOpcional } from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";
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
  /**
   * Intervalo de manutenção preventiva, em horas de horímetro.
   *
   * Vive no TIPO e não na peça: o intervalo é do fabricante e vale para toda a
   * família — GERADOR revisa a cada 250 h, todos eles. Repetir por peça faria
   * cada cadastro novo pedir um número que ninguém lembra, e metade ficaria
   * zero.
   *
   * NULO = este tipo não tem manutenção por uso. É o caso de NOTEBOOK e da
   * maioria: só faz sentido onde o fabricante publica o intervalo.
   */
  intervalo_manutencao_h: numeroOpcional,
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

// ═══════════════════════════════════════════════════════════════════════════
// A ficha do tipo — o construtor de campos
// ═══════════════════════════════════════════════════════════════════════════

export const TIPOS_CAMPO = ["texto", "numero", "data", "lista", "sim_nao"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const TIPO_CAMPO_INFO: Record<
  TipoCampo,
  { label: string; ajuda: string }
> = {
  texto: {
    label: "Texto",
    ajuda: "Qualquer coisa escrita. Não dá para somar nem comparar.",
  },
  numero: {
    label: "Número",
    ajuda: "Dá para filtrar por faixa: memória abaixo de 8, altura acima de 2.",
  },
  data: {
    label: "Data",
    ajuda: "Garantia, aquisição, última aferição.",
  },
  lista: {
    label: "Lista de opções",
    ajuda: "Escolha fechada. É o que impede SSD, ssd e S.S.D. na mesma coluna.",
  },
  sim_nao: {
    label: "Sim ou não",
    ajuda: "Tem bateria? Está sob garantia?",
  },
};

/**
 * A chave é o NOME DA COLUNA no jsonb — e por isso é normalizada.
 *
 * "Memória RAM" digitado pelo usuário vira `memoria_ram`. Sem isso, a chave
 * carregaria acento e espaço, e toda consulta teria de escrever
 * `ficha->>'Memória RAM'` — que é o tipo de coisa que se digita errado uma vez
 * e o filtro devolve vazio para sempre, sem erro nenhum.
 *
 * A chave é derivada do rótulo na CRIAÇÃO e depois congelada: mudar a chave de
 * um campo que já tem valores gravados órfãos-aria todos eles em silêncio.
 */
export function chaveDeRotulo(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export const campoFichaSchema = z
  .object({
    chave: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(
        /^[a-z][a-z0-9_]*$/,
        "A chave só aceita letras minúsculas, números e _, começando por letra.",
      ),
    rotulo: z
      .string()
      .trim()
      .min(1, "Informe o rótulo do campo.")
      .max(60, "Use no máximo 60 caracteres."),
    tipo: z.enum(TIPOS_CAMPO),
    /** Só para `numero`: "GB", "m", "kg". Aparece ao lado do valor. */
    unidade: textoOpcional(10),
    /** Só para `lista`. */
    opcoes: z.array(z.string().trim().min(1)).max(30).default([]),
    obrigatorio: z.boolean().default(false),
  })
  // Lista sem opção é um seletor vazio: o campo aparece na ficha e não deixa
  // escolher nada. O erro precisa vir aqui, e não na hora de preencher a peça.
  .refine((c) => c.tipo !== "lista" || c.opcoes.length > 0, {
    message: "Uma lista precisa de ao menos uma opção.",
    path: ["opcoes"],
  });

export type CampoFicha = z.output<typeof campoFichaSchema>;

/**
 * Os campos de um tipo.
 *
 * A unicidade de `chave` é conferida AQUI e não no banco: `campos_ficha` é um
 * jsonb, e duas chaves iguais fariam a segunda sobrescrever a primeira ao
 * gravar a ficha da peça — o valor do primeiro campo sumiria sem erro.
 */
export const camposFichaSchema = z
  .array(campoFichaSchema)
  .max(30, "Trinta campos por tipo já é uma ficha que ninguém preenche.")
  .refine(
    (campos) => new Set(campos.map((c) => c.chave)).size === campos.length,
    { message: "Há dois campos com a mesma chave." },
  );

export const salvarCamposSchema = z.object({
  tipo_id: z.string().uuid(),
  campos: camposFichaSchema,
});

export type SalvarCamposDados = z.output<typeof salvarCamposSchema>;

/**
 * Um campo da ficha ENQUANTO ESTÁ SENDO EDITADO na tela.
 *
 * `gravado` diz se o campo já existe no banco, e existe porque a chave só pode
 * seguir o rótulo enquanto o campo é novo — depois de gravada, mudá-la orfana
 * os valores já preenchidos nas peças, em silêncio.
 *
 * Essa informação NÃO pode ser inferida do valor da chave. Era exatamente isso
 * que o editor fazia (`const novo = campo.chave === ""`), e por isso toda chave
 * gerada pela tela ficou sendo a PRIMEIRA LETRA do rótulo: na primeira tecla a
 * chave deixava de ser vazia e o campo passava a se comportar como gravado.
 * O tipo DESKTOP em produção nasceu com as chaves `m`, `p` e `a`.
 */
export type CampoEmEdicao = CampoFicha & { gravado: boolean };

/** Um campo em branco, pronto para receber o rótulo. */
export function campoNovo(): CampoEmEdicao {
  return {
    chave: "",
    rotulo: "",
    tipo: "texto",
    unidade: null,
    opcoes: [],
    obrigatorio: false,
    gravado: false,
  };
}

/** Os campos que vieram do banco, prontos para a tela. */
export function paraEdicao(campos: CampoFicha[]): CampoEmEdicao[] {
  return campos.map((c) => ({ ...c, gravado: true }));
}

/**
 * O rótulo mudou. A chave acompanha **enquanto o campo for novo**.
 *
 * Não há caixa de digitação para a chave na tela: ela é derivada e exibida.
 * Rótulo que não produz chave nenhuma (` — `) deixa a chave vazia de
 * propósito — `campoFichaSchema` recusa, e o erro aparece ao salvar.
 */
export function comRotulo(campo: CampoEmEdicao, rotulo: string): CampoEmEdicao {
  if (campo.gravado) return { ...campo, rotulo };
  return { ...campo, rotulo, chave: chaveDeRotulo(rotulo) };
}

/**
 * Tira o `gravado` antes de mandar ao banco.
 *
 * `gravado` é estado de tela. Dentro do jsonb ele seria uma chave que
 * `campoFichaSchema` não declara e que ninguém saberia de onde veio.
 */
export function paraGravar(campos: CampoEmEdicao[]): CampoFicha[] {
  // Campo a campo, e não `{ gravado, ...resto }`: assim está escrito aqui o que
  // vai para o jsonb. Um campo novo de TELA não vaza por esquecimento, e um
  // campo novo de `CampoFicha` não passa despercebido — o TypeScript acusa a
  // propriedade que falta.
  return campos.map((c) => ({
    chave: c.chave,
    rotulo: c.rotulo,
    tipo: c.tipo,
    unidade: c.unidade,
    opcoes: c.opcoes,
    obrigatorio: c.obrigatorio,
  }));
}

/**
 * Valida a ficha de UMA peça contra os campos do tipo dela.
 *
 * Devolve o objeto pronto para gravar, com as chaves que o tipo conhece e nada
 * mais: campo removido do tipo deixa de ser gravado, e chave estranha vinda de
 * requisição forjada é descartada em vez de virar coluna fantasma.
 *
 * NÃO lança para campo em branco não obrigatório — ele simplesmente não entra
 * no objeto. Gravar `""` e `null` misturados faria `ficha->>'x' is null` ser
 * verdadeiro para uns e falso para outros, com o mesmo significado na tela.
 */
export function validarFicha(
  campos: CampoFicha[],
  bruto: Record<string, unknown>,
): { ok: true; ficha: Record<string, unknown> } | { ok: false; erro: string } {
  const ficha: Record<string, unknown> = {};

  for (const c of campos) {
    const cru = bruto[c.chave];
    const texto = typeof cru === "string" ? cru.trim() : cru == null ? "" : String(cru);

    if (texto === "") {
      if (c.obrigatorio) return { ok: false, erro: `Informe ${c.rotulo}.` };
      continue;
    }

    if (c.tipo === "numero") {
      const n = Number(texto.replace(",", "."));
      if (!Number.isFinite(n)) {
        return { ok: false, erro: `${c.rotulo} precisa ser um número.` };
      }
      ficha[c.chave] = n;
    } else if (c.tipo === "sim_nao") {
      ficha[c.chave] = texto === "true" || texto === "on" || texto === "sim";
    } else if (c.tipo === "lista") {
      if (!c.opcoes.includes(texto)) {
        return { ok: false, erro: `${c.rotulo}: opção inválida.` };
      }
      ficha[c.chave] = texto;
    } else if (c.tipo === "data") {
      if (!ehDataISO(texto)) {
        return { ok: false, erro: `${c.rotulo} precisa ser uma data válida.` };
      }
      ficha[c.chave] = texto;
    } else {
      if (texto.length > 200) {
        return { ok: false, erro: `${c.rotulo}: use no máximo 200 caracteres.` };
      }
      ficha[c.chave] = texto;
    }
  }

  return { ok: true, ficha };
}
