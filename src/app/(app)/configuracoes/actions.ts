"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { TIPOS_RELATORIO } from "@/lib/relatorios";

export type ConfigFormState = { error?: string; ok?: boolean };

const schema = z.object({
  ativo: z.boolean(),
  dias_alerta: z
    .array(z.number().int().min(0).max(365))
    .min(1, "Informe ao menos um prazo de aviso.")
    .max(6),
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

  // Prazos: aceita "30, 15, 3" (vírgula, ponto-e-vírgula ou espaço).
  // Remove duplicados e ordena do maior para o menor.
  const diasAlerta = Array.from(
    new Set(
      String(formData.get("dias_alerta") ?? "")
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(Number),
    ),
  )
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);

  const parsed = schema.safeParse({
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    dias_alerta: diasAlerta,
    destinatarios,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0];
    return {
      error:
        msg?.path[0] === "destinatarios"
          ? "Há um e-mail inválido na lista de destinatários."
          : msg?.path[0] === "dias_alerta"
            ? (msg?.message ??
              "Prazos inválidos. Use números entre 0 e 365, ex.: 30, 15, 3.")
            : (msg?.message ?? "Dados inválidos."),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("config_alerta").upsert({
    org_id: perfil.org_id,
    ativo: parsed.data.ativo,
    dias_alerta: parsed.data.dias_alerta,
    // mantém a coluna legada em sincronia (maior prazo)
    dias_antecedencia: Math.max(...parsed.data.dias_alerta),
    destinatarios: parsed.data.destinatarios,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/configuracoes");
  return { ok: true };
}

const schemaRelatorio = z.object({
  ativo: z.boolean(),
  tipo: z.enum(TIPOS_RELATORIO.map((t) => t.valor) as [string, ...string[]]),
  frequencia: z.enum(["semanal", "mensal"]),
  dia: z.coerce.number().int().min(1).max(28),
  destinatarios: z.array(z.string().email()),
});

export async function salvarConfigRelatorioEmail(
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

  const parsed = schemaRelatorio.safeParse({
    ativo: formData.get("ativo") === "on" || formData.get("ativo") === "true",
    tipo: formData.get("tipo"),
    frequencia: formData.get("frequencia"),
    dia: formData.get("dia"),
    destinatarios,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0];
    return {
      error:
        msg?.path[0] === "destinatarios"
          ? "Há um e-mail inválido na lista de destinatários."
          : msg?.path[0] === "dia"
            ? "Dia inválido. Use 1 a 7 (semanal) ou 1 a 28 (mensal)."
            : (msg?.message ?? "Dados inválidos."),
    };
  }

  // Coerência: no semanal, o dia vai de 1 a 7.
  if (parsed.data.frequencia === "semanal" && parsed.data.dia > 7) {
    return { error: "No modo semanal, o dia deve ser de 1 (segunda) a 7 (domingo)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("config_relatorio_email").upsert({
    org_id: perfil.org_id,
    ativo: parsed.data.ativo,
    tipo: parsed.data.tipo,
    frequencia: parsed.data.frequencia,
    dia: parsed.data.dia,
    destinatarios: parsed.data.destinatarios,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/configuracoes");
  return { ok: true };
}
