import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronsRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { moduloLiberado } from "@/lib/modulos";
import { navVisivel } from "@/lib/nav";
import type { Papel } from "@/lib/permissoes";
import { APP_VERSION } from "@/lib/changelog";
import { SistengeIcon, SistengeLogo } from "@/components/sistenge-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { BackButton } from "@/components/back-button";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { NavLink } from "@/components/layout/nav-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("nome, email, papel, modulos")
    .eq("id", user.id)
    .single();

  const isMaster = perfil?.papel === "master";
  const modulos = (perfil?.modulos as string[] | null) ?? null;
  const papel = (perfil?.papel ?? "gestor") as Papel;

  // Filtragem no server, uma vez por request. Antes rodava no client e duas
  // vezes (uma por árvore de navegação), e o bundle do cliente carregava a
  // entrada de /configuracoes para todo mundo.
  const itens = navVisivel(isMaster, (m) => moduloLiberado(modulos, isMaster, m));

  return (
    <div className="min-h-dvh bg-background">
      <ServiceWorkerRegister />

      {/* Sidebar desktop — 72px, expande a 240px no hover e no focus-within.
          `fixed` a tira do fluxo: a coluna principal compensa com um
          padding-left fixo de 72px, e a sidebar passa por cima do conteúdo ao
          expandir (padrão Linear/Vercel, adotado pelo Sistenge People). */}
      <aside
        className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-18
                   flex-col overflow-hidden border-r bg-card
                   transition-[width,box-shadow] duration-200 ease-out
                   hover:w-60 hover:shadow-md
                   focus-within:w-60 focus-within:shadow-md md:flex"
      >
        {/* Cross-fade entre o símbolo (colapsada) e o logotipo (expandida). */}
        <div className="relative flex h-16 shrink-0 items-center border-b px-5.5">
          <div className="absolute left-5.5 flex items-center transition-opacity duration-150 group-hover/sidebar:opacity-0 group-focus-within/sidebar:opacity-0">
            <SistengeIcon className="h-5.5 w-auto" />
          </div>
          <div className="flex items-center opacity-0 transition-opacity delay-75 duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <SistengeLogo className="h-6.5 w-auto" />
          </div>
        </div>

        <div className="scrollbar-sutil flex-1 overflow-x-hidden overflow-y-auto p-3.5">
          <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
            {itens.map((item) => (
              <div key={item.href} className="contents">
                {item.separadorAntes ? (
                  <div className="my-1.5 h-px bg-border" aria-hidden />
                ) : null}
                <NavLink href={item.href} label={item.label} icon={item.icon} />
              </div>
            ))}
          </nav>
        </div>

        {/* Rodapé: chevron sempre visível, versão só quando expandida. */}
        <Link
          href="/novidades"
          title={`Loca v${APP_VERSION} — novidades`}
          className="flex h-12 shrink-0 items-center gap-3.5 border-t px-3.5 font-mono
                     text-[11px] whitespace-nowrap text-muted-foreground
                     transition-colors hover:text-foreground focus-visible:ring-2
                     focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none"
        >
          <ChevronsRight className="size-4.5 shrink-0 opacity-70" aria-hidden />
          <span className="opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            Loca · v{APP_VERSION}
          </span>
        </Link>
      </aside>

      <div className="flex min-h-dvh flex-col md:pl-18">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav itens={itens} versao={APP_VERSION} />
            <Link
              href="/"
              aria-label="Loca — início"
              className="flex items-center md:hidden"
            >
              <SistengeIcon className="h-5 w-auto" />
            </Link>
            <BackButton className="hidden md:inline-flex" />
            <Breadcrumb />
          </div>

          {/* Zona do meio, só para a busca. Ela tem `w-full max-w-xs` e, no
              cluster da direita, esse `w-full` competiria por espaço e
              truncaria a saudação ao lado. */}
          <div className="flex flex-1 justify-end md:justify-center">
            <CommandPalette itens={itens} papel={papel} />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <span className="hidden max-w-45 truncate text-sm text-muted-foreground lg:inline">
              Olá, {(perfil?.nome ?? perfil?.email ?? "").split(" ")[0]}
            </span>
            <UserMenu
              nome={perfil?.nome ?? ""}
              email={perfil?.email ?? user.email ?? ""}
              papel={papel}
              versao={APP_VERSION}
            />
          </div>
        </header>

        {/* Sem `overflow-y-auto`: quem rola é o documento. Com ele, `main` viraria
            um segundo container de scroll — barra de rolagem dupla e momentum
            scroll quebrado no iOS. */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
