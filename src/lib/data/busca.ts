import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger, erroMeta } from "@/lib/logger";
import {
  classificarAcerto,
  ordenarResultados,
  termoValido,
  type Entidade,
  type ResultadoBusca,
} from "@/lib/busca";

/**
 * Um grupo de resultados por entidade, pronto para a UI do Ctrl+K.
 */
export type GrupoBusca = {
  entidade: Entidade;
  /** Rótulo em PT-BR no plural: "Funcionários", "Obras". */
  rotulo: string;
  itens: ResultadoBusca[]; // no máximo 5
  total: number; // quantos casaram no total
  /** Lista filtrada, para o "ver todos". */
  hrefTodos: string;
};

/** Quantos itens cada grupo mostra antes do "ver todos". */
const MAX_ITENS_POR_GRUPO = 5;

/**
 * Rótulo em PT-BR de cada entidade, no plural — texto visível ao usuário.
 *
 * NOTA: outra onda vai acrescentar a coluna `tipo` em `obra` (obra |
 * departamento). Quando ela chegar, o rótulo de "obra" pode precisar ler essa
 * coluna para diferenciar os dois; até lá, `obra` não existe e não é filtrada.
 */
const ROTULOS: Record<Entidade, string> = {
  obra: "Obras",
  fornecedor: "Fornecedores",
  equipamento: "Equipamentos",
  funcionario: "Funcionários",
  contrato: "Contratos",
  imovel: "Imóveis",
};

/** Monta o grupo final: corta em 5, ordena e resolve o "ver todos". */
function montarGrupo(
  entidade: Entidade,
  resultados: ResultadoBusca[],
  hrefTodos: string,
): GrupoBusca | null {
  if (resultados.length === 0) return null;
  const ordenados = ordenarResultados(resultados);
  return {
    entidade,
    rotulo: ROTULOS[entidade],
    itens: ordenados.slice(0, MAX_ITENS_POR_GRUPO),
    total: ordenados.length,
    hrefTodos,
  };
}

/**
 * Busca obras. Filtra `deleted_at is null` — `obra` tem soft delete desde a
 * migration 0032 (`AGENTS.md` / `src/lib/mega/servidor.ts` documentam o
 * incidente de filtrar a coluna errada e a consulta inteira ser recusada).
 */
async function buscarObras(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obra")
    .select("id, nome, codigo")
    .is("deleted_at", null);

  if (error) {
    logger.error("busca: não consegui ler obras", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as { id: string; nome: string; codigo: string }[];
  const resultados: ResultadoBusca[] = [];
  for (const o of linhas) {
    const acerto = classificarAcerto({ termo, nome: o.nome, codigos: [o.codigo] });
    if (!acerto) continue;
    resultados.push({
      entidade: "obra",
      id: o.id,
      titulo: o.nome,
      detalhe: o.codigo,
      href: `/obras/${o.id}`,
      acerto,
    });
  }
  return montarGrupo("obra", resultados, `/obras?q=${encodeURIComponent(termo)}`);
}

/**
 * Busca fornecedores. `fornecedor` NÃO tem `deleted_at` — usa `ativo`
 * (ver AGENTS.md e o comentário em `src/lib/mega/servidor.ts`). Filtrar por
 * `deleted_at` faria o PostgREST recusar a consulta inteira e o fornecedor
 * sumiria da busca em silêncio.
 */
async function buscarFornecedores(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedor")
    .select("id, nome, cnpj")
    .eq("ativo", true);

  if (error) {
    logger.error("busca: não consegui ler fornecedores", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as { id: string; nome: string; cnpj: string | null }[];
  const resultados: ResultadoBusca[] = [];
  for (const f of linhas) {
    const acerto = classificarAcerto({ termo, nome: f.nome, codigos: [f.cnpj] });
    if (!acerto) continue;
    resultados.push({
      entidade: "fornecedor",
      id: f.id,
      titulo: f.nome,
      detalhe: f.cnpj,
      href: `/fornecedores/${f.id}`,
      acerto,
    });
  }
  return montarGrupo("fornecedor", resultados, `/fornecedores?q=${encodeURIComponent(termo)}`);
}

/**
 * Busca equipamentos. Título é o `identificador`; `numero_serie` e
 * `service_tag` entram como códigos (casam o termo) e também como `detalhe`
 * (o que identifica na segunda linha do resultado). `equipamento_unidade`
 * usa `ativo`, não `deleted_at` — mesmo caso de `fornecedor`.
 */
async function buscarEquipamentos(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select("id, identificador, numero_serie, service_tag")
    .eq("ativo", true);

  if (error) {
    logger.error("busca: não consegui ler equipamentos", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as {
    id: string;
    identificador: string;
    numero_serie: string | null;
    service_tag: string | null;
  }[];
  const resultados: ResultadoBusca[] = [];
  for (const e of linhas) {
    const acerto = classificarAcerto({
      termo,
      nome: e.identificador,
      codigos: [e.numero_serie, e.service_tag],
    });
    if (!acerto) continue;
    const detalhe = [e.numero_serie, e.service_tag].filter(Boolean).join(" · ") || null;
    resultados.push({
      entidade: "equipamento",
      id: e.id,
      titulo: e.identificador,
      detalhe,
      href: `/frota/${e.id}`,
      acerto,
    });
  }
  return montarGrupo("equipamento", resultados, `/frota?q=${encodeURIComponent(termo)}`);
}

/**
 * Busca funcionários. NÃO há ficha individual: `/termos/funcionarios` é uma
 * listagem, então tanto o `href` do item quanto o `hrefTodos` apontam para
 * ela — inventar `/funcionarios/<id>` daria 404. `funcionario` usa `ativo`,
 * não `deleted_at`.
 */
async function buscarFuncionarios(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionario")
    .select("id, nome, cpf")
    .eq("ativo", true);

  if (error) {
    logger.error("busca: não consegui ler funcionários", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as { id: string; nome: string; cpf: string | null }[];
  const resultados: ResultadoBusca[] = [];
  for (const f of linhas) {
    const acerto = classificarAcerto({ termo, nome: f.nome, codigos: [f.cpf] });
    if (!acerto) continue;
    resultados.push({
      entidade: "funcionario",
      id: f.id,
      titulo: f.nome,
      detalhe: f.cpf,
      href: "/termos/funcionarios",
      acerto,
    });
  }
  // SEM `?q=` aqui: `/termos/funcionarios` não filtra por termo nenhum (não
  // tem `ListSearch`, não lê `sp.q`) — mandar o parâmetro faria a busca
  // parecer que jogou fora o que o usuário digitou. O link fica na listagem
  // crua, que é o fallback que o brief já previa para quando a tela de
  // destino não aceita busca.
  return montarGrupo("funcionario", resultados, "/termos/funcionarios");
}

/**
 * Busca contratos de locação. `contrato_locacao` tem `deleted_at` desde a
 * migration 0032.
 */
async function buscarContratos(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contrato_locacao")
    .select("id, numero, numero_registro")
    .is("deleted_at", null);

  if (error) {
    logger.error("busca: não consegui ler contratos", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as {
    id: string;
    numero: string;
    numero_registro: string | null;
  }[];
  const resultados: ResultadoBusca[] = [];
  for (const c of linhas) {
    // Contrato não tem "nome": o número faz esse papel para classificarAcerto,
    // e o registro entra como código adicional.
    const acerto = classificarAcerto({
      termo,
      nome: c.numero,
      codigos: [c.numero_registro],
    });
    if (!acerto) continue;
    resultados.push({
      entidade: "contrato",
      id: c.id,
      titulo: c.numero,
      detalhe: c.numero_registro,
      href: `/contratos/${c.id}`,
      acerto,
    });
  }
  return montarGrupo("contrato", resultados, `/contratos?q=${encodeURIComponent(termo)}`);
}

/**
 * Busca imóveis. `imovel` tem `deleted_at` desde a migration 0032.
 */
async function buscarImoveis(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("imovel")
    .select("id, apelido, proprietario_nome")
    .is("deleted_at", null);

  if (error) {
    logger.error("busca: não consegui ler imóveis", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as {
    id: string;
    apelido: string;
    proprietario_nome: string | null;
  }[];
  const resultados: ResultadoBusca[] = [];
  for (const i of linhas) {
    // Imóvel não tem código próprio; o nome do proprietário é a única outra
    // coisa que identifica, então entra como código (casa via classificarAcerto).
    const acerto = classificarAcerto({
      termo,
      nome: i.apelido,
      codigos: [i.proprietario_nome],
    });
    if (!acerto) continue;
    resultados.push({
      entidade: "imovel",
      id: i.id,
      titulo: i.apelido,
      detalhe: i.proprietario_nome,
      href: `/imoveis/${i.id}`,
      acerto,
    });
  }
  return montarGrupo("imovel", resultados, `/imoveis?q=${encodeURIComponent(termo)}`);
}

/**
 * Busca global (Ctrl+K) sobre os seis registros da aplicação.
 *
 * `createClient()`, nunca `createAdminClient()`: o isolamento por organização
 * é feito por RLS, e é a única barreira desta busca — um client admin faria
 * qualquer usuário ver os registros de todas as organizações, sem erro e sem
 * teste vermelho.
 *
 * O filtro roda em memória (não em SQL) porque `unaccent` não está instalado
 * nesta base e o PostgREST não permite função sobre coluna dentro de um
 * `.or()` — ver `termoOr` em `src/lib/lista.ts`. Sem tratar acento, "joao" não
 * encontraria nada entre os funcionários. Isso só é defensável porque as seis
 * tabelas somam 720 linhas (medido em 17/09/2026); não é para crescer para
 * filtro no banco achando que está otimizando.
 *
 * Cada consulta roda isolada: uma falhar loga e devolve grupo vazio, sem
 * derrubar as outras cinco.
 */
export async function buscarGlobal(termo: string): Promise<GrupoBusca[]> {
  if (!termoValido(termo)) return [];

  const grupos = await Promise.all([
    buscarObras(termo),
    buscarFornecedores(termo),
    buscarEquipamentos(termo),
    buscarFuncionarios(termo),
    buscarContratos(termo),
    buscarImoveis(termo),
  ]);

  return grupos.filter((g): g is GrupoBusca => g !== null);
}
