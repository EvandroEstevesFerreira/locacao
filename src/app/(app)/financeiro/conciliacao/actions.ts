"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { confirmarSchema, recusarSchema } from "@/lib/conciliacao";
import { darBaixa } from "../actions";

/**
 * A confirmação humana de uma sugestão do Mega.
 *
 * É AQUI, e só aqui, que a conciliação escreve no livro financeiro — com
 * sessão de usuário, sob as policies que `lancamento_financeiro` já exige. O
 * cron propõe; ninguém dá baixa sem alguém ter clicado.
 */
export async function confirmarSugestao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para dar baixa em lançamentos.");
  }

  const parsed = confirmarSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabaseLeitura = await createClient();
  const { data: sugestao, error: erroLeitura } = await supabaseLeitura
    .from("mega_conciliacao")
    .select("lancamento_id, status")
    .eq("id", d.id)
    .maybeSingle();

  if (erroLeitura || !sugestao) {
    return falha("Sugestão não encontrada.");
  }

  // `id` e `lancamentoId` chegam separados no mesmo payload do cliente, e um
  // não valida o outro sozinho. Sem conferir aqui, um usuário poderia mandar
  // o `id` da sugestão A junto com o `lancamentoId` de um lançamento Y
  // qualquer: a baixa aconteceria em Y, mas a fila registraria a sugestão A
  // como confirmada — a trilha de auditoria passaria a descrever uma baixa
  // que não foi essa.
  if (sugestao.lancamento_id !== d.lancamentoId) {
    return falha("Esta sugestão não corresponde a este lançamento.");
  }
  if (sugestao.status !== "sugerida") {
    return falha("Esta sugestão já foi decidida.");
  }

  // A BAIXA PRIMEIRO, o status depois. Se a ordem fosse a inversa e a baixa
  // falhasse, a sugestão sairia da fila sem o lançamento ter sido pago — e o
  // título ficaria quitado no Mega, pendente no Loca, e invisível para os dois.
  const baixa = await darBaixa({
    id: d.lancamentoId,
    valorPago: d.valorPago,
    multa: d.multa,
    juros: d.juros,
    // Sem `nfNumero`: a AUSÊNCIA da chave é o que faz `darBaixa` preservar a NF
    // do Loca. Mandar `null` apagaria o campo, que é o dano que se quer evitar.
    dataPagamento: d.dataPagamento,
  });
  if (!baixa.ok) return baixa;

  const supabase = await createClient();
  const { error } = await supabase
    .from("mega_conciliacao")
    .update({
      status: "confirmada",
      decidido_por: perfil.id,
      decidido_em: new Date().toISOString(),
    })
    .eq("id", d.id);

  if (error) {
    // A BAIXA JÁ ACONTECEU e não dá para desfazer daqui. Devolver `ok: false`
    // seria mentira: o lançamento está pago. O aviso existe para este caso.
    return {
      ok: true,
      id: d.id,
      aviso:
        "A baixa foi registrada, mas não consegui marcar a sugestão como confirmada. " +
        "Ela pode reaparecer na fila.",
    };
  }

  revalidatePath("/financeiro/conciliacao");
  // `revalidatePath` e não `router.refresh()`: a lista do financeiro também
  // ficou velha, e o refresh do cliente só re-busca a rota atual.
  revalidatePath("/financeiro");
  return { ok: true, id: d.id };
}

/** Recusar tira o título da fila — e é para isso que a tabela existe. */
export async function recusarSugestao(raw: unknown): Promise<ActionResult> {
  return mudarStatus(raw, "sugerida", "recusada", "recusar sugestões");
}

/**
 * Desfazer a recusa devolve o título à fila.
 *
 * Existe porque recusa é um clique, e um clique errado não pode apagar um
 * título para sempre. Não desfaz confirmação: essa mexeu no livro financeiro,
 * e desfazer baixa é outra operação, na tela do lançamento.
 */
export async function desfazerRecusa(raw: unknown): Promise<ActionResult> {
  return mudarStatus(raw, "recusada", "sugerida", "reabrir sugestões");
}

async function mudarStatus(
  raw: unknown,
  statusEsperado: "sugerida" | "recusada",
  status: "recusada" | "sugerida",
  oQue: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha(`Você não tem permissão para ${oQue}.`);
  }

  const parsed = recusarSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();

  // Recusar só vale a partir de "sugerida", e desfazer só a partir de
  // "recusada". Sem esta conferência, clicar duas vezes reprocessaria a
  // mesma transição e o `decidido_por`/`decidido_em` do primeiro clique
  // desapareceria em silêncio, sem que nada tivesse de fato mudado de estado.
  const { data: atual, error: erroLeitura } = await supabase
    .from("mega_conciliacao")
    .select("status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (erroLeitura || !atual) return falha("Sugestão não encontrada.");
  if (atual.status !== statusEsperado) {
    return falha("Esta sugestão já foi decidida.");
  }

  const { error } = await supabase
    .from("mega_conciliacao")
    .update({
      status,
      decidido_por: status === "recusada" ? perfil.id : null,
      decidido_em: status === "recusada" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) return falha("Não foi possível registrar a decisão.");

  revalidatePath("/financeiro/conciliacao");
  return { ok: true, id: parsed.data.id };
}
