import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha da listagem de fornecedores, com as obras já achatadas. */
export type FornecedorListItem = {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  /**
   * O campo que faz o sistema funcionar: é por ele que saem o romaneio de
   * recebimento e o termo de devolução. Vem para a LISTAGEM, e não só para o
   * detalhe, porque quem precisa saber quantos fornecedores estão sem e-mail
   * não vai abrir 37 fichas para descobrir.
   */
  contato_email: string | null;
  ativo: boolean;
  /**
   * Obras onde o fornecedor atua: as que têm CONTRATO mais as vinculadas à mão.
   *
   * A união existe porque os dois conjuntos hoje são disjuntos — no
   * levantamento de 2026-09-05 havia 8 vínculos manuais e nenhum deles com
   * contrato correspondente, porque o cadastro de contratos ainda está no
   * começo (2 contratos no sistema inteiro). Derivar só do contrato apagaria a
   * informação que existe; manter só o manual perpetua a lista paralela. A
   * união deixa o contrato assumir sozinho à medida que forem cadastrados.
   */
  obras: { id: string; codigo: string }[];
};

export async function listarFornecedores(
  p: ListaParams & { obraId?: string },
): Promise<Pagina<FornecedorListItem>> {
  const supabase = await createClient();

  // Filtrar por obra exige join INTERNO: com o embed normal o PostgREST conta e
  // pagina todos os fornecedores, e só depois filtra as obras aninhadas — o que
  // devolve páginas parcialmente vazias e um total errado.
  const embed = p.obraId
    ? "fornecedor_obra!inner(obra:obra_id(id, codigo))"
    : "fornecedor_obra(obra:obra_id(id, codigo))";

  let query = supabase
    .from("fornecedor")
    .select(
      `id, nome, cnpj, contato_nome, contato_telefone, contato_email, ativo, ${embed}`,
      { count: "exact" },
    );
  if (p.obraId) query = query.eq("fornecedor_obra.obra_id", p.obraId);
  if (p.q) query = query.or(termoOr(["nome", "cnpj"], p.q));

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarFornecedores", error.message);

  type Bruto = Omit<FornecedorListItem, "obras"> & {
    fornecedor_obra: { obra: { id: string; codigo: string } | null }[];
  };
  const brutos = (data ?? []) as unknown as Bruto[];

  // As obras que vêm de CONTRATO, numa consulta só para a página inteira. Uma
  // por fornecedor seriam vinte consultas por página — e o contrato é a fonte
  // que deve prevalecer, então ela não pode ser a cara.
  const porContrato = new Map<string, Map<string, { id: string; codigo: string }>>();
  if (brutos.length > 0) {
    const { data: contratos, error: erroContratos } = await supabase
      .from("contrato_locacao")
      .select("fornecedor_id, obra:obra_id(id, codigo)")
      .in(
        "fornecedor_id",
        brutos.map((f) => f.id),
      );
    // Erro aqui NÃO derruba a listagem: sem as obras de contrato a tela mostra
    // só as manuais, que é pior mas ainda serve. Zerar a lista inteira por
    // causa de uma coluna acessória seria a troca errada.
    if (erroContratos) {
      console.error("listarFornecedores.contratos", erroContratos.message);
    }
    for (const c of contratos ?? []) {
      const o = (Array.isArray(c.obra) ? c.obra[0] : c.obra) as
        | { id: string; codigo: string }
        | null;
      if (!o) continue;
      const atual = porContrato.get(c.fornecedor_id) ?? new Map();
      atual.set(o.id, o);
      porContrato.set(c.fornecedor_id, atual);
    }
  }

  return {
    itens: brutos.map(({ fornecedor_obra, ...f }) => {
      // Map por id para não repetir a obra que está nos dois conjuntos.
      const juntas = new Map(porContrato.get(f.id) ?? []);
      for (const v of fornecedor_obra ?? []) {
        if (v.obra) juntas.set(v.obra.id, v.obra);
      }
      return {
        ...f,
        obras: [...juntas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)),
      };
    }),
    total: count ?? 0,
  };
}

/**
 * As obras em que o fornecedor tem contrato. Somente leitura — o contrato é a
 * fonte, e o formulário do fornecedor mostra estas sem deixar editar.
 */
export async function obrasComContratoDoFornecedor(
  fornecedorId: string,
): Promise<{ id: string; codigo: string; nome: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contrato_locacao")
    .select("obra:obra_id(id, codigo, nome)")
    .eq("fornecedor_id", fornecedorId);

  if (error) {
    console.error("obrasComContratoDoFornecedor", error.message);
    return [];
  }

  const unicas = new Map<string, { id: string; codigo: string; nome: string }>();
  for (const c of data ?? []) {
    const o = (Array.isArray(c.obra) ? c.obra[0] : c.obra) as
      | { id: string; codigo: string; nome: string }
      | null;
    if (o) unicas.set(o.id, o);
  }
  return [...unicas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/** Quantos fornecedores ativos estão sem e-mail — o contador do topo da lista. */
export async function contarFornecedoresSemEmail(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("fornecedor")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true)
    .is("contato_email", null);

  if (error) {
    console.error("contarFornecedoresSemEmail", error.message);
    return 0;
  }
  return count ?? 0;
}
