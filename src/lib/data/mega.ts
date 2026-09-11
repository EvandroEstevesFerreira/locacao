import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import {
  situacaoDoTitulo,
  vencimentoEfetivo,
  dataDePagamento,
  foiProrrogado,
  type SituacaoTitulo,
} from "@/lib/mega/vencimento";

/**
 * Leitura do espelho do Mega.
 *
 * `createClient()` e não admin: o recorte por organização e por papel é da RLS
 * (`mega_titulo` só é visível para master e administrador). Um client admin
 * aqui furaria os dois em silêncio.
 *
 * NUNCA CHAMA A API DO MEGA. Isto lê a tabela que o cron diário encheu. Chamar
 * o ERP por requisição autenticaria em paralelo a cada tela aberta, e a conta
 * `120.apifin` já foi bloqueada exatamente assim.
 */

export type TituloEspelhado = {
  id: string;
  numeroAp: string;
  numeroParcela: string;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  dataVencimento: string;
  /** A data de PAGAR: a prorrogada quando houve renegociação. */
  vencimentoEfetivo: string;
  prorrogado: boolean;
  situacao: SituacaoTitulo;
  valorParcela: number;
  saldoAtual: number;
  quitado: boolean;
  /**
   * O dia em que foi pago, ou `null` se ainda não foi.
   *
   * Vem do ERP (a prorrogação), não da nossa observação. Para "quando o cron
   * viu o saldo zerar", que é outra pergunta, use `quitacaoVistaEm`.
   */
  pagoEm: string | null;
  quitacaoVistaEm: string | null;
};

export type EspelhoDoFornecedor = {
  titulos: TituloEspelhado[];
  pago: number;
  emAberto: number;
  /** Em aberto com a data de pagar já vencida. */
  atrasado: number;
  /** Quando o cron rodou pela última vez. `null` = nunca rodou. */
  sincronizadoEm: string | null;
  ultimoErro: string | null;
};

/**
 * Os títulos que o Mega tem para um fornecedor.
 *
 * `cache()` porque a mesma leitura serve o resumo e a lista dentro da mesma
 * renderização.
 */
export const obterEspelhoDoFornecedor = cache(
  async (fornecedorId: string): Promise<EspelhoDoFornecedor | null> =>
    lerEspelho("fornecedor_id", fornecedorId),
);

/**
 * O mesmo espelho, do lado do imóvel.
 *
 * O aluguel é pago ao LOCADOR, que não é fornecedor: `mega_titulo` aponta para
 * um ou para outro, nunca para os dois (há CHECK no banco). Por isso a leitura
 * muda só a coluna do filtro.
 */
export const obterEspelhoDoImovel = cache(
  async (codigoMega: string): Promise<EspelhoDoFornecedor | null> =>
    lerEspelho("codigo_mega", codigoMega),
);

/**
 * Quantos imóveis dividem o mesmo locador.
 *
 * A TELA PRECISA DIZER ISSO EM VOZ ALTA. Desde abril/2026 a EXPRESSO
 * ENGENHARIA recebe o aluguel de vários imóveis do MPD num agente só; sem o
 * aviso, quem somasse o "pago" de cada tela contaria o mesmo dinheiro N vezes.
 */
export const contarImoveisDoLocador = cache(async (codigoMega: string): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("imovel")
    .select("id", { count: "exact", head: true })
    .eq("codigo_mega", codigoMega)
    .is("deleted_at", null);
  return count ?? 0;
});

const lerEspelho = async (
  coluna: "fornecedor_id" | "codigo_mega",
  id: string,
): Promise<EspelhoDoFornecedor | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mega_titulo")
      .select(
        "id, numero_ap, numero_parcela, tipo_documento, numero_documento, data_vencimento, data_prorrogado, valor_parcela, saldo_atual, quitacao_vista_em",
      )
      .eq(coluna, id)
      .order("data_vencimento", { ascending: true });

    // SEM ACESSO OU SEM ESPELHO, DEVOLVE NULO — e a tela não desenha a seção.
    // Uma seção vazia diria "o Mega não tem nada para este fornecedor", que é
    // afirmação diferente de "eu não sei", e a errada das duas.
    if (error) {
      console.error("lerEspelho:", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;

    const hoje = hojeISOSaoPaulo();

    const titulos: TituloEspelhado[] = data.map((l) => {
      const datas = {
        dataVencimento: l.data_vencimento as string,
        dataProrrogado: (l.data_prorrogado as string | null) ?? null,
      };
      return {
      id: l.id as string,
      numeroAp: l.numero_ap as string,
      numeroParcela: l.numero_parcela as string,
      tipoDocumento: (l.tipo_documento as string) || null,
      numeroDocumento: (l.numero_documento as string) || null,
      dataVencimento: datas.dataVencimento,
      vencimentoEfetivo: vencimentoEfetivo(datas),
      prorrogado: foiProrrogado(datas),
      situacao: situacaoDoTitulo({ ...datas, saldoAtual: Number(l.saldo_atual), hojeISO: hoje }),
      valorParcela: Number(l.valor_parcela),
      saldoAtual: Number(l.saldo_atual),
      quitado: Number(l.saldo_atual) === 0,
      pagoEm: dataDePagamento({ ...datas, saldoAtual: Number(l.saldo_atual) }),
      quitacaoVistaEm: (l.quitacao_vista_em as string | null) ?? null,
      };
    })
      // Pela data de PAGAR, não pela do documento: numa lista ordenada pelo
      // vencimento original, o título prorrogado para março aparece em dezembro.
      .sort((a, b) => a.vencimentoEfetivo.localeCompare(b.vencimentoEfetivo));

    const { data: sync } = await supabase
      .from("mega_sync")
      .select("ultima_rodada_em, ultimo_erro")
      .maybeSingle();

    return {
      titulos,
      // O pago é o VALOR DA PARCELA das quitadas, não o saldo (que é zero).
      pago: titulos.filter((t) => t.quitado).reduce((s, t) => s + t.valorParcela, 0),
      emAberto: titulos.reduce((s, t) => s + t.saldoAtual, 0),
      atrasado: titulos
        .filter((t) => t.situacao === "atrasado")
        .reduce((s, t) => s + t.saldoAtual, 0),
      sincronizadoEm: (sync?.ultima_rodada_em as string | null) ?? null,
      ultimoErro: (sync?.ultimo_erro as string | null) ?? null,
    };
};

export type ContratoEspelhado = {
  id: string;
  codigo: string;
  nome: string | null;
  produto: string | null;
  projetoNome: string | null;
  totalContratado: number;
  medicao: number;
  saldo: number;
};

/**
 * Os contratos que o Mega tem para este fornecedor nesta obra.
 *
 * O RECORTE É FORNECEDOR + OBRA, e não só fornecedor: a CCN tem 19 contratos em
 * 12 obras diferentes. Mostrar todos na tela de um contrato de locação de uma
 * obra só seria ruído — e pior, faria o total parecer o desta obra.
 */
export const obterContratosDoMega = cache(
  async (fornecedorId: string, obraId: string): Promise<ContratoEspelhado[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("mega_contrato")
      .select("id, codigo, nome, produto, projeto_nome, total_contratado, medicao, saldo")
      .eq("fornecedor_id", fornecedorId)
      .eq("obra_id", obraId)
      .order("total_contratado", { ascending: false });

    if (error) {
      console.error("obterContratosDoMega:", error.message);
      return [];
    }

    return (data ?? []).map((c) => ({
      id: c.id as string,
      codigo: c.codigo as string,
      nome: (c.nome as string | null) ?? null,
      produto: (c.produto as string | null) ?? null,
      projetoNome: (c.projeto_nome as string | null) ?? null,
      totalContratado: Number(c.total_contratado),
      medicao: Number(c.medicao),
      saldo: Number(c.saldo),
    }));
  },
);
