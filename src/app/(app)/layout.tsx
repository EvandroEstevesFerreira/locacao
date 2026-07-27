import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PAPEL_INFO, type Papel } from "@/lib/permissoes";
import { APP_VERSION } from "@/lib/changelog";
import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { BackButton } from "@/components/back-button";
import { ServiceWorkerRegister } from "@/components/sw-register";

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

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-[240px_1fr] md:grid-rows-1">
      <ServiceWorkerRegister />
      {/* Barra lateral (desktop) */}
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="border-b px-4 py-4">
          <div className="font-heading text-xl leading-none font-semibold tracking-wide">
            SISTENGE
          </div>
          <div className="eyebrow mt-1.5">Locações de obra</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar isMaster={isMaster} modulos={modulos} />
        </div>
        {/* Rodapé: usuário logado + perfil + sair */}
        <div className="border-t p-3">
          <Link
            href="/perfil"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {(perfil?.nome ?? perfil?.email ?? "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium">
                {perfil?.nome ?? perfil?.email ?? "Usuário"}
              </span>
              <span className="block text-xs text-primary">
                {PAPEL_INFO[(perfil?.papel ?? "gestor") as Papel]?.label ??
                  perfil?.papel}
              </span>
            </span>
          </Link>
          <div className="mt-1 flex items-center gap-1">
            <Link
              href="/perfil"
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              <UserRound className="size-4" /> Meu perfil
            </Link>
            <form action="/auth/signout" method="post" className="flex-1">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> Sair
              </button>
            </form>
          </div>
          <Link
            href="/novidades"
            className="mt-2 block px-2 text-xs text-muted-foreground hover:text-primary"
          >
            Loca v{APP_VERSION} · Novidades
          </Link>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Topo */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <BackButton />
          <span className="font-heading text-lg font-semibold tracking-wide md:hidden">
            SISTENGE
          </span>
          <div className="ml-auto">
            <UserMenu
              nome={perfil?.nome ?? ""}
              email={perfil?.email ?? user.email ?? ""}
              papel={perfil?.papel ?? "gestor"}
            />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>

        {/* Navegação inferior (mobile) */}
        <nav className="border-t bg-card md:hidden">
          <div className="overflow-x-auto">
            <Sidebar isMaster={isMaster} modulos={modulos} />
          </div>
        </nav>
      </div>
    </div>
  );
}
