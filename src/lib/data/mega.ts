import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

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
  valorParcela: number;
  saldoAtual: number;
  quitado: boolean;
  quitacaoVistaEm: string | null;
};

export type EspelhoDoFornecedor = {
  titulos: TituloEspelhado[];
  pago: number;
  emAberto: number;
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
  async (fornecedorId: string): Promise<EspelhoDoFornecedor | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mega_titulo")
      .select(
        "id, numero_ap, numero_parcela, tipo_documento, numero_documento, data_vencimento, valor_parcela, saldo_atual, quitacao_vista_em",
      )
      .eq("fornecedor_id", fornecedorId)
      .order("data_vencimento", { ascending: true });

    // SEM ACESSO OU SEM ESPELHO, DEVOLVE NULO — e a tela não desenha a seção.
    // Uma seção vazia diria "o Mega não tem nada para este fornecedor", que é
    // afirmação diferente de "eu não sei", e a errada das duas.
    if (error) {
      console.error("obterEspelhoDoFornecedor:", error.message);
      return null;
    }
    if (!data || data.length === 0) return null;

    const titulos: TituloEspelhado[] = data.map((l) => ({
      id: l.id as string,
      numeroAp: l.numero_ap as string,
      numeroParcela: l.numero_parcela as string,
      tipoDocumento: (l.tipo_documento as string) || null,
      numeroDocumento: (l.numero_documento as string) || null,
      dataVencimento: l.data_vencimento as string,
      valorParcela: Number(l.valor_parcela),
      saldoAtual: Number(l.saldo_atual),
      quitado: Number(l.saldo_atual) === 0,
      quitacaoVistaEm: (l.quitacao_vista_em as string | null) ?? null,
    }));

    const { data: sync } = await supabase
      .from("mega_sync")
      .select("ultima_rodada_em, ultimo_erro")
      .maybeSingle();

    return {
      titulos,
      // O pago é o VALOR DA PARCELA das quitadas, não o saldo (que é zero).
      pago: titulos.filter((t) => t.quitado).reduce((s, t) => s + t.valorParcela, 0),
      emAberto: titulos.reduce((s, t) => s + t.saldoAtual, 0),
      sincronizadoEm: (sync?.ultima_rodada_em as string | null) ?? null,
      ultimoErro: (sync?.ultimo_erro as string | null) ?? null,
    };
  },
);
