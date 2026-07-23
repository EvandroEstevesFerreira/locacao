import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Loca — Controle de Locações",
  description:
    "Controle de locações de materiais e equipamentos em obra da Sistenge.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Loca",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#5980a6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
