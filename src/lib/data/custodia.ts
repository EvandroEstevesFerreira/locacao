import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Posse, TipoDetentor } from "@/lib/custodia";
import type { Situacao, Propriedade, Estado } from "@/lib/frota";

export type PecaDetalhe = {
  id: string;
  identificador: string;
  numeroSerie: string | null;
  situacao: Situacao;
  propriedade: Propriedade;
  estado: Estado | null;
  ano: number | null;
  observacoes: string | null;
  itemId: string;
  itemDescricao: string;
  categoriaNome: string | null;
  /** 'geral' | 'ti' — governa se o bloco de campos de TI aparece. */
  perfilCampos: string;
  obraId: string | null;
  obraRotulo: string | null;
  imei: string | null;
  imei2: string | null;
  linhaTelefonica: string | null;
  operadora: string | null;
  serviceTag: string | null;
  memoriaGb: number | null;
  configuracao: string | null;
};

/** Erro em detalhe: devolve null e a página chama `notFound()`. */
export async function obterPeca(id: string): Promise<PecaDetalhe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select(
      "id, identificador, numero_serie, situacao, propriedade, estado, ano, observacoes, " +
        "obra_id, item_id, imei, imei_2, linha_telefonica, operadora, service_tag, " +
        "memoria_gb, configuracao, " +
        "item:item_id(descricao, categoria:categoria_id(nome, perfil_campos)), " +
        "obra:obra_id(codigo, nome)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error) console.error("obterPeca", error);
    return null;
  }

  // Tipagem explícita: este projeto não tem tipos gerados do Supabase, então a
  // inferência do PostgREST é por análise da string do select e cai para
  // `GenericStringError` com join aninhado. Mesmo padrão de `data/termo.ts`.
  const b = data as unknown as Record<string, unknown>;
  const item = b.item as {
    descricao: string;
    categoria: { nome: string; perfil_campos: string } | null;
  } | null;
  const obra = b.obra as { codigo: string; nome: string } | null;

  return {
    id: b.id as string,
    identificador: b.identificador as string,
    numeroSerie: (b.numero_serie as string | null) ?? null,
    situacao: b.situacao as Situacao,
    propriedade: b.propriedade as Propriedade,
    estado: (b.estado as Estado | null) ?? null,
    ano: b.ano === null || b.ano === undefined ? null : Number(b.ano),
    observacoes: (b.observacoes as string | null) ?? null,
    itemId: b.item_id as string,
    itemDescricao: item?.descricao ?? "—",
    categoriaNome: item?.categoria?.nome ?? null,
    perfilCampos: item?.categoria?.perfil_campos ?? "geral",
    obraId: (b.obra_id as string | null) ?? null,
    obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
    imei: (b.imei as string | null) ?? null,
    imei2: (b.imei_2 as string | null) ?? null,
    linhaTelefonica: (b.linha_telefonica as string | null) ?? null,
    operadora: (b.operadora as string | null) ?? null,
    serviceTag: (b.service_tag as string | null) ?? null,
    memoriaGb:
      b.memoria_gb === null || b.memoria_gb === undefined ? null : Number(b.memoria_gb),
    configuracao: (b.configuracao as string | null) ?? null,
  };
}

/**
 * As posses da peça, mais novas primeiro. A ordenação FINAL é de
 * `montarLinhaDoTempo`, que põe a aberta no topo — aqui só garantimos ordem
 * estável antes do cálculo.
 *
 * Erro em lista: registra e devolve vazio.
 */
export async function listarPossesDaPeca(unidadeId: string): Promise<Posse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custodia_peca")
    .select(
      "id, tipo, inicio, fim, origem, termo_id, observacoes, " +
        "obra:obra_id(codigo, nome), funcionario:funcionario_id(nome), " +
        "fornecedor:fornecedor_id(nome), " +
        "termo:termo_id(numero_registro, cancelado_em)",
    )
    .eq("unidade_id", unidadeId)
    .order("inicio", { ascending: false });

  if (error || !data) {
    if (error) console.error("listarPossesDaPeca", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => {
    const obra = l.obra as { codigo: string; nome: string } | null;
    const func = l.funcionario as { nome: string } | null;
    const forn = l.fornecedor as { nome: string } | null;
    const termo = l.termo as {
      numero_registro: string | null;
      cancelado_em: string | null;
    } | null;

    return {
      id: l.id as string,
      tipo: l.tipo as TipoDetentor,
      obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
      funcionarioNome: func?.nome ?? null,
      fornecedorNome: forn?.nome ?? null,
      inicio: l.inicio as string,
      fim: (l.fim as string | null) ?? null,
      origem: l.origem as "termo" | "manual",
      termoId: (l.termo_id as string | null) ?? null,
      termoNumero: termo?.numero_registro ?? null,
      termoCancelado: Boolean(termo?.cancelado_em),
      observacoes: (l.observacoes as string | null) ?? null,
    };
  });
}

/**
 * Destinos possíveis de uma movimentação, para os selects da tela.
 *
 * `obra` tem `deleted_at` (migration 0032) e precisa do filtro: sem ele, uma
 * obra excluída apareceria como destino, e abrir posse apontando para ela
 * registraria a peça num lugar que não deveria existir. `fornecedor` NÃO tem
 * `deleted_at` — só `ativo` — então aqui o filtro é só `.eq("ativo", true)`.
 */
export async function listarObrasEFornecedores(): Promise<{
  obras: { id: string; rotulo: string }[];
  fornecedores: { id: string; nome: string }[];
}> {
  const supabase = await createClient();
  const [{ data: obras }, { data: fornecedores }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").is("deleted_at", null).order("codigo"),
    supabase.from("fornecedor").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return {
    obras: ((obras ?? []) as unknown as { id: string; codigo: string; nome: string }[]).map(
      (o) => ({ id: o.id, rotulo: `${o.codigo} — ${o.nome}` }),
    ),
    fornecedores: (fornecedores ?? []) as unknown as { id: string; nome: string }[],
  };
}
