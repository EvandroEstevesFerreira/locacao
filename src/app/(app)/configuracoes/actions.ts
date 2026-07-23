"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";

export type ConfigFormState = { error?: string; ok?: boolean };

const schema = z.object({
  ativo: z.boolean(),
  dias_antecedencia: z.coerce.number().int().min(0).max(90),
  destinatarios: z.array(z.string().email()),
});

export async function salvarConfigAlerta(
  _prev: ConfigFormState,
  formData: FormData,
): Promise<ConfigFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeConfigurarSistema(perfil.papel)) {
    return { error: "Apenas o Master pode alterar as configurações." };
  }

  const destinatarios = String(formData.get("destinatarios") ?? "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = schema.safeParse({
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    dias_antecedencia: formData.get("dias_antecedencia"),
    destinatarios,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0];
    return {
      error:
        msg?.path[0] === "destinatarios"
          ? "Há um e-mail inválido na lista de destinatários."
          : (msg?.message ?? "Dados inválidos."),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("config_alerta").upsert({
    org_id: perfil.org_id,
    ativo: parsed.data.ativo,
    dias_antecedencia: parsed.data.dias_antecedencia,
    destinatarios: parsed.data.destinatarios,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/configuracoes");
  return { ok: true };
}
