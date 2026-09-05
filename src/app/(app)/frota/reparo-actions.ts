"use server";

// Ordem de reparo de equipamento — fase 2c.
//
// A ordem NÃO tem rascunho, ao contrário do recebimento e da devolução: ela
// nasce como documento numerado, porque é ela que AUTORIZA a peça a sair da
// obra. Um rascunho de autorização não autoriza nada.
//
// A situação da peça ('manutencao' / 'disponivel') NÃO é mexida aqui: é o
// trigger `sincronizar_situacao_peca` (migration 0068) que a segue. Se ela
// morasse na action, bastaria um caminho novo de escrita esquecer a linha para
// a peça ficar 'disponivel' com a máquina na oficina — e alguém a entregaria a
// um funcionário que iria procurá-la e não achar.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { reparoSchema } from "@/lib/reparo";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { buscarReparo } from "@/lib/data/reparos";

function revalidar(unidadeId: string, reparoId?: string) {
  revalidatePath("/frota/reparos");
  revalidatePath(`/frota/${unidadeId}`);
  if (reparoId) revalidatePath(`/frota/reparos/${reparoId}`);
}

export async function salvarReparo(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar ordens de reparo.");
  }

  const parsed = reparoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const supabase = await createClient();

  if (id) {
    // Ordem CONCLUÍDA não volta a ser editada. Ela registra um custo que já foi
    // pago e um serviço que já foi feito; para desfazer, cancele — o que
    // devolve a peça e deixa o rastro.
    const { data, error } = await supabase
      .from("reparo_equipamento")
      .update(campos)
      .eq("id", id)
      .neq("status", "concluido")
      .select("id");
    if (error) {
      console.error("salvarReparo(update)", error);
      return falha("Não foi possível salvar a ordem de reparo.");
    }
    if (!data || data.length === 0) {
      // Distingue "não existe" de "já concluída": a segunda tem conserto (o
      // usuário precisa saber que o caminho é cancelar), a primeira não.
      const atual = await buscarReparo(id);
      return falha(
        atual?.status === "concluido"
          ? "Esta ordem já foi concluída e não pode mais ser editada."
          : "Ordem de reparo não encontrada.",
      );
    }
    revalidar(campos.unidade_id, id);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("reparo_equipamento")
    .insert({ org_id: perfil.org_id, ...campos })
    .select("id")
    .single();
  if (error || !data) {
    console.error("salvarReparo(insert)", error);
    return falha("Não foi possível abrir a ordem de reparo.");
  }

  revalidar(campos.unidade_id, data.id);
  return { ok: true, id: data.id };
}

/**
 * Conclui a ordem.
 *
 * Existe separado de `salvarReparo` porque é o passo que devolve a peça ao
 * pátio: o trigger a tira de 'manutencao'. Pedir que a pessoa mude o status num
 * `<select>` no meio de um formulário de dez campos esconderia isso.
 */
export async function concluirReparo(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para concluir ordens de reparo.");
  }

  const id = String((raw as { id?: string })?.id ?? "").trim();
  const concluidoEm = String((raw as { concluido_em?: string })?.concluido_em ?? "").trim();
  const bruto = String((raw as { valor?: string })?.valor ?? "").trim();
  if (!id) return falha("Ordem não informada.");
  if (!concluidoEm) return falha("Informe a data em que o reparo foi concluído.");

  const valor = bruto ? Number(bruto.replace(",", ".")) : null;
  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
    return falha("Informe um valor válido, igual ou maior que zero.");
  }

  const reparo = await buscarReparo(id);
  if (!reparo) return falha("Ordem de reparo não encontrada.");
  if (reparo.status === "concluido") return falha("Esta ordem já foi concluída.");
  if (reparo.status === "cancelado") {
    return falha("Ordem cancelada não pode ser concluída. Abra uma nova.");
  }
  // A trava do banco (`reparo_concluido_tem_data`) pega a data faltando, mas
  // não pega a data ANTERIOR à saída — e voltar antes de sair é erro de
  // digitação que passaria em silêncio.
  if (reparo.enviado_em && concluidoEm < reparo.enviado_em) {
    return falha("A conclusão não pode ser anterior à saída da peça.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .update({
      status: "concluido",
      concluido_em: concluidoEm,
      ...(valor !== null ? { valor } : {}),
    })
    .eq("id", id)
    // Corrida: dois cliques não concluem duas vezes, e o trigger não devolve a
    // peça duas vezes.
    .neq("status", "concluido")
    .select("id");

  if (error) {
    console.error("concluirReparo", error);
    return falha("Não foi possível concluir a ordem.");
  }
  if (!data || data.length === 0) {
    return falha("Esta ordem já foi concluída por outra pessoa.");
  }

  revalidar(reparo.unidade_id, id);
  return {
    ok: true,
    id,
    aviso:
      "Ordem " +
      (reparo.numero_registro ?? "") +
      " concluída. A peça " +
      (reparo.unidadeIdentificador ?? "") +
      " voltou a ficar disponível.",
  };
}

export async function excluirReparo(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const id = String(formData.get("id") ?? "").trim();
  const unidadeId = String(formData.get("unidade_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_reparo_equipamento", {
    p_id: id,
  });
  if (error || data !== true) {
    return {
      error:
        "Não foi possível excluir. Ordem concluída não se exclui — cancele, para deixar o rastro.",
    };
  }

  if (unidadeId) revalidar(unidadeId);
}
