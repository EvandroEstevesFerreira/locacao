"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { funcionarioSchema } from "@/lib/termo";

export async function salvarFuncionario(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para cadastrar funcionários.");
  }

  const parsed = funcionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("funcionario")
        .update(parsed.data)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("funcionario")
        .insert({ org_id: perfil.org_id, ...parsed.data })
        .select("id")
        .single();

  if (error) {
    // 23505 = unique_violation. O único índice único é o do CPF.
    if (error.code === "23505") return falha("Já existe funcionário com esse CPF.");
    return falha("Não foi possível salvar o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true, id: data?.id };
}

export async function excluirFuncionario(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode excluir funcionários.");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return falha("Funcionário inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("funcionario").delete().eq("id", id);
  if (error) {
    // 23503 = foreign_key_violation: o funcionário tem termo. Não se apaga
    // quem tem histórico — desativa.
    if (error.code === "23503") {
      return falha("Este funcionário tem termos registrados. Desative-o em vez de excluir.");
    }
    return falha("Não foi possível excluir o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true };
}
