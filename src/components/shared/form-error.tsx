// Erro de servidor num formulário.
//
// Antes cada form renderizava `<p className="text-sm text-destructive">` solto,
// que se perdia no meio dos campos. Este é o bloco do Sistenge People, com
// borda, fundo e ícone — usado igual em todos os forms e no ConfirmDialog.
//
// É para o erro que veio do SERVIDOR (permissão negada, CNPJ duplicado, falha de
// rede). Erro de campo continua sendo `<p className="text-xs text-destructive">`
// embaixo do próprio campo, que é o que o zodResolver preenche.

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
