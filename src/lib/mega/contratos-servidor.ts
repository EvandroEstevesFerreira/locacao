import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { hojeISOSaoPaulo } from "@/lib/locacao";
import { logger, erroMeta } from "@/lib/logger";
import type { SessaoMega } from "./cliente";
import { janelasDeConsulta } from "./janela";
import { agruparPorContrato } from "./contratos";

/**
 * O espelho dos contratos do Mega.
 *
 * UMA CHAMADA para os 958 contratos da empresa. O filtro do que interessa é em
 * memória, pela mesma razão dos títulos: a resposta traz contratos de 55
 * projetos, e o Loca tem 8 obras — guardar os outros 48 seria coletar além do
 * propósito do sistema.
 */
export async function sincronizarContratos(
  supabase: SupabaseClient,
  orgId: string,
  sessao: SessaoMega,
): Promise<{ vistos: number; recusados: number; semObra: number }> {
  const hoje = hojeISOSaoPaulo();
  const janelas = janelasDeConsulta(hoje);
  // A janela de contratos é UMA só, a mais larga: contrato não "vence" como
  // parcela, e o módulo aceita o intervalo inteiro sem o limite de 2 anos da
  // rota de contas a pagar.
  const inicio = janelas[0].inicio;
  const fim = janelas[janelas.length - 1].fim;

  const [{ data: obras, error: erroObras }, { data: forns, error: erroForns }] =
    await Promise.all([
      supabase.from("obra").select("id, codigo").eq("org_id", orgId).is("deleted_at", null),
      supabase
        .from("fornecedor")
        .select("id, codigo_mega")
        .eq("org_id", orgId)
        .eq("ativo", true)
        .not("codigo_mega", "is", null),
    ]);

  if (erroObras) throw new Error(erroObras.message);
  if (erroForns) throw new Error(erroForns.message);

  const obraPorCodigo = new Map(
    (obras ?? [])
      .filter((o) => o.codigo)
      .map((o) => [String(o.codigo).trim(), o.id as string]),
  );
  const fornPorCodigo = new Map(
    (forns ?? [])
      .filter((f) => f.codigo_mega)
      .map((f) => [String(f.codigo_mega).trim(), f.id as string]),
  );

  const { contratos: itens, recusados } = await sessao.contratos(inicio, fim);

  // CADA LINHA DA RESPOSTA É UM ITEM DO CONTRATO, não o contrato. 958 linhas
  // para 664 contratos; sem agrupar, o upsert morre com "cannot affect row a
  // second time" — foi o que derrubou a primeira rodada em produção.
  const contratos = agruparPorContrato(itens);

  // SÓ AS OBRAS DO LOCA. Os 48 projetos restantes são de outras frentes da
  // Sistenge e não têm nada que fazer aqui.
  const doLoca = contratos.filter(
    (c) => c.codigoProjeto && obraPorCodigo.has(c.codigoProjeto),
  );

  if (doLoca.length === 0) return { vistos: 0, recusados, semObra: contratos.length };

  const agora = new Date().toISOString();
  const linhas = doLoca.map((c) => ({
    org_id: orgId,
    codigo: c.codigo,
    nome: c.nome,
    produto: c.produto,
    itens: c.itens,
    codigo_agente: c.codigoAgente,
    agente_nome: c.agenteNome,
    // Fica NULO quando o fornecedor não está no Loca — o contrato entra assim
    // mesmo, porque o número da obra continua valendo.
    fornecedor_id: c.codigoAgente ? (fornPorCodigo.get(c.codigoAgente) ?? null) : null,
    codigo_projeto: c.codigoProjeto,
    projeto_nome: c.projetoNome,
    obra_id: obraPorCodigo.get(c.codigoProjeto!) ?? null,
    total_contratado: c.totalContratado,
    total_distratado: c.totalDistratado,
    medicao: c.medicao,
    saldo: c.saldo,
    nota: c.nota,
    adiantamento: c.adiantamento,
    criado_em_mega: c.criadoEmMega,
    criado_por: c.criadoPor,
    sincronizado_em: agora,
  }));

  const { error } = await supabase
    .from("mega_contrato")
    .upsert(linhas, { onConflict: "org_id,codigo" });

  if (error) {
    logger.error("mega: falha ao gravar contratos", erroMeta(error));
    throw new Error(error.message);
  }

  return {
    vistos: linhas.length,
    recusados,
    semObra: contratos.length - doLoca.length,
  };
}
