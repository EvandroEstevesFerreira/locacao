import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { hojeISOSaoPaulo } from "@/lib/locacao";
import { logger, erroMeta } from "@/lib/logger";
import { SessaoMega, ErroMega } from "./cliente";
import { janelasDeConsulta } from "./janela";
import {
  chaveDoTitulo,
  dedupPorChave,
  linhasParaEspelho,
  type LinhaExistente,
  type ResumoRodada,
} from "./espelho";

/**
 * A sincronização do espelho do Mega, uma organização por vez.
 *
 * Recebe o `supabase` de quem chama (o cron, com service role), seguindo a
 * regra do AGENTS.md para escrita compartilhada.
 */

type Fornecedor = { id: string; codigo_mega: string | null };

export async function sincronizarOrg(
  supabase: SupabaseClient,
  orgId: string,
  sessao: SessaoMega,
): Promise<ResumoRodada> {
  const hoje = hojeISOSaoPaulo();
  const janelas = janelasDeConsulta(hoje);

  const { data: fornecedores, error: erroForn } = await supabase
    .from("fornecedor")
    .select("id, codigo_mega")
    .eq("org_id", orgId)
    // `ativo`, NÃO `deleted_at`: a tabela de fornecedor não tem soft delete. Com
    // a coluna errada o PostgREST recusa a consulta INTEIRA, `data` volta nulo e
    // a rodada leria zero fornecedores todo dia, sem erro nenhum no log.
    .eq("ativo", true)
    .not("codigo_mega", "is", null);

  if (erroForn) throw new Error(erroForn.message);

  const lista = ((fornecedores ?? []) as Fornecedor[]).filter(
    (f): f is { id: string; codigo_mega: string } => Boolean(f.codigo_mega?.trim()),
  );

  const porCodigo = new Map(lista.map((f) => [f.codigo_mega.trim(), f.id]));

  const resumo: ResumoRodada = {
    fornecedoresLidos: 0,
    titulosVistos: 0,
    recusados: 0,
    falhas: [],
  };

  // SEQUENCIAL, NÃO EM PARALELO. Um Promise.all de 36 fornecedores dispara 36
  // chamadas simultâneas à conta `120.apifin` — que já foi bloqueada uma vez, e
  // que o projeto Financeiro também usa. A rodada é diária: não há pressa que
  // pague esse risco.
  for (const codigo of porCodigo.keys()) {
    // DUAS JANELAS POR FORNECEDOR porque o Mega recusa intervalo maior que
    // 2 anos, e locação é plurianual. Sequenciais, como tudo aqui.
    const titulos = [];
    let recusados = 0;
    try {
      for (const j of janelas) {
        const r = await sessao.titulosDoFornecedor(codigo, j.inicio, j.fim);
        titulos.push(...r.titulos);
        recusados += r.recusados;
      }
    } catch (e) {
      // FALHA DE AUTENTICAÇÃO ABORTA A RODADA INTEIRA. Continuar o laço
      // tentaria autenticar de novo a cada fornecedor — que é exatamente o
      // encadeamento que bloqueia a conta no ERP.
      if (e instanceof ErroMega && (e.status === 401 || e.status === 403)) throw e;
      resumo.falhas.push({
        codigo,
        motivo: e instanceof Error ? e.message : "Falha desconhecida.",
      });
      continue;
    }

    resumo.fornecedoresLidos += 1;
    resumo.recusados += recusados;
    if (titulos.length === 0) continue;

    const { data: antigas, error: erroAntigas } = await supabase
      .from("mega_titulo")
      .select(
        "codigo_mega, numero_ap, numero_parcela, tipo_documento, numero_documento, data_vencimento, valor_parcela, quitacao_vista_em",
      )
      .eq("org_id", orgId)
      .eq("codigo_mega", codigo);

    if (erroAntigas) throw new Error(erroAntigas.message);

    const existentes: LinhaExistente[] = (antigas ?? []).map((l) => ({
      chave: chaveDoTitulo({
        codigoAgente: l.codigo_mega as string,
        numeroAp: l.numero_ap as string,
        numeroParcela: l.numero_parcela as string,
        tipoDocumento: l.tipo_documento as string,
        numeroDocumento: l.numero_documento as string,
        dataVencimento: l.data_vencimento as string,
        valorParcela: Number(l.valor_parcela),
      }),
      quitacao_vista_em: (l.quitacao_vista_em as string | null) ?? null,
    }));

    const linhas = dedupPorChave(
      linhasParaEspelho({
        orgId,
        titulos,
        existentes,
        fornecedorPorCodigo: porCodigo,
        hojeISO: hoje,
      }),
    );

    const { error: erroUpsert } = await supabase.from("mega_titulo").upsert(linhas, {
      onConflict:
        "org_id,codigo_mega,numero_ap,numero_parcela,tipo_documento,numero_documento,data_vencimento,valor_parcela",
    });

    if (erroUpsert) {
      logger.error("mega: falha ao gravar o espelho", {
        codigo,
        ...erroMeta(erroUpsert),
      });
      resumo.falhas.push({ codigo, motivo: erroUpsert.message });
      continue;
    }

    resumo.titulosVistos += linhas.length;
  }

  return resumo;
}

/** Grava o resultado da rodada, para a tela saber se o dado é fresco. */
export async function registrarRodada(
  supabase: SupabaseClient,
  orgId: string,
  resumo: ResumoRodada | null,
  erro: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("mega_sync")
    .update({
      ultima_rodada_em: new Date().toISOString(),
      ultimo_erro: erro,
      titulos_vistos: resumo?.titulosVistos ?? 0,
      fornecedores_lidos: resumo?.fornecedoresLidos ?? 0,
    })
    .eq("org_id", orgId);

  if (error) {
    logger.error("mega: não consegui registrar a rodada", erroMeta(error));
  }
}
