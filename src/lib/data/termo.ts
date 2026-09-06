import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Estado, SituacaoTermo } from "@/lib/termo";

export type FuncionarioLinha = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  matricula: string | null;
  telefone: string | null;
  email: string | null;
  email_confirmado: boolean;
  obra_id: string | null;
  obra_codigo: string | null;
  ativo: boolean;
};

export type TermoLinha = {
  id: string;
  numero_registro: string | null;
  funcionario_nome: string;
  obra_codigo: string | null;
  data_entrega: string;
  previsao_devolucao: string | null;
  situacao: SituacaoTermo;
  itens: number;
};

export type TermoItemLinha = {
  id: string;
  item_id: string;
  item_descricao: string;
  unidade_id: string | null;
  patrimonio: string | null;
  quantidade: number;
  unidade_medida: string | null;
  estado_entrega: Estado;
  estado_devolucao: Estado | null;
  data_devolucao: string | null;
  observacoes: string | null;
};

export type AssinaturaLinha = {
  momento: "entrega" | "devolucao";
  papel: "funcionario" | "empresa";
  nome: string;
  cpf: string | null;
  imagem: string | null;
  assinado_em: string;
  assinado_ip: string | null;
};

export type TermoDetalhe = {
  id: string;
  numero_registro: string | null;
  funcionario_id: string;
  funcionario_nome: string;
  funcionario_cpf: string | null;
  funcionario_cargo: string | null;
  obra_id: string | null;
  obra_codigo: string | null;
  obra_nome: string | null;
  contrato_id: string | null;
  data_entrega: string;
  previsao_devolucao: string | null;
  emitido_em: string | null;
  encerrado_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  observacoes: string | null;
  situacao: SituacaoTermo;
  itens: TermoItemLinha[];
  assinaturas: AssinaturaLinha[];
};

/** Erro em leitura de lista: registra e devolve vazio. */
export async function listarFuncionarios(
  opts: { busca?: string; apenasAtivos?: boolean } = {},
): Promise<FuncionarioLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("funcionario")
    .select(
      "id, nome, cpf, cargo, matricula, telefone, email, email_confirmado, obra_id, ativo, obra:obra_id(codigo)",
    )
    .order("nome");
  if (opts.apenasAtivos) q = q.eq("ativo", true);
  if (opts.busca) q = q.ilike("nome", `%${opts.busca}%`);

  const { data, error } = await q;
  if (error) {
    console.error("listarFuncionarios", error);
    return [];
  }
  return (data ?? []).map((f) => {
    const obra = f.obra as { codigo: string } | { codigo: string }[] | null;
    return {
      id: f.id,
      nome: f.nome,
      cpf: f.cpf,
      cargo: f.cargo,
      matricula: f.matricula,
      telefone: f.telefone,
      email: f.email,
      email_confirmado: f.email_confirmado,
      obra_id: f.obra_id,
      obra_codigo: Array.isArray(obra) ? (obra[0]?.codigo ?? null) : (obra?.codigo ?? null),
      ativo: f.ativo,
    };
  });
}

export async function listarTermos(opts: {
  busca?: string;
  obraId?: string;
  situacao?: string;
  from: number;
  to: number;
  sort: string;
  ascending: boolean;
}): Promise<{ linhas: TermoLinha[]; total: number }> {
  const supabase = await createClient();

  let q = supabase
    .from("termo_equipamento")
    .select(
      "id, numero_registro, data_entrega, previsao_devolucao, " +
        "funcionario:funcionario_id(nome), obra:obra_id(codigo), " +
        "termo_equipamento_item(count), situacao:termo_equipamento_situacao(situacao)",
      { count: "exact" },
    );
  if (opts.obraId) q = q.eq("obra_id", opts.obraId);
  if (opts.busca) q = q.ilike("funcionario.nome", `%${opts.busca}%`);

  const { data, error, count } = await q
    .order(opts.sort, { ascending: opts.ascending })
    .range(opts.from, opts.to);
  if (error) {
    console.error("listarTermos", error);
    return { linhas: [], total: 0 };
  }

  // Mesmo motivo do `obterTermo`: sem tipos gerados, o join da view derruba a
  // inferência do PostgREST para `GenericStringError`.
  const linhas = ((data ?? []) as unknown as Record<string, unknown>[]).map((t) => {
    const f = t.funcionario as { nome: string } | { nome: string }[] | null;
    const o = t.obra as { codigo: string } | { codigo: string }[] | null;
    const s = t.situacao as { situacao: string } | { situacao: string }[] | null;
    const c = t.termo_equipamento_item as { count: number }[] | null;
    return {
      id: t.id as string,
      numero_registro: t.numero_registro as string | null,
      funcionario_nome: Array.isArray(f) ? (f[0]?.nome ?? "—") : (f?.nome ?? "—"),
      obra_codigo: Array.isArray(o) ? (o[0]?.codigo ?? null) : (o?.codigo ?? null),
      data_entrega: t.data_entrega as string,
      previsao_devolucao: t.previsao_devolucao as string | null,
      situacao: (Array.isArray(s) ? s[0]?.situacao : s?.situacao) as SituacaoTermo,
      itens: c?.[0]?.count ?? 0,
    };
  });

  // Filtro de situação depois da consulta: `situacao` vem de view relacionada e
  // o PostgREST não filtra por coluna de embed sem `!inner`, que mudaria a
  // cardinalidade da contagem.
  const filtradas = opts.situacao
    ? linhas.filter((l) => l.situacao === opts.situacao)
    : linhas;

  return { linhas: filtradas, total: count ?? 0 };
}

/** Erro em detalhe: devolve null e a página chama `notFound()`. */
export async function obterTermo(id: string): Promise<TermoDetalhe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("termo_equipamento")
    .select(
      "*, funcionario:funcionario_id(nome, cpf, cargo), obra:obra_id(codigo, nome), " +
        "situacao:termo_equipamento_situacao(situacao), " +
        "termo_equipamento_item(id, item_id, unidade_id, quantidade, estado_entrega, " +
        "estado_devolucao, data_devolucao, observacoes, " +
        "item:item_id(descricao, unidade), unidade:unidade_id(identificador)), " +
        "termo_assinatura(momento, papel, nome, cpf, imagem, assinado_em, assinado_ip)",
    )
    .eq("id", id)
    .single();
  if (error || !data) {
    if (error) console.error("obterTermo", error);
    return null;
  }

  // Tipagem explícita: o cliente Supabase deste projeto não tem tipos gerados,
  // então a inferência do PostgREST é por análise da string do `select` — e o
  // `*` combinado com o join da view `termo_equipamento_situacao` a derruba para
  // `GenericStringError`. Mesmo padrão de `data/frota.ts` e `data/custo-item.ts`.
  const bruto = data as unknown as Record<string, unknown>;

  const f = bruto.funcionario as { nome: string; cpf: string | null; cargo: string | null } | null;
  const o = bruto.obra as { codigo: string; nome: string } | null;
  const s = bruto.situacao as { situacao: string } | { situacao: string }[] | null;

  return {
    id: bruto.id as string,
    numero_registro: bruto.numero_registro as string | null,
    funcionario_id: bruto.funcionario_id as string,
    funcionario_nome: f?.nome ?? "—",
    funcionario_cpf: f?.cpf ?? null,
    funcionario_cargo: f?.cargo ?? null,
    obra_id: bruto.obra_id as string | null,
    obra_codigo: o?.codigo ?? null,
    obra_nome: o?.nome ?? null,
    contrato_id: bruto.contrato_id as string | null,
    data_entrega: bruto.data_entrega as string,
    previsao_devolucao: bruto.previsao_devolucao as string | null,
    emitido_em: bruto.emitido_em as string | null,
    encerrado_em: bruto.encerrado_em as string | null,
    cancelado_em: bruto.cancelado_em as string | null,
    motivo_cancelamento: bruto.motivo_cancelamento as string | null,
    observacoes: bruto.observacoes as string | null,
    situacao: (Array.isArray(s) ? s[0]?.situacao : s?.situacao) as SituacaoTermo,
    itens: ((bruto.termo_equipamento_item ?? []) as Record<string, unknown>[]).map((i: Record<string, unknown>) => {
      const item = i.item as { descricao: string; unidade: string | null } | null;
      const un = i.unidade as { identificador: string } | null;
      return {
        id: i.id as string,
        item_id: i.item_id as string,
        item_descricao: item?.descricao ?? "—",
        unidade_id: (i.unidade_id as string | null) ?? null,
        patrimonio: un?.identificador ?? null,
        quantidade: Number(i.quantidade),
        unidade_medida: item?.unidade ?? null,
        estado_entrega: i.estado_entrega as Estado,
        estado_devolucao: (i.estado_devolucao as Estado | null) ?? null,
        data_devolucao: (i.data_devolucao as string | null) ?? null,
        observacoes: (i.observacoes as string | null) ?? null,
      };
    }),
    assinaturas: ((bruto.termo_assinatura ?? []) as Record<string, unknown>[]) as AssinaturaLinha[],
  };
}
