import "server-only";

import { createClient } from "@/lib/supabase/server";

// Leituras do alojamento: medidas disciplinares e entregas ao ocupante.
//
// `createClient()`, nunca `createAdminClient()`. O isolamento por organização
// aqui depende de RLS — e, no caso da medida disciplinar, a RLS é a ÚNICA coisa
// que impede um usuário operacional de ler a advertência de um colega. Um
// `.from(...)` com client admin faria isso vazar em silêncio, e nenhum teste
// pegaria.

export type MedidaLista = {
  id: string;
  data: string;
  tipo: string;
  suspensao_dias: number | null;
  fato_descricao: string;
  ciencia: string | null;
  ocupante_id: string;
  ocupante_nome: string;
};

export type EntregaLista = {
  id: string;
  tipo: string;
  entregue_em: string | null;
  devolvido_em: string | null;
  tratativa: string | null;
  ocupante_id: string;
  ocupante_nome: string;
};

/**
 * Medidas disciplinares de um imóvel.
 *
 * Devolve vazio quando o usuário não tem permissão de leitura — a policy de
 * SELECT esconde as linhas, e isso é o comportamento desejado: quem não pode
 * ver, vê uma lista vazia, não um erro que confirma que existe registro.
 */
export async function listarMedidas(imovelId: string): Promise<MedidaLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medida_disciplinar")
    .select(
      "id, data, tipo, suspensao_dias, fato_descricao, ciencia, ocupante_id, ocupante_imovel(nome)",
    )
    .eq("imovel_id", imovelId)
    .order("data", { ascending: false });

  if (error) {
    console.error("listarMedidas", error);
    return [];
  }

  // O PostgREST devolve o embed como objeto OU array conforme a cardinalidade.
  // A camada de leitura achata isso: a página nunca vê a ambiguidade.
  return (data ?? []).map((m) => {
    const oc = m.ocupante_imovel as { nome: string } | { nome: string }[] | null;
    const nome = Array.isArray(oc) ? (oc[0]?.nome ?? "—") : (oc?.nome ?? "—");
    return {
      id: m.id,
      data: m.data,
      tipo: m.tipo,
      suspensao_dias: m.suspensao_dias,
      fato_descricao: m.fato_descricao,
      ciencia: m.ciencia,
      ocupante_id: m.ocupante_id,
      ocupante_nome: nome,
    };
  });
}

/** Entregas (chaves e kit) de um imóvel, pendentes primeiro. */
export async function listarEntregas(imovelId: string): Promise<EntregaLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrega_ocupante")
    .select(
      "id, tipo, entregue_em, devolvido_em, tratativa, ocupante_id, ocupante_imovel(nome)",
    )
    .eq("imovel_id", imovelId)
    .order("devolvido_em", { ascending: true, nullsFirst: true })
    .order("entregue_em", { ascending: false });

  if (error) {
    console.error("listarEntregas", error);
    return [];
  }

  return (data ?? []).map((e) => {
    const oc = e.ocupante_imovel as { nome: string } | { nome: string }[] | null;
    const nome = Array.isArray(oc) ? (oc[0]?.nome ?? "—") : (oc?.nome ?? "—");
    return {
      id: e.id,
      tipo: e.tipo,
      entregue_em: e.entregue_em,
      devolvido_em: e.devolvido_em,
      tratativa: e.tratativa,
      ocupante_id: e.ocupante_id,
      ocupante_nome: nome,
    };
  });
}

/**
 * Uma medida disciplinar completa, para gerar o PDF.
 *
 * Devolve `null` quando não existe ou quando o usuário não pode lê-la — a rota
 * responde 404 nos dois casos, sem distinguir, para não confirmar a existência
 * de um registro disciplinar a quem não tem acesso a ele.
 */
export async function buscarMedida(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medida_disciplinar")
    .select("*, ocupante_imovel(nome, cpf, cargo), imovel(apelido, cidade, obra_id, org_id)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const oc = data.ocupante_imovel as
    | { nome: string; cpf: string | null; cargo: string | null }
    | Array<{ nome: string; cpf: string | null; cargo: string | null }>
    | null;
  const im = data.imovel as
    | { apelido: string; cidade: string | null; obra_id: string | null; org_id: string }
    | Array<{ apelido: string; cidade: string | null; obra_id: string | null; org_id: string }>
    | null;

  return {
    ...data,
    ocupante: Array.isArray(oc) ? (oc[0] ?? null) : oc,
    imovel: Array.isArray(im) ? (im[0] ?? null) : im,
  };
}

/** Uma entrega completa, para gerar o PDF. */
export async function buscarEntrega(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrega_ocupante")
    .select("*, ocupante_imovel(nome, cpf, cargo, quarto, armario), imovel(apelido, endereco, cidade, uf, obra_id, org_id)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const oc = data.ocupante_imovel as Record<string, unknown> | Record<string, unknown>[] | null;
  const im = data.imovel as Record<string, unknown> | Record<string, unknown>[] | null;

  return {
    ...data,
    ocupante: Array.isArray(oc) ? (oc[0] ?? null) : oc,
    imovel: Array.isArray(im) ? (im[0] ?? null) : im,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Rotina semanal de limpeza (fase 4)
// ═══════════════════════════════════════════════════════════════════════════

export type TarefaLimpeza = {
  id: string;
  grupo: string;
  descricao: string;
  frequencia: "D" | "S" | "M";
  ordem: number;
};

export type ChecklistLista = {
  id: string;
  semana_inicio: string;
  auxiliar_nome: string | null;
  avaliacao: string | null;
  observacoes: string | null;
};

/**
 * Catálogo de tarefas da organização, na ordem em que o auxiliar percorre o
 * alojamento. Vazio quando a organização ainda não semeou o catálogo — nesse
 * caso a folha impressa cai no catálogo embutido em `frm-rh-005.tsx`.
 */
export async function listarTarefasLimpeza(): Promise<TarefaLimpeza[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarefa_limpeza")
    .select("id, grupo, descricao, frequencia, ordem")
    .eq("ativo", true)
    .order("ordem");

  if (error) {
    console.error("listarTarefasLimpeza", error);
    return [];
  }
  return (data ?? []) as TarefaLimpeza[];
}

/** Checklists de um imóvel, da semana mais recente para a mais antiga. */
export async function listarChecklists(imovelId: string): Promise<ChecklistLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_limpeza")
    .select("id, semana_inicio, auxiliar_nome, avaliacao, observacoes")
    .eq("imovel_id", imovelId)
    .order("semana_inicio", { ascending: false })
    .limit(12);

  if (error) {
    console.error("listarChecklists", error);
    return [];
  }
  return (data ?? []) as ChecklistLista[];
}
