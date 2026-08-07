// Par rótulo/valor para telas de detalhe.
//
// Unifica três helpers locais idênticos: `Info` em contratos/[id] e em
// vistorias/[id], e `Campo` em imoveis/[id]. Os três renderizavam
// `<p className="text-xs text-muted-foreground">` + `<p className="font-medium">`
// e divergiam só nos extras — um tinha `destaque`, outro tinha `span` e `node`.
//
// Não confundir com o `Campo` de configuracoes/empresa-form.tsx: aquele é um
// campo de formulário (Label + Input), outro conceito.
//
// Este componente é para o par de leitura. Quando o número É o assunto da tela,
// use o KpiCard.

import { cn } from "@/lib/utils";

export function Campo({
  label,
  valor,
  node,
  span,
  destaque,
  className,
}: {
  label: string;
  /** Valor simples. `null`/`undefined`/vazio viram travessão. */
  valor?: string | number | null;
  /** Conteúdo rico (badge, link, lista) no lugar do valor. Tem precedência. */
  node?: React.ReactNode;
  /** Ocupa a linha inteira num grid de 3 colunas (ex.: endereço). */
  span?: boolean;
  /** Destaca o valor — para o campo principal do bloco. */
  destaque?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(span && "sm:col-span-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={destaque ? "text-lg font-semibold tracking-tight" : "font-medium"}>
        {node ?? (valor === null || valor === undefined || valor === "" ? "—" : String(valor))}
      </p>
    </div>
  );
}
