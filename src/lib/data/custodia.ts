import "server-only";
import {
  donoDaPeca,
  linhasElegiveis,
  type DonoDaPeca,
  type LinhaEmAberto,
} from "@/lib/frota";

import { createClient } from "@/lib/supabase/server";
import type { Posse, TipoDetentor } from "@/lib/custodia";
import type { Situacao, Propriedade, Estado } from "@/lib/frota";

import type { UnidadeMedidor } from "@/lib/catalogo";
import { camposFichaSchema, type CampoFicha } from "@/lib/catalogo";

export type PecaDetalhe = {
  /** Peças com horímetro entram no apontamento de uso (migration 0071). */
  temMedidor: boolean;
  /** `h` ou `km`. Nulo quando o tipo não define revisão por uso. */
  unidadeMedidor: UnidadeMedidor | null;
  /** Valores dos campos definidos pelo tipo do item (migration 0070). */
  ficha: Record<string, unknown>;
  /** A definição desses campos, para o formulário saber o que desenhar. */
  camposDoTipo: CampoFicha[];
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
        "memoria_gb, configuracao, ficha, tem_medidor, " +
        "item:item_id(descricao, tipo:tipo_id(campos_ficha, unidade_medidor), categoria:categoria_id(nome, perfil_campos)), " +
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
    tipo: { campos_ficha: unknown; unidade_medidor: string | null } | null;
    categoria: { nome: string; perfil_campos: string } | null;
  } | null;

  // A definição passa pelo schema em vez de ser confiada: a coluna é jsonb com
  // um check que só garante ser array, e um campo gravado com forma errada
  // derrubaria a tela da peça em vez de ser ignorado.
  const definicao = camposFichaSchema.safeParse(item?.tipo?.campos_ficha ?? []);
  if (!definicao.success) {
    console.error("obterPeca: campos_ficha inválido", definicao.error.issues[0]);
  }
  const obra = b.obra as { codigo: string; nome: string } | null;

  return {
    // `?? {}` e não o valor cru: a coluna é `not null default '{}'`, mas uma
    // linha antiga lida antes da 0070 chegaria como `undefined` — e o
    // formulário faria `Object.keys(undefined)`.
    temMedidor: Boolean(b.tem_medidor),
    // A unidade vem do TIPO e desce até os rótulos: sem ela a tela diria “h”
    // no hodômetro de um carro, e a leitura de 48.000 viraria “48.000 h”.
    unidadeMedidor: (item?.tipo?.unidade_medidor as UnidadeMedidor | null) ?? null,
    ficha: (b.ficha as Record<string, unknown> | null) ?? {},
    camposDoTipo: definicao.success ? definicao.data : [],
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
      "id, tipo, inicio, fim, origem, termo_id, observacoes, detentor_rotulo, " +
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
      // O snapshot da migration 0062 vem antes do vínculo em
      // `descreverDetentor`: o embed abaixo respeita a RLS da tabela embutida,
      // e `soft_delete` de obra apagaria o nome dela do histórico inteiro.
      detentorRotulo: (l.detentor_rotulo as string | null) ?? null,
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

/**
 * A empresa responsável pela peça, derivada do contrato.
 *
 * Função própria em vez de campos novos no select de `obterPeca`: as linhas em
 * aberto vêm de `item_locado`, outra tabela, e o AGENTS.md é explícito sobre
 * mexer em string de select — `!inner` e `count` mudam cardinalidade em
 * silêncio. Duas consultas em paralelo custam menos que um join que ninguém
 * confere.
 *
 * Devolve o tipo PLANO de `donoDaPeca`, e não as linhas cruas: a página não
 * precisa saber que "em aberto" é `status = 'em_aberto'` em `item_locado`.
 *
 * Devolve TAMBÉM o id do provisório, ao lado do `dono`. A função pura recebe e
 * expõe o NOME, que é o que a tela mostra; o formulário precisa do id para abrir
 * no valor atual. Buscar o id numa segunda leitura, ou fazer `donoDaPeca` levar
 * um objeto só para carregar o id até a tela, seriam os dois piores.
 */
export async function obterDonoDaPeca(
  pecaId: string,
): Promise<{ dono: DonoDaPeca; provisorioId: string | null }> {
  const supabase = await createClient();
  const [linhasRes, pecaRes] = await Promise.all([
    supabase
      .from("item_locado")
      .select("id, contrato:contrato_id(id, numero, fornecedor:fornecedor_id(nome))")
      .eq("unidade_id", pecaId)
      .eq("status", "em_aberto"),
    supabase
      .from("equipamento_unidade")
      .select("fornecedor_provisorio_id, fornecedor_provisorio:fornecedor_provisorio_id(nome)")
      .eq("id", pecaId)
      .maybeSingle(),
  ]);

  type LinhaBruta = {
    id: string;
    contrato: {
      id: string;
      numero: string;
      fornecedor: { nome: string } | null;
    } | null;
  };
  const brutas = (linhasRes.data ?? []) as unknown as LinhaBruta[];

  const linhasEmAberto: LinhaEmAberto[] = brutas
    // Linha sem contrato não existe no modelo (a FK é obrigatória), mas o
    // PostgREST devolve `null` quando a RLS esconde o contrato — e nesse caso o
    // usuário não pode saber de quem é a peça por aquele caminho.
    .filter((l) => l.contrato !== null)
    .map((l) => ({
      itemLocadoId: l.id,
      contratoId: l.contrato!.id,
      contratoNumero: l.contrato!.numero,
      fornecedorNome: l.contrato!.fornecedor?.nome ?? null,
    }));

  const prov = pecaRes.data as unknown as {
    fornecedor_provisorio_id: string | null;
    fornecedor_provisorio: { nome: string } | null;
  } | null;

  return {
    dono: donoDaPeca({
      linhasEmAberto,
      fornecedorProvisorio: prov?.fornecedor_provisorio?.nome ?? null,
    }),
    provisorioId: prov?.fornecedor_provisorio_id ?? null,
  };
}

/**
 * Os contratos a que esta peça pode ser amarrada, com a linha de destino.
 *
 * Só oferece contrato que TENHA linha elegível — as quatro condições de
 * `linhasElegiveis`. Um seletor que listasse todos os contratos e falhasse na
 * hora de salvar faria a pessoa tentar três antes de entender o critério.
 */
export async function listarContratosParaAmarrar(peca: {
  id: string;
  itemId: string;
}): Promise<{ itemLocadoId: string; contratoNumero: string; obra: string | null }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("item_locado")
    .select(
      "id, contrato_id, item_id, status, unidade_id, " +
        "contrato:contrato_id(numero, obra:obra_id(codigo))",
    )
    .eq("item_id", peca.itemId);

  type Bruta = {
    id: string;
    contrato_id: string;
    item_id: string;
    status: "em_aberto" | "devolvido";
    unidade_id: string | null;
    contrato: { numero: string; obra: { codigo: string } | null } | null;
  };
  const linhas = (data ?? []) as unknown as Bruta[];

  return linhasElegiveis(
    linhas.map((l) => ({
      id: l.id,
      contratoId: l.contrato_id,
      itemId: l.item_id,
      status: l.status,
      unidadeId: l.unidade_id,
    })),
    peca,
  ).map((elegivel) => {
    const bruta = linhas.find((l) => l.id === elegivel.id)!;
    return {
      itemLocadoId: elegivel.id,
      contratoNumero: bruta.contrato?.numero ?? "—",
      obra: bruta.contrato?.obra?.codigo ?? null,
    };
  });
}
