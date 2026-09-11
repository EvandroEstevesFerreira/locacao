import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { hojeISOSaoPaulo } from "@/lib/locacao";
import { logger, erroMeta } from "@/lib/logger";
import { SessaoMega } from "./cliente";
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

type ComCodigo = { id: string; codigo_mega: string | null };

/** Os códigos do Mega que o Loca conhece: fornecedores e locadores de imóvel. */
async function codigosConhecidos(supabase: SupabaseClient, orgId: string) {
  const [forn, imov] = await Promise.all([
    supabase
      .from("fornecedor")
      .select("id, codigo_mega")
      .eq("org_id", orgId)
      // `ativo`, NÃO `deleted_at`: a tabela de fornecedor não tem soft delete.
      // Com a coluna errada o PostgREST recusa a consulta INTEIRA, `data` volta
      // nulo, e a rodada leria zero fornecedores todo dia sem erro no log.
      .eq("ativo", true)
      .not("codigo_mega", "is", null),
    supabase
      .from("imovel")
      .select("id, codigo_mega")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .not("codigo_mega", "is", null),
  ]);

  if (forn.error) throw new Error(forn.error.message);
  if (imov.error) throw new Error(imov.error.message);

  const validos = (linhas: ComCodigo[] | null) =>
    (linhas ?? []).filter((l): l is { id: string; codigo_mega: string } =>
      Boolean(l.codigo_mega?.trim()),
    );

  // Fornecedor: um código, um fornecedor (há índice único em `codigo_mega`).
  const fornecedorPorCodigo = new Map(
    validos(forn.data as ComCodigo[] | null).map((l) => [l.codigo_mega.trim(), l.id]),
  );

  // Imóvel: um código pode ser de VÁRIOS — a imobiliária que administra o
  // conjunto. Agrupar em lista é o que impede o último cadastrado de ficar com
  // os títulos de todos.
  const imovelPorCodigo = new Map<string, string[]>();
  for (const l of validos(imov.data as ComCodigo[] | null)) {
    const cod = l.codigo_mega.trim();
    imovelPorCodigo.set(cod, [...(imovelPorCodigo.get(cod) ?? []), l.id]);
  }

  return { fornecedorPorCodigo, imovelPorCodigo };
}

export async function sincronizarOrg(
  supabase: SupabaseClient,
  orgId: string,
  sessao: SessaoMega,
): Promise<ResumoRodada> {
  const hoje = hojeISOSaoPaulo();
  const janelas = janelasDeConsulta(hoje);
  const { fornecedorPorCodigo, imovelPorCodigo } = await codigosConhecidos(supabase, orgId);

  const resumo: ResumoRodada = {
    fornecedoresLidos: 0,
    titulosVistos: 0,
    recusados: 0,
    falhas: [],
  };

  const conhecidos = new Set([...fornecedorPorCodigo.keys(), ...imovelPorCodigo.keys()]);
  if (conhecidos.size === 0) return resumo;

  // DUAS CHAMADAS NA RODADA INTEIRA, e não uma por fornecedor.
  //
  // A rota por período traz TODAS as parcelas da Sistenge — 458 num mês, de 224
  // agentes. Consultar agente a agente eram 74 chamadas diárias contra a conta
  // `120.apifin`, que já foi bloqueada uma vez e é compartilhada com o
  // Financeiro.
  const todos = [];
  for (const j of janelas) {
    const r = await sessao.titulosDoPeriodo(j.inicio, j.fim);
    todos.push(...r.titulos);
    resumo.recusados += r.recusados;
  }

  // O FILTRO É EM MEMÓRIA, E É DELIBERADO. A resposta traz tudo que a empresa
  // paga: folha, vale-transporte, impostos, veículos. Guardar isso no Loca
  // seria coletar muito além do propósito do sistema — decisão do Evandro em
  // 10/09/2026. Só entra agente que o Loca já conhece.
  const doLoca = todos.filter((t) => conhecidos.has(t.codigoAgente));

  const porCodigo = new Map<string, typeof doLoca>();
  for (const t of doLoca) {
    const lista = porCodigo.get(t.codigoAgente) ?? [];
    lista.push(t);
    porCodigo.set(t.codigoAgente, lista);
  }

  for (const [codigo, titulos] of porCodigo) {
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
        fornecedorPorCodigo,
        imovelPorCodigo,
        hojeISO: hoje,
      }),
    );

    const { error: erroUpsert } = await supabase.from("mega_titulo").upsert(linhas, {
      onConflict:
        "org_id,codigo_mega,numero_ap,numero_parcela,tipo_documento,numero_documento,data_vencimento,valor_parcela",
    });

    if (erroUpsert) {
      logger.error("mega: falha ao gravar o espelho", { codigo, ...erroMeta(erroUpsert) });
      resumo.falhas.push({ codigo, motivo: erroUpsert.message });
      continue;
    }

    resumo.fornecedoresLidos += 1;
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
