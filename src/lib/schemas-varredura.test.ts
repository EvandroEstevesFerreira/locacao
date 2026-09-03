import { describe, it, expect } from "vitest";
import { z } from "zod";

import * as alojamento from "./alojamento";
import * as avanco from "./avanco";
import * as config from "./config";
import * as custodia from "./custodia";
import * as custoItem from "./custo-item";
import * as estoque from "./estoque";
import * as fechamento from "./fechamento";
import * as financeiro from "./financeiro";
import * as fornecedor from "./fornecedor";
import * as frota from "./frota";
import * as imoveis from "./imoveis";
import * as itens from "./itens";
import * as locacao from "./locacao";
import * as obra from "./obra";
import * as orcamento from "./orcamento";
import * as permissoes from "./permissoes";
import * as recebimento from "./recebimento";
import * as termo from "./termo";

/**
 * VARREDURA — o teste que a suíte de idempotência deveria ter sido desde o
 * começo.
 *
 * `schemas-idempotencia.test.ts` cobre uma LISTA de schemas escrita à mão, e é
 * por isso que o mesmo defeito apareceu três vezes em produção:
 *
 *   - reparo/ocupante (`imoveis.ts`), corrigido na 0.31.x
 *   - obra (`obra.ts`), corrigido na 0.35.0
 *   - empresa (`config.ts`), reportado pelo usuário com o erro cru do zod na
 *     tela: "Invalid input: expected string, received null"
 *
 * Cada correção passava, cada schema novo continuava fora da lista. Este teste
 * não tem lista: ele IMPORTA os módulos de domínio, encontra todo `ZodObject`
 * exportado e exige a propriedade de todos. Um schema novo entra na varredura
 * por existir.
 *
 * A propriedade: toda action re-valida o que recebe, e o que ela recebe é o
 * OUTPUT do mesmo schema — o zodResolver já transformou no cliente. Logo
 * `parse(parse(x))` tem de dar `parse(x)`. Sem isso, deixar um campo opcional
 * em branco vira erro genérico na cara do usuário.
 */

const MODULOS: Record<string, Record<string, unknown>> = {
  alojamento,
  avanco,
  config,
  custodia,
  custoItem,
  estoque,
  fechamento,
  financeiro,
  fornecedor,
  frota,
  imoveis,
  itens,
  locacao,
  obra,
  orcamento,
  permissoes,
  recebimento,
  termo,
};

/**
 * Amostra mínima por schema: só os campos obrigatórios, todo opcional ausente.
 *
 * É deliberadamente o caso MÍNIMO — é aí que o output ganha os `null` que a
 * entrada não aceitava, e é exatamente o formulário que o usuário preenche
 * pela metade. Um schema sem amostra aqui reprova a varredura em vez de ser
 * ignorado em silêncio: acrescentar a amostra é parte de criar o schema.
 */
const UUID = "11111111-1111-4111-8111-111111111111";

const AMOSTRAS: Record<string, unknown> = {
  imovelSchema: { tipo: "casa", apelido: "Casa 1", status: "ativo" },
  contratoImovelSchema: {
    imovel_id: UUID,
    data_inicio: "2026-08-01",
    valor_aluguel: "1900",
    valor_condominio: "",
    valor_iptu: "",
    seguro_fianca: "",
    seguro_fianca_mensal: false,
    vigente: true,
  },
  contaConsumoSchema: {
    imovel_id: UUID,
    tipo: "agua",
    competencia: "2026-08",
    valor: "120",
    vencimento: "2026-09-10",
    pago: false,
    lancar: false,
  },
  reparoSchema: { imovel_id: UUID, data: "2026-08-01", descricao: "Troca de torneira" },
  ocupanteSchema: { imovel_id: UUID, nome: "Fulano de Tal" },
  ocorrenciaSchema: { imovel_id: UUID, data: "2026-08-01", descricao: "Ocorrência" },
  medidaDisciplinarSchema: {
    ocupante_id: UUID,
    imovel_id: UUID,
    data: "2026-08-22",
    tipo: "escrita",
    fato_descricao: "Descumpriu o horário de silêncio pela segunda vez.",
  },
  entregaOcupanteSchema: {
    ocupante_id: UUID,
    imovel_id: UUID,
    tipo: "chaves",
    entregue_em: "2026-08-01",
  },
  fechamentoLimpezaSchema: { id: UUID, imovel_id: UUID },
  tarefaLimpezaSchema: { grupo: "BANHEIROS", descricao: "Lavar piso", frequencia: "D" },
  obraSchema: { codigo: "OB-01", nome: "Obra", status: "ativa" },
  avancoSchema: { obra_id: UUID, semana: "2026-08-31", percentual: "34" },
  orcamentoSchema: { obra_id: UUID, valor_total: "400000" },
  orcamentoItemSchema: { item_id: UUID, valor_previsto: "120000" },
  rateioSchema: { lancamento_id: UUID },
  fechamentoSchema: { obra_id: UUID, competencia: "2026-09" },
  unidadeSchema: { item_id: UUID, identificador: "PAT-0431" },
  categoriaSchema: { nome: "Concretagem" },
  moverPecaSchema: {
    unidade_id: UUID,
    tipo: "almoxarifado",
    data: "2026-09-02",
  },
  editarPecaSchema: { id: UUID, identificador: "PAT-0431" },
  movimentoSchema: { item_id: UUID, tipo: "entrada", quantidade: "10", data: "2026-09-02" },
  parcelaItemSchema: { item_locado_id: UUID, valor: "100" },
  empresaSchema: { nome: "Sistenge Engenharia" },
  fornecedorSchema: {
    nome: "Fornecedor X",
    ativo: true,
    obras: [],
    confirmar_duplicado: false,
  },
  contratoSchema: {
    obra_id: UUID,
    fornecedor_id: UUID,
    numero: "CT-001",
    cadencia: "mensal",
    data_inicio: "2026-08-01",
    status: "ativo",
    cobranca_prorata: false,
  },
  itemLocadoSchema: {
    contrato_id: UUID,
    item_id: UUID,
    quantidade: "2",
    valor_unitario_periodo: "100",
    data_retirada: "2026-08-01",
  },
  itemSchema: { tipo: "equipamento", descricao: "Betoneira 400L", ativo: true },
  configRelatorioSchema: {
    ativo: false,
    tipo: "custo_por_obra",
    frequencia: "mensal",
    dia: 1,
    destinatarios: "",
  },
  baixaSchema: { id: UUID, valorPago: "100", dataPagamento: "2026-09-10" },
  trocarSenhaSchema: { senha: "senhaforte123", confirmar: "senhaforte123" },
  papelSchema: "operador",
  criarUsuarioSchema: {
    nome: "Fulano",
    email: "fulano@sistenge.com",
    papel: "operador",
    senha: "senhaforte123",
    obras: [],
    modulos: [],
  },
  editarUsuarioSchema: {
    id: UUID,
    nome: "Fulano",
    papel: "operador",
    ativo: true,
    obras: [],
    modulos: [],
  },
  recebimentoSchema: { contrato_id: UUID, recebido_em: "2026-08-24" },
  recebimentoItemSchema: {
    recebimento_id: UUID,
    item_id: UUID,
    quantidade: "2",
    condicao: "ok",
  },
  fecharRecebimentoSchema: { id: UUID, ciente: true },
  lancamentoSchema: {
    obra_id: UUID,
    descricao: "Aluguel",
    valor: "1000",
    vencimento: "2026-09-10",
    competencia: "2026-09",
    status: "pendente",
  },
  funcionarioSchema: { nome: "Fulano de Tal" },
  termoSchema: { funcionario_id: UUID, data_entrega: "2026-09-02" },
  termoItemSchema: {
    item_id: UUID,
    controle: "quantidade",
    quantidade: "1",
    estado_entrega: "bom",
  },
  devolucaoItemSchema: {
    item_id: UUID,
    data_devolucao: "2026-09-02",
    estado_devolucao: "bom",
  },
  assinaturaSchema: { nome: "Fulano de Tal" },
  cancelamentoSchema: { motivo: "Emitido para o funcionário errado." },
};

/** Todo ZodObject exportado pelos módulos de domínio, com nome de origem. */
function encontrarSchemas(): { nome: string; modulo: string; schema: z.ZodType }[] {
  const achados: { nome: string; modulo: string; schema: z.ZodType }[] = [];
  for (const [modulo, exportados] of Object.entries(MODULOS)) {
    for (const [nome, valor] of Object.entries(exportados)) {
      // Só os que terminam em `Schema`: é a convenção do projeto, e sem ela a
      // varredura pegaria helpers internos que não são entrada de formulário.
      if (!nome.endsWith("Schema")) continue;
      if (!valor || typeof (valor as z.ZodType).safeParse !== "function") continue;
      achados.push({ nome, modulo, schema: valor as z.ZodType });
    }
  }
  return achados;
}

const SCHEMAS = encontrarSchemas();

describe("varredura de schemas", () => {
  it("encontrou schemas para verificar", () => {
    // Se um refactor renomear a convenção, a varredura viraria um teste vazio
    // que passa sempre. Este caso é a trava.
    expect(SCHEMAS.length).toBeGreaterThan(10);
  });

  it("todo schema exportado tem amostra na varredura", () => {
    const semAmostra = SCHEMAS.filter((s) => !(s.nome in AMOSTRAS)).map(
      (s) => `${s.modulo}.${s.nome}`,
    );
    expect(
      semAmostra,
      `Schemas sem amostra em AMOSTRAS. Acrescente o caso MÍNIMO (só os campos ` +
        `obrigatórios) — é onde o defeito de idempotência aparece:\n  ` +
        semAmostra.join("\n  "),
    ).toEqual([]);
  });

  for (const { nome, modulo, schema } of SCHEMAS) {
    const amostra = AMOSTRAS[nome];
    if (amostra === undefined) continue;

    it(`${modulo}.${nome} aceita o próprio output`, () => {
      const primeira = schema.parse(amostra);
      const r = schema.safeParse(primeira);
      const detalhe = r.success
        ? ""
        : `${r.error.issues[0].path.join(".") || "(raiz)"}: ${r.error.issues[0].message}`;
      expect(r.success, detalhe).toBe(true);
    });

    it(`${modulo}.${nome} não muda o output na segunda passagem`, () => {
      const primeira = schema.parse(amostra);
      expect(schema.parse(primeira)).toEqual(primeira);
    });

    // A SEGUNDA propriedade da varredura, e o furo que deixou a 0.39.1 passar.
    //
    // A amostra acima é o caso mínimo e OMITE o `id` — mas o browser não omite
    // nada. Todo formulário que cria e edita no mesmo componente carrega o id
    // num `<input type="hidden" {...register("id")} />`, e num cadastro NOVO
    // esse input manda `""`: o react-hook-form semeia o valor do DOM quando o
    // defaultValue é `undefined`. Um `id: z.string().uuid().optional()` recusa
    // esse `""`, o `handleSubmit` engole o submit e o botão Salvar não faz nada
    // — em silêncio, porque nenhum form renderiza `errors.id`.
    //
    // Só vale para quem já aceita a amostra sem `id`, que é exatamente o
    // conjunto "schema de formulário que também cria". Quem exige `id` (baixa,
    // fechamento de limpeza, editar usuário) fica fora por construção.
    const objeto =
      typeof amostra === "object" && amostra !== null && !Array.isArray(amostra);
    const criaSemId = objeto && !("id" in amostra) && schema.safeParse(amostra).success;

    if (criaSemId) {
      it(`${modulo}.${nome} aceita id em branco (cadastro novo)`, () => {
        const r = schema.safeParse({ ...(amostra as object), id: "" });
        const detalhe = r.success
          ? ""
          : `Use \`idOpcional\` de @/lib/campos no campo id. ` +
            `${r.error.issues[0].path.join(".") || "(raiz)"}: ${r.error.issues[0].message}`;
        expect(r.success, detalhe).toBe(true);
      });
    }
  }
});
