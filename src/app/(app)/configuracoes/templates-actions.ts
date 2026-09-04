"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { DOCUMENTOS, type TipoDocumento } from "@/lib/templates";

export type TemplateFormState = { error?: string; ok?: boolean };

const TIPOS = DOCUMENTOS.map((d) => d.tipo) as string[];

export async function salvarTemplate(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeConfigurarSistema(perfil.papel)) {
    return { error: "Apenas o Master pode editar templates." };
  }

  const tipo = String(formData.get("tipo") ?? "");
  if (!TIPOS.includes(tipo)) return { error: "Documento inválido." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const corpo = String(formData.get("corpo") ?? "").trim();
  const versao = String(formData.get("versao") ?? "").trim();
  if (!titulo) return { error: "Informe o título do documento." };
  if (!corpo) return { error: "O corpo do documento não pode ficar vazio." };
  if (!versao) return { error: "Informe a versão do documento." };
  if (!/^\d+(\.\d+)*$/.test(versao)) {
    return { error: "A versão deve ser numérica, como 1.3." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("documento_template").upsert(
    {
      org_id: perfil.org_id,
      tipo,
      titulo,
      corpo,
      versao,
      ativo: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,tipo" },
  );
  if (error) return { error: "Não foi possível salvar o template." };

  revalidatePath(`/configuracoes/templates/${tipo}`);
  return { ok: true };
}

/** Restaura o padrão: remove a linha salva (o PDF volta a usar o template do código). */
export async function restaurarTemplate(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeConfigurarSistema(perfil.papel)) return;
  const tipo = String(formData.get("tipo") ?? "");
  if (!TIPOS.includes(tipo)) return;
  const supabase = await createClient();
  // Zero linhas é LEGÍTIMO: a organização pode nunca ter customizado este
  // documento, e restaurar o padrão nesse caso é no-op. O que não pode é o
  // erro sumir — sem log, um template que insiste em voltar customizado não
  // tem por onde ser investigado.
  const { error: erroRestaurar } = await supabase
    .from("documento_template")
    .delete()
    .eq("org_id", perfil.org_id)
    .eq("tipo", tipo as TipoDocumento);
  if (erroRestaurar) console.error("restaurarPadrao", erroRestaurar);
  revalidatePath(`/configuracoes/templates/${tipo}`);
}
