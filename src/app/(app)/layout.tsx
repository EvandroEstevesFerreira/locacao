import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
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
    .select("nome, email, papel")
    .eq("id", user.id)
    .single();

  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-[240px_1fr] md:grid-rows-1">
      {/* Barra lateral (desktop) */}
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">Loca</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar isMaster={perfil?.papel === "master"} />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Topo */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4">
          <span className="text-base font-semibold md:hidden">Loca</span>
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
            <Sidebar isMaster={perfil?.papel === "master"} />
          </div>
        </nav>
      </div>
    </div>
  );
}
