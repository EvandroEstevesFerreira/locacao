"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import {
  erroDeEscrita,
  falha,
  primeiroErro,
  type ActionResult,
} from "@/lib/acoes";
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
  //
  // As duas escritas descartavam o erro. O fornecedor era salvo, o `delete`
  // limpava os vínculos, o `insert` falhava — e o resultado era um fornecedor
  // que perdeu TODAS as obras, anunciado como "Fornecedor atualizado". Na
  // ordem em que acontece, o silêncio não deixa nem o estado anterior de pé.
  //
  // Zero linhas no `delete` é legítimo (fornecedor sem vínculo), por isso o
  // que se checa é o erro, não a contagem.
  let avisoObras: string | null = null;
  if (fornecedorId) {
    const { error: erroApagar } = await supabase
      .from("fornecedor_obra")
      .delete()
      .eq("fornecedor_id", fornecedorId);
    if (erroApagar) {
      console.error("salvarFornecedor/obras/apagar", erroApagar);
      avisoObras =
        "O fornecedor foi salvo, mas as obras dele não foram atualizadas.";
    } else if (obras.length > 0) {
      const { error: erroInserir } = await supabase.from("fornecedor_obra").insert(
        obras.map((obra_id) => ({
          fornecedor_id: fornecedorId!,
          obra_id,
          org_id: perfil.org_id!,
        })),
      );
      if (erroInserir) {
        console.error("salvarFornecedor/obras/inserir", erroInserir);
        avisoObras =
          "O fornecedor foi salvo, mas as obras dele não foram vinculadas. " +
          "Abra o cadastro e marque as obras de novo.";
      }
    }
  }

  revalidatePath("/fornecedores");
  // `ok: true` com `aviso`: o fornecedor foi salvo de verdade. Devolver
  // `ok: false` faria a pessoa salvar outra vez e criar um duplicado.
  return {
    ok: true,
    id: fornecedorId ?? undefined,
    aviso: avisoObras ?? undefined,
  };
}

export async function excluirFornecedor(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir fornecedores." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase.from("fornecedor").delete().eq("id", id).select("id"),
    {
      registro: "fornecedor",
      contexto: "excluirFornecedor",
      dica: "Deixe-o inativo na edição para preservar o histórico.",
    },
  );
  if (erro) return { error: erro };
  revalidatePath("/fornecedores");
}
