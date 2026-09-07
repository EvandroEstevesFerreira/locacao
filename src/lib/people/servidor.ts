import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { configPeople, buscarPessoas, ErroPeople } from "./cliente";
import { mapearPessoa, proximoCursor, semRepetidas } from "./mapeamento";

/**
 * A rodada de sincronização.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * RECEBE O `supabase` DE QUEM CHAMA, como manda o AGENTS.md para escrita
 * compartilhada entre grupos de rota: o cron passa o client admin (roda sem
 * sessão, não há RLS a respeitar) e a action passa o client do usuário, que
 * atravessa as policies de `funcionario`. Duplicar o escritor nos dois é como
 * as duas cópias divergem — e divergência numa base de pessoas aparece como
 * termo emitido para quem já foi desligado.
 */

/** Lotes do upsert. Acima disso o PostgREST começa a recusar por tamanho. */
const LOTE = 200;

export type ResultadoSync = {
  ok: boolean;
  recebidas: number;
  gravadas: number;
  paginas: number;
  cursor: string | null;
  erro: string | null;
};

/**
 * O de-para `codigo_people → obra_id`.
 *
 * Só entram as obras que alguém preencheu. Obra sem código do People
 * simplesmente não casa, e a pessoa fica com `obra_id` nulo — que é o
 * comportamento desenhado, não uma falha.
 */
async function deParaDeObra(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("obra")
    .select("id, codigo_people")
    .eq("org_id", orgId)
    .not("codigo_people", "is", null);

  if (error) throw new Error(`Não consegui ler o de-para de obra: ${error.message}`);

  const mapa = new Map<string, string>();
  for (const o of (data ?? []) as { id: string; codigo_people: string }[]) {
    mapa.set(o.codigo_people.trim(), o.id);
  }
  return mapa;
}

/**
 * Puxa o delta do People e grava.
 *
 * O CURSOR SÓ AVANÇA SE TUDO GRAVOU. Salvá-lo antes do upsert deixaria as
 * pessoas daquela janela para trás em definitivo: a rodada seguinte pediria
 * apenas o que mudou DEPOIS delas, e ninguém jamais saberia que faltaram.
 * Falhar e repetir a janela é barato; perdê-la é silencioso.
 */
export async function sincronizarPessoas(
  supabase: SupabaseClient,
  orgId: string,
  cursorAtual: string | null,
  agoraISO: string,
): Promise<ResultadoSync> {
  const cfg = configPeople();
  if (!cfg) {
    return {
      ok: false,
      recebidas: 0,
      gravadas: 0,
      paginas: 0,
      cursor: cursorAtual,
      erro: "PEOPLE_API_URL / PEOPLE_API_TOKEN não configurados.",
    };
  }

  try {
    const dePara = await deParaDeObra(supabase, orgId);
    const { pessoas, paginas } = await buscarPessoas(cfg, cursorAtual);

    // Repetida no mesmo lote derrubaria o upsert inteiro com "ON CONFLICT DO
    // UPDATE command cannot affect row a second time".
    const unicas = semRepetidas(pessoas);
    const linhas = unicas.map((p) => mapearPessoa(p, orgId, dePara, agoraISO));

    let gravadas = 0;
    for (let i = 0; i < linhas.length; i += LOTE) {
      const fatia = linhas.slice(i, i + LOTE);
      const { error } = await supabase
        .from("funcionario")
        // `people_id` é a chave, e o conflito é resolvido pelo índice único
        // `(org_id, people_id)` da 0094. NUNCA `insert` cego: o contrato avisa
        // que a mesma pessoa pode chegar duas vezes em varreduras diferentes.
        .upsert(fatia, { onConflict: "org_id,people_id" });

      if (error) {
        throw new Error(
          `Falha ao gravar o lote ${i / LOTE + 1}: ${error.message}`,
        );
      }
      gravadas += fatia.length;
    }

    return {
      ok: true,
      recebidas: pessoas.length,
      gravadas,
      paginas,
      cursor: proximoCursor(unicas, cursorAtual),
      erro: null,
    };
  } catch (e) {
    return {
      ok: false,
      recebidas: 0,
      gravadas: 0,
      paginas: 0,
      // O cursor NÃO ANDA quando algo falha: a janela inteira é tentada de novo
      // na próxima rodada.
      cursor: cursorAtual,
      erro:
        e instanceof ErroPeople
          ? `${e.codigo}: ${e.message}`
          : e instanceof Error
            ? e.message
            : "Erro desconhecido na sincronização.",
    };
  }
}

/** Grava o resultado da rodada em `people_sync`. */
export async function registrarRodada(
  supabase: SupabaseClient,
  orgId: string,
  r: ResultadoSync,
  agoraISO: string,
) {
  const { error } = await supabase
    .from("people_sync")
    .update({
      ultimo_atualizado_em: r.cursor,
      ultimo_sync_em: agoraISO,
      ultimo_erro: r.erro,
      pessoas_recebidas: r.gravadas,
      updated_at: agoraISO,
    })
    .eq("org_id", orgId);

  // Não relança: a rodada em si pode ter dado certo, e derrubar aqui faria uma
  // sincronização bem-sucedida parecer um fracasso. Fica no log.
  return error?.message ?? null;
}
