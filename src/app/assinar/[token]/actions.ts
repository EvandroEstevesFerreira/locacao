"use server";

// A assinatura pela rota pública.
//
// ESTA ACTION RODA SEM SESSÃO. Não há `getCurrentPerfil()`, não há papel, não há
// organização no contexto — quem assina é justamente quem não tem login.
//
// A autorização É O TOKEN, e quem a impõe é o BANCO: `assinar_termo_por_link` é
// `security definer`, confere o CPF contra o funcionário daquele termo e queima
// o link, tudo numa transação. A aplicação nunca recebe um handle capaz de ler
// outra coisa. É por isso que não há `createAdminClient()` aqui: um handle admin
// genérico numa rota pública é a pior versão do furo que o AGENTS.md proíbe.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hashDoToken } from "@/lib/assinatura-servidor";
import { assinaturaLinkSchema } from "@/lib/assinatura-link";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

export async function assinarPeloLink(raw: unknown): Promise<ActionResult> {
  const token = String((raw as { token?: string })?.token ?? "").trim();
  if (!token) return falha("Link inválido.");

  const parsed = assinaturaLinkSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  // O IP é evidência acessória e pode vir sujo de qualquer intermediário. A
  // função no banco faz o cast com rede de proteção: IP malformado vira nulo e
  // NÃO custa a assinatura.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assinar_termo_por_link", {
    p_token_hash: hashDoToken(token),
    p_cpf: parsed.data.cpf,
    p_imagem: parsed.data.imagem ?? null,
    p_ip: ip,
  });

  if (error) {
    console.error("assinarPeloLink", error);
    return falha("Não foi possível registrar a assinatura. Tente novamente.");
  }

  const r = data as { ok?: boolean; motivo?: string; funcionario?: string } | null;
  if (!r?.ok) return falha(r?.motivo ?? "Não foi possível registrar a assinatura.");

  revalidatePath(`/assinar/${token}`);
  return { ok: true, aviso: r.funcionario ?? undefined };
}
