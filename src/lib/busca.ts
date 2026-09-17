// Busca global: o módulo puro de normalização, classificação e ordenação.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// A busca global (Ctrl+K) já navega páginas estáticas. Agora expande para
// registros: obras, fornecedores, equipamentos, funcionários, contratos,
// imóveis. Encontrá-los exige três passos puros:
//
// 1. Normalizar o termo (acentos, espaços, caso).
// 2. Classificar como acertou (código prefixo / código contém / nome prefixo /
//    nome contém).
// 3. Ordenar misturando seis entidades diferentes numa lista única.
//
// Puro = sem Supabase, sem I/O, sem "hoje". Estes três passos rodam igual
// no cliente e no servidor. Divergência entre eles (um normaliza e o outro
// não) mata a busca: "Imóveis" aparece, "Imóvel Centro" não. A assinatura
// tem seu próprio módulo `busca.ts` porque não há meio-termo — ou o código
// que acerta está aqui, ou está espalhado.
// ═══════════════════════════════════════════════════════════════════════════

import type { ModuloKey } from "@/lib/modulos";

/** As entidades que a busca cobre, na ordem fixa de desempate. */
export const ENTIDADES = ["obra", "fornecedor", "equipamento", "funcionario", "contrato", "imovel"] as const;
export type Entidade = (typeof ENTIDADES)[number];

export type ResultadoBusca = {
  entidade: Entidade;
  id: string;
  titulo: string;
  /** Segunda linha do resultado: código, CPF, patrimônio — o que identifica. */
  detalhe: string | null;
  href: string;
  /** Em qual campo o termo bateu, e como. Decide a ordem. */
  acerto: Acerto;
};

export type Acerto = "codigo-prefixo" | "codigo-contem" | "nome-prefixo" | "nome-contem";

/**
 * De qual módulo cada entidade depende.
 *
 * POR QUE ISTO EXISTE. `perfil.modulos` (migration 0023) é uma segunda lista
 * branca, além da RLS, e ela é conferida SÓ em código de aplicação —
 * `moduloLiberado` / `exigirModulo` e o filtro do menu. Nenhuma policy carrega
 * predicado de módulo. Quer dizer: a RLS devolve alegremente o fornecedor para
 * quem tem só `imoveis` liberado, e sem este mapa a busca imprimiria o nome
 * dele na tela — que é exatamente o dano que a busca global tem de evitar,
 * porque acontece ANTES de qualquer clique. Quem aplica o mapa é a ponte
 * (`busca-global-action.ts`), do lado do servidor, nunca o cliente.
 */
export const MODULO_POR_ENTIDADE: Record<Entidade, ModuloKey> = {
  obra: "obras",
  fornecedor: "fornecedores",
  equipamento: "frota",
  funcionario: "termos",
  contrato: "contratos",
  imovel: "imoveis",
};

export const TERMO_MINIMO = 2;

/**
 * Normaliza um termo de busca: acentos, espaços extras, maiúsculas.
 *
 * DECISÃO: Usar a mesma transformação que normalizar() em command-palette.tsx.
 * Páginas são filtradas no cliente com essa função; registros são filtrados no
 * servidor com normalizarBusca(). Se divergirem, "João" aparece num resultado
 * e "João da Silva" não — e ninguém espera que um substring de um match deixe
 * de casar. A transformação é NFD (decomposição) + remover diacríticos + caixa
 * baixa + trim(). O trim() é adição desta função (a palette não precisa porque
 * o input já vem limpo).
 */
export function normalizarBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Um termo com menos de TERMO_MINIMO caracteres não é válido.
 *
 * Uma letra casaria com quase tudo ("a" encontra Anderson, Andrade, etc.).
 * Duas letras é o mínimo razoável.
 */
export function termoValido(s: string): boolean {
  return normalizarBusca(s).length >= TERMO_MINIMO;
}

/**
 * Classifica em qual campo o termo acertou e como.
 *
 * DECISÃO: Normalizar o termo E os campos antes de comparar. Códigos são
 * checados primeiro (prefixo antes de contém), depois o nome (mesma ordem).
 * Se um código bate, nenhum nome vence — quem digita "14L4594" sabe EXATAMENTE
 * o que quer. Null em codigos[] é ignorado sem quebrar (cnpj, codigo,
 * service_tag são todos anuláveis no banco).
 *
 * `nome` aceita uma LISTA porque há registro com mais de um campo de
 * linguagem natural e nenhum deles é identificador: o imóvel tem apelido e
 * nome do proprietário, o equipamento tem patrimônio e descrição do modelo.
 * Tratar esses campos como "código" os promoveria acima de um prefixo de nome
 * de verdade — buscar "cent" traria a casa do "Vicente" antes do imóvel que se
 * chama "Centro". Nome de pessoa não é identificador. Null na lista é ignorado.
 */
export function classificarAcerto(args: {
  termo: string;
  nome: string | (string | null)[];
  codigos: (string | null)[];
}): Acerto | null {
  const { termo, nome, codigos } = args;
  const nomes = (Array.isArray(nome) ? nome : [nome]).filter(
    (n): n is string => n !== null,
  );
  const termoNorm = normalizarBusca(termo);

  // Checar códigos: prefixo antes de contém.
  for (const codigo of codigos) {
    if (codigo === null) continue;
    const codigoNorm = normalizarBusca(codigo);
    if (codigoNorm.startsWith(termoNorm)) {
      return "codigo-prefixo";
    }
  }

  for (const codigo of codigos) {
    if (codigo === null) continue;
    const codigoNorm = normalizarBusca(codigo);
    if (codigoNorm.includes(termoNorm)) {
      return "codigo-contem";
    }
  }

  // Checar nome: prefixo antes de contém, e prefixo em QUALQUER dos nomes
  // vence "contém" em todos eles.
  for (const n of nomes) {
    if (normalizarBusca(n).startsWith(termoNorm)) {
      return "nome-prefixo";
    }
  }

  for (const n of nomes) {
    if (normalizarBusca(n).includes(termoNorm)) {
      return "nome-contem";
    }
  }

  return null;
}

/**
 * Ordena resultados de busca por relevância.
 *
 * DECISÃO: Peso numérico por Acerto (código-prefixo < código-contem <
 * nome-prefixo < nome-contem); em empate, índice da entidade em ENTIDADES.
 * Usa [...rs].sort(...) para NÃO ordenar em lugar: o chamador não espera que
 * a lista dele mude por baixo. Sorting in-place é o tipo de bug que aparece
 * três arquivos de distância.
 */
export function ordenarResultados(rs: ResultadoBusca[]): ResultadoBusca[] {
  const pesoAcerto: Record<Acerto, number> = {
    "codigo-prefixo": 0,
    "codigo-contem": 1,
    "nome-prefixo": 2,
    "nome-contem": 3,
  };

  return [...rs].sort((a, b) => {
    // Comparar pelo peso do acerto.
    const pesoA = pesoAcerto[a.acerto];
    const pesoB = pesoAcerto[b.acerto];

    if (pesoA !== pesoB) {
      return pesoA - pesoB;
    }

    // Empate: desempatar pela ordem fixa das entidades.
    //
    // ESTE DESEMPATE NÃO DISPARA NA PRODUÇÃO DE HOJE, e é de propósito que ele
    // fique. `montarGrupo` chama esta função uma vez por entidade, então o
    // array sempre tem uma `entidade` só e a diferença dá zero. Ele existe
    // para a lista única e ranqueada que a spec descreve — a renderização
    // agrupada tornou a mistura desnecessária, não impossível. Sai daqui no
    // dia em que a decisão de agrupar virar definitiva.
    const idxA = ENTIDADES.indexOf(a.entidade);
    const idxB = ENTIDADES.indexOf(b.entidade);

    return idxA - idxB;
  });
}
