"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * `<form>` cujo server action pode dizer que falhou.
 *
 * O `<form action={…}>` nativo do React exige que a action devolva `void`: o
 * retorno é descartado, e não há canal para uma mensagem. Isso deixava três
 * ações do sistema mudas — alternar "pago" de uma conta de consumo, mudar o
 * status de uma avaria e restaurar um template padrão. Quando falhavam, o
 * valor simplesmente voltava ao anterior na revalidação, e a pessoa concluía
 * que tinha clicado errado.
 *
 * Aqui o submit é interceptado, o `FormData` é montado do próprio formulário
 * (então os `<input type="hidden">` continuam funcionando igual) e o retorno é
 * lido. Sucesso revalida a rota; falha vira toast.
 *
 * Para formulário com validação por campo, use `react-hook-form` — este é para
 * o caso oposto: um controle, um botão, e o único erro possível vem do
 * servidor.
 */
export function FormComErro({
  action,
  children,
  className,
}: {
  /** Server action que devolve `{ error }` quando falha. */
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  return (
    <form
      className={className}
      // `inert` enquanto envia: o clique duplo num toggle de "pago" mandaria
      // dois estados opostos em sequência, e o último a chegar venceria.
      inert={pendente || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        iniciar(async () => {
          const r = await action(dados);
          if (r?.error) {
            toast.error(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {children}
    </form>
  );
}
