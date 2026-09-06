"use server";

// Cadastro de frentes de serviço de uma obra.
//
// O cadastro é por obra e criado na hora de usar. Foi assim de propósito: não
// se sabia, ao desenhar, se as frentes da Sistenge são estáveis ou informais, e
// este formato serve aos dois casos — estáveis são cadastradas uma vez e
// reusadas; informais, cada obra cria o que precisa, quando precisa. Nenhum dos
// dois produz cadastro vazio.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { frenteSchema } from "@/lib/frente";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

function revalidar(obraId: string) {
  revalidatePath(`/obras/${obraId}`);
  // O seletor do item do contrato lê as frentes da obra; sem isto, uma frente
  // recém-criada não apareceria lá até a próxima navegação completa.
  revalidatePath("/contratos");
}

export async function salvarFrente(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar frentes.");
  }

  const parsed = frenteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, obra_id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("frente_obra")
        .update(campos)
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("frente_obra")
        .insert({ org_id: perfil.org_id, obra_id, ...campos })
        .select("id")
        .maybeSingle();

  if (error) {
    console.error("salvarFrente", error);
    // `23505` só pode ser `unique (obra_id, nome)`. Duas "Fundação" na mesma
    // obra seriam sempre erro de digitação — e a duplicata é justamente o que
    // separa um relatório por frente de uma lista de nomes parecidos.
    if ((error as { code?: string }).code === "23505") {
      return falha("Já existe uma frente com esse nome nesta obra.");
    }
    return falha("Não foi possível salvar a frente.");
  }

  revalidar(obra_id);
  return { ok: true, id: data?.id };
}

export async function excluirFrente(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir frentes." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const obraId = String(formData.get("obra_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();

  // Frente com item alocado não se exclui — DESATIVA-SE. A FK é
  // `on delete set null`, então excluir não quebraria nada: os itens só
  // perderiam a alocação em silêncio, e o custo voltaria a ser da obra sem que
  // ninguém entendesse por que o relatório por frente encolheu.
  const { count } = await supabase
    .from("item_locado")
    .select("id", { count: "exact", head: true })
    .eq("frente_id", id);
  if (count && count > 0) {
    return {
      error: `${count} ${count === 1 ? "item está alocado" : "itens estão alocados"} a esta frente. Desative-a em vez de excluir — assim ela some do seletor sem apagar o histórico do que consumiu.`,
    };
  }

  const { error } = await supabase.from("frente_obra").delete().eq("id", id);
  if (error) {
    console.error("excluirFrente", error);
    return { error: "Não foi possível excluir a frente." };
  }

  if (obraId) revalidar(obraId);
}
