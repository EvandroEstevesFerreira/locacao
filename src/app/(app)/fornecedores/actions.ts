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
/**
 * O índice único do código do Mega, dito em português.
 *
 * Repetir a mensagem crua do Postgres não ajuda: a saída aqui não é "tente de
 * novo", é descobrir qual das duas linhas é a empresa de verdade. O `ARMASA`
 * está duas vezes no Loca com o mesmo CNPJ, e as duas casam com o código 4114.
 */
function erroDeCodigoRepetido(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" && Boolean(error.message?.includes("codigo_mega"));
}

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

  const { id, obras, contatos, confirmar_duplicado, cnpj, ...resto } = parsed.data;
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
    if (error && erroDeCodigoRepetido(error)) {
      return falha(
        "Já existe outro fornecedor com este código do Mega. Dois cadastros apontando para o mesmo agente são a mesma empresa duas vezes — desative o que sobra antes de gravar o código aqui.",
      );
    }
    if (error) return falha("Não foi possível salvar. Tente novamente.");
  } else {
    const { data: criado, error } = await supabase
      .from("fornecedor")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error && erroDeCodigoRepetido(error)) {
      return falha(
        "Já existe outro fornecedor com este código do Mega. Dois cadastros apontando para o mesmo agente são a mesma empresa duas vezes — desative o que sobra antes de gravar o código aqui.",
      );
    }
    if (error || !criado) return falha("Não foi possível salvar. Tente novamente.");
    fornecedorId = criado.id;
  }

  // Sincroniza os CONTATOS.
  //
  // Apaga e reinsere, em vez de casar linha por linha. Duas razões: nada aponta
  // para `fornecedor_contato` (não há FK a preservar), e é o que torna o
  // "um principal" trivial — o índice único parcial proibiria duas linhas
  // principais coexistindo, e num `update` linha a linha a ordem passaria por
  // esse estado. Inserindo o lote de uma vez, com um só `principal: true`, o
  // estado intermediário não existe.
  //
  // O erro das DUAS escritas é conferido. Foi a lição da sincronia de obras
  // logo abaixo: o `delete` limpava, o `insert` falhava, e o resultado era um
  // fornecedor que perdeu todos os vínculos — anunciado como "atualizado".
  let avisoContatos: string | null = null;
  if (fornecedorId) {
    const { error: erroApagar } = await supabase
      .from("fornecedor_contato")
      .delete()
      .eq("fornecedor_id", fornecedorId);
    if (erroApagar) {
      console.error("salvarFornecedor/contatos/apagar", erroApagar);
      avisoContatos =
        "O fornecedor foi salvo, mas os contatos dele não foram atualizados.";
    } else if (contatos.length > 0) {
      const { error: erroInserir } = await supabase
        .from("fornecedor_contato")
        .insert(
          contatos.map((c) => ({
            org_id: perfil.org_id!,
            fornecedor_id: fornecedorId!,
            nome: c.nome,
            cargo: c.cargo,
            telefone: c.telefone,
            principal: c.principal,
          })),
        );
      if (erroInserir) {
        console.error("salvarFornecedor/contatos/inserir", erroInserir);
        avisoContatos =
          "O fornecedor foi salvo, mas os contatos não foram gravados — a lista ficou vazia. Abra o cadastro e refaça.";
      }
    }
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
  // Os DOIS avisos, e não só um: obras e contatos falham por caminhos
  // independentes, e mostrar apenas o primeiro esconderia metade do que não
  // ficou salvo.
  const avisos = [avisoObras, avisoContatos].filter(Boolean);
  return {
    ok: true,
    id: fornecedorId ?? undefined,
    aviso: avisos.length > 0 ? avisos.join(" ") : undefined,
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
