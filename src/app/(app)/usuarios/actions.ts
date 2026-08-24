"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentPerfil, PAPEL_INFO, type Papel } from "@/lib/auth";
import { criarUsuarioSchema, editarUsuarioSchema } from "@/lib/permissoes";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { normalizarModulos } from "@/lib/modulos";
import { enviarEmail, emailConfigurado } from "@/lib/email";
import { montarContexto, SELECT_ORGANIZACAO_EMAIL } from "@/lib/emails/contexto";
import { acessoCriado, senhaRedefinida } from "@/lib/emails/templates";

/**
 * Contexto de e-mail da organização — razão social e CNPJ para o rodapé.
 *
 * Client normal, não admin: `organizacao` é tabela da aplicação e o isolamento
 * por organização depende da RLS. O master lê a própria organização por policy.
 */
async function contextoEmail(orgId: string | null) {
  // `exigirMaster` já garante `org_id`, mas o tipo de `Perfil` continua anulável
  // e o TS não estreita entre funções. Tratar o nulo aqui é mais honesto que um
  // `!`: no pior caso o rodapé sai com o nome genérico, e nada quebra.
  if (!orgId) return montarContexto(null);
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizacao")
    .select(SELECT_ORGANIZACAO_EMAIL)
    .eq("id", orgId)
    .single();
  return montarContexto(org);
}

/** Só o master gere usuários. Retorna o perfil master ou null. */
async function exigirMaster() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || perfil.papel !== "master") return null;
  return perfil;
}

/**
 * Lista VAZIA de módulos vira `null`, que significa acesso a todos. Evita
 * trancar o usuário fora de tudo por não ter marcado nenhuma caixa.
 */
function modulosOuNull(marcados: string[]): string[] | null {
  const validos = normalizarModulos(marcados);
  return validos.length > 0 ? validos : null;
}

async function sincronizarObras(
  client: ReturnType<typeof createAdminClient>,
  perfilId: string,
  obras: string[],
) {
  await client.from("obra_usuario").delete().eq("perfil_id", perfilId);
  if (obras.length > 0) {
    await client
      .from("obra_usuario")
      .insert(obras.map((obra_id) => ({ obra_id, perfil_id: perfilId })));
  }
}

// ---------------------------------------------------------------------------
// Criar usuário (e-mail + senha temporária) — usa a API admin (service_role).
// ---------------------------------------------------------------------------
export async function criarUsuario(raw: unknown): Promise<ActionResult> {
  const master = await exigirMaster();
  if (!master) return falha("Apenas o Master pode criar usuários.");

  const parsed = criarUsuarioSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return falha(
      "Criação indisponível: falta a chave SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }

  const { data: criado, error: errAuth } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome },
  });
  if (errAuth || !criado?.user) {
    const jaExiste =
      errAuth?.message?.toLowerCase().includes("already") ||
      errAuth?.message?.toLowerCase().includes("registered");
    return falha(
      jaExiste
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível criar o usuário. Tente novamente.",
    );
  }

  const uid = criado.user.id;
  // O trigger handle_new_user já criou o perfil; ajustamos org/papel/nome/ativo.
  await admin
    .from("perfil")
    .update({
      org_id: master.org_id,
      papel: parsed.data.papel,
      nome: parsed.data.nome,
      ativo: true,
      modulos: modulosOuNull(parsed.data.modulos),
      senha_temporaria: true, // força troca no primeiro acesso
    })
    .eq("id", uid);

  await sincronizarObras(admin, uid, parsed.data.obras);

  // E-mail de boas-vindas com os dados de acesso (best-effort).
  if (emailConfigurado()) {
    try {
      await enviarEmail(
        [parsed.data.email],
        acessoCriado(
          {
            nome: parsed.data.nome,
            email: parsed.data.email,
            senha: parsed.data.senha,
            perfil: PAPEL_INFO[parsed.data.papel as Papel]?.label ?? parsed.data.papel,
          },
          await contextoEmail(master.org_id),
        ),
      );
    } catch (e) {
      console.error("Falha ao enviar e-mail de novo usuário:", e);
    }
  }

  revalidatePath("/usuarios");
  return { ok: true, id: uid };
}

// ---------------------------------------------------------------------------
// Excluir usuário (auth + perfil em cascata). Só master; nunca a si mesmo.
// ---------------------------------------------------------------------------
export async function excluirUsuario(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const master = await exigirMaster();
  if (!master) return { error: "Apenas o Master pode excluir usuários." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Usuário inválido." };
  if (id === master.id) {
    return { error: "Você não pode excluir o seu próprio acesso." };
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(id); // cascata remove perfil e vínculos
  } catch (e) {
    console.error("Falha ao excluir usuário:", e);
    return {
      error:
        "Não foi possível excluir. Verifique a chave SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  revalidatePath("/usuarios");
}

// ---------------------------------------------------------------------------
// Editar usuário — papel, nome, ativo, obras e (opcional) redefinir senha.
// ---------------------------------------------------------------------------
export async function salvarUsuario(raw: unknown): Promise<ActionResult> {
  const master = await exigirMaster();
  if (!master) return falha("Apenas o Master pode editar usuários.");

  const parsed = editarUsuarioSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { ativo } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfil")
    .update({
      papel: parsed.data.papel,
      nome: parsed.data.nome,
      ativo,
      modulos: modulosOuNull(parsed.data.modulos),
    })
    .eq("id", parsed.data.id);
  if (error) return falha("Não foi possível salvar. Tente novamente.");

  // Redefinição opcional de senha (via API admin).
  const novaSenha = parsed.data.nova_senha;
  if (novaSenha) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(parsed.data.id, {
        password: novaSenha,
      });
      // Nova senha definida pelo master é temporária: força troca no próximo acesso.
      await admin
        .from("perfil")
        .update({ senha_temporaria: true })
        .eq("id", parsed.data.id);
    } catch {
      return falha(
        "Perfil salvo, mas a senha não pôde ser redefinida (falta SUPABASE_SERVICE_ROLE_KEY).",
      );
    }

    // E-mail avisando a nova senha (best-effort).
    if (emailConfigurado()) {
      try {
        const { data: u } = await supabase
          .from("perfil")
          .select("email")
          .eq("id", parsed.data.id)
          .single();
        if (u?.email) {
          await enviarEmail(
            [u.email],
            senhaRedefinida(
              { nome: parsed.data.nome, email: u.email, senha: novaSenha },
              await contextoEmail(master.org_id),
            ),
          );
        }
      } catch (e) {
        console.error("Falha ao enviar e-mail de redefinição:", e);
      }
    }
  }

  // Sincroniza acesso por obra (usa client normal; master tem policy de gestão).
  const obras = parsed.data.obras;
  await supabase.from("obra_usuario").delete().eq("perfil_id", parsed.data.id);
  if (obras.length > 0) {
    await supabase
      .from("obra_usuario")
      .insert(obras.map((obra_id) => ({ obra_id, perfil_id: parsed.data.id })));
  }

  revalidatePath("/usuarios");
  return { ok: true, id: parsed.data.id };
}
