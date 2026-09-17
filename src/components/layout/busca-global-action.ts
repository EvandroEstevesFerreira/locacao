"use server";

// Ponte entre o palette ("use client") e a leitura server-only de
// `src/lib/data/busca.ts`. Confere sessão, resolve o acesso por módulo e
// delega. Sem sessão, devolve lista vazia.
//
// POR QUE O FILTRO DE MÓDULO MORA AQUI, E NÃO NO CLIENTE. São duas barreiras
// diferentes, e só uma delas é do banco:
//
// - RLS cuida de organização e escopo por obra — automática, em toda consulta;
// - `perfil.modulos` (migration 0023) é uma segunda lista branca que NENHUMA
//   policy carrega. Ela vive em código (`moduloLiberado` / `exigirModulo` e o
//   filtro do menu). Sem esta função aplicá-la, um usuário com apenas
//   `imoveis` liberado digitaria "val" e leria o nome e o CNPJ de um
//   fornecedor — nome que ele não alcança em lugar nenhum: `/fornecedores`
//   recusa via `exigirModulo` e o item não está no menu. O dano da busca
//   global é o nome na tela, antes do clique; o 403 depois não repara nada.
//
// E mora no SERVIDOR porque uma função `"use server"` é endpoint público:
// qualquer um com sessão a chama com o argumento que quiser. Filtrar no
// palette seria enfeite.
import { getCurrentPerfil } from "@/lib/auth";
import { ENTIDADES, MODULO_POR_ENTIDADE, type Entidade } from "@/lib/busca";
import { moduloLiberado } from "@/lib/modulos";
import { buscarGlobal, type GrupoBusca } from "@/lib/data/busca";

export async function buscarGlobalAction(termo: string): Promise<GrupoBusca[]> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return [];

  // `moduloLiberado` já trata os dois casos especiais: master passa sempre, e
  // `modulos == null` é acesso total (retrocompatível, quem nunca teve módulos
  // definidos). Não replicar essa regra aqui é o ponto — uma cópia é onde as
  // duas divergem.
  const liberadas: Entidade[] = ENTIDADES.filter((e) =>
    moduloLiberado(perfil.modulos, perfil.papel === "master", MODULO_POR_ENTIDADE[e]),
  );
  if (liberadas.length === 0) return [];

  return buscarGlobal(termo, liberadas);
}
