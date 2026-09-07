import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { configPeople, buscarPessoas, ErroPeople } from "./cliente";
import {
  mapearPessoa,
  proximoCursor,
  semRepetidas,
  ausentesNaVarredura,
  resolverColisoes,
} from "./mapeamento";

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
  /** Quantos vínculos deixaram de existir do lado do People. */
  ausentes: number;
  /** A rodada foi completa (e por isso pôde medir ausência). */
  completa: boolean;
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
  completa = false,
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
      ausentes: 0,
      completa: false,
    };
  }

  // Na varredura completa o `desde` é ignorado de propósito: é ela que traz o
  // recorte inteiro, e é só comparando com o inteiro que se enxerga quem sumiu.
  const desde = completa ? null : cursorAtual;

  try {
    const dePara = await deParaDeObra(supabase, orgId);
    const { pessoas, paginas } = await buscarPessoas(cfg, desde);

    // Repetida no mesmo lote derrubaria o upsert inteiro com "ON CONFLICT DO
    // UPDATE command cannot affect row a second time".
    const unicas = semRepetidas(pessoas);

    // Duas pessoas LEGÍTIMAS do People podem trazer o mesmo CPF — são os cinco
    // cadastros duplicados por bug de import. Sem isto, o lote inteiro morre no
    // índice único de CPF do Loca.
    const semColisao = resolverColisoes(unicas);
    const linhas = semColisao.map((p) => mapearPessoa(p, orgId, dePara, agoraISO));

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

    // SÓ A VARREDURA COMPLETA PODE MARCAR AUSÊNCIA. Vinda de um delta, uma
    // resposta vazia — que é o caso normal de um dia sem novidade — acusaria a
    // base inteira de ter sumido.
    const ausentes = completa
      ? await marcarAusentes(supabase, orgId, unicas.map((p) => p.id), agoraISO)
      : 0;

    return {
      ok: true,
      recebidas: pessoas.length,
      gravadas,
      paginas,
      cursor: proximoCursor(unicas, cursorAtual),
      erro: null,
      ausentes,
      completa,
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
      ausentes: 0,
      completa,
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
      // Só marca a varredura completa quando ela DEU CERTO. Marcar uma que
      // falhou empurraria a próxima por mais uma semana, e a ausência ficaria
      // invisível justamente depois de um problema.
      ...(r.completa && r.ok ? { ultima_varredura_completa: agoraISO } : {}),
    })
    .eq("org_id", orgId);

  // Não relança: a rodada em si pode ter dado certo, e derrubar aqui faria uma
  // sincronização bem-sucedida parecer um fracasso. Fica no log.
  return error?.message ?? null;
}

/**
 * Marca quem estava vinculado e não veio na varredura completa.
 *
 * MARCA, NÃO APAGA. A causa provável é o merge dos cadastros duplicados do lado
 * do People; mas pode ser também alguém que saiu do recorte de 2026. Apagar o
 * vínculo levaria junto o histórico de equipamento de uma pessoa que talvez
 * ainda esteja com ele — e essa é uma decisão de gente, não de cron.
 *
 * Também LIMPA a marca de quem voltou a aparecer: cadastro reativado ou
 * varredura anterior que pegou o People no meio de um deploy.
 */
async function marcarAusentes(
  supabase: SupabaseClient,
  orgId: string,
  recebidos: string[],
  agoraISO: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("funcionario")
    .select("id, people_id")
    .eq("org_id", orgId)
    .not("people_id", "is", null);

  if (error) return 0;

  const locais = (data ?? []) as { id: string; people_id: string }[];
  const porPeople = new Map(locais.map((f) => [f.people_id, f.id]));
  const sumidos = ausentesNaVarredura([...porPeople.keys()], recebidos);

  if (sumidos.length > 0) {
    await supabase
      .from("funcionario")
      .update({ ausente_no_people_em: agoraISO })
      .in("id", sumidos.map((pid) => porPeople.get(pid)!));
  }

  // Quem voltou: tira a marca.
  const voltaram = locais
    .filter((f) => recebidos.includes(f.people_id))
    .map((f) => f.id);
  if (voltaram.length > 0) {
    await supabase
      .from("funcionario")
      .update({ ausente_no_people_em: null })
      .in("id", voltaram)
      .not("ausente_no_people_em", "is", null);
  }

  return sumidos.length;
}
