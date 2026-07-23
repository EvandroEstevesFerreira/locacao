"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";

export type UsuarioFormState = { error?: string };

const usuarioSchema = z.object({
  id: z.string().uuid(),
  papel: z.enum(["admin", "gestor", "financeiro", "operacional", "visualizador"]),
});

async function exigirAdmin() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || perfil.papel !== "admin") return null;
  return perfil;
}

export async function salvarUsuario(
  _prev: UsuarioFormState,
  formData: FormData,
): Promise<UsuarioFormState> {
  const admin = await exigirAdmin();
  if (!admin) return { error: "Apenas administradores podem editar usuários." };

  const parsed = usuarioSchema.safeParse({
    id: formData.get("id"),
    papel: formData.get("papel"),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const ativo =
    formData.get("ativo") === "on" || formData.get("ativo") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfil")
    .update({ papel: parsed.data.papel, ativo })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  // Sincroniza o acesso por obra (checkboxes "obras").
  const obrasSelecionadas = formData.getAll("obras").map(String);
  await supabase.from("obra_usuario").delete().eq("perfil_id", parsed.data.id);
  if (obrasSelecionadas.length > 0) {
    await supabase.from("obra_usuario").insert(
      obrasSelecionadas.map((obra_id) => ({
        obra_id,
        perfil_id: parsed.data.id,
      })),
    );
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
