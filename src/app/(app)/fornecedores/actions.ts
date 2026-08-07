"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { formatarCnpj, normalizarCnpj } from "@/lib/cnpj";
import { fornecedorSchema } from "@/lib/fornecedor";

/**
 * Salva fornecedor e sincroniza os vínculos com obras.
 *
 * `duplicado: true` no retorno é sinal para o formulário mostrar a caixa
 * "salvar mesmo assim": CNPJ repetido não é erro de validação, é uma decisão do
 * usuário — pode haver matriz e filial com o mesmo raiz.
 */
export async function salvarFornecedor(
  raw: unknown,
): Promise<ActionResult & { duplicado?: boolean }> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar fornecedores.");
  }

  const parsed = fornecedorSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, obras, confirmar_duplicado, cnpj, ...resto } = parsed.data;
  const cnpjNorm = cnpj ? normalizarCnpj(cnpj) : "";
  const dados = {
    ...resto,
    cnpj: cnpjNorm === "" ? null : formatarCnpj(cnpjNorm),
  };

  const supabase = await createClient();

  if (dados.cnpj && !confirmar_duplicado) {
    let dupQ = supabase.from("fornecedor").select("id, nome").eq("cnpj", dados.cnpj);
    if (id) dupQ = dupQ.neq("id", id);
    const { data: dups } = await dupQ.limit(1);
    if (dups && dups.length > 0) {
      return {
        ok: false,
        erro: `Já existe um fornecedor com este CNPJ: ${dups[0].nome}.`,
        duplicado: true,
      };
    }
  }

  let fornecedorId = id ?? null;
  if (id) {
    const { error } = await supabase.from("fornecedor").update(dados).eq("id", id);
    if (error) return falha("Não foi possível salvar. Tente novamente.");
  } else {
    const { data: criado, error } = await supabase
      .from("fornecedor")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !criado) return falha("Não foi possível salvar. Tente novamente.");
    fornecedorId = criado.id;
  }

  // Sincroniza os vínculos com obras (N:N).
  if (fornecedorId) {
    await supabase.from("fornecedor_obra").delete().eq("fornecedor_id", fornecedorId);
    if (obras.length > 0) {
      await supabase.from("fornecedor_obra").insert(
        obras.map((obra_id) => ({
          fornecedor_id: fornecedorId!,
          obra_id,
          org_id: perfil.org_id!,
        })),
      );
    }
  }

  revalidatePath("/fornecedores");
  return { ok: true, id: fornecedorId ?? undefined };
}

export async function excluirFornecedor(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir fornecedores." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("fornecedor").delete().eq("id", id);
  revalidatePath("/fornecedores");
}
