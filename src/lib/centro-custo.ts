// Domínio Centro de custo: a obra e o departamento na mesma lista.
//
// Sem dependências de servidor — importado pelo formulário (cliente) e pela
// action (servidor), como `src/lib/obra.ts`.
//
// As mesmas regras vivem na migration 0114, no trigger
// `obra_centro_custo_valido`. A duplicação é deliberada e tem um único
// propósito: MENSAGEM. O banco recusa com erro cru, sem nome de campo, e o
// formulário não teria onde pendurá-lo. Quem manda continua sendo o banco.

export const TIPO_CENTRO_CUSTO = ["obra", "departamento"] as const;
export type TipoCentroCusto = (typeof TIPO_CENTRO_CUSTO)[number];

export const TIPO_CENTRO_CUSTO_INFO: Record<
  TipoCentroCusto,
  { label: string; variant: "default" | "secondary"; descricao: string }
> = {
  obra: {
    label: "Obra",
    variant: "default",
    descricao: "Obra ou contrato de engenharia, com prazo, avanço físico e fechamento mensal.",
  },
  departamento: {
    label: "Departamento",
    variant: "secondary",
    descricao: "Área administrativa da empresa. Consome locação, mas não tem prazo nem avanço.",
  },
};

/** O mínimo que as regras de hierarquia precisam saber de um centro de custo. */
export type CentroCustoNo = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoCentroCusto;
  pai_id: string | null;
};

export type ResultadoRegra = { ok: true } | { ok: false; motivo: string };

/**
 * Departamento não recebe frente de serviço, avanço, orçamento de locação nem
 * fechamento mensal.
 *
 * A tela usa isto para não renderizar os blocos; o banco usa os quatro
 * gatilhos da 0114 para não gravá-los. Os dois são necessários: a server action
 * continua alcançável com o bloco escondido, e um fechamento mensal do RH é um
 * número plausível dentro de um relatório financeiro.
 */
export function aceitaControleDeObra(tipo: TipoCentroCusto): boolean {
  return tipo === "obra";
}

/**
 * O candidato a pai serve para este centro de custo?
 *
 * `null` é resposta legítima: centro de custo de raiz é o caso comum.
 */
export function paiPermitido(
  filho: Pick<CentroCustoNo, "id" | "tipo">,
  pai: Pick<CentroCustoNo, "id" | "nome" | "tipo" | "pai_id"> | null,
): ResultadoRegra {
  if (!pai) return { ok: true };

  if (filho.tipo === "obra") {
    return {
      ok: false,
      motivo:
        "Uma obra não fica subordinada a outro centro de custo. " +
        "Para agrupar trabalho dentro de uma obra, use frentes de serviço.",
    };
  }

  if (pai.id === filho.id) {
    return { ok: false, motivo: "Um centro de custo não pode ser pai de si mesmo." };
  }

  if (pai.tipo !== "departamento") {
    return {
      ok: false,
      motivo: "Somente um departamento pode ser pai de outro centro de custo.",
    };
  }

  // Dois níveis, e o limite é o que elimina ciclo por construção: para haver
  // ciclo seria preciso um pai que já tem pai.
  if (pai.pai_id !== null) {
    return {
      ok: false,
      motivo: `A hierarquia tem no máximo dois níveis, e "${pai.nome}" já é um setor de outro departamento.`,
    };
  }

  return { ok: true };
}

export type ComNivel<T> = T & { nivel: number };

/**
 * Ordena a lista pondo cada filho logo abaixo do seu pai, com o nível para a
 * indentação da tela.
 *
 * É função pura porque a indentação é REGRA, não CSS — e regra dentro de
 * componente é regra sem teste.
 *
 * Duas tolerâncias que não são zelo excessivo:
 *
 * - **Órfão vira raiz.** `pai_id` aponta para uma linha que a RLS pode esconder:
 *   quem tem acesso ao RH mas não ao Administrativo recebe o setor sem o pai.
 *   Sumir com ele seria esconder o que o usuário tem direito de ver.
 * - **Ciclo não trava.** O banco o impede (trigger da 0114), mas esta função
 *   também roda sobre dado de teste e de importação, e um laço infinito no
 *   render é uma página branca sem mensagem.
 */
export function ordenarComHierarquia<
  T extends Pick<CentroCustoNo, "id" | "codigo" | "pai_id">,
>(itens: T[]): ComNivel<T>[] {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const porCodigo = (a: T, b: T) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });

  // Raiz é quem não tem pai OU cujo pai não está na lista (escondido pela RLS,
  // ou ausente por ciclo — em ambos os casos ele precisa aparecer).
  const ehRaiz = (i: T) => i.pai_id === null || !porId.has(i.pai_id) || i.pai_id === i.id;

  const filhosDe = new Map<string, T[]>();
  for (const i of itens) {
    if (ehRaiz(i)) continue;
    const lista = filhosDe.get(i.pai_id as string) ?? [];
    lista.push(i);
    filhosDe.set(i.pai_id as string, lista);
  }

  const saida: ComNivel<T>[] = [];
  const visitados = new Set<string>();

  for (const raiz of itens.filter(ehRaiz).sort(porCodigo)) {
    if (visitados.has(raiz.id)) continue;
    visitados.add(raiz.id);
    saida.push({ ...raiz, nivel: 0 });

    for (const filho of (filhosDe.get(raiz.id) ?? []).sort(porCodigo)) {
      if (visitados.has(filho.id)) continue;
      visitados.add(filho.id);
      saida.push({ ...filho, nivel: 1 });
    }
  }

  // Sobra só quando os dados têm ciclo entre não-raízes. Entram no fim, na
  // raiz: uma linha visível é melhor que uma linha perdida.
  for (const i of itens) {
    if (!visitados.has(i.id)) {
      visitados.add(i.id);
      saida.push({ ...i, nivel: 0 });
    }
  }

  return saida;
}
