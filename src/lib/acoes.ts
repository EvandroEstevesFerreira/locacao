/**
 * Contrato de retorno das server actions.
 *
 * Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas: um
 * `redirect()` lança `NEXT_REDIRECT`, então tudo depois do `await` no cliente
 * — inclusive o `router.refresh()` e o próprio `if (!r.ok)` — seria código
 * morto.
 *
 * O Sistenge People redeclara este tipo em cada `actions.ts`. Aqui fica num
 * lugar só.
 */
export type ActionResult =
  | {
      ok: true;
      id?: string;
      /**
       * Deu certo, mas com ressalva que o usuário precisa ler.
       *
       * Existe para o caso em que a operação principal é IRREVERSÍVEL e um
       * passo acessório falhou — fechar um recebimento numera o registro e não
       * pode ser desfeito, mas o e-mail ao fornecedor pode não ter saído.
       * Devolver `ok: false` ali seria mentira: o fechamento aconteceu.
       */
      aviso?: string;
    }
  | { ok: false; erro: string };

/** Atalho para o caso de erro, que é o mais repetido. */
export function falha(erro: string): ActionResult {
  return { ok: false, erro };
}

/**
 * Primeira mensagem de um erro do zod, com fallback.
 *
 * Mostramos uma mensagem por vez de propósito nas actions: a validação por
 * campo é responsabilidade do formulário (react-hook-form + zodResolver). Aqui
 * é a rede de segurança do servidor.
 */
export function primeiroErro(
  issues: { message: string }[],
  fallback = "Dados inválidos.",
): string {
  return issues[0]?.message ?? fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// O JULGADOR DE UMA ESCRITA QUE TINHA DE AFETAR UMA LINHA
// ═══════════════════════════════════════════════════════════════════════════
//
// Existe porque a mesma falha silenciosa apareceu três vezes em versões
// diferentes, sempre em ação secundária (excluir, alternar, anexar):
//
// 1) `excluirItem` fazia `delete` e DESCARTAVA o erro. Item já usado é
//    recusado pela chave estrangeira, e o diálogo de confirmação fechava como
//    se tivesse excluído — com o item ainda na lista (corrigido na 0.54.0).
//
// 2) `moverPeca` fazia `update` e confiava em `error == null`. UPDATE de ZERO
//    linhas NÃO é erro para o PostgREST: uma policy de RLS que filtra a linha
//    devolve `error: null` com nada alterado, e a action dizia "movido" com a
//    peça parada (corrigido na 0.50.0).
//
// As duas lições juntas: capturar o erro NÃO basta, e olhar só o erro TAMBÉM
// não. Uma escrita por `id` que não devolveu linha nenhuma falhou, em
// silêncio. É por isso que este julgador exige o `.select(...)` no call site.
//
// Devolve `null` quando deu certo, ou a mensagem para o usuário.

/** Só o que interessa de um erro do PostgREST, para não acoplar ao tipo dele. */
type ErroDeBanco = { code?: string; message?: string } | null;

/** Violação de chave estrangeira: o registro é referenciado por outro. */
const FK_VIOLADA = "23503";
/** Violação de unicidade. */
const UNICO_VIOLADO = "23505";

export function erroDeEscrita(
  resultado: { data: unknown[] | null; error: ErroDeBanco },
  opts: {
    /** Nome do registro na voz do usuário: "fornecedor", "reparo", "anexo". */
    registro: string;
    /** `excluir` é o padrão porque é o caso mais comum e o mais perigoso. */
    acao?: "excluir" | "salvar";
    /** O que fazer em vez disso, quando a exclusão é recusada por uso. */
    dica?: string;
    /** Prefixo do `console.error`, para achar no log. */
    contexto: string;
  },
): string | null {
  const { data, error } = resultado;
  const acao = opts.acao ?? "excluir";
  const feito = acao === "excluir" ? "excluído" : "salvo";

  if (error) {
    console.error(opts.contexto, error);

    if (error.code === FK_VIOLADA) {
      return acao === "excluir"
        ? `Este ${opts.registro} já foi usado por outros registros e não pode ser excluído.${
            opts.dica ? ` ${opts.dica}` : ""
          }`
        : `Um registro relacionado a este ${opts.registro} não foi encontrado. Recarregue a página e tente de novo.`;
    }
    if (error.code === UNICO_VIOLADO) {
      return `Já existe um ${opts.registro} com esses dados.`;
    }
    return `Não foi possível ${acao} o ${opts.registro}. Tente novamente.`;
  }

  // Sem erro E sem linha afetada: a policy de RLS filtrou a linha, ou o `id`
  // não existe mais. Nos dois casos o usuário precisa saber que NADA mudou.
  if (!data?.length) {
    console.error(`${opts.contexto}: a escrita atingiu 0 linhas`);
    return `O ${opts.registro} não foi ${feito}. Confira se você tem permissão para isso, ou recarregue a página.`;
  }

  return null;
}
