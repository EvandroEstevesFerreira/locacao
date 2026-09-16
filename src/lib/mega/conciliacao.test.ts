import { describe, it, expect } from "vitest";
import {
  competenciaDoTitulo,
  documentoConfiavel,
  sugerirConciliacao,
  type TituloQuitado,
  type LancamentoAberto,
} from "./conciliacao";

const titulo = (over: Partial<TituloQuitado> = {}): TituloQuitado => ({
  id: "t1",
  fornecedor_id: "f1",
  imovel_id: null,
  tipo_documento: "NF",
  numero_documento: "42824001",
  data_vencimento: "2026-08-15",
  data_prorrogado: "2026-08-15",
  valor_parcela: 2038.53,
  saldo_atual: 0,
  ...over,
});

const lancamento = (over: Partial<LancamentoAberto> = {}): LancamentoAberto => ({
  id: "l1",
  fornecedor_id: "f1",
  imovel_id: null,
  competencia: "2026-08-01",
  valor: 2038.53,
  nf_numero: "42824001",
  status: "pendente",
  ...over,
});

describe("competenciaDoTitulo", () => {
  it("usa a PRORROGADA, não o vencimento original", () => {
    // Prorrogar de 03/12 para 31/03 muda o mês. Ler o vencimento original aqui
    // casaria o pagamento com a competência errada.
    expect(
      competenciaDoTitulo({ data_vencimento: "2024-12-03", data_prorrogado: "2025-03-31" }),
    ).toBe("2025-03-01");
  });

  it("cai no vencimento quando não há prorrogação", () => {
    expect(
      competenciaDoTitulo({ data_vencimento: "2026-08-15", data_prorrogado: null }),
    ).toBe("2026-08-01");
  });
});

describe("documentoConfiavel", () => {
  it("confia em NF com número longo", () => {
    expect(documentoConfiavel("NF", "42824001")).toBe(true);
  });

  it("não confia em RECIBO, nem com número longo", () => {
    // Medido: 92 genéricos em 94 RECIBOs. O tipo manda, não o formato.
    expect(documentoConfiavel("RECIBO", "42824001")).toBe(false);
  });

  it("não confia em número de 1 a 3 dígitos, nem em NF", () => {
    // "1", "2", "3" é o lançador numerando à mão.
    expect(documentoConfiavel("NF", "3")).toBe(false);
    expect(documentoConfiavel("NF", "123")).toBe(false);
  });

  it("não confia em documento vazio", () => {
    expect(documentoConfiavel("NF", "")).toBe(false);
  });
});

describe("sugerirConciliacao", () => {
  it("ignora título em aberto", () => {
    // Saldo > 0 não tem baixa a propor: a prorrogada dele é previsão.
    const r = sugerirConciliacao({
      titulos: [titulo({ saldo_atual: 100 })],
      lancamentos: [lancamento()],
    });
    expect(r).toEqual([]);
  });

  it("ignora lançamento já pago", () => {
    const r = sugerirConciliacao({
      titulos: [titulo()],
      lancamentos: [lancamento({ status: "pago" })],
    });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBeNull();
  });

  it("casa agente + competência + valor, com documento fiscal batendo: confiança alta", () => {
    const r = sugerirConciliacao({ titulos: [titulo()], lancamentos: [lancamento()] });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].confianca).toBe("alta");
    expect(r[0].motivo).toContain("42824001");
  });

  it("propõe mesmo com valor diferente, e diz a diferença", () => {
    // Multa e juros são exatamente o que faz o valor divergir. Esconder a
    // divergência esconde a multa.
    const r = sugerirConciliacao({
      titulos: [titulo({ valor_parcela: 2038.53 })],
      lancamentos: [lancamento({ valor: 2000, nf_numero: "42824001" })],
    });
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].motivo).toContain("38,53");
  });

  it("aluguel sem documento útil casa por agente + competência, com confiança média", () => {
    const r = sugerirConciliacao({
      titulos: [
        titulo({
          fornecedor_id: null,
          imovel_id: "i1",
          tipo_documento: "RECIBO",
          numero_documento: "3",
          valor_parcela: 2000,
        }),
      ],
      lancamentos: [
        lancamento({ fornecedor_id: null, imovel_id: "i1", valor: 2000, nf_numero: null }),
      ],
    });
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].confianca).toBe("media");
  });

  it("o bloco de aluguel casa parcela a parcela, não documento a documento", () => {
    // O MESMO documento em 3 parcelas mensais. Casar por documento quitaria o
    // contrato inteiro com a primeira; casar por parcela dá 3 casamentos.
    const base = {
      fornecedor_id: null,
      imovel_id: "i1",
      tipo_documento: "RECIBO",
      numero_documento: "1",
      valor_parcela: 2000,
    };
    const r = sugerirConciliacao({
      titulos: [
        titulo({ ...base, id: "t1", data_vencimento: "2026-07-10", data_prorrogado: "2026-07-10" }),
        titulo({ ...base, id: "t2", data_vencimento: "2026-08-10", data_prorrogado: "2026-08-10" }),
        titulo({ ...base, id: "t3", data_vencimento: "2026-09-10", data_prorrogado: "2026-09-10" }),
      ],
      lancamentos: [
        lancamento({ id: "l7", fornecedor_id: null, imovel_id: "i1", competencia: "2026-07-01", valor: 2000, nf_numero: null }),
        lancamento({ id: "l8", fornecedor_id: null, imovel_id: "i1", competencia: "2026-08-01", valor: 2000, nf_numero: null }),
        lancamento({ id: "l9", fornecedor_id: null, imovel_id: "i1", competencia: "2026-09-01", valor: 2000, nf_numero: null }),
      ],
    });
    expect(r.map((s) => [s.mega_titulo_id, s.lancamento_id])).toEqual([
      ["t1", "l7"],
      ["t2", "l8"],
      ["t3", "l9"],
    ]);
  });

  it("nunca reusa o mesmo lançamento em duas sugestões", () => {
    // Duas parcelas na mesma competência com o mesmo valor: a segunda fica sem
    // casamento em vez de duplicar a baixa.
    const r = sugerirConciliacao({
      titulos: [titulo({ id: "t1" }), titulo({ id: "t2" })],
      lancamentos: [lancamento({ id: "l1" })],
    });
    const usados = r.map((s) => s.lancamento_id).filter(Boolean);
    expect(usados).toEqual(["l1"]);
    expect(r.find((s) => s.lancamento_id === null)).toBeDefined();
  });

  it("título de agente sem vínculo no Loca não casa com nada", () => {
    // NUNCA resolver agente por nome ou por valor: medido em 10/09/2026, 3 de 8
    // candidatos por valor+dia eram falsos.
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: null, imovel_id: null })],
      lancamentos: [lancamento()],
    });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBeNull();
    expect(r[0].confianca).toBe("baixa");
  });

  it("não casa entre agentes diferentes", () => {
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: "f1" })],
      lancamentos: [lancamento({ fornecedor_id: "f2" })],
    });
    expect(r[0].lancamento_id).toBeNull();
  });

  it("não casa fornecedor com imóvel de mesmo id", () => {
    // `fornecedor_id` e `imovel_id` vêm de tabelas diferentes; um uuid igual
    // seria coincidência, mas o casamento tem de comparar o TIPO do dono.
    const r = sugerirConciliacao({
      titulos: [titulo({ fornecedor_id: "x", imovel_id: null })],
      lancamentos: [lancamento({ fornecedor_id: null, imovel_id: "x" })],
    });
    expect(r[0].lancamento_id).toBeNull();
  });
});

describe("numérico que chega como string", () => {
  // O PostgREST devolve `numeric` como STRING. `"0.00" === 0` é falso, e o
  // preço disso não é um teste vermelho: é a fila vazia para sempre, com o
  // cron reportando sucesso e a tela dizendo "Nada a conciliar".
  it("casa com saldo, valor da parcela e valor do lançamento em string", () => {
    const r = sugerirConciliacao({
      titulos: [titulo({ saldo_atual: "0.00", valor_parcela: "2038.53" })],
      lancamentos: [lancamento({ valor: "2038.53" })],
    });
    expect(r).toHaveLength(1);
    expect(r[0].lancamento_id).toBe("l1");
    expect(r[0].confianca).toBe("alta");
  });

  it("ainda descarta o título em aberto cujo saldo veio em string", () => {
    const r = sugerirConciliacao({
      titulos: [titulo({ saldo_atual: "2038.53" })],
      lancamentos: [lancamento()],
    });
    expect(r).toHaveLength(0);
  });

  it("a diferença de valor sai formatada, não concatenada como texto", () => {
    // Sem a coerção, `t.valor_parcela - escolhido.valor` com strings daria
    // NaN e o motivo mostraria "R$ NaN" para quem vai decidir a baixa.
    const r = sugerirConciliacao({
      titulos: [titulo({ tipo_documento: "RECIBO", valor_parcela: "2138.53" })],
      lancamentos: [lancamento({ valor: "2038.53", nf_numero: null })],
    });
    expect(r[0].motivo).not.toContain("NaN");
    expect(r[0].motivo).toContain("100,00");
  });
});

describe("TIPOS_FISCAIS é preso à medição", () => {
  // `NFE`, `NFS`, `NFSE` e `FATURA` já foram aceitos aqui. A medição de
  // 11/09/2026 só olhou `NF`; admitir tipo não medido é apostar que ele se
  // comporta igual, e a aposta custa uma NF boa sobrescrita.
  it("só NF é tipo fiscal", () => {
    expect(documentoConfiavel("NF", "42824001")).toBe(true);
    for (const tipo of ["NFE", "NFS", "NFSE", "FATURA", "BOLETO"]) {
      expect(documentoConfiavel(tipo, "42824001"), tipo).toBe(false);
    }
  });
});
