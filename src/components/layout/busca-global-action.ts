"use server";

// Ponte entre o palette ("use client") e a leitura server-only de
// `src/lib/data/busca.ts`. Só isso: confere sessão e delega. Sem sessão,
// devolve lista vazia — nunca resultados, porque quem decide o que cada
// organização vê é a RLS por trás de `buscarGlobal`, e essa checagem aqui é
// só para não gastar uma consulta com quem nem está autenticado.
import { getCurrentPerfil } from "@/lib/auth";
import { buscarGlobal, type GrupoBusca } from "@/lib/data/busca";

export async function buscarGlobalAction(termo: string): Promise<GrupoBusca[]> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return [];
  return buscarGlobal(termo);
}
