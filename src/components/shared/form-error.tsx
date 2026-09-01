// O recado de erro de um formulário, acima dos botões.
//
// Antes cada form renderizava `<p className="text-sm text-destructive">` solto,
// que se perdia no meio dos campos. Este é o bloco do Sistenge People, com
// borda, fundo e ícone — usado igual em todos os forms e no ConfirmDialog.
//
// Leva duas coisas, e a segunda entrou na 0.39.1:
//
//  1. o erro que veio do SERVIDOR — permissão negada, CNPJ duplicado, falha de
//     rede;
//  2. a reprovação da validação no cliente, via `aoInvalidar` de
//     @/lib/validacao-form. Sem isso, campo sem mensagem própria (um `id`
//     oculto, por exemplo) reprovava o submit em SILÊNCIO: o Salvar não fazia
//     nada e a tela não dizia por quê.
//
// Erro de campo continua sendo `<p className="text-xs text-destructive">`
// embaixo do próprio campo, que é o que o zodResolver preenche — o bloco aqui
// repete a primeira mensagem de propósito, porque em form longo a do campo pode
// estar fora da tela (ver o comentário em @/lib/validacao-form).

import { AlertCircle } from "lucide-react";

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
