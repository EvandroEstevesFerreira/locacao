import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de autenticação por link de e-mail (recuperação de senha,
 * confirmação, etc.). O link do Supabase redireciona para cá com `?code=`;
 * trocamos o código por uma sessão (cookies) e seguimos para `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Sem código ou falha na troca: manda para o login com aviso.
  return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
}
