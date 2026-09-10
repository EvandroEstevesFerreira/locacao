import { describe, it, expect } from "vitest";

import {
  chaveDoTitulo,
  dedupPorChave,
  linhasParaEspelho,
  type LinhaExistente,
} from "./espelho";
import type { TituloMega } from "./contrato";

const HOJE = "2026-09-10";

function titulo(over: Partial<TituloMega> = {}): TituloMega {
  return {
    codigoAgente: "2630",
    agenteNome: "5I LOCACOES",
    agenteCnpj: "11.111.111/0001-11",
    numeroAp: "32549",
    numeroParcela: "001",
    filial: "3",
    tipoDocumento: "NF",
    numeroDocumento: "42824001",
    dataVencimento: "2026-08-15",
    dataProrrogado: null,
    valorParcela: 2038.53,
    saldoAtual: 0,
    ...over,
  };
}

describe("chaveDoTitulo", () => {
  it("separa parcelas que só diferem no vencimento", () => {
    const a = chaveDoTitulo(titulo());
    const b = chaveDoTitulo(titulo({ dataVencimento: "2026-09-15" }));
    expect(a).not.toBe(b);
  });

  // A DOCUMENTAÇÃO DO MEGA JÁ NOS ENSINOU ISSO NA MARRA: `AP + parcela` não é
  // único. Retenções (ISS, INSS, IR) reaproveitam o número da AP com tipo de
  // documento diferente. Chave estreita faria uma sobrescrever a outra e o
  // total do fornecedor sairia menor que o real.
  it("separa retenção de nota com o mesmo AP e a mesma parcela", () => {
    const nf = chaveDoTitulo(titulo({ tipoDocumento: "NF" }));
    const iss = chaveDoTitulo(titulo({ tipoDocumento: "GUIA", numeroDocumento: "" }));
    expect(nf).not.toBe(iss);
  });

  it("trata documento ausente e string vazia como a mesma coisa", () => {
    expect(chaveDoTitulo(titulo({ numeroDocumento: null }))).toBe(
      chaveDoTitulo(titulo({ numeroDocumento: "" })),
    );
  });
});

describe("linhasParaEspelho", () => {
  const orgId = "org-1";
  const porCodigo = new Map([["2630", "forn-5i"]]);

  it("liga o título ao fornecedor pelo código do Mega", () => {
    const [l] = linhasParaEspelho({
      orgId,
      titulos: [titulo()],
      existentes: [],
      fornecedorPorCodigo: porCodigo,
      hojeISO: HOJE,
    });
    expect(l.fornecedor_id).toBe("forn-5i");
    expect(l.codigo_mega).toBe("2630");
  });

  // O TÍTULO ENTRA MESMO SEM FORNECEDOR RECONHECIDO. Perder a linha porque o
  // cadastro do Loca não tem aquele código faria o espelho mentir por omissão —
  // e o buraco apareceria como "nada pago" na tela, que é pior que "não sei".
  it("guarda o título mesmo sem fornecedor casado", () => {
    const [l] = linhasParaEspelho({
      orgId,
      titulos: [titulo({ codigoAgente: "9999" })],
      existentes: [],
      fornecedorPorCodigo: porCodigo,
      hojeISO: HOJE,
    });
    expect(l.fornecedor_id).toBeNull();
    expect(l.codigo_mega).toBe("9999");
  });

  it("normaliza documento ausente para string vazia, que é o que a chave usa", () => {
    const [l] = linhasParaEspelho({
      orgId,
      titulos: [titulo({ tipoDocumento: null, numeroDocumento: null })],
      existentes: [],
      fornecedorPorCodigo: porCodigo,
      hojeISO: HOJE,
    });
    expect(l.tipo_documento).toBe("");
    expect(l.numero_documento).toBe("");
  });

  describe("quitacao_vista_em", () => {
    it("marca hoje quando o título aparece já quitado", () => {
      const [l] = linhasParaEspelho({
        orgId,
        titulos: [titulo({ saldoAtual: 0 })],
        existentes: [],
        fornecedorPorCodigo: porCodigo,
        hojeISO: HOJE,
      });
      expect(l.quitacao_vista_em).toBe(HOJE);
    });

    it("deixa nulo enquanto há saldo", () => {
      const [l] = linhasParaEspelho({
        orgId,
        titulos: [titulo({ saldoAtual: 2038.53 })],
        existentes: [],
        fornecedorPorCodigo: porCodigo,
        hojeISO: HOJE,
      });
      expect(l.quitacao_vista_em).toBeNull();
    });

    // ESTE É O TESTE QUE IMPORTA. A data é o mais perto de "quando pagou" que
    // existe — a API do Mega não devolve data de pagamento. Se cada rodada
    // reescrevesse o valor, a data viraria "ontem" para sempre e não serviria
    // para nada. Uma vez vista, não se mexe mais.
    it("PRESERVA a data da primeira vez que viu quitado", () => {
      const existente: LinhaExistente = {
        chave: chaveDoTitulo(titulo()),
        quitacao_vista_em: "2026-08-20",
      };
      const [l] = linhasParaEspelho({
        orgId,
        titulos: [titulo({ saldoAtual: 0 })],
        existentes: [existente],
        fornecedorPorCodigo: porCodigo,
        hojeISO: HOJE,
      });
      expect(l.quitacao_vista_em).toBe("2026-08-20");
    });

    // Estorno acontece: o financeiro reabre um título já baixado. O espelho
    // segue o Mega, então a data observada some junto com a quitação — mantê-la
    // faria a tela mostrar "pago em 20/08" ao lado de um saldo em aberto.
    it("apaga a data se o título volta a ter saldo", () => {
      const existente: LinhaExistente = {
        chave: chaveDoTitulo(titulo()),
        quitacao_vista_em: "2026-08-20",
      };
      const [l] = linhasParaEspelho({
        orgId,
        titulos: [titulo({ saldoAtual: 500 })],
        existentes: [existente],
        fornecedorPorCodigo: porCodigo,
        hojeISO: HOJE,
      });
      expect(l.quitacao_vista_em).toBeNull();
    });
  });

  it("copia valor e saldo sem arredondar", () => {
    const [l] = linhasParaEspelho({
      orgId,
      titulos: [titulo({ valorParcela: 2038.53, saldoAtual: 1019.27 })],
      existentes: [],
      fornecedorPorCodigo: porCodigo,
      hojeISO: HOJE,
    });
    expect(l.valor_parcela).toBe(2038.53);
    expect(l.saldo_atual).toBe(1019.27);
  });
});

describe("dedupPorChave", () => {
  // O upsert do PostgREST falha INTEIRO quando o mesmo alvo aparece duas vezes
  // no mesmo comando. São duas janelas de consulta por fornecedor: um título
  // repetido entre elas mataria a rodada do dia.
  it("mantém uma linha por chave", () => {
    const linhas = linhasParaEspelho({
      orgId: "org-1",
      titulos: [titulo(), titulo()],
      existentes: [],
      fornecedorPorCodigo: new Map(),
      hojeISO: HOJE,
    });
    expect(linhas).toHaveLength(2);
    expect(dedupPorChave(linhas)).toHaveLength(1);
  });

  it("não junta títulos que só diferem no vencimento", () => {
    const linhas = linhasParaEspelho({
      orgId: "org-1",
      titulos: [titulo(), titulo({ dataVencimento: "2026-09-15" })],
      existentes: [],
      fornecedorPorCodigo: new Map(),
      hojeISO: HOJE,
    });
    expect(dedupPorChave(linhas)).toHaveLength(2);
  });
});
