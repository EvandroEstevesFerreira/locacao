import "server-only";

import { createClient } from "@/lib/supabase/server";
import { logger, erroMeta } from "@/lib/logger";
import {
  classificarAcerto,
  normalizarBusca,
  ordenarResultados,
  termoValido,
  type Entidade,
  type ResultadoBusca,
} from "@/lib/busca";
import {
  TIPO_CENTRO_CUSTO_INFO,
  type TipoCentroCusto,
} from "@/lib/centro-custo";

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

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Quantos itens cada grupo mostra antes do "ver todos". */
const MAX_ITENS_POR_GRUPO = 5;

/**
 * O "ver todos" de um grupo: a listagem, com `?q=` SÓ quando ela vai encontrar
 * o mesmo que o palette encontrou.
 *
 * POR QUE A CONDIÇÃO. A busca casa sem acento, em memória (`normalizarBusca`);
 * as telas de listagem filtram por `termoOr` (`src/lib/lista.ts`), que é um
 * `ilike` cru, sensível a acento. Quando o termo digitado tem acento a remover,
 * os dois discordam: "jose" mostra "Fornecedores (5 de 12)" e
 * `/fornecedores?q=jose` responde "Nenhum fornecedor encontrado", porque todo
 * mundo é "José". O usuário conclui que a busca mentiu.
 *
 * Então: mandamos o termo quando nada foi removido dele, e caímos na listagem
 * crua quando foi. É a MESMA regra do grupo de funcionários, cujo destino
 * (`/termos/funcionarios`) nunca lê `?q=` — nos dois casos o link só promete o
 * recorte que a tela de destino entrega de verdade.
 *
 * Isto é remendo do lado da busca, não conserto: quem arruma de vez é fazer
 * `termoOr` ignorar acento, e essa é outra frente.
 */
function hrefTodos(base: string, termo: string): string {
  const semAcento = normalizarBusca(termo);
  const cru = termo.toLowerCase().trim();
  return semAcento === cru ? `${base}?q=${encodeURIComponent(termo)}` : base;
}

/**
 * Rótulo em PT-BR de cada entidade, no plural — texto visível ao usuário.
 *
 * "obra" virou "Centros de custo" porque a tabela `obra` deixou de conter só
 * obra: ganhou `tipo` (obra | departamento | grupo) e a tela se chama
 * "Centros de custo".
 * Rotular o grupo inteiro de "Obras" ficaria errado sempre que ele trouxer um
 * departamento — hoje já são dois (800 — Administração, 686 — CPQ03
 * Manutenção). O `GrupoBusca` só tem UM rótulo para o grupo inteiro (é o que
 * vira o cabeçalho no palette, ver `command-palette.tsx`), e um grupo pode
 * misturar os três tipos — então o rótulo do grupo fica neutro, e QUEM
 * diferencia cada linha é o `detalhe`, que passa a levar
 * `TIPO_CENTRO_CUSTO_INFO[tipo].label` (ver `buscarObras` abaixo). Dividir em
 * dois grupos foi cogitado e descartado: exigiria duas entidades em
 * `ENTIDADES`/`MODULO_POR_ENTIDADE`, e as duas already resolvem para o mesmo
 * módulo (`obras`) e a mesma tabela — duas entidades por uma tabela só criaria
 * uma segunda forma de o filtro por módulo divergir do RLS.
 */
const ROTULOS: Record<Entidade, string> = {
  obra: "Centros de custo",
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
  href: string,
): GrupoBusca | null {
  if (resultados.length === 0) return null;
  const ordenados = ordenarResultados(resultados);
  return {
    entidade,
    rotulo: ROTULOS[entidade],
    itens: ordenados.slice(0, MAX_ITENS_POR_GRUPO),
    total: ordenados.length,
    hrefTodos: href,
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
    .select("id, nome, codigo, tipo")
    .is("deleted_at", null);

  if (error) {
    logger.error("busca: não consegui ler obras", erroMeta(error));
    return null;
  }

  const linhas = (data ?? []) as unknown as {
    id: string;
    nome: string;
    codigo: string;
    tipo: TipoCentroCusto;
  }[];
  const resultados: ResultadoBusca[] = [];
  for (const o of linhas) {
    const acerto = classificarAcerto({ termo, nome: o.nome, codigos: [o.codigo] });
    if (!acerto) continue;
    // O grupo mistura obra e departamento sob um rótulo só ("Centros de
    // custo"); o `detalhe` é quem diferencia cada linha na tela, com o mesmo
    // rótulo de `TIPO_CENTRO_CUSTO_INFO` que a tela de cadastro usa.
    resultados.push({
      entidade: "obra",
      id: o.id,
      titulo: o.nome,
      // `?? ` porque um valor novo no enum do banco chegaria aqui antes de
      // existir no `TIPO_CENTRO_CUSTO_INFO`, e um `undefined.label` derruba
      // o Ctrl+K inteiro — caro demais para um rótulo.
      detalhe: `${TIPO_CENTRO_CUSTO_INFO[o.tipo]?.label ?? "Centro de custo"} · ${o.codigo}`,
      href: `/obras/${o.id}`,
      acerto,
    });
  }
  return montarGrupo("obra", resultados, hrefTodos("/obras", termo));
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
  return montarGrupo("fornecedor", resultados, hrefTodos("/fornecedores", termo));
}

/**
 * Busca equipamentos. Título é o `identificador`; `numero_serie` e
 * `service_tag` entram como códigos (casam o termo) e também como `detalhe`
 * (o que identifica na segunda linha do resultado). `equipamento_unidade`
 * usa `ativo`, não `deleted_at` — mesmo caso de `fornecedor`.
 *
 * A DESCRIÇÃO DO MODELO entra junto, via `item:item_id(descricao)`. Sem ela,
 * buscar "betoneira" não encontra betoneira nenhuma — só quem tenha digitado a
 * palavra no patrimônio. O embed é por chave estrangeira obrigatória
 * (`item_id`), então é um-para-um e NÃO muda a contagem de linhas; o mesmo
 * embed já está em `listarFrota`. Ela casa no nível de NOME, não de código: é
 * texto descritivo, e "14L4594" tem de continuar ganhando dela.
 */
async function buscarEquipamentos(termo: string): Promise<GrupoBusca | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select("id, identificador, numero_serie, service_tag, item:item_id(descricao)")
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
    // O PostgREST devolve embed como objeto OU array conforme a cardinalidade;
    // achatamos aqui para que o tipo de retorno desta camada seja plano.
    item: { descricao: string } | { descricao: string }[] | null;
  }[];
  const resultados: ResultadoBusca[] = [];
  for (const e of linhas) {
    const item = achatar(e.item);
    const descricao = item?.descricao ?? null;
    const acerto = classificarAcerto({
      termo,
      nome: [e.identificador, descricao],
      codigos: [e.numero_serie, e.service_tag],
    });
    if (!acerto) continue;
    const detalhe =
      [descricao, e.numero_serie, e.service_tag].filter(Boolean).join(" · ") || null;
    resultados.push({
      entidade: "equipamento",
      id: e.id,
      titulo: e.identificador,
      detalhe,
      href: `/frota/${e.id}`,
      acerto,
    });
  }
  return montarGrupo("equipamento", resultados, hrefTodos("/frota", termo));
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
  return montarGrupo("contrato", resultados, hrefTodos("/contratos", termo));
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
    // Imóvel não tem código próprio. O nome do proprietário casa, mas no
    // NÍVEL DE NOME, nunca como código: nome de pessoa não é identificador, e
    // promovê-lo faria "cent" trazer a "Casa 12" do Vicente antes do imóvel
    // cujo apelido é literalmente "Centro".
    const acerto = classificarAcerto({
      termo,
      nome: [i.apelido, i.proprietario_nome],
      codigos: [],
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
  return montarGrupo("imovel", resultados, hrefTodos("/imoveis", termo));
}

/**
 * Busca global (Ctrl+K) sobre os seis registros da aplicação.
 *
 * `createClient()`, nunca `createAdminClient()`: o isolamento por organização
 * e o escopo por obra são feitos por RLS — um client admin faria qualquer
 * usuário ver os registros de todas as organizações, sem erro e sem teste
 * vermelho.
 *
 * A RLS NÃO é a barreira inteira, porém. O acesso por módulo (`perfil.modulos`)
 * não tem policy nenhuma: ele é conferido em código, e por isso chega aqui já
 * resolvido, em `entidades`.
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
 *
 * `entidades` NÃO tem valor padrão de propósito: é a lista que sobrou depois
 * de `perfil.modulos` — a segunda barreira, a que só existe em código de
 * aplicação (ver `MODULO_POR_ENTIDADE` em `src/lib/busca.ts`). Um padrão
 * "todas" faria um chamador futuro esquecer o filtro sem nada ficar vermelho,
 * e o vazamento é silencioso: o nome do registro na tela, sem clique.
 */
export async function buscarGlobal(
  termo: string,
  entidades: readonly Entidade[],
): Promise<GrupoBusca[]> {
  if (!termoValido(termo)) return [];

  const permitida = (e: Entidade) => entidades.includes(e);
  const consultas: Promise<GrupoBusca | null>[] = [];
  if (permitida("obra")) consultas.push(buscarObras(termo));
  if (permitida("fornecedor")) consultas.push(buscarFornecedores(termo));
  if (permitida("equipamento")) consultas.push(buscarEquipamentos(termo));
  if (permitida("funcionario")) consultas.push(buscarFuncionarios(termo));
  if (permitida("contrato")) consultas.push(buscarContratos(termo));
  if (permitida("imovel")) consultas.push(buscarImoveis(termo));

  const grupos = await Promise.all(consultas);

  return grupos.filter((g): g is GrupoBusca => g !== null);
}
