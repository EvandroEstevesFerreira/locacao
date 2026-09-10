"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { exigirModulo } from "@/lib/modulos";
import { transferirCustodiaSchema } from "@/lib/custodia";
import { registrarDevolucao, encerrarTermo } from "../../../termos/actions";

/**
 * A devolução do lado de quem entrega, feita a partir da PEÇA.
 *
 * "Vou herdar a máquina que era do André." Antes disso eram dois caminhos em
 * telas diferentes: caçar o termo ativo na lista de Termos, registrar a
 * devolução, encerrar; e só então voltar à peça para emitir o novo. Nada na
 * página da peça dizia que era esse o caminho — nem havia link para o termo.
 *
 * ┌─ CONTINUAM SENDO DOIS TERMOS ────────────────────────────────────────────┐
 * │ Esta action faz A PRIMEIRA METADE: encerra o termo de quem está com a    │
 * │ peça. A segunda — o termo de quem recebe — é a emissão normal, e é ela   │
 * │ que faz a posse nascer, como manda `custodia_funcionario_exige_termo`.   │
 * │                                                                          │
 * │ Não é uma transação: as duas assinaturas podem acontecer em dias         │
 * │ diferentes, e entre elas a peça fica DISPONÍVEL. O que liga uma ponta à  │
 * │ outra é o lembrete, não uma trava.                                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function devolverParaTransferir(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para transferir custódia.");
  }

  const parsed = transferirCustodiaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();

  // O TERMO É DESCOBERTO AQUI, não recebido da tela. Aceitar um `termo_id` do
  // cliente permitiria encerrar o termo de outra peça — e encerrar termo alheio
  // devolve para `disponivel` equipamento que está legitimamente com alguém.
  const { data: posse, error: erroPosse } = await supabase
    .from("custodia_peca")
    .select("termo_id, funcionario:funcionario_id(nome)")
    .eq("unidade_id", d.unidade_id)
    .is("fim", null)
    .eq("tipo", "funcionario")
    .maybeSingle();

  if (erroPosse) return falha("Não consegui ler a posse atual da peça.");
  if (!posse?.termo_id) {
    return falha(
      "Esta peça não está com nenhuma pessoa por termo aberto. Nada a devolver.",
    );
  }
  const termoId = posse.termo_id as string;

  // Os itens deste termo que ainda não voltaram. Um termo pode ter saído com
  // notebook e celular juntos; aqui devolve-se só o que esta peça representa.
  const { data: itens, error: erroItens } = await supabase
    .from("termo_equipamento_item")
    .select("id")
    .eq("termo_id", termoId)
    .eq("unidade_id", d.unidade_id)
    .is("data_devolucao", null);

  if (erroItens) return falha("Não consegui ler os itens do termo.");
  if (!itens?.length) {
    return falha("Esta peça já consta devolvida neste termo.");
  }

  const rDev = await registrarDevolucao(
    termoId,
    (itens as { id: string }[]).map((i) => ({
      item_id: i.id,
      data_devolucao: d.data_devolucao,
      estado_devolucao: d.estado_devolucao,
      observacoes: d.observacoes ?? undefined,
    })),
  );
  if (!rDev.ok) return rDev;

  const rEnc = await encerrarTermo(
    termoId,
    {
      funcionario: {
        nome: d.assinante,
        cpf: null,
        imagem: d.assinatura ?? null,
      },
      empresa: { nome: perfil.nome ?? "—", imagem: null },
    },
    d.motivo_sem_assinatura,
  );
  if (!rEnc.ok) return rEnc;

  // O LEMBRETE, e não uma reserva. A peça está disponível de verdade: se outra
  // pessoa levar antes, o lembrete deixa de valer sozinho — `lembreteValido`
  // confere a situação antes de mostrar.
  if (d.destinatario_id) {
    const { error } = await supabase
      .from("equipamento_unidade")
      .update({
        entrega_pendente_funcionario_id: d.destinatario_id,
        entrega_pendente_em: new Date().toISOString(),
      })
      .eq("id", d.unidade_id);
    if (error) {
      // Não derruba: a devolução ACONTECEU e é irreversível. Dizer que falhou
      // faria quem clicou tentar de novo sobre um termo já encerrado.
      console.error("devolverParaTransferir/lembrete", error);
      return {
        ok: true,
        aviso:
          "A devolução foi registrada, mas não consegui anotar para quem a peça vai. Emita o termo novo pela própria peça.",
      };
    }
  }

  revalidatePath(`/frota/${d.unidade_id}`);
  revalidatePath("/frota");
  revalidatePath("/termos");
  return { ok: true };
}

/** Desiste da entrega anotada. A peça continua disponível para quem for. */
export async function limparEntregaPendente(
  unidadeId: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  const semModulo = exigirModulo(perfil, "frota");
  if (semModulo) return falha(semModulo);
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para alterar a frota.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipamento_unidade")
    .update({
      entrega_pendente_funcionario_id: null,
      entrega_pendente_em: null,
    })
    .eq("id", unidadeId);

  if (error) return falha("Não consegui limpar o lembrete.");

  revalidatePath(`/frota/${unidadeId}`);
  revalidatePath("/frota");
  return { ok: true };
}
