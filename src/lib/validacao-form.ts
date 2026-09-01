// A rede contra o pior modo de falha de um formulário: não fazer NADA.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `handleSubmit(onSubmit)` só chama `onSubmit` se a validação passar. Se
// reprovar, o react-hook-form preenche `formState.errors` e devolve — e o que o
// usuário vê depende INTEIRAMENTE de o formulário renderizar `errors.<campo>`
// daquele campo. Para campo que ele não renderiza, o clique em Salvar não
// produz erro, nem aviso, nem requisição: nada.
//
// Foi assim que a 0.39.1 chegou ao usuário. Um `<input type="hidden"
// {...register("id")} />` mandava `""`, o `uuid()` do schema recusava, e os sete
// cadastros que criam registro novo ficaram mudos — nenhum deles renderiza
// `errors.id`, porque ninguém renderiza erro de campo oculto. A causa está
// corrigida em `idOpcional` (@/lib/campos), mas o MECANISMO que a escondeu
// continuava de pé para o próximo campo sem mensagem própria.
//
// Aqui o silêncio deixa de ser possível: `handleSubmit(onSubmit, aoInvalidar(
// setErroServidor))` garante que toda reprovação vira texto na tela.
//
// Sobre a duplicação: quando o campo que reprovou JÁ mostra a mensagem embaixo
// de si, ela aparece duas vezes — embaixo do campo e no bloco acima dos botões.
// É deliberado. O bloco fica onde o olho do usuário está no instante do clique,
// e nos forms longos (imóvel, contrato, empresa) a mensagem do campo pode estar
// fora da tela. Mensagem repetida é cosmético; formulário mudo é o defeito.
// ═══════════════════════════════════════════════════════════════════════════

/** Quando a reprovação não trouxe mensagem nenhuma — não deveria acontecer. */
const FALLBACK = "Revise os campos do formulário e tente de novo.";

/**
 * Primeira mensagem de erro de uma árvore de `FieldErrors` do react-hook-form.
 *
 * Recebe `unknown` de propósito: o tipo `FieldErrors` é recursivo e cheio de
 * uniões, e tipá-lo aqui custaria mais casts do que o teste desta função.
 */
export function primeiraMensagemDeErro(errors: unknown): string | null {
  if (!errors || typeof errors !== "object") return null;

  const no = errors as Record<string, unknown>;
  if (typeof no.message === "string" && no.message.trim().length > 0) {
    return no.message;
  }

  for (const [chave, valor] of Object.entries(no)) {
    // `ref` é o nó do DOM do campo: descer nele é sair andando pela árvore da
    // página. `types` guarda as mensagens por regra do MESMO campo, e o `message`
    // do próprio nó já cobre o caso.
    if (chave === "ref" || chave === "types") continue;
    const achado = primeiraMensagemDeErro(valor);
    if (achado) return achado;
  }
  return null;
}

/**
 * Segundo argumento de `handleSubmit` — o caminho da reprovação.
 *
 * Uso:
 *
 *     <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}>
 *
 * O `onSubmit` de cada form abre com `setErroServidor(null)`, então o recado sai
 * da tela sozinho no envio seguinte que passar.
 */
export function aoInvalidar(setErro: (mensagem: string) => void) {
  return (errors: unknown) => setErro(primeiraMensagemDeErro(errors) ?? FALLBACK);
}
