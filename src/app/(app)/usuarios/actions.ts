"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentPerfil, PAPEIS } from "@/lib/auth";

export type UsuarioFormState = { error?: string };

const papelSchema = z.enum(PAPEIS as unknown as [string, ...string[]]);

/** Só o master gere usuários. Retorna o perfil master ou null. */
async function exigirMaster() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || perfil.papel !== "master") return null;
  return perfil;
}

function obrasDoForm(formData: FormData) {
  return formData.getAll("obras").map(String).filter(Boolean);
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
const criarSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  email: z.string().trim().email("E-mail inválido."),
  papel: papelSchema,
  senha: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
});

export async function criarUsuario(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const master = await exigirMaster();
  if (!master) return { error: "Apenas o Master pode criar usuários." };

  const parsed = criarSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    papel: formData.get("papel"),
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "Criação indisponível: falta a chave SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    };
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
    return {
      error: jaExiste
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível criar o usuário. Tente novamente.",
    };
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
    })
    .eq("id", uid);

  await sincronizarObras(admin, uid, obrasDoForm(formData));

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

// ---------------------------------------------------------------------------
// Editar usuário — papel, nome, ativo, obras e (opcional) redefinir senha.
// ---------------------------------------------------------------------------
const editarSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1, "Informe o nome.").max(120),
  papel: papelSchema,
});

export async function salvarUsuario(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const master = await exigirMaster();
  if (!master) return { error: "Apenas o Master pode editar usuários." };

  const parsed = editarSchema.safeParse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    papel: formData.get("papel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ativo =
    formData.get("ativo") === "on" || formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfil")
    .update({ papel: parsed.data.papel, nome: parsed.data.nome, ativo })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  // Redefinição opcional de senha (via API admin).
  const novaSenha = String(formData.get("nova_senha") ?? "").trim();
  if (novaSenha) {
    if (novaSenha.length < 8) {
      return { error: "A nova senha deve ter ao menos 8 caracteres." };
    }
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(parsed.data.id, {
        password: novaSenha,
      });
    } catch {
      return {
        error:
          "Perfil salvo, mas a senha não pôde ser redefinida (falta SUPABASE_SERVICE_ROLE_KEY).",
      };
    }
  }

  // Sincroniza acesso por obra (usa client normal; master tem policy de gestão).
  const obras = obrasDoForm(formData);
  await supabase.from("obra_usuario").delete().eq("perfil_id", parsed.data.id);
  if (obras.length > 0) {
    await supabase
      .from("obra_usuario")
      .insert(obras.map((obra_id) => ({ obra_id, perfil_id: parsed.data.id })));
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
