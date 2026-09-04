"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { respostasSchema, corrigir, aprovado } from "@/lib/treinamento";
import { trilhaPorChave } from "@/lib/treinamento/index";

/**
 * O que a tela recebe de volta.
 *
 * Reprovar NÃO é erro de sistema: devolve as perguntas erradas com o porquê e a
 * aula a revisar, e a tela oferece tentar de novo. Só o `porque` e o id da aula
 * saem — nunca o índice correto, senão bastaria reprovar uma vez para colher o
 * gabarito.
 */
export type ResultadoQuestionario =
  | { ok: true; numeroRegistro: string | null }
  | {
      ok: false;
      erro: string;
      erradas?: { perguntaId: string; porque: string; aula: string }[];
    };

/**
 * Corrige o questionário e registra a conclusão.
 *
 * A CORREÇÃO É AQUI, no servidor, e é por isso que `Pergunta.correta` nunca vai
 * no payload da página. Um questionário cujas respostas chegam ao navegador é
 * decorativo — quem quiser passar sem ler abre o inspetor.
 */
export async function concluirTrilha(raw: unknown): Promise<ResultadoQuestionario> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { ok: false, erro: "Sessão inválida. Entre novamente." };

  const parsed = respostasSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, erro: primeiroErro(parsed.error.issues) };
  }

  const trilha = trilhaPorChave(parsed.data.trilha);
  if (!trilha) return { ok: false, erro: "Trilha não encontrada." };

  const correcao = corrigir(trilha, parsed.data.respostas);
  if (!aprovado(correcao)) {
    return {
      ok: false,
      erro:
        correcao.total - correcao.acertos === 1
          ? "Uma resposta não confere. Revise a aula indicada e tente de novo."
          : `${correcao.total - correcao.acertos} respostas não conferem. Revise as aulas indicadas e tente de novo.`,
      erradas: correcao.erradas.map((e) => ({
        perguntaId: e.pergunta.id,
        porque: e.pergunta.porque,
        aula: e.pergunta.aula,
      })),
    };
  }

  const supabase = await createClient();

  // O número só é gerado na primeira conclusão desta versão. Refazer a mesma
  // versão não gasta número novo — o comprovante é o mesmo documento.
  const { data: existente } = await supabase
    .from("treinamento_conclusao")
    .select("numero_registro")
    .eq("perfil_id", perfil.id)
    .eq("trilha", trilha.chave)
    .eq("versao", trilha.versao)
    .maybeSingle();

  let numero = (existente as { numero_registro: string | null } | null)?.numero_registro ?? null;

  if (!numero) {
    const ano = Number(hojeISOSaoPaulo().slice(0, 4));
    const { data, error } = await supabase.rpc("proximo_numero", {
      p_org: perfil.org_id,
      p_tipo: "treinamento_conclusao",
      p_ano: ano,
    });
    if (error || !data) {
      console.error("concluirTrilha/numero", error);
      return { ok: false, erro: "Não foi possível gerar o número do comprovante." };
    }
    numero = data as string;
  }

  const { error } = await supabase.from("treinamento_conclusao").upsert(
    {
      org_id: perfil.org_id,
      perfil_id: perfil.id,
      trilha: trilha.chave,
      versao: trilha.versao,
      acertos: correcao.acertos,
      total_perguntas: correcao.total,
      numero_registro: numero,
      // `concluido_em` NÃO entra no payload, e isso é deliberado: a coluna tem
      // `default now()` (migration 0063) e só é escrita na primeira conclusão
      // desta versão. Como `assinatura` e `assinado_ip` também ficam de fora,
      // refazer o questionário da mesma versão preserva o documento assinado —
      // se `concluido_em` fosse reescrito aqui, a declaração já assinada
      // ("respondi corretamente ... em {{concluido_em}}") passaria a exibir a
      // data da última visita, sem nova assinatura. A tentativa fica registrada
      // pelo trigger `trg_treinamento_updated_at`, em `updated_at`.
    },
    // Refazer a mesma versão atualiza a linha. Sem isto, dois cliques no botão
    // estourariam erro de chave única na cara de quem acabou de acertar tudo.
    { onConflict: "perfil_id,trilha,versao" },
  );

  if (error) {
    console.error("concluirTrilha/upsert", error);
    return { ok: false, erro: "Não foi possível registrar a conclusão." };
  }

  revalidatePath("/treinamento");
  revalidatePath(`/treinamento/${trilha.chave}`);
  revalidatePath("/treinamento/pendentes");
  return { ok: true, numeroRegistro: numero };
}

/**
 * Assina o comprovante de uma conclusão que já existe.
 *
 * Concluir e assinar são dois momentos de propósito: a conclusão é o fato
 * (acertou tudo), a assinatura é a declaração de que a pessoa leu e entendeu.
 * Exigir a assinatura para registrar a conclusão faria quem fechasse a aba
 * perder o resultado do questionário.
 */
export async function assinarComprovante(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");

  const trilhaChave = String(formData.get("trilha") ?? "").trim();
  const assinatura = String(formData.get("assinatura") ?? "").trim();
  if (!trilhaChave) return falha("Trilha inválida.");
  if (!assinatura) return falha("Assine o comprovante para concluir.");

  const trilha = trilhaPorChave(trilhaChave);
  if (!trilha) return falha("Trilha não encontrada.");

  const supabase = await createClient();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .update({ assinatura, assinado_ip: ip })
    .eq("perfil_id", perfil.id)
    .eq("trilha", trilha.chave)
    .eq("versao", trilha.versao)
    // `.select("id")` porque UPDATE barrado pela RLS devolve zero linhas SEM
    // erro, e a action diria sucesso sobre nada — foi o defeito da 0.50.0.
    .select("id");

  if (error) {
    console.error("assinarComprovante", error);
    return falha("Não foi possível gravar a assinatura.");
  }
  if (!data?.length) {
    return falha(
      "Conclua o questionário desta trilha antes de assinar o comprovante.",
    );
  }

  revalidatePath(`/treinamento/${trilha.chave}`);
  return { ok: true };
}
