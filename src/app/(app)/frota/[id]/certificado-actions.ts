"use server";

// Lançamento e exclusão de certificado da peça.
//
// O arquivo já subiu quando estas actions rodam: o upload é do cliente, com a
// mesma RLS de storage dos outros anexos. O que chega aqui é o CAMINHO, e o
// contrato é o inverso do usual — se a gravação falhar, quem chamou apaga o
// objeto, senão o bucket acumula PDF órfão que nenhuma tela encontra.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { certificadoSchema } from "@/lib/certificado";

async function guarda() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { erro: "Sessão inválida. Entre novamente." };
  if (!podeOperar(perfil.papel)) {
    return { erro: "Você não tem permissão para lançar certificados." };
  }
  return { orgId: perfil.org_id };
}

function revalidar(unidadeId: string) {
  revalidatePath(`/frota/${unidadeId}`);
  revalidatePath("/frota");
}

/**
 * Lança um certificado na peça.
 *
 * NÃO substitui o anterior — insere mais um. O acúmulo é o recurso: a inspeção
 * de 2025 tem de continuar existindo depois que a de 2026 for lançada, porque é
 * dela que a fiscalização pergunta.
 */
export async function registrarCertificado(
  raw: unknown,
  arquivoPath: string | null,
): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const parsed = certificadoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const c = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificado_equipamento")
    .insert({
      org_id: g.orgId,
      unidade_id: c.unidade_id,
      especie: c.especie,
      emitido_em: c.emitido_em,
      vence_em: c.vence_em,
      numero: c.numero,
      responsavel: c.responsavel,
      arquivo_path: arquivoPath,
      observacoes: c.observacoes,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("registrarCertificado", error);
    return falha("Não foi possível registrar o certificado.");
  }

  revalidar(c.unidade_id);
  return { ok: true, id: data.id };
}

/**
 * Exclui um certificado.
 *
 * `soft_delete`, nunca `.update({ deleted_at })`: a policy de SELECT esconde
 * linhas com `deleted_at`, e o Postgres a aplica também à linha NOVA de um
 * UPDATE, abortando o próprio comando (incidente da 0.19.4).
 *
 * O PDF fica no bucket de propósito. Excluir o registro é quase sempre conserto
 * de digitação, e apagar o arquivo junto tornaria irreversível o que devia ser
 * só uma correção — o `audit_log` guarda a linha, e o caminho com ela.
 */
export async function excluirCertificado(
  id: string,
  unidadeId: string,
): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "certificado_equipamento",
    p_id: id,
  });

  // `soft_delete` devolve true/false: `error` nulo com `data` false quer dizer
  // que nenhuma linha casou — outra organização, ou já excluído.
  if (error || data !== true) {
    console.error("excluirCertificado", error, data);
    return falha("Não foi possível excluir o certificado.");
  }

  revalidar(unidadeId);
  return { ok: true, id };
}
