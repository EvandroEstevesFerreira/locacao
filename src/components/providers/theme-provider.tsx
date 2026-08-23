"use client";

// Provider de tema (next-themes). O pacote já estava no package.json desde a
// v0.13, mas nunca foi montado: a classe .dark nunca chegava ao <html>, então
// todo o bloco `.dark` de globals.css era código morto e o useTheme() de
// ui/sonner.tsx sempre caía no default.
//
// `attribute="class"` casa com o @custom-variant dark de globals.css.
// `disableTransitionOnChange` importa aqui porque a sidebar tem
// transition-[width] e o header tem backdrop-blur: sem ele, alternar o tema
// pinta um flash de transição de cor em toda a árvore.

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
