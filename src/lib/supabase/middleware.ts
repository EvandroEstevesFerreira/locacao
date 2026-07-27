import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { moduloDaRota, moduloLiberado } from "@/lib/modulos";

/**
 * Renova a sessão do usuário a cada requisição e protege rotas.
 * Rotas públicas: /login, /auth/*. Todo o resto exige usuário autenticado.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: não insira código entre o createServerClient e o getClaims().
  // Um erro aqui pode causar logout aleatório dos usuários.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const isPublic =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Acesso modular por usuário + onboarding (troca forçada de senha).
  // Mutações (server actions/POST) já são protegidas por papel + RLS.
  // Fail-open: qualquer erro de leitura não tranca o usuário.
  if (user && request.method === "GET") {
    const uid = user.sub as string | undefined;
    const modulo = moduloDaRota(request.nextUrl.pathname);
    const naTrocaSenha = request.nextUrl.pathname.startsWith("/trocar-senha");
    if (uid && (modulo || !naTrocaSenha)) {
      const { data: perfil } = await supabase
        .from("perfil")
        .select("papel, modulos, senha_temporaria")
        .eq("id", uid)
        .single();

      // Senha temporária: força a troca antes de qualquer outra navegação.
      if (perfil?.senha_temporaria && !naTrocaSenha) {
        const url = request.nextUrl.clone();
        url.pathname = "/trocar-senha";
        url.search = "";
        return NextResponse.redirect(url);
      }

      if (perfil && modulo) {
        const isMaster = perfil.papel === "master";
        const modulos = (perfil.modulos as string[] | null) ?? null;
        if (!moduloLiberado(modulos, isMaster, modulo)) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
