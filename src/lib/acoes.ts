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
