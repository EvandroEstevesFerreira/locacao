import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * <select> nativo estilizado — fonte única de verdade para os selects do app.
 *
 * Antes desta versão a mesma ideia estava duplicada em 20 arquivos, em 5
 * variações divergentes da string de classe (com e sem `flex`, com e sem
 * `w-full`, com e sem anel de foco, e uma em `h-8 text-xs`). O resultado eram
 * selects de alturas diferentes lado a lado com os campos de texto.
 *
 * Por que nativo, e não o `ui/select.tsx` (Base UI):
 * - 4 páginas de listagem (financeiro, imoveis, relatorios, vistorias/[id])
 *   são Server Components e usam filtros GET com submit nativo; o Select do
 *   Base UI é obrigatoriamente client.
 * - os forms restantes vivem dentro de `<form action={serverAction}>` e
 *   dependem do par `name`/`defaultValue` nativo em form uncontrolled.
 *
 * A seta é a do próprio browser (não usamos `appearance-none`), igual ao
 * comportamento anterior: assim a consolidação não muda nada visualmente além
 * de alinhar a caixa, e não precisamos de um ícone que teria de seguir o tema.
 *
 * Largura: `w-full` por padrão, como a maioria dos call sites. Filtros que
 * ficam em linha passam `className="w-auto"`.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
