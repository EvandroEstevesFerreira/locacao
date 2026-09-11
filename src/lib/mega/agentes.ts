import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger, erroMeta } from "@/lib/logger";
import type { SessaoMega } from "./cliente";

/**
 * O cache de agentes do Mega.
 *
 * POR QUE ELE EXISTE: a rota de contas a pagar por período devolve
 * `Agente.Nome` e `Agente.Cnpj` NULOS — só o código vem preenchido (medido em
 * 10/09/2026: 458 parcelas, 224 agentes, zero nomes). O nome sai de
 * `/api/globalagente/Agente/{id}`, uma chamada por agente.
 *
 * Resolver 224 códigos toda manhã seriam 224 chamadas diárias contra a conta
 * `120.apifin`. Resolvidos uma vez, ficam — e o custo vira zero.
 */

/**
 * Resolve os códigos que ainda não estão no cache.
 *
 * SEQUENCIAL E COM TETO. São centenas de chamadas na primeira vez, e a conta de
 * API é compartilhada com o Financeiro: um `Promise.all` aqui seria o pior uso
 * possível dela. O teto existe para uma rodada não virar uma varredura da base
 * inteira do ERP por acidente.
 */
export async function resolverAgentes(
  supabase: SupabaseClient,
  orgId: string,
  sessao: SessaoMega,
  codigos: string[],
  { teto = 300 }: { teto?: number } = {},
): Promise<{ resolvidos: number; naoEncontrados: number; pulados: number }> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];

  const { data: jaTemos, error } = await supabase
    .from("mega_agente")
    .select("codigo")
    .eq("org_id", orgId);

  if (error) throw new Error(error.message);

  const conhecidos = new Set((jaTemos ?? []).map((l) => l.codigo as string));
  const faltando = unicos.filter((c) => !conhecidos.has(c));

  const alvo = faltando.slice(0, teto);
  let resolvidos = 0;
  let naoEncontrados = 0;

  for (const codigo of alvo) {
    const agente = await sessao.agentePorCodigo(codigo);
    if (!agente) {
      naoEncontrados += 1;
      continue;
    }
    const { error: erroGravar } = await supabase.from("mega_agente").upsert(
      {
        org_id: orgId,
        codigo,
        nome: agente.nome,
        cnpj: agente.cnpj,
        documento: agente.documento,
        resolvido_em: new Date().toISOString(),
      },
      { onConflict: "org_id,codigo" },
    );
    if (erroGravar) {
      logger.error("mega: falha ao gravar agente", { codigo, ...erroMeta(erroGravar) });
      continue;
    }
    resolvidos += 1;
  }

  return { resolvidos, naoEncontrados, pulados: faltando.length - alvo.length };
}
