import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

// Inter para a interface, JetBrains Mono para números, valores e códigos.
// Os nomes das variáveis são --font-inter / --font-jetbrains-mono, e o mapa
// para --font-sans / --font-mono vive no @theme de globals.css. No Tailwind v4
// nomear a variável de fonte como --font-sans criaria auto-referência.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loca — Controle de Locações",
  description:
    "Controle de locações de materiais e equipamentos em obra da Sistenge.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Loca",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Antes era o vermelho #BE3A31. Na identidade Sistenge 2026 o vermelho é da
  // marca, não da interface — a cor da barra do sistema segue o slate-900, que
  // é o que public/manifest.webmanifest já declarava.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning é obrigatório com next-themes: o script dele
    // altera a className do <html> antes da hidratação.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* O Toaster fica DENTRO do provider: ui/sonner.tsx usa useTheme()
            para escolher a skin, e como irmão de {children} ficaria fora do
            contexto. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
