import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TipoVistoria } from "@/lib/vistoria";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha da listagem de vistorias, com as contagens já resolvidas. */
export type VistoriaListItem = {
  id: string;
  tipo: TipoVistoria;
  data: string;
  contratoNumero: string | null;
  obraCodigo: string | null;
  fotos: number;
  avarias: number;
};

export async function listarVistorias(
  p: Omit<ListaParams, "q"> & { obraId?: string },
): Promise<Pagina<VistoriaListItem>> {
  const supabase = await createClient();
  // `!inner` no contrato é necessário para poder filtrar por obra do contrato —
  // e muda a cardinalidade: vistoria sem contrato deixa de aparecer. É o
  // comportamento desejado aqui (toda vistoria nasce de um contrato).
  let query = supabase
    .from("vistoria")
    .select(
      "id, tipo, data, contrato:contrato_id!inner(numero, obra_id, obra:obra_id(codigo)), vistoria_foto(count), avaria(count)",
      { count: "exact" },
    );
  if (p.obraId) query = query.eq("contrato.obra_id", p.obraId);

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarVistorias", error.message);

  type Bruto = {
    id: string;
    tipo: TipoVistoria;
    data: string;
    contrato: { numero: string; obra: { codigo: string } | null } | null;
    vistoria_foto: { count: number }[];
    avaria: { count: number }[];
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map((v) => ({
      id: v.id,
      tipo: v.tipo,
      data: v.data,
      contratoNumero: v.contrato?.numero ?? null,
      obraCodigo: v.contrato?.obra?.codigo ?? null,
      fotos: v.vistoria_foto?.[0]?.count ?? 0,
      avarias: v.avaria?.[0]?.count ?? 0,
    })),
    total: count ?? 0,
  };
}
