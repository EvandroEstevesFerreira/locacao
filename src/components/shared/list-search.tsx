"use client";

// Busca das listagens, sincronizada na querystring.
//
// Antes exigia Enter para aplicar. Agora aplica sozinha 300ms depois da última
// tecla e tem botão de limpar — o comportamento das listas do Sistenge People, e
// a diferença mais sentida entre as duas listas do Loca (algumas tinham busca ao
// vivo via <form method="get">, outras não).
//
// O `params.delete("page")` é essencial e o `setParam` do People não faz: sem
// ele, quem estava na página 7 e digita um filtro continua pedindo a página 7 de
// um resultado que agora tem 2.

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;

export function ListSearch({
  placeholder = "Buscar…",
  paramName = "q",
  ariaLabel = "Buscar",
}: {
  placeholder?: string;
  paramName?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const naUrl = sp.get(paramName) ?? "";

  const [texto, setTexto] = useState(naUrl);
  const [pendente, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function aplicar(valor: string) {
    const params = new URLSearchParams(sp.toString());
    if (valor.trim()) params.set(paramName, valor.trim());
    else params.delete(paramName);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  function onChange(valor: string) {
    setTexto(valor);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => aplicar(valor), DEBOUNCE_MS);
  }

  function limpar() {
    if (timer.current) clearTimeout(timer.current);
    setTexto("");
    aplicar("");
  }

  // Só limpa o timer ao desmontar. Não sincroniza `texto` com a URL: enquanto o
  // usuário digita, o campo é a fonte da verdade.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form
      // Enter continua funcionando, aplicando na hora em vez de esperar o
      // debounce — quem já tem o hábito não perde nada.
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        aplicar(texto);
      }}
      className="relative flex-1"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        aria-label={ariaLabel}
      />
      {pendente ? (
        <Loader2
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      ) : texto ? (
        <button
          type="button"
          onClick={limpar}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </form>
  );
}
